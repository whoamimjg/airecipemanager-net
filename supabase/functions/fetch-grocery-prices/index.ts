// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const KROGER_CLIENT_ID = Deno.env.get("KROGER_CLIENT_ID");
const KROGER_CLIENT_SECRET = Deno.env.get("KROGER_CLIENT_SECRET");
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Apify actor IDs per store. Override via env if you swap actors.
const APIFY_ACTORS: Record<string, string> = {
  aldi: Deno.env.get("APIFY_ACTOR_ALDI") ?? "NfjOkthTaB3R22JVr",
  meijer: Deno.env.get("APIFY_ACTOR_MEIJER") ?? "outstanding_vegetable~meijer-scraper",
  giant_eagle: Deno.env.get("APIFY_ACTOR_GIANT_EAGLE") ?? "chimerical_quicklime~gianteagle-products-scraper",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type PriceResult = {
  price: number | null;
  productName: string | null;
  productSize: string | null;
  currency: string;
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ----- Kroger -----
let krogerToken: { token: string; expiresAt: number } | null = null;

async function getKrogerToken(): Promise<string> {
  if (krogerToken && krogerToken.expiresAt > Date.now() + 30_000) {
    return krogerToken.token;
  }
  const basic = btoa(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`);
  const res = await fetch("https://api.kroger.com/v1/connect/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });
  if (!res.ok) throw new Error(`Kroger token error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  krogerToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  };
  return krogerToken.token;
}

async function getKrogerLocationId(zip: string, token: string): Promise<string | null> {
  // Widen search to 100 miles (Kroger API max) so rural / non-Kroger-dominant
  // ZIPs still find the nearest banner store.
  const url = `https://api.kroger.com/v1/locations?filter.zipCode.near=${zip}&filter.radiusInMiles=100&filter.limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`Kroger locations ${res.status}: ${text}`);
    return null;
  }
  const data = JSON.parse(text);
  const first = data?.data?.[0];
  const locId = first?.locationId ?? null;
  console.log(`Kroger location for ZIP ${zip}: ${locId} (${first?.name ?? "n/a"}, ${first?.address?.city ?? ""})`);
  return locId;
}

async function fetchKrogerPrice(term: string, locationId: string, token: string): Promise<PriceResult> {
  const url = `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`Kroger products ${res.status} for "${term}": ${text}`);
    return { price: null, productName: null, productSize: null, currency: "USD" };
  }
  const data = JSON.parse(text);
  const p = data?.data?.[0];
  const item = p?.items?.[0];
  const price = item?.price?.promo || item?.price?.regular || null;
  if (!price) {
    console.log(`Kroger no price for "${term}" at ${locationId}. Items: ${JSON.stringify(p?.items ?? [])}`);
  }
  return {
    price: price ?? null,
    productName: p?.description ?? null,
    productSize: item?.size ?? null,
    currency: "USD",
  };
}


// ----- Apify -----
async function fetchApifyPrice(store: "aldi" | "meijer" | "giant_eagle", term: string, zip: string): Promise<PriceResult> {
  const actorId = APIFY_ACTORS[store];
  if (!actorId || !APIFY_API_TOKEN) {
    return { price: null, productName: null, productSize: null, currency: "USD" };
  }

  // Per-actor input shapes.
  let input: Record<string, any> = {};
  if (store === "aldi") {
    // eneiromatos/ultimate-aldi-scraper takes a keywords array.
    // Aldi US pricing does not vary materially by ZIP, so we ignore it here.
    input = {
      keywords: [term],
      startPageNumber: 1,
      finalPageNumber: 1,
    };
  } else if (store === "meijer") {
    // outstanding_vegetable/meijer-scraper does NOT support search terms — it
    // crawls the full site and times out for per-item lookups. Best-effort.
    input = {
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"], apifyProxyCountry: "US" },
    };
  } else if (store === "giant_eagle") {
    input = { search: term, zipCode: zip, maxItems: 1 };
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}&timeout=45`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    console.warn(`Apify ${store} error ${res.status}: ${await res.text().catch(() => "")}`);
    return { price: null, productName: null, productSize: null, currency: "USD" };
  }
  const items = await res.json().catch(() => []);
  const first = Array.isArray(items) ? items[0] : null;
  if (!first) return { price: null, productName: null, productSize: null, currency: "USD" };

  // Try a bunch of common field names
  const rawPrice =
    first.price ?? first.salePrice ?? first.currentPrice ?? first.regularPrice ??
    first.priceCurrent ?? first.priceValue ?? first.price_value ?? null;
  let price: number | null = null;
  if (typeof rawPrice === "number") price = rawPrice;
  else if (typeof rawPrice === "string") {
    const m = rawPrice.replace(/,/g, "").match(/[\d.]+/);
    price = m ? parseFloat(m[0]) : null;
  } else if (rawPrice && typeof rawPrice === "object") {
    price = rawPrice.value ?? rawPrice.amount ?? null;
  }

  return {
    price,
    productName: first.title ?? first.name ?? first.productName ?? null,
    productSize: first.size ?? first.unitOfMeasure ?? null,
    currency: first.currency ?? "USD",
  };
}

async function fetchOne(store: string, name: string, zip: string, krogerCtx: { token?: string; locationId?: string | null }): Promise<PriceResult> {
  try {
    if (store === "kroger") {
      if (!krogerCtx.token || !krogerCtx.locationId) {
        return { price: null, productName: null, productSize: null, currency: "USD" };
      }
      return await fetchKrogerPrice(name, krogerCtx.locationId, krogerCtx.token);
    }
    return await fetchApifyPrice(store as any, name, zip);
  } catch (e) {
    console.error(`fetchOne ${store} ${name} failed:`, e);
    return { price: null, productName: null, productSize: null, currency: "USD" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const items: Array<{ key: string; name: string }> = body.items ?? [];
    const store: string = body.store;
    const zip: string = (body.zip ?? "").toString().trim();

    const validStores = ["kroger", "aldi", "meijer", "giant_eagle"];
    if (!validStores.includes(store)) {
      return new Response(JSON.stringify({ error: "Invalid store" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!zip || !/^\d{5}$/.test(zip)) {
      return new Response(JSON.stringify({ error: "Valid 5-digit ZIP required. Set it in Account settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ prices: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Read cache for these items
    const itemKeys = items.map((i) => normalizeKey(i.name));
    const { data: cacheRows } = await supabase
      .from("grocery_price_cache")
      .select("item_key, price, product_name, product_size, currency, fetched_at")
      .eq("store", store)
      .eq("zip_code", zip)
      .in("item_key", itemKeys);

    const cacheMap = new Map<string, any>();
    const now = Date.now();
    for (const row of cacheRows ?? []) {
      const age = now - new Date(row.fetched_at).getTime();
      if (age < CACHE_TTL_MS) cacheMap.set(row.item_key, row);
    }

    // 2. Fetch missing ones
    const toFetch = items.filter((i) => !cacheMap.has(normalizeKey(i.name)));

    let krogerCtx: { token?: string; locationId?: string | null } = {};
    if (store === "kroger" && toFetch.length > 0) {
      if (!KROGER_CLIENT_ID || !KROGER_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Kroger credentials not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = await getKrogerToken();
      const locationId = await getKrogerLocationId(zip, token);
      krogerCtx = { token, locationId };
    }

    // Run sequentially to be gentle on rate limits
    const fetched: Record<string, PriceResult> = {};
    for (const item of toFetch) {
      const key = normalizeKey(item.name);
      const result = await fetchOne(store, item.name, zip, krogerCtx);
      fetched[key] = result;
      // Upsert to cache ONLY when we got a real price; never poison cache with nulls.
      if (result.price != null) {
        await supabase.from("grocery_price_cache").upsert(
          {
            item_key: key,
            store,
            zip_code: zip,
            price: result.price,
            product_name: result.productName,
            product_size: result.productSize,
            currency: result.currency,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "item_key,store,zip_code" },
        );
      }

    }

    // 3. Build response keyed by original item.key
    const prices: Record<string, any> = {};
    for (const item of items) {
      const nk = normalizeKey(item.name);
      const cached = cacheMap.get(nk);
      const r = cached ?? fetched[nk];
      if (r) {
        prices[item.key] = {
          price: r.price,
          productName: r.product_name ?? r.productName ?? null,
          productSize: r.product_size ?? r.productSize ?? null,
          currency: r.currency ?? "USD",
          cached: !!cached,
        };
      }
    }

    return new Response(JSON.stringify({ store, zip, prices }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-grocery-prices error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
