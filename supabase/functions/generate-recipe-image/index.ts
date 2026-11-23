import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Generates a photo for a saved recipe and stores it on the row. Paid plans only:
// each image costs real money, and the apps' paywall copy lists this as a paid feature.
//
// POST { recipe_id } with the user's JWT → { image_url } | { error, code }
//   code "plan_required"  → caller shows the upgrade hint, not an error.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const IMAGE_MODEL = "google/gemini-2.5-flash-image";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in to generate photos" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);
    if (user.is_anonymous) return json({ error: "AI photos are part of paid plans.", code: "plan_required" }, 403);

    const { recipe_id } = await req.json();
    if (!recipe_id || typeof recipe_id !== "string") return json({ error: "recipe_id is required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Plan gate: an active subscription on anything but the free tier.
    const { data: sub } = await admin.from("subscriptions").select("plan, is_active").eq("user_id", user.id).maybeSingle();
    const paid = !!sub && sub.is_active && sub.plan !== "free";
    if (!paid) return json({ error: "AI photos are part of paid plans.", code: "plan_required" }, 403);

    const { data: recipe, error: recipeError } = await admin
      .from("recipes")
      .select("id, user_id, title, description, category, ingredients")
      .eq("id", recipe_id)
      .maybeSingle();
    if (recipeError || !recipe) return json({ error: "Recipe not found" }, 404);
    if (recipe.user_id !== user.id) return json({ error: "Not your recipe" }, 403);

    const ingredientNames = (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
      .map((i: any) => (typeof i === "string" ? i : i?.name))
      .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 8)
      .join(", ");
    const prompt =
      `A photograph of the finished dish "${recipe.title}"` +
      (recipe.description ? `: ${recipe.description}` : "") +
      (ingredientNames ? `. Key ingredients: ${ingredientNames}.` : ".") +
      ` Plated and ready to eat, natural light, shallow depth of field, overhead or 45-degree angle, ` +
      `simple neutral background, appetizing, realistic food photography. No text, no watermark, no people, no hands.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("OpenRouter error", response.status, text);
      throw new Error("The image service is unavailable right now");
    }
    const data = await response.json();
    const dataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl || !dataUrl.startsWith("data:")) throw new Error("No image came back");

    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) throw new Error("Unexpected image format");
    const contentType = match[1].toLowerCase();
    const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1].replace("+xml", "");
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));

    // Same bucket and folder as user-uploaded photos; one file per recipe so a regenerate replaces it.
    const path = `${user.id}/ai-${recipe.id}.${ext}`;
    const { error: uploadError } = await admin.storage.from("recipe-images").upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw new Error(`Could not store the photo: ${uploadError.message}`);
    const { data: pub } = admin.storage.from("recipe-images").getPublicUrl(path);
    // Cache-bust so a regenerated photo shows up instead of the old one.
    const imageUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await admin
      .from("recipes")
      .update({ image_url: imageUrl, image_is_ai: true })
      .eq("id", recipe.id);
    if (updateError) throw new Error(updateError.message);

    return json({ image_url: imageUrl });
  } catch (e) {
    console.error("generate-recipe-image", e);
    return json({ error: e instanceof Error ? e.message : "Failed to generate a photo" }, 500);
  }
});
