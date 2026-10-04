// MCP server for AI Recipe Manager.
//
// Lets an AI agent (Claude, or any MCP client) read the user's grocery list and
// preferences, record what it put in a store cart, and tick items as bought.
// Authentication is Supabase Auth's OAuth 2.1 server: an unauthenticated call
// gets 401 + WWW-Authenticate pointing at our protected-resource metadata, the
// client discovers the authorization server from there, the user signs in and
// consents on airecipemanager.com/oauth/consent, and every tool call then runs
// as that user through RLS. No service-role access anywhere in this file.
//
// Hard rules the tools enforce in their descriptions and the prompt:
//   - the agent never places an order or enters payment details;
//   - nothing on the user's list is ever hidden or deleted from here.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@0.10.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Public URL of this function. SUPABASE_URL is the public project URL in
// production; MCP_PUBLIC_URL overrides it (local dev, custom domain).
const RESOURCE_URL = Deno.env.get("MCP_PUBLIC_URL") ?? `${SUPABASE_URL}/functions/v1/mcp`;
const AUTH_SERVER = `${SUPABASE_URL}/auth/v1`;
const METADATA_URL = `${RESOURCE_URL}/oauth-protected-resource`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

const withCors = (res: Response) => {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
};

const unauthorized = (detail: string) =>
  new Response(JSON.stringify({ error: "unauthorized", error_description: detail }), {
    status: 401,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${METADATA_URL}"`,
    },
  });

// ---------- auth ----------

type Shopper = { id: string; email: string | null; supabase: SupabaseClient };

// Validating a token is a round trip to Auth; cache briefly so a burst of tool
// calls in one shopping run doesn't pay it every time.
const tokenCache = new Map<string, { user: { id: string; email: string | null }; until: number }>();

async function authenticate(req: Request): Promise<Shopper | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();

  const cached = tokenCache.get(token);
  let user = cached && cached.until > Date.now() ? cached.user : null;
  if (!user) {
    const verifier = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data.user) return null;
    user = { id: data.user.id, email: data.user.email ?? null };
    tokenCache.set(token, { user, until: Date.now() + 60_000 });
    if (tokenCache.size > 500) tokenCache.clear();
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { ...user, supabase };
}

// ---------- domain ----------

type ListItem = {
  key: string;
  name: string;
  quantity?: string;
  unit?: string;
  category?: string;
  note?: string;
  recipes?: string[];
};

const STORE_LABELS: Record<string, string> = {
  kroger: "Kroger",
  walmart: "Walmart",
  meijer: "Meijer",
  giant_eagle: "Giant Eagle",
  aldi: "Aldi",
  target: "Target",
  costco: "Costco",
  other: "their usual store",
};

const storeLabel = (id: string | null | undefined) =>
  (id && STORE_LABELS[id]) || (id ? id : "their usual store");

const PLAYBOOK = `You are shopping an AI Recipe Manager grocery list for the user.

1. Call get_shopping_list. It returns the items the user saved with "Shop my list", the store they want, and their ZIP. If it says there is no saved list, ask the user to open airecipemanager.com, go to Grocery List and press "Shop my list", then call it again.
2. Open the store's website in the user's browser (they are already signed in). Search for each item, pick the product that best matches the quantity and unit, and add it to the cart. Prefer store brands when the list does not name a brand. Respect the diet restrictions returned with the list when choosing substitutes.
3. If an item cannot be found, note it and move on. Never remove an item from the user's list for any reason.
4. Call report_shopping_result once with what happened: list_id, store, status (in_cart, partial or failed), a cart_url if the site has one, and a per-item status (added, substituted, not_found, skipped) with a short note.
5. Hand the cart to the user: list what was added, what was substituted, what was not found, and the estimated total if the site shows one. Then STOP.

Hard rules:
- Never place the order, never press Checkout / Place order / Buy, never enter or confirm payment, address, or login details, and never solve a CAPTCHA. The user completes the purchase.
- Everything you report as added or substituted is ticked off the user's list automatically. Use mark_items_bought only for extra items the user says they bought.
- Do not add items the list does not contain unless the user asks.`;

/** Store-specific playbook lines, learned from real runs. */
function storeRules(store: string | null | undefined): string[] {
  switch (store) {
    case "meijer":
      return [
        "Meijer: open Meijer's AI assistant, Ask Joy Dot, and send the full list in ONE message, one of each item.",
        "Meijer: ignore Joy Dot's reply; it can say it failed even when the items were added.",
        "Meijer: open the cart and check every list item against it.",
        "Meijer: add anything missing by hand with a normal site search.",
        "Meijer: mark any item Joy Dot swapped as 'substituted' with a note saying what it chose.",
        "Meijer: point out items that were already in the cart before the run so the user can remove them if unwanted.",
        "Meijer: stop at the cart. Never check out.",
      ];
    default:
      return [];
  }
}

function groupByCategory(items: ListItem[]) {
  const groups: Record<string, ListItem[]> = {};
  for (const it of items) {
    const cat = (it.category || "Other").trim() || "Other";
    (groups[cat] ??= []).push(it);
  }
  return groups;
}

/**
 * Tick items off the user's grocery list. Recipe-derived rows are ticked through
 * grocery_checked_keys (the key the web and apps share); hand-added rows live in
 * grocery_items and are ticked by name. Ticked items move to "Bought" and stay
 * visible; nothing is deleted.
 */
async function tickItems(shopper: Shopper, items: { key: string; name?: string | null }[]) {
  const { supabase } = shopper;
  const keys = Array.from(new Set(items.map((i) => String(i.key ?? "").trim()).filter(Boolean)));
  if (keys.length === 0) return { ticked_keys: 0, ticked_manual: 0 };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("grocery_checked_keys")
    .upsert(keys.map((item_key) => ({ user_id: shopper.id, item_key, created_at: now })), {
      onConflict: "user_id,item_key",
    });
  if (error) throw new Error(error.message);

  const wanted = new Set(
    items.flatMap((i) => [i.key, i.name ?? ""]).map((n) => String(n).trim().toLowerCase()).filter(Boolean),
  );
  const { data: manual } = await supabase.from("grocery_items").select("id, name").eq("is_checked", false);
  const ids = (manual ?? []).filter((m) => wanted.has(String(m.name).trim().toLowerCase())).map((m) => m.id);
  if (ids.length > 0) {
    const { error: e2 } = await supabase.from("grocery_items").update({ is_checked: true }).in("id", ids);
    if (e2) throw new Error(e2.message);
  }
  return { ticked_keys: keys.length, ticked_manual: ids.length };
}

function buildServer(shopper: Shopper) {
  const { supabase } = shopper;
  const mcp = new McpServer({ name: "ai-recipe-manager", version: "1.0.0" });
  const text = (value: unknown) => ({
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  });

  mcp.tool("get_shopping_list", {
    description:
      "Get the grocery list the user saved with the 'Shop my list' button in AI Recipe Manager, " +
      "plus the store they want to shop at, their ZIP code and diet restrictions. Call this first. " +
      "Items are grouped by store aisle. Never remove items from the user's list; if something " +
      "cannot be bought, report it with report_shopping_result instead. The agent must never place " +
      "the order or enter payment details; the user checks out themselves.",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string", description: "A specific saved list. Defaults to the most recent one." },
      },
    },
    handler: async (args: { list_id?: string }) => {
      let query = supabase
        .from("shopping_lists")
        .select("id, store, zip_code, range_label, items, item_count, status, result, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (args?.list_id) query = query.eq("id", args.list_id);
      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, preferred_store, zip_code, diet_restrictions, household_size")
        .maybeSingle();

      const list = rows?.[0];
      if (!list) {
        return text({
          saved_list: null,
          message:
            "No saved list yet. Ask the user to open airecipemanager.com → Grocery List and press " +
            "\"Shop my list\", then call get_shopping_list again.",
          shopper: {
            account_email: shopper.email,
            preferred_store: profile?.preferred_store ?? null,
            preferred_store_label: storeLabel(profile?.preferred_store),
            zip_code: profile?.zip_code ?? null,
          },
        });
      }

      const items = (Array.isArray(list.items) ? list.items : []) as ListItem[];
      const store = list.store ?? profile?.preferred_store ?? null;
      return text({
        list_id: list.id,
        saved_at: list.created_at,
        status: list.status,
        store,
        store_label: storeLabel(store),
        zip_code: list.zip_code ?? profile?.zip_code ?? null,
        planned_for: list.range_label ?? null,
        item_count: items.length,
        items_by_aisle: groupByCategory(items),
        shopper: {
          account_email: shopper.email,
          first_name: (profile?.display_name ?? "").split(" ")[0] || null,
          diet_restrictions: profile?.diet_restrictions ?? [],
          household_size: profile?.household_size ?? null,
        },
        previous_result: list.result ?? null,
        rules: [
          "Add items to the cart; never place the order or enter payment details.",
          "Never remove items from the user's list. Report anything you cannot find.",
          "Call report_shopping_result when done; items it marks added or substituted are ticked off the list for the user.",
          ...storeRules(store),
        ],
      });
    },
  });

  mcp.tool("get_shopper_profile", {
    description:
      "The user's shopping preferences: preferred store, ZIP code, diet restrictions and household size.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, preferred_store, zip_code, diet_restrictions, household_size")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return text({
        account_email: shopper.email,
        first_name: (data?.display_name ?? "").split(" ")[0] || null,
        preferred_store: data?.preferred_store ?? null,
        preferred_store_label: storeLabel(data?.preferred_store),
        zip_code: data?.zip_code ?? null,
        diet_restrictions: data?.diet_restrictions ?? [],
        household_size: data?.household_size ?? null,
      });
    },
  });

  mcp.tool("report_shopping_result", {
    description:
      "Record the outcome of a shopping run so the user sees it in AI Recipe Manager: which items " +
      "went into the cart, which were substituted or not found, and a link to the cart if there is one. " +
      "Call once at the end of the run. Items reported as added or substituted are ticked off the user's " +
      "grocery list automatically (they move to Bought and stay visible); nothing is ever deleted.",
    inputSchema: {
      type: "object",
      required: ["list_id", "status", "items"],
      properties: {
        list_id: { type: "string" },
        store: { type: "string", description: "Store id or name actually shopped." },
        status: { type: "string", enum: ["in_cart", "partial", "failed"] },
        cart_url: { type: "string", description: "Link to the cart or order review page, if the site has one." },
        estimated_total: { type: "number", description: "Cart total shown by the store, if visible." },
        summary: { type: "string", description: "One or two sentences for the user." },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["key", "status"],
            properties: {
              key: { type: "string", description: "The item key from get_shopping_list." },
              status: { type: "string", enum: ["added", "substituted", "not_found", "skipped"] },
              product: { type: "string", description: "Product name chosen at the store." },
              price: { type: "number" },
              note: { type: "string" },
            },
          },
        },
      },
    },
    handler: async (args: {
      list_id: string;
      store?: string;
      status: "in_cart" | "partial" | "failed";
      cart_url?: string;
      estimated_total?: number;
      summary?: string;
      items: { key: string; status: string; product?: string; price?: number; note?: string }[];
    }) => {
      if (!args?.list_id || !args.status || !Array.isArray(args.items)) {
        throw new Error("list_id, status and items are required");
      }
      const allowed = new Set(["in_cart", "partial", "failed"]);
      if (!allowed.has(args.status)) throw new Error("status must be in_cart, partial or failed");
      const result = {
        store: args.store ?? null,
        cart_url: args.cart_url ?? null,
        estimated_total: args.estimated_total ?? null,
        summary: args.summary ?? null,
        items: args.items.map((i) => ({
          key: String(i.key),
          status: String(i.status),
          product: i.product ?? null,
          price: i.price ?? null,
          note: i.note ?? null,
        })),
        reported_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("shopping_lists")
        .update({ status: args.status, result, updated_at: new Date().toISOString() })
        .eq("id", args.list_id)
        .select("id, items")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No saved list with that id for this user");

      // What went into the cart is as good as bought for the list: tick it off
      // so the web and the apps show it under Bought instead of To buy.
      const snapshot = (Array.isArray(data.items) ? data.items : []) as ListItem[];
      const nameByKey = new Map(snapshot.map((i) => [i.key, i.name]));
      const inCart = result.items
        .filter((i) => i.status === "added" || i.status === "substituted")
        .map((i) => ({ key: i.key, name: nameByKey.get(i.key) ?? i.key }));
      const ticked = await tickItems(shopper, inCart);

      return text({
        ok: true,
        list_id: data.id,
        status: args.status,
        in_cart: inCart.length,
        ticked_off_list: ticked.ticked_keys,
        not_found: result.items.filter((i) => i.status === "not_found").length,
        next_step: "Tell the user the cart is ready for them to review and place the order, and that those items are now ticked off their list. Do not check out.",
      });
    },
  });

  mcp.tool("mark_items_bought", {
    description:
      "Tick extra items off the user's grocery list (they move to Bought; nothing is deleted). " +
      "report_shopping_result already ticks everything it put in the cart, so use this only when the " +
      "user says they bought something themselves or asks you to tick items.",
    inputSchema: {
      type: "object",
      required: ["keys"],
      properties: {
        keys: { type: "array", items: { type: "string" }, description: "Item keys from get_shopping_list." },
      },
    },
    handler: async (args: { keys: string[] }) => {
      const keys = Array.from(new Set((args?.keys ?? []).map((k) => String(k).trim()).filter(Boolean)));
      if (keys.length === 0) throw new Error("keys is required");
      const ticked = await tickItems(shopper, keys.map((key) => ({ key })));
      return text({ ok: true, marked_bought: ticked.ticked_keys });
    },
  });

  mcp.prompt("shop_my_list", {
    description: "Step-by-step playbook for shopping the user's AI Recipe Manager grocery list at their store.",
    handler: () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: PLAYBOOK } }],
    }),
  });

  return mcp;
}

// ---------- http ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const sub = url.pathname.replace(/^(?:\/functions\/v1)?\/mcp/, "") || "/";

  // RFC 9728 protected-resource metadata. MCP clients fetch this from the URL
  // in our WWW-Authenticate header, then the authorization server's own
  // metadata at <project>/.well-known/oauth-authorization-server/auth/v1.
  if (sub === "/oauth-protected-resource" || sub === "/.well-known/oauth-protected-resource") {
    return new Response(
      JSON.stringify({
        resource: RESOURCE_URL,
        authorization_servers: [AUTH_SERVER],
        bearer_methods_supported: ["header"],
        resource_name: "AI Recipe Manager",
        resource_documentation: "https://airecipemanager.com/skills/shop-my-list/SKILL.md",
      }),
      { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } },
    );
  }

  if (sub === "/health") {
    return new Response(JSON.stringify({ ok: true, resource: RESOURCE_URL }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (sub !== "/") return new Response("Not found", { status: 404, headers: CORS });

  const shopper = await authenticate(req);
  if (!shopper) return unauthorized("Sign in to AI Recipe Manager to use this connector.");

  try {
    const transport = new StreamableHttpTransport();
    const handle = transport.bind(buildServer(shopper));
    return withCors(await handle(req));
  } catch (err) {
    console.error("mcp request failed", err);
    return new Response(JSON.stringify({ error: "server_error", message: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
