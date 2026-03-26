import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCEPT_BLUE_BASE = "https://api.sandbox.accept.blue/api/v2";

function getBasicAuth(): string {
  const sourceKey = Deno.env.get("ACCEPT_BLUE_SOURCE_KEY")!;
  const pin = Deno.env.get("ACCEPT_BLUE_PIN")!;
  return btoa(`${sourceKey}:${pin}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This endpoint returns a tokenization key/nonce config
    // The frontend will use accept.blue's hosted tokenization JS
    // to collect card details and get back a nonce
    const body = await req.json();
    const { action } = body;

    if (action === "get-tokenization-key") {
      // Return the source key for the hosted tokenization form
      // The source key is a publishable key safe for frontend use
      const sourceKey = Deno.env.get("ACCEPT_BLUE_SOURCE_KEY")!.trim();
      return new Response(
        JSON.stringify({
          tokenization_source: sourceKey,
          sandbox: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "save-card") {
      // Save a card using a nonce for future use
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { nonce, name, customer_id } = body;
      if (!nonce) {
        return new Response(
          JSON.stringify({ error: "Missing nonce" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const payload: Record<string, unknown> = {
        nonce,
        ...(name ? { name } : {}),
        ...(customer_id ? { customer_id } : {}),
      };

      const response = await fetch(`${ACCEPT_BLUE_BASE}/saved-cards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${getBasicAuth()}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("accept.blue save-card error:", result);
        return new Response(
          JSON.stringify({ error: "Failed to save card", details: result }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: get-tokenization-key, save-card" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Tokenize error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
