import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCEPT_BLUE_BASE = (
  Deno.env.get("ACCEPT_BLUE_API_BASE_URL")?.trim() ||
  "https://api.develop.accept.blue/api/v2"
).replace(/\/$/, "");

function getBasicAuth(): string {
  const sourceKey = Deno.env.get("ACCEPT_BLUE_API_SOURCE_KEY")?.trim();
  const pin = Deno.env.get("ACCEPT_BLUE_PIN")?.trim();

  if (!sourceKey || !pin) {
    throw new Error("Missing ACCEPT_BLUE_API_SOURCE_KEY or ACCEPT_BLUE_PIN");
  }

  return btoa(`${sourceKey}:${pin}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
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
    const { amount, card, name, description } = body;

    // card should contain tokenization result:
    // { nonce: "...", expiry_month: N, expiry_year: N, avs_zip: "..." }
    // or a saved card: { source: "card-ref-..." }
    if (!amount || !card) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: amount, card" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chargePayload: Record<string, unknown> = {
      amount: Number(amount),
      ...(name ? { name } : {}),
    };

    if (card.nonce) {
      chargePayload.source = `nonce-${card.nonce}`;
      if (card.expiry_month) chargePayload.expiry_month = card.expiry_month;
      if (card.expiry_year) chargePayload.expiry_year = card.expiry_year;
      if (card.avs_zip) chargePayload.avs_zip = card.avs_zip;
    } else if (card.source) {
      chargePayload.source = card.source;
    }

    const response = await fetch(`${ACCEPT_BLUE_BASE}/transactions/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${getBasicAuth()}`,
      },
      body: JSON.stringify(chargePayload),
    });

    const responseText = await response.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("accept.blue non-JSON response:", responseText);
      return new Response(
        JSON.stringify({ error: "Payment gateway error", details: responseText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!response.ok) {
      console.error("accept.blue charge error:", result);
      return new Response(JSON.stringify({ error: "Payment failed", details: result }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If successful, record in billing_history
    if (result.status === "approved" || result.status_code === 1) {
      const invoiceNumber = `INV-${Date.now()}`;
      await supabase.from("billing_history").insert({
        user_id: user.id,
        amount: Number(amount),
        invoice_number: invoiceNumber,
        plan: description || "one-time",
        status: "paid",
        payment_method: "card",
        description: description || "One-time payment",
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Charge error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
