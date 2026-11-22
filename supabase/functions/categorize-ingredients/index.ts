import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "Produce",
  "Meats",
  "Dairy",
  "Beverages",
  "Cereal",
  "Dry Goods",
  "Canned Goods",
  "Bread",
  "Frozen",
  "Snacks",
  "Condiments & Spices",
  "Other",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients } = await req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: "ingredients array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Canonical spelling for the lookup table and the response: lowercased, trimmed, single
    // spaces. The mobile apps already send their canonical keys; the website sends names.
    const norm = (n: string) => String(n ?? "").toLowerCase().trim().replace(/\s+/g, " ");
    const wanted = Array.from(new Set(ingredients.map(norm).filter(Boolean)));

    // 1. Shared table: foods anyone has asked about before are answered without AI.
    const base = Deno.env.get("SUPABASE_URL") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const known: Record<string, string> = {};
    if (base && service && wanted.length) {
      try {
        const q = wanted.map(k => `"${k.replace(/"/g, '\\"')}"`).join(",");
        const r = await fetch(`${base}/rest/v1/ingredient_aisles?select=item_key,aisle&item_key=in.(${encodeURIComponent(q)})`, {
          headers: { apikey: service, Authorization: `Bearer ${service}` },
        });
        if (r.ok) for (const row of await r.json()) known[row.item_key] = row.aisle;
      } catch (e) { console.error("ingredient_aisles lookup failed", e); }
    }
    const unknown = wanted.filter(k => !known[k]);
    const hit = Object.keys(known);
    if (base && service && hit.length) {
      // fire-and-forget; a failed counter must never slow a list down
      const q = hit.map(k => `"${k.replace(/"/g, '\\"')}"`).join(",");
      fetch(`${base}/rest/v1/rpc/bump_ingredient_hits`, {
        method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ keys: hit }),
      }).catch(() => {});
      void q;
    }
    if (unknown.length === 0) {
      return new Response(
        JSON.stringify({ categories: known }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Categorize each ingredient into exactly one grocery store aisle category.

Categories: ${CATEGORIES.join(", ")}

Rules:
- "Produce" = fresh fruits, vegetables, herbs (fresh basil, cilantro, parsley, ginger root)
- "Meats" = all raw/fresh meat, poultry, fish, seafood (chicken, beef, salmon, shrimp, bacon, sausage)
- "Dairy" = milk, cheese, butter, cream, eggs, yogurt
- "Beverages" = drinks, juices, sodas, coffee, tea, water, wine, beer
- "Cereal" = breakfast cereals, oats, granola
- "Dry Goods" = rice, basmati rice, pasta, noodles, quinoa, couscous, flour, sugar, baking supplies, nuts, seeds, dried fruits, bouillon, cornstarch, baking powder/soda, cocoa, chocolate chips, dried beans, lentils
- "Canned Goods" = canned/jarred items, broth, stock, canned beans, canned tomatoes, coconut milk (canned)
- "Bread" = bread, buns, rolls, tortillas, pita, naan, bagels, wraps
- "Frozen" = frozen foods, ice cream, frozen vegetables, frozen pizza
- "Snacks" = chips, crackers, pretzels, popcorn, cookies, candy, snack bars, trail mix, jerky, fruit snacks
- "Condiments & Spices" = all spices, seasonings, dried herbs, salt, pepper, oils, vinegars, sauces, dressings, honey, syrups, mustard, ketchup, mayo, hot sauce, soy sauce, extracts
- "Other" = anything that doesn't fit above (cleaning supplies, paper goods, etc.)

Important: Spice names that sound like produce (e.g. "cayenne pepper", "garlic powder", "onion powder") are "Condiments & Spices", NOT "Produce".

Ingredients to categorize:
${unknown.map((name: string, i: number) => `${i + 1}. ${name}`).join("\n")}

Also decide whether each entry is a COMMON GROCERY ITEM: a generic food or household product
anyone could buy at a supermarket (e.g. "egg", "sharp cheddar cheese", "paper towels").
It is NOT common if it is a brand or store name, a dish or recipe ("grandma's casserole"),
a note or instruction, a person's own label, gibberish, or not a purchasable thing.

Respond with ONLY a JSON array of objects with "name", "category" and "common" (true/false) fields. No explanation.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a grocery categorization expert. Respond only with valid JSON. Use short category names only, do not repeat the full ingredient text." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI categorization failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Try to parse, recovering from truncated arrays
    let categorized: any[] | null = null;
    try {
      categorized = JSON.parse(cleaned);
    } catch {
      const startIdx = cleaned.indexOf("[");
      const sliced = startIdx >= 0 ? cleaned.slice(startIdx) : cleaned;
      try {
        categorized = JSON.parse(sliced);
      } catch {
        // Extract individual complete objects from a possibly-truncated array
        const objects: any[] = [];
        const objRegex = /\{[^{}]*\}/g;
        let m;
        while ((m = objRegex.exec(sliced)) !== null) {
          try { objects.push(JSON.parse(m[0])); } catch { /* skip */ }
        }
        if (objects.length > 0) categorized = objects;
      }
    }

    if (!categorized || !Array.isArray(categorized)) {
      console.error("Could not parse AI response:", content.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse categorization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a map for easy lookup
    const categoryMap: Record<string, string> = { ...known };
    const learned: { item_key: string; aisle: string; source: string }[] = [];
    for (const item of categorized) {
      const name = norm(item.name || "");
      const cat = CATEGORIES.includes(item.category) ? item.category : "Other";
      if (!name) continue;
      categoryMap[name] = cat;
      // Guard rail for the shared table: only a common, well-formed grocery item is written,
      // and only when the model actually placed it ("Other" is the model shrugging).
      // Everything still gets an answer for THIS request; it just isn't taught to everyone.
      const wellFormed = /^[a-z][a-z' -]{1,48}$/.test(name) && name.split(" ").length <= 4;
      if (cat !== "Other" && item.common === true && wellFormed && unknown.includes(name)) {
        learned.push({ item_key: name, aisle: cat, source: "ai" });
      }
    }

    // 2. Remember the new answers in the shared table (service role; clients can't write it).
    if (base && service && learned.length) {
      try {
        await fetch(`${base}/rest/v1/ingredient_aisles?on_conflict=item_key`, {
          method: "POST",
          headers: {
            apikey: service, Authorization: `Bearer ${service}`,
            "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates",
          },
          body: JSON.stringify(learned),
        });
      } catch (e) { console.error("ingredient_aisles write failed", e); }
    }

    return new Response(
      JSON.stringify({ categories: categoryMap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Categorization error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
