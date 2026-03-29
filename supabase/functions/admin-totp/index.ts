import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TOTP } from "https://esm.sh/otpauth@9.3.1";
import { encode as base32Encode } from "https://esm.sh/hi-base32@0.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["whoamimjg50@gmail.com"];

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user || !ADMIN_EMAILS.includes(user.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { action, code } = body;

    switch (action) {
      case "setup": {
        // Check if already set up
        const { data: existing } = await adminClient
          .from("admin_totp")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (existing?.is_verified) {
          return new Response(JSON.stringify({ already_setup: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generate a new secret
        const randomBytes = new Uint8Array(20);
        crypto.getRandomValues(randomBytes);
        const secret = base32Encode(randomBytes).replace(/=/g, "");

        // Upsert the secret
        await adminClient.from("admin_totp").upsert(
          { user_id: user.id, totp_secret: secret, is_verified: false },
          { onConflict: "user_id" }
        );

        const totp = new TOTP({
          issuer: "AI Appetite Aid Admin",
          label: user.email ?? "admin",
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: secret,
        });

        return new Response(
          JSON.stringify({ otpauth_url: totp.toString(), secret }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify-setup": {
        const { data: record } = await adminClient
          .from("admin_totp")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!record) {
          return new Response(JSON.stringify({ error: "No TOTP setup found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const totp = new TOTP({
          issuer: "AI Appetite Aid Admin",
          label: user.email ?? "admin",
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: record.totp_secret,
        });

        const delta = totp.validate({ token: code, window: 1 });
        if (delta === null) {
          return new Response(JSON.stringify({ valid: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient
          .from("admin_totp")
          .update({ is_verified: true })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ valid: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify": {
        const { data: record } = await adminClient
          .from("admin_totp")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!record || !record.is_verified) {
          return new Response(JSON.stringify({ error: "TOTP not set up", needs_setup: true }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const totp = new TOTP({
          issuer: "AI Appetite Aid Admin",
          label: user.email ?? "admin",
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: record.totp_secret,
        });

        const delta = totp.validate({ token: code, window: 1 });
        return new Response(JSON.stringify({ valid: delta !== null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const { data: record } = await adminClient
          .from("admin_totp")
          .select("is_verified")
          .eq("user_id", user.id)
          .single();

        return new Response(
          JSON.stringify({ is_setup: record?.is_verified ?? false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
