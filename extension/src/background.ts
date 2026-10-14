// Service worker: signs the user in (OAuth 2.1 + PKCE against Supabase Auth),
// talks to the MCP server for the list and the report, and drives the content
// script through a shopping run one item at a time.
import { ASSIST_URL, AUTHORIZE_URL, MCP_URL, OAUTH_CLIENT_ID, TOKEN_URL, USERINFO_URL } from "./shared/config";
import { pickLocally, searchQuery } from "./shared/match";
import { builtinAdapterFor, fillUrl } from "./shared/stores";
import type {
  Adapter, AddResult, AuthState, Candidate, CartInfo, CollectResult, ContentRequest, ItemResult, ListItem, PageOutline,
  PageStatus, PanelRequest, RunState, SearchResult, ShoppingList,
} from "./shared/types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// ---------- auth ----------

interface Tokens { access_token: string; refresh_token: string | null; expires_at: number; email: string | null }

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (len = 64) => {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

async function loadTokens(): Promise<Tokens | null> {
  const { tokens } = await chrome.storage.local.get("tokens");
  return (tokens as Tokens | undefined) ?? null;
}
const saveTokens = (tokens: Tokens | null) => (tokens ? chrome.storage.local.set({ tokens }) : chrome.storage.local.remove("tokens"));

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: OAUTH_CLIENT_ID, ...params }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(body.error_description || body.error || body.msg || `Token request failed (${res.status})`);
  const prev = await loadTokens();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? prev?.refresh_token ?? null,
    expires_at: Date.now() + Number(body.expires_in ?? 3600) * 1000,
    email: prev?.email ?? null,
  };
}

async function signIn(): Promise<AuthState> {
  const verifier = randomString(64);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = randomString(24);
  const redirectUri = chrome.identity.getRedirectURL();
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "openid email offline_access",
    state,
  }).toString();
  const responseUrl = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  if (!responseUrl) throw new Error("Sign-in was cancelled");
  const q = new URL(responseUrl).searchParams;
  if (q.get("error")) throw new Error(q.get("error_description") || q.get("error")!);
  if (q.get("state") !== state) throw new Error("Sign-in state mismatch; try again");
  const code = q.get("code");
  if (!code) throw new Error("No authorization code returned");
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
  try {
    const info = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then((r) => r.json());
    tokens.email = info?.email ?? null;
  } catch { /* email is cosmetic */ }
  await saveTokens(tokens);
  broadcast({ type: "auth", auth: { signedIn: true, email: tokens.email } });
  return { signedIn: true, email: tokens.email };
}

async function signOut(): Promise<AuthState> {
  await saveTokens(null);
  cachedList = null;
  state = freshState();
  broadcast({ type: "auth", auth: { signedIn: false, email: null } });
  broadcast({ type: "state", state });
  return { signedIn: false, email: null };
}

async function accessToken(): Promise<string> {
  let tokens = await loadTokens();
  if (!tokens) throw new Error("Sign in first");
  if (tokens.expires_at - Date.now() < 60_000) {
    if (!tokens.refresh_token) {
      await saveTokens(null);
      throw new Error("Your sign-in expired; sign in again");
    }
    try {
      tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
      await saveTokens(tokens);
    } catch (err) {
      await saveTokens(null);
      broadcast({ type: "auth", auth: { signedIn: false, email: null } });
      throw new Error("Your sign-in expired; sign in again");
    }
  }
  return tokens.access_token;
}

async function authState(): Promise<AuthState> {
  const t = await loadTokens();
  return { signedIn: !!t, email: t?.email ?? null };
}

// ---------- MCP + assist ----------

let rpcId = 0;
async function mcpCall<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
  });
  if (res.status === 401) {
    await saveTokens(null);
    broadcast({ type: "auth", auth: { signedIn: false, email: null } });
    throw new Error("Your sign-in expired; sign in again");
  }
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || "MCP error");
  const content = body.result?.content?.[0]?.text;
  if (body.result?.isError) throw new Error(content || "MCP tool failed");
  try { return JSON.parse(content) as T; } catch { return content as T; }
}

async function assist<T = unknown>(action: string, payload: Record<string, unknown>): Promise<T> {
  const token = await accessToken();
  const res = await fetch(ASSIST_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `shop-assist ${action} failed (${res.status})`);
  return body as T;
}

// ---------- run state ----------

let cachedList: ShoppingList | null = null;
let state: RunState = freshState();
let stopRequested = false;

function freshState(): RunState {
  return { phase: "idle", listId: null, store: null, storeUrl: null, tabId: null, items: [], results: [], currentKey: null, message: null, cartUrl: null, estimatedTotal: null, reported: false, startedAt: null };
}

function broadcast(msg: unknown) {
  chrome.runtime.sendMessage(msg).catch(() => { /* panel closed */ });
}
function update(patch: Partial<RunState>) {
  state = { ...state, ...patch };
  broadcast({ type: "state", state });
}

const flatten = (list: ShoppingList): ListItem[] => Object.values(list.items_by_aisle ?? {}).flat();

async function loadList(): Promise<ShoppingList | { saved_list: null; message: string }> {
  const data = await mcpCall<ShoppingList | { saved_list: null; message: string }>("get_shopping_list");
  cachedList = "list_id" in data ? data : null;
  broadcast({ type: "list", list: cachedList, message: "message" in data ? data.message : null });
  return data;
}

// ---------- tab + content script plumbing ----------

async function tabForOrigin(storeUrl: string): Promise<chrome.tabs.Tab> {
  const origin = new URL(storeUrl).origin;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url && t.url.startsWith(origin + "/") && !t.url.includes("/checkout"));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    return existing;
  }
  const tab = await chrome.tabs.create({ url: storeUrl, active: true });
  await tabLoaded(tab.id!);
  return tab;
}

function tabLoaded(tabId: number, timeoutMs = 25_000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); setTimeout(resolve, 900); } };
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => { if (id === tabId && info.status === "complete") finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => { if (t.status === "complete") finish(); }).catch(finish);
    setTimeout(finish, timeoutMs);
  });
}

async function send<T>(tabId: number, msg: ContentRequest): Promise<T> {
  const res = await chrome.tabs.sendMessage(tabId, msg) as { ok: boolean; result?: T; error?: string } | undefined;
  if (!res) throw new Error("No answer from the store page");
  if (!res.ok) throw new Error(res.error || "content script error");
  return res.result as T;
}

async function ensureEngine(tabId: number, adapter: Adapter | null): Promise<void> {
  const alive = await chrome.tabs.sendMessage(tabId, { type: "ping" } satisfies ContentRequest).catch(() => null);
  if (!alive) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
  await send(tabId, { type: "configure", adapter });
}

async function resolveAdapter(host: string): Promise<Adapter | null> {
  const builtin = builtinAdapterFor(host);
  let learned: Adapter | null = null;
  try {
    const r = await assist<{ adapter: Adapter | null }>("get_adapter", { host });
    learned = r.adapter;
  } catch { /* fine, heuristics still work */ }
  if (!builtin) return learned;
  if (!learned) return builtin;
  // Built-in search/cart URLs plus whatever selectors were learned for this host.
  return { ...learned, ...builtin, searchInput: builtin.searchInput ?? learned.searchInput, productCard: builtin.productCard ?? learned.productCard, name: builtin.name ?? learned.name, price: builtin.price ?? learned.price, addButton: builtin.addButton ?? learned.addButton };
}

/** Results pages render asynchronously; poll until tiles appear. */
async function collectSettled(tabId: number, maxMs = 12_000): Promise<CollectResult> {
  const started = Date.now();
  let last: CollectResult = { candidates: [], strategy: "none" };
  let stableFor = 0;
  let lastCount = -1;
  while (Date.now() - started < maxMs) {
    last = await send<CollectResult>(tabId, { type: "collect" });
    if (last.candidates.length > 0) {
      if (last.candidates.length === lastCount) stableFor++; else stableFor = 0;
      if (stableFor >= 1) return last;
      lastCount = last.candidates.length;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return last;
}

// ---------- the run ----------

async function startRun(storeUrl: string, useAi: boolean): Promise<RunState> {
  if (state.phase === "running" || state.phase === "preparing") throw new Error("A run is already going");
  if (!cachedList) await loadList();
  if (!cachedList) throw new Error("No saved list. Open airecipemanager.com → Grocery List → Shop my list first.");
  const list = cachedList;
  const items = flatten(list);
  stopRequested = false;
  state = { ...freshState(), phase: "preparing", listId: list.list_id, store: list.store, storeUrl, items, startedAt: Date.now(), message: "Opening the store…" };
  broadcast({ type: "state", state });

  runLoop(list, items, storeUrl, useAi).catch((err) => {
    update({ phase: "stopped", message: `Stopped: ${String((err as Error)?.message ?? err)}` });
  });
  return state;
}

async function runLoop(list: ShoppingList, items: ListItem[], storeUrl: string, useAi: boolean) {
  const tab = await tabForOrigin(storeUrl);
  const tabId = tab.id!;
  const host = new URL(tab.url || storeUrl).hostname;
  let adapter = await resolveAdapter(host);
  update({ tabId, phase: "running", message: adapter?.notes?.join(" ") ?? null });

  const diet = list.shopper?.diet_restrictions ?? [];
  const results: ItemResult[] = [];

  for (const item of items) {
    if (stopRequested) break;
    update({ currentKey: item.key, message: `Searching for ${item.name}…` });
    const query = searchQuery(item);
    let result: ItemResult = { key: item.key, name: item.name, status: "not_found" };
    try {
      // 1. Search.
      await ensureEngine(tabId, adapter);
      if (adapter?.searchUrl) {
        await chrome.tabs.update(tabId, { url: fillUrl(adapter.searchUrl, host, query) });
        await tabLoaded(tabId);
        await ensureEngine(tabId, adapter);
      } else {
        const r = await send<SearchResult>(tabId, { type: "search", query });
        if (r.navigated) {
          await tabLoaded(tabId);
          await ensureEngine(tabId, adapter);
        }
      }

      // 2. Make sure the page is still a shop and not a wall.
      const status = await send<PageStatus>(tabId, { type: "page-status" });
      if (status.botCheck) {
        results.push({ ...result, status: "skipped", note: "stopped at a bot check" });
        update({ phase: "blocked", results: [...results], message: "The store is showing a bot check. Finish it yourself in the store tab, then press Start again to continue with the remaining items." });
        return;
      }
      if (status.loginWall) {
        results.push({ ...result, status: "skipped", note: "store asked for sign-in" });
        update({ phase: "blocked", results: [...results], message: "The store wants you to sign in. Sign in on the store tab (the extension never types passwords), then press Start again." });
        return;
      }

      // 3. Collect tiles; if none, let the AI read the page once and remember what it learned.
      let collected = await collectSettled(tabId);
      if (collected.candidates.length === 0 && useAi) {
        update({ message: `No product tiles recognised on ${host}; asking the AI to read the page…` });
        const outline = await send<PageOutline>(tabId, { type: "outline" });
        const inferred = await assist<{ selectors: Partial<Adapter> | null }>("infer_selectors", { host, outline });
        if (inferred.selectors) {
          adapter = { ...(adapter ?? { hosts: [host], source: "learned" as const }), ...inferred.selectors, source: adapter?.source ?? "learned" };
          await send(tabId, { type: "configure", adapter });
          collected = await collectSettled(tabId, 5_000);
          if (collected.candidates.length > 0) {
            assist("save_adapter", { host, selectors: inferred.selectors, source: "learned", outcome: "success" }).catch(() => {});
          }
        }
      }
      if (collected.candidates.length === 0) {
        result = { ...result, status: "not_found", note: "no products recognised on the results page" };
      } else {
        // 4. Choose.
        let chosen: Candidate | null = null;
        let chosenBy: "ai" | "rules" = "rules";
        let substituted = false;
        let reason = "";
        if (useAi) {
          try {
            const pick = await assist<{ index: number | null; substituted: boolean; reason: string }>("pick", {
              item, candidates: collected.candidates, diet_restrictions: diet, store: host,
            });
            chosenBy = "ai";
            substituted = !!pick.substituted;
            reason = pick.reason || "";
            chosen = pick.index !== null && pick.index !== undefined ? collected.candidates[pick.index] ?? null : null;
          } catch (err) {
            reason = `AI pick failed (${String((err as Error)?.message ?? err)}); used rules`;
          }
        }
        if (!chosen && chosenBy === "rules") {
          const local = pickLocally(item, collected.candidates, diet);
          chosen = local.chosen;
          if (chosen) {
            const top = local.ranked[0];
            substituted = top.score < 70;
            reason = reason ? `${reason}; ${top.reasons.join(", ")}` : top.reasons.join(", ");
          }
        }
        if (!chosen) {
          result = { ...result, status: "not_found", note: reason || `no close match among ${collected.candidates.length} results`, chosenBy };
        } else {
          // 5. Add to cart.
          update({ message: `Adding ${chosen.name}…` });
          const added = await send<AddResult>(tabId, { type: "add", index: chosen.index });
          if (!added.clicked) {
            result = { ...result, status: "not_found", note: added.note || "could not press Add", product: chosen.name, chosenBy };
          } else {
            result = {
              ...result,
              status: substituted ? "substituted" : "added",
              product: chosen.name,
              price: chosen.price ?? undefined,
              note: [reason, added.verified ? "" : (added.note || "not confirmed by the store")].filter(Boolean).join("; ") || undefined,
              chosenBy,
              verified: added.verified,
            };
          }
        }
      }
    } catch (err) {
      result = { ...result, status: "skipped", note: String((err as Error)?.message ?? err) };
    }
    results.push(result);
    update({ results: [...results] });
  }

  // Cart summary: open the cart page if we know it, read what we can.
  let cart: CartInfo = { cartUrl: null, estimatedTotal: null, count: null };
  try {
    if (adapter?.cartUrl) {
      await chrome.tabs.update(tabId, { url: fillUrl(adapter.cartUrl, host) });
      await tabLoaded(tabId);
    }
    await ensureEngine(tabId, adapter);
    cart = await send<CartInfo>(tabId, { type: "cart-info" });
  } catch { /* summary is best effort */ }
  const cartUrl = cart.cartUrl ?? (adapter?.cartUrl ? fillUrl(adapter.cartUrl, host) : null);
  update({
    phase: stopRequested ? "stopped" : "finished",
    currentKey: null,
    cartUrl,
    estimatedTotal: cart.estimatedTotal,
    message: stopRequested ? "Stopped. You can still send the report for what was added." : "Done. Review the cart in the store tab and place the order yourself.",
  });
  if (!stopRequested) await sendReport().catch((err) => update({ message: `Done, but the report did not send: ${String((err as Error)?.message ?? err)}` }));
}

async function sendReport(): Promise<void> {
  if (!state.listId || state.reported) return;
  const inCart = state.results.filter((r) => r.status === "added" || r.status === "substituted").length;
  const missing = state.results.filter((r) => r.status === "not_found").length;
  const total = state.items.length;
  const status = inCart === 0 ? "failed" : inCart + 0 >= total && missing === 0 && state.results.length === total ? "in_cart" : "partial";
  const host = state.storeUrl ? new URL(state.storeUrl).hostname.replace(/^www\./, "") : state.store;
  const summary = `${inCart} of ${total} items in the cart at ${host}` + (missing ? `, ${missing} not found` : "") + (state.results.length < total ? `, ${total - state.results.length} not attempted` : "") + ".";
  await mcpCall("report_shopping_result", {
    list_id: state.listId,
    store: state.store && state.store !== "other" ? state.store : host,
    status,
    cart_url: state.cartUrl ?? undefined,
    estimated_total: state.estimatedTotal ?? undefined,
    summary,
    items: state.results.map((r) => ({ key: r.key, status: r.status, product: r.product, price: r.price, note: r.note })),
  });
  update({ reported: true });
}

async function teachStore(storeUrl: string): Promise<{ host: string; matches: number }> {
  const tab = await tabForOrigin(storeUrl);
  const tabId = tab.id!;
  const host = new URL(tab.url || storeUrl).hostname;
  await ensureEngine(tabId, null);
  const taught = await send<Partial<Adapter> & { matches: number }>(tabId, { type: "teach" });
  const { matches, ...selectors } = taught;
  await assist("save_adapter", { host, selectors, source: "taught", outcome: "success" });
  return { host, matches };
}

// ---------- panel messages ----------

chrome.runtime.onMessage.addListener((msg: PanelRequest, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "get-state": return { auth: await authState(), state, list: cachedList };
      case "sign-in": return signIn();
      case "sign-out": return signOut();
      case "load-list": return loadList();
      case "start-run": return startRun(msg.storeUrl, msg.useAi);
      case "stop-run": stopRequested = true; update({ message: "Stopping after the current item…" }); return state;
      case "send-report": await sendReport(); return state;
      case "teach-store": return teachStore(msg.storeUrl);
    }
  })().then(
    (result) => sendResponse({ ok: true, result }),
    (err) => sendResponse({ ok: false, error: String((err as Error)?.message ?? err) }),
  );
  return true;
});
