import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const keys = [
    "ACCEPT_BLUE_API_SOURCE_KEY",
    "ACCEPT_BLUE_SOURCE_KEY",
    "ACCEPT_BLUE_PIN",
  ];

  const result: Record<string, string> = {};
  for (const k of keys) {
    const v = Deno.env.get(k);
    result[k] = v ? `SET (${v.length} chars, starts: ${v.substring(0, 4)}...)` : "NOT SET";
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
