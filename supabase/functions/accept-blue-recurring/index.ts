import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCEPT_BLUE_BASE = "https://api.sandbox.accept.blue/api/v2";

function getBasicAuth(): string {
  const sourceKey = Deno.env.get("ACCEPT_BLUE_SOURCE_KEY")!.trim();
  const pin = Deno.env.get("ACCEPT_BLUE_PIN")!.trim();
  return btoa(`${sourceKey}:${pin}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      return await createRecurring(body, user.id, supabase);
    } else if (action === "cancel") {
      return await cancelRecurring(body, user.id, supabase);
    } else if (action === "list") {
      return await listRecurring(user.id);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use: create, cancel, list" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Recurring error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function createRecurring(
  body: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const { card, amount, frequency, title, plan } = body as {
    card: { nonce?: string; source?: string };
    amount: number;
    frequency: string; // monthly, weekly, yearly
    title?: string;
    plan?: string;
  };

  if (!card || !amount || !frequency) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: card, amount, frequency" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Map frequency to accept.blue schedule params
  const scheduleMap: Record<string, { frequency: string; period: number }> = {
    weekly: { frequency: "weekly", period: 1 },
    biweekly: { frequency: "weekly", period: 2 },
    monthly: { frequency: "monthly", period: 1 },
    quarterly: { frequency: "monthly", period: 3 },
    yearly: { frequency: "monthly", period: 12 },
  };

  const schedule = scheduleMap[frequency] || scheduleMap.monthly;

  // Calculate next billing date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Start tomorrow
  const nextDate = startDate.toISOString().split("T")[0];

  const payload: Record<string, unknown> = {
    amount: Number(amount),
    schedule: {
      frequency: schedule.frequency,
      period: schedule.period,
      start_date: nextDate,
    },
    title: title || "Subscription",
    active: true,
  };

  if (card.nonce) {
    payload.source = `nonce-${card.nonce}`;
    if (card.expiry_month) payload.expiry_month = card.expiry_month;
    if (card.expiry_year) payload.expiry_year = card.expiry_year;
    if (card.avs_zip) payload.avs_zip = card.avs_zip;
  } else if (card.source) {
    payload.source = card.source;
  }

  const response = await fetch(`${ACCEPT_BLUE_BASE}/recurring-schedules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getBasicAuth()}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("accept.blue recurring error:", result);
    return new Response(JSON.stringify({ error: "Failed to create recurring schedule", details: result }), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update subscription table
  const planName = (plan as string) || "basic";
  const planConfig: Record<string, { limit: number; price: number }> = {
    basic: { limit: 100, price: Number(amount) },
    pro: { limit: 500, price: Number(amount) },
    unlimited: { limit: 999999, price: Number(amount) },
  };

  const config = planConfig[planName] || planConfig.basic;

  await supabase
    .from("subscriptions")
    .update({
      plan: planName as "basic" | "pro" | "unlimited",
      recipe_limit: config.limit,
      price_monthly: config.price,
      is_active: true,
      next_billing_date: nextDate,
      payment_method: `accept_blue_schedule:${result.id}`,
    })
    .eq("user_id", userId);

  return new Response(JSON.stringify({ success: true, schedule: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cancelRecurring(
  body: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const { schedule_id } = body as { schedule_id: string };

  if (!schedule_id) {
    return new Response(
      JSON.stringify({ error: "Missing schedule_id" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const response = await fetch(
    `${ACCEPT_BLUE_BASE}/recurring-schedules/${schedule_id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${getBasicAuth()}`,
      },
    }
  );

  const resultText = await response.text();

  if (!response.ok) {
    console.error("accept.blue cancel error:", resultText);
    return new Response(
      JSON.stringify({ error: "Failed to cancel schedule" }),
      {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Reset subscription to free
  await supabase
    .from("subscriptions")
    .update({
      plan: "free" as const,
      recipe_limit: 25,
      price_monthly: 0,
      is_active: true,
      next_billing_date: null,
      payment_method: null,
    })
    .eq("user_id", userId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listRecurring(userId: string) {
  // Note: accept.blue doesn't filter by customer on list endpoint,
  // so we rely on our local subscription data for user-specific info
  const response = await fetch(`${ACCEPT_BLUE_BASE}/recurring-schedules`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
    },
  });

  const result = await response.json();

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
