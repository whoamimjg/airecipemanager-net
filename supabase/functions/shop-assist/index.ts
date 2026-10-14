// Helper for the Chrome shopping extension. Signed-in users only (an OAuth
// access token from the extension, or a normal session token); the public key
// alone is not enough, so nobody can spend AI credits anonymously.
//
//   pick             choose the product tile that best matches a list item (Gemini)
//   infer_selectors  read a page outline and return CSS selectors for its tiles (Gemini)
//   get_adapter      selectors previously learned or taught for a store host
//   save_adapter     remember selectors for a host (service role; RLS keeps clients read-only)
//
// The AI never sees the user's whole list or account; only the one item being
// shopped and the product tiles on screen. Diet restrictions are passed so a
// substitute never breaks them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL = "google/gemini-3-flash-preview";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Candidate = { index: number; name: string; price: number | null; priceText: string | null; size: string | null; unitPrice: string | null; brand: string | null; addLabel: string; unavailable: boolean };
type Item = { key: string; name: string; quantity?: string; unit?: string; note?: string };

const normHost = (h: string) => String(h || "").toLowerCase().replace(/^www\./, "").slice(0, 120);
const SELECTOR_KEYS = ["searchInput", "productCard", "name", "price", "size", "addButton"] as const;
const cleanSelectors = (s: Record<string, unknown> | null | undefined) => {
  const out: Record<string, string> = {};
  for (const k of SELECTOR_KEYS) {
    const v = s?.[k];
    if (typeof v === "string" && v.trim() && v.length < 300 && !/[<{}]|javascript:|url\(/i.test(v)) out[k] = v.trim();
  }
  return out;
};

async function gemini(system: string, user: string, tool: { name: string; description: string; parameters: unknown }) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{ type: "function", function: tool }],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  const raw = call?.function?.arguments ?? data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("AI returned nothing usable");
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function pick(body: { item: Item; candidates: Candidate[]; diet_restrictions?: string[]; store?: string }) {
  const item = body.item;
  const candidates = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 20);
  if (!item?.name || candidates.length === 0) return { index: null, substituted: false, reason: "nothing to choose from" };
  const diet = (body.diet_restrictions ?? []).filter((d) => typeof d === "string").slice(0, 20);
  const system = `You choose which product tile on a grocery store's search results page best fulfils one grocery list item.
Rules:
- Match the food itself first, then the quantity and unit (for "2 lb chicken thighs" prefer a pack near 2 lb; for "1 can black beans" prefer a single standard can, not a multipack).
- Prefer store brands when the list names no brand. Prefer in-stock tiles.
- Never choose something that conflicts with the diet restrictions; if every tile conflicts, choose nothing.
- If no tile is the same food, choose nothing rather than a wrong product. A close substitute (different brand, size, or cut) is fine and must be flagged substituted=true with a short reason.
- Answer only by calling the tool.`;
  const user = JSON.stringify({
    store: body.store ?? null,
    item: { name: item.name, quantity: item.quantity ?? null, unit: item.unit ?? null, note: item.note ?? null },
    diet_restrictions: diet,
    tiles: candidates.map((c) => ({ index: c.index, name: c.name, brand: c.brand, price: c.priceText ?? c.price, size: c.size, unit_price: c.unitPrice, out_of_stock: c.unavailable })),
  });
  const out = await gemini(system, user, {
    name: "choose_product",
    description: "Pick the tile index that best matches the item, or null when none fits.",
    parameters: {
      type: "object",
      required: ["index", "substituted", "reason"],
      properties: {
        index: { type: ["integer", "null"], description: "Index of the chosen tile, or null." },
        substituted: { type: "boolean", description: "True when the pick is a reasonable substitute rather than exactly the item." },
        reason: { type: "string", description: "One short sentence for the shopper." },
      },
    },
  });
  const valid = candidates.map((c) => c.index);
  const index = Number.isInteger(out?.index) && valid.includes(out.index) ? out.index : null;
  return { index, substituted: index !== null && !!out?.substituted, reason: String(out?.reason ?? "").slice(0, 240) };
}

async function inferSelectors(body: { host: string; outline: unknown }) {
  const outline = body.outline as { url?: string; title?: string; inputs?: unknown[]; buttons?: unknown[]; repeats?: unknown[] };
  if (!outline || typeof outline !== "object") throw new Error("outline is required");
  const system = `You are given a compact outline of a grocery store's search results page: its text inputs, its buttons grouped by label with counts, and groups of repeated sibling elements with a text sample. Work out the CSS selectors the shopping extension should use:
- product_card: the repeated element that is one product tile (contains a name, a price and an add-to-cart control). Use the repeat group's selector when one fits.
- add_button: the control inside a tile that adds it to the cart (text like "Add", "Add to cart", or an aria-label starting with "Add").
- search_input: the site search box.
- name / price: optional selectors inside a tile for the product name and price, only if obvious from the outline.
Selectors must be plain CSS (tag, .class, [attr=value]); never use generated-looking classes with long digit runs. Set confidence low when guessing. Answer only by calling the tool.`;
  const out = await gemini(system, JSON.stringify(outline).slice(0, 60_000), {
    name: "page_selectors",
    description: "CSS selectors for the page's product tiles.",
    parameters: {
      type: "object",
      required: ["product_card", "add_button", "confidence"],
      properties: {
        search_input: { type: ["string", "null"] },
        product_card: { type: ["string", "null"] },
        add_button: { type: ["string", "null"] },
        name: { type: ["string", "null"] },
        price: { type: ["string", "null"] },
        confidence: { type: "number", description: "0 to 1" },
      },
    },
  });
  const selectors = cleanSelectors({
    searchInput: out?.search_input, productCard: out?.product_card, addButton: out?.add_button, name: out?.name, price: out?.price,
  });
  if (!selectors.productCard || (Number(out?.confidence) || 0) < 0.3) return { selectors: null, confidence: Number(out?.confidence) || 0 };
  return { selectors, confidence: Number(out?.confidence) || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sign in first" }, 401);
  const verifier = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: who, error: authErr } = await verifier.auth.getUser(token);
  if (authErr || !who.user) return json({ error: "Sign in first" }, 401);
  const userId = who.user.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON body required" }, 400); }
  const action = String(body.action ?? "");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    switch (action) {
      case "pick":
        return json(await pick(body as never));

      case "infer_selectors":
        return json(await inferSelectors(body as never));

      case "get_adapter": {
        const host = normHost(String(body.host ?? ""));
        if (!host) return json({ adapter: null });
        // Longest matching suffix: "shop.example.com" also finds "example.com".
        const parts = host.split(".");
        const hosts = parts.map((_, i) => parts.slice(i).join(".")).filter((h) => h.includes("."));
        const { data } = await admin.from("store_adapters").select("host, selectors, source, success_count, fail_count").in("host", hosts);
        const best = (data ?? []).sort((a, b) => b.host.length - a.host.length)[0];
        if (!best || (best.fail_count ?? 0) > (best.success_count ?? 0) + 3) return json({ adapter: null });
        return json({ adapter: { hosts: [best.host], ...cleanSelectors(best.selectors as Record<string, unknown>), source: best.source } });
      }

      case "save_adapter": {
        const host = normHost(String(body.host ?? ""));
        const selectors = cleanSelectors(body.selectors as Record<string, unknown>);
        const source = body.source === "taught" ? "taught" : "learned";
        const outcome = body.outcome === "fail" ? "fail" : "success";
        if (!host || !host.includes(".")) return json({ error: "host is required" }, 400);
        if (outcome === "success" && !selectors.productCard && !selectors.addButton) return json({ error: "selectors are required" }, 400);
        const { data: existing } = await admin.from("store_adapters").select("host, success_count, fail_count, source").eq("host", host).maybeSingle();
        // A taught adapter (a human clicked) outranks a learned one; a learned one never overwrites a taught one.
        if (existing?.source === "taught" && source === "learned" && outcome === "success") {
          await admin.from("store_adapters").update({ success_count: (existing.success_count ?? 0) + 1, updated_at: new Date().toISOString() }).eq("host", host);
          return json({ ok: true, kept: "taught" });
        }
        const row = outcome === "fail"
          ? { host, fail_count: (existing?.fail_count ?? 0) + 1, updated_at: new Date().toISOString() }
          : { host, selectors, source, success_count: (existing?.success_count ?? 0) + 1, created_by: existing ? undefined : userId, updated_at: new Date().toISOString() };
        const { error } = await admin.from("store_adapters").upsert(row, { onConflict: "host" });
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action "${action}"` }, 400);
    }
  } catch (err) {
    console.error("shop-assist", action, err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
