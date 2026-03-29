import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["ADMIN_EMAIL_PLACEHOLDER"]; // Will be updated with real email

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and check admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to query all data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    let data;

    switch (endpoint) {
      case "overview": {
        const [profiles, subscriptions, billing, recipes] = await Promise.all([
          adminClient.from("profiles").select("*"),
          adminClient.from("subscriptions").select("*"),
          adminClient.from("billing_history").select("*").order("date", { ascending: false }),
          adminClient.from("recipes").select("user_id, is_ai_generated, created_at"),
        ]);

        const totalUsers = profiles.data?.length ?? 0;
        const subs = subscriptions.data ?? [];
        const planCounts: Record<string, number> = {};
        let totalRevenue = 0;
        let activeSubscribers = 0;

        for (const s of subs) {
          planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1;
          if (s.plan !== "free" && s.is_active) {
            activeSubscribers++;
            totalRevenue += Number(s.price_monthly);
          }
        }

        // Signups over time (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const signupsByDay: Record<string, number> = {};
        for (const p of profiles.data ?? []) {
          const day = p.created_at.split("T")[0];
          if (new Date(day) >= thirtyDaysAgo) {
            signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
          }
        }

        const totalRecipes = recipes.data?.length ?? 0;
        const aiRecipes = recipes.data?.filter((r: any) => r.is_ai_generated).length ?? 0;

        data = {
          totalUsers,
          activeSubscribers,
          monthlyRevenue: totalRevenue,
          planCounts,
          totalRecipes,
          aiRecipes,
          signupsByDay,
          recentPayments: (billing.data ?? []).slice(0, 10),
        };
        break;
      }

      case "users": {
        const [profiles, subscriptions, recipeStats] = await Promise.all([
          adminClient.from("profiles").select("*").order("created_at", { ascending: false }),
          adminClient.from("subscriptions").select("*"),
          adminClient.from("recipes").select("user_id"),
        ]);

        const subMap: Record<string, any> = {};
        for (const s of subscriptions.data ?? []) {
          subMap[s.user_id] = s;
        }

        const recipeCountMap: Record<string, number> = {};
        for (const r of recipeStats.data ?? []) {
          recipeCountMap[r.user_id] = (recipeCountMap[r.user_id] ?? 0) + 1;
        }

        data = (profiles.data ?? []).map((p: any) => ({
          ...p,
          subscription: subMap[p.user_id] ?? null,
          recipeCount: recipeCountMap[p.user_id] ?? 0,
        }));
        break;
      }

      case "payments": {
        const { data: billing } = await adminClient
          .from("billing_history")
          .select("*")
          .order("date", { ascending: false });

        // Join with profiles
        const userIds = [...new Set((billing ?? []).map((b: any) => b.user_id))];
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);

        const profileMap: Record<string, any> = {};
        for (const p of profiles ?? []) {
          profileMap[p.user_id] = p;
        }

        data = (billing ?? []).map((b: any) => ({
          ...b,
          user_display_name: profileMap[b.user_id]?.display_name ?? "Unknown",
          user_email: profileMap[b.user_id]?.email ?? "Unknown",
        }));
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
