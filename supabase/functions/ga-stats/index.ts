import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["whoamimjg50@gmail.com"];

// --- Google service-account auth (RS256 JWT -> OAuth access token) ---
function b64url(input: string | Uint8Array): string {
  let bin = "";
  if (typeof input === "string") bin = btoa(input);
  else {
    let s = "";
    for (const byte of input) s += String.fromCharCode(byte);
    bin = btoa(s);
  }
  return bin.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function runReport(token: string, propertyId: string, body: unknown): Promise<any> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`GA API error: ${json.error?.message ?? JSON.stringify(json)}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const propertyId = Deno.env.get("GA_PROPERTY_ID");
    const saJson = Deno.env.get("GA_SERVICE_ACCOUNT_JSON");
    if (!propertyId || !saJson) {
      return new Response(
        JSON.stringify({ error: "Analytics not configured. Set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "28")));
    const startDate = `${days}daysAgo`;

    const token = await getAccessToken(saJson);

    // Per-day time series (active users, page views, sessions)
    const series = await runReport(token, propertyId, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });
    // Top pages by views
    const top = await runReport(token, propertyId, {
      dateRanges: [{ startDate, endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    });

    const byDay = (series.rows ?? []).map((r: any) => {
      const d = r.dimensionValues[0].value; // YYYYMMDD
      return {
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        users: Number(r.metricValues[0].value),
        pageViews: Number(r.metricValues[1].value),
        sessions: Number(r.metricValues[2].value),
      };
    });
    const totals = byDay.reduce(
      (acc: any, d: any) => ({
        users: acc.users + d.users,
        pageViews: acc.pageViews + d.pageViews,
        sessions: acc.sessions + d.sessions,
      }),
      { users: 0, pageViews: 0, sessions: 0 },
    );
    const topPages = (top.rows ?? []).map((r: any) => ({
      path: r.dimensionValues[0].value,
      views: Number(r.metricValues[0].value),
    }));

    return new Response(JSON.stringify({ days, totals, byDay, topPages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
