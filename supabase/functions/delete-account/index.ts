import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify identity
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Use service role to delete all user data and then the auth user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user data from all tables
    await adminClient.from("meal_plans").delete().eq("user_id", userId);
    await adminClient.from("inventory_items").delete().eq("user_id", userId);
    await adminClient.from("recipes").delete().eq("user_id", userId);
    await adminClient.from("subscriptions").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // Delete avatar files from storage
    const { data: avatarFiles } = await adminClient.storage
      .from("avatars")
      .list(userId);
    if (avatarFiles && avatarFiles.length > 0) {
      const filePaths = avatarFiles.map((f) => `${userId}/${f.name}`);
      await adminClient.storage.from("avatars").remove(filePaths);
    }

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
