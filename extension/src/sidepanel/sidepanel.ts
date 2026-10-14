// Side panel UI. All state lives in the service worker; this file only renders
// it and sends the user's clicks over.
import { AI_PROVIDER_LABEL, WEBSITE_URL } from "../shared/config";
import { STORE_HOME } from "../shared/stores";
import type { AuthState, ItemResult, ListItem, PanelRequest, RunState, ShoppingList } from "../shared/types";

const main = document.getElementById("main")!;
const account = document.getElementById("account")!;

let auth: AuthState = { signedIn: false, email: null };
let list: ShoppingList | null = null;
let listMessage: string | null = null;
let run: RunState | null = null;
let busy: string | null = null;
let error: string | null = null;
let useAi = false;
let storeUrl = "";

async function ask<T = unknown>(msg: PanelRequest): Promise<T> {
  const res = (await chrome.runtime.sendMessage(msg)) as { ok: boolean; result?: T; error?: string };
  if (!res?.ok) throw new Error(res?.error || "No answer from the extension");
  return res.result as T;
}

async function withBusy(label: string, fn: () => Promise<void>) {
  busy = label;
  error = null;
  render();
  try { await fn(); } catch (err) { error = String((err as Error)?.message ?? err); }
  busy = null;
  render();
}

chrome.runtime.onMessage.addListener((msg: { type: string; [k: string]: unknown }) => {
  if (msg.type === "state") run = msg.state as RunState;
  if (msg.type === "auth") auth = msg.auth as AuthState;
  if (msg.type === "list") { list = msg.list as ShoppingList | null; listMessage = (msg.message as string) ?? null; }
  render();
});

async function init() {
  const { ai_consent_v1, store_url } = await chrome.storage.sync.get(["ai_consent_v1", "store_url"]);
  useAi = ai_consent_v1 === true;
  storeUrl = typeof store_url === "string" ? store_url : "";
  const s = await ask<{ auth: AuthState; state: RunState; list: ShoppingList | null }>({ type: "get-state" });
  auth = s.auth; run = s.state; list = s.list;
  render();
  if (auth.signedIn && !list) withBusy("Loading your list…", async () => { await loadList(); });
}

async function loadList() {
  const data = await ask<ShoppingList | { saved_list: null; message: string }>({ type: "load-list" });
  if ("list_id" in data) { list = data; listMessage = null; } else { list = null; listMessage = data.message; }
  if (!storeUrl && list?.store && STORE_HOME[list.store]) storeUrl = STORE_HOME[list.store];
}

const el = (html: string) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function render() {
  account.innerHTML = auth.signedIn
    ? `<span>${esc(auth.email ?? "Signed in")}</span><button id="signout">Sign out</button>`
    : "";
  account.querySelector("#signout")?.addEventListener("click", () => withBusy("Signing out…", async () => { await ask({ type: "sign-out" }); list = null; }));

  main.innerHTML = "";
  if (error) main.appendChild(el(`<div class="msg bad">${esc(error)}</div>`));
  if (busy) main.appendChild(el(`<div class="msg">${esc(busy)}</div>`));

  if (!auth.signedIn) {
    const card = el(`<section class="card">
      <h2>Sign in to AI Recipe Manager</h2>
      <p>The extension reads the grocery list you saved with <b>Shop my list</b> and puts it into your store's online cart.</p>
      <div class="row"><button class="primary" id="signin" ${busy ? "disabled" : ""}>Sign in</button></div>
      <p class="small">You sign in on airecipemanager.com and approve this extension there. No store passwords are ever typed by the extension.</p>
    </section>`);
    card.querySelector("#signin")!.addEventListener("click", () => withBusy("Waiting for sign-in…", async () => { auth = await ask<AuthState>({ type: "sign-in" }); await loadList(); }));
    main.appendChild(card);
    return;
  }

  main.appendChild(renderList());
  if (list) main.appendChild(renderRun());
}

function renderList(): HTMLElement {
  if (!list) {
    const card = el(`<section class="card">
      <h2>No saved list yet</h2>
      <p>${esc(listMessage ?? "Open the website, go to Grocery List and press Shop my list.")}</p>
      <div class="row">
        <a href="${WEBSITE_URL}/dashboard" target="_blank" rel="noreferrer"><button>Open my grocery list</button></a>
        <button id="reload" ${busy ? "disabled" : ""}>Check again</button>
      </div>
    </section>`);
    card.querySelector("#reload")!.addEventListener("click", () => withBusy("Loading your list…", loadList));
    return card;
  }
  const items = Object.entries(list.items_by_aisle ?? {});
  const card = el(`<section class="card">
    <h2>Your list</h2>
    <div class="stat"><span>${list.item_count} items</span><span>${esc(list.store_label)}</span>${list.zip_code ? `<span>ZIP ${esc(list.zip_code)}</span>` : ""}${list.planned_for ? `<span>${esc(list.planned_for)}</span>` : ""}</div>
    <ul class="items">${items.map(([aisle, its]) => `<li class="aisle">${esc(aisle)}</li>` + its.map((i) => `<li><span class="icon">${statusIcon(i)}</span><span><span class="name">${esc(i.name)}</span>${i.quantity ? ` <span class="detail">${esc(i.quantity)} ${esc(i.unit ?? "")}</span>` : ""}${resultLine(i)}</span></li>`).join("")).join("")}</ul>
    <div class="row" style="margin-top:8px"><button id="reload" ${busy || run?.phase === "running" ? "disabled" : ""}>Reload list</button></div>
  </section>`);
  card.querySelector("#reload")!.addEventListener("click", () => withBusy("Loading your list…", loadList));
  return card;
}

function resultFor(item: ListItem): ItemResult | undefined {
  return run?.results.find((r) => r.key === item.key);
}
function statusIcon(item: ListItem): string {
  const r = resultFor(item);
  if (run?.currentKey === item.key && run.phase === "running") return "⏳";
  if (!r) return "·";
  return { added: "✅", substituted: "🔁", not_found: "❌", skipped: "⚠️" }[r.status];
}
function resultLine(item: ListItem): string {
  const r = resultFor(item);
  if (!r) return "";
  const bits = [r.product, r.price != null ? `$${r.price.toFixed(2)}` : null, r.note, r.chosenBy === "ai" ? "AI pick" : null].filter(Boolean);
  return bits.length ? `<div class="detail">${esc(bits.join(" · "))}</div>` : "";
}

function renderRun(): HTMLElement {
  const running = run?.phase === "running" || run?.phase === "preparing";
  const done = run?.phase === "finished" || run?.phase === "stopped" || run?.phase === "blocked";
  const added = run?.results.filter((r) => r.status === "added" || r.status === "substituted").length ?? 0;
  const card = el(`<section class="card">
    <h2>Shop at</h2>
    <input type="url" id="storeurl" placeholder="https://www.yourstore.com/" value="${esc(storeUrl)}" ${running ? "disabled" : ""} />
    <div class="row small" style="margin-top:6px">
      <button id="usetab" ${running ? "disabled" : ""}>Use current tab</button>
      <span>Any grocery site works. Sign in to the store first.</span>
    </div>
    <label class="switch" style="margin-top:10px">
      <input type="checkbox" id="useai" ${useAi ? "checked" : ""} ${running ? "disabled" : ""} />
      <span>Let AI pick products. Each item's name and the product tiles on the results page are sent to ${esc(AI_PROVIDER_LABEL)}. Off: a built-in matcher chooses by name and size, nothing leaves your browser except the list itself.</span>
    </label>
    <div class="row" style="margin-top:10px">
      ${running ? `<button id="stop">Stop</button>` : `<button class="primary" id="start" ${busy ? "disabled" : ""}>${run?.phase === "blocked" ? "Continue" : "Start shopping"}</button>`}
      <button id="teach" ${running || busy ? "disabled" : ""} title="Click the search box and one Add button so the extension learns this store's layout">Teach this store</button>
    </div>
    ${run?.message ? `<div class="msg ${run.phase === "blocked" ? "warn" : run.phase === "stopped" ? "warn" : ""}" style="margin-top:10px">${esc(run.message)}</div>` : ""}
    ${done ? `<div class="stat" style="margin-top:8px"><span>${added} in cart</span><span>${run!.results.filter((r) => r.status === "not_found").length} not found</span>${run!.estimatedTotal != null ? `<span>about $${run!.estimatedTotal.toFixed(2)}</span>` : ""}</div>` : ""}
    ${done && run?.cartUrl ? `<p><a href="${esc(run.cartUrl)}" target="_blank" rel="noreferrer">Open the cart</a> and place the order yourself.</p>` : ""}
    ${done && run?.results.length && !run.reported ? `<div class="row"><button id="report" ${busy ? "disabled" : ""}>Send report to AI Recipe Manager</button></div>` : ""}
    ${run?.reported ? `<p class="small">Reported. Items in the cart are ticked off your list.</p>` : ""}
  </section>`);

  const urlInput = card.querySelector<HTMLInputElement>("#storeurl")!;
  urlInput.addEventListener("change", () => { storeUrl = urlInput.value.trim(); chrome.storage.sync.set({ store_url: storeUrl }); });
  card.querySelector("#usetab")!.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url?.startsWith("http")) { storeUrl = new URL(tab.url).origin + "/"; urlInput.value = storeUrl; chrome.storage.sync.set({ store_url: storeUrl }); }
  });
  card.querySelector<HTMLInputElement>("#useai")!.addEventListener("change", (e) => {
    useAi = (e.target as HTMLInputElement).checked;
    chrome.storage.sync.set({ ai_consent_v1: useAi });
  });
  card.querySelector("#start")?.addEventListener("click", () => withBusy("Starting…", async () => {
    storeUrl = urlInput.value.trim();
    if (!/^https:\/\//.test(storeUrl)) throw new Error("Enter the store's https:// address or press Use current tab");
    const origin = new URL(storeUrl).origin + "/*";
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error("The extension needs access to that store's pages to add items");
    chrome.storage.sync.set({ store_url: storeUrl });
    run = await ask<RunState>({ type: "start-run", storeUrl, useAi });
  }));
  card.querySelector("#stop")?.addEventListener("click", () => withBusy("Stopping…", async () => { run = await ask<RunState>({ type: "stop-run" }); }));
  card.querySelector("#report")?.addEventListener("click", () => withBusy("Sending report…", async () => { run = await ask<RunState>({ type: "send-report" }); }));
  card.querySelector("#teach")?.addEventListener("click", () => withBusy("In the store tab: click the search box, then one product's Add button…", async () => {
    storeUrl = urlInput.value.trim();
    if (!/^https:\/\//.test(storeUrl)) throw new Error("Enter the store's https:// address first");
    const granted = await chrome.permissions.request({ origins: [new URL(storeUrl).origin + "/*"] });
    if (!granted) throw new Error("The extension needs access to that store's pages");
    const r = await ask<{ host: string; matches: number }>({ type: "teach-store", storeUrl });
    error = null;
    listMessage = null;
    run = { ...(run ?? ({} as RunState)), message: `Learned ${r.host}: ${r.matches} product tiles recognised. Saved for everyone who shops there.` } as RunState;
  }));
  return card;
}

init().catch((err) => { error = String((err as Error)?.message ?? err); render(); });
