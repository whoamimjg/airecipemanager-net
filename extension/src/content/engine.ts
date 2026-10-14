// Content script: the part of the extension that reads and clicks a store page.
//
// It does not know which store it is on. A built-in, learned or taught adapter
// may give it CSS selectors; when they are missing or stale it falls back to
// heuristics that work on most grocery sites: every tile with an "Add" control,
// a price and a name is a product.
//
// Hard rules enforced here, not just in the UI:
//   - it never clicks anything that looks like checkout, payment or purchase;
//   - it never types anything but a product search;
//   - it stops and reports when a bot check or a login wall is on screen.
import type {
  Adapter, AddResult, Candidate, CartInfo, CollectResult, ContentRequest, PageOutline, PageStatus, SearchResult,
} from "../shared/types";

declare global {
  interface Window { __armShopEngine?: { version: number } }
}

(() => {
  const VERSION = 1;
  if (window.__armShopEngine?.version === VERSION) return; // already injected on this page
  window.__armShopEngine = { version: VERSION };

  let adapter: Adapter | null = null;
  type Card = { el: HTMLElement; add: HTMLElement; candidate: Candidate };
  let lastCards: Card[] = [];

  // ---------- small DOM helpers ----------

  const PRICE_RE = /\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)(?!\s?(?:\/|per\b|each\b|ea\b))/;
  const ANY_PRICE_RE = /\$\s?\d/;
  const SIZE_RE = /\b(\d+(?:\.\d+)?)\s?(fl\s?oz|oz|lbs?|pounds?|g|kg|ml|l|qt|pt|gal|ct|count|pk|pack|each|ea|dozen)\b/i;
  const UNIT_PRICE_RE = /\$\s?\d+(?:\.\d+)?\s?\/\s?(?:fl\s?oz|oz|lb|ct|each|ea|100\s?g|kg|l)/i;
  const ADD_TEXT_RE = /^(?:\+|add|add to cart|add to basket|add to bag|add to order|add item|add for (?:pickup|delivery|shipping)|add to trolley)$/i;
  const ADD_ARIA_RE = /\badd\b.*\b(?:cart|basket|bag|order)\b|\badd to cart\b/i;
  const FORBIDDEN_RE = /check\s?out|place (?:your )?order|buy now|pay(?:ment)?|purchase|order now|subscribe|sign ?in|log ?in|password|remove|delete/i;
  const UNAVAILABLE_RE = /out of stock|sold out|unavailable|not available|currently unavailable|notify me/i;
  const SIGNIN_ADD_RE = /sign ?in (?:to|and) add|log ?in to add/i;
  const BOT_RE = /press (?:and|&) hold|verify (?:that )?you are (?:a )?human|are you a (?:robot|human)|robot or human|unusual traffic|access denied|request blocked|security check|complete the captcha/i;

  const text = (el: Element | null | undefined) =>
    ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const label = (el: Element) =>
    (el.getAttribute("aria-label") || el.getAttribute("title") || text(el) || (el as HTMLInputElement).value || "").trim();
  const visible = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el as HTMLElement);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const inChrome = (el: Element) => !!el.closest("header, nav, footer, [role=navigation], [role=banner], [role=contentinfo], [class*=minicart i], [id*=minicart i], [class*=mini-cart i]");
  const parsePrice = (s: string | null) => {
    if (!s) return null;
    const m = s.match(/\d{1,4}(?:,\d{3})*(?:\.\d{2})?/);
    return m ? parseFloat(m[0].replace(/,/g, "")) : null;
  };

  function cssPath(el: Element, depth = 4): string {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur !== document.body && parts.length < depth) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && !/\d{3,}/.test(cur.id)) {
        parts.unshift(`${part}#${CSS.escape(cur.id)}`);
        break;
      }
      const classes = Array.from(cur.classList).filter((c) => !/\d{3,}|^(?:is|has|js)-/.test(c)).slice(0, 2);
      if (classes.length) part += "." + classes.map((c) => CSS.escape(c)).join(".");
      const attr = ["data-testid", "data-test", "data-automation-id", "data-qa"].find((a) => cur!.getAttribute(a));
      if (attr) part += `[${attr}="${cur.getAttribute(attr)!.replace(/"/g, '\\"')}"]`;
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  // ---------- page status ----------

  function pageStatus(): PageStatus {
    const body = document.body?.innerText?.slice(0, 20000) ?? "";
    const captchaFrame = Array.from(document.querySelectorAll("iframe")).some(
      (f) => /captcha|challenge|px-captcha|perimeterx|datadome|arkose/i.test(f.src + " " + f.title + " " + f.id) && visible(f) && f.getBoundingClientRect().height > 60,
    );
    const pw = Array.from(document.querySelectorAll<HTMLInputElement>("input[type=password]")).some(visible);
    const signInToAdd = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a")).some((el) => visible(el) && SIGNIN_ADD_RE.test(label(el)));
    const checkoutPage = /\/(checkout|payment|purchase|billing|place-order)\b/i.test(location.pathname) ||
      Array.from(document.querySelectorAll("h1, h2")).some((h) => /^(checkout|payment|place (your )?order)$/i.test(text(h)));
    return {
      url: location.href,
      host: location.hostname,
      botCheck: BOT_RE.test(body.slice(0, 4000)) || captchaFrame,
      loginWall: (pw || signInToAdd) && !findAddControls().length,
      checkoutPage,
      title: document.title,
    };
  }

  // ---------- search ----------

  function findSearchInput(): HTMLInputElement | null {
    if (adapter?.searchInput) {
      const el = document.querySelector<HTMLInputElement>(adapter.searchInput);
      if (el && visible(el)) return el;
    }
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type=search], input[type=text], input:not([type])'))
      .filter(visible)
      .filter((i) => !/zip|postal|email|phone|password|promo|coupon|address|name/i.test(i.name + " " + i.placeholder + " " + (i.getAttribute("aria-label") || "")));
    const score = (i: HTMLInputElement) => {
      const s = `${i.type} ${i.name} ${i.id} ${i.placeholder} ${i.getAttribute("aria-label") || ""} ${i.className} ${i.getAttribute("role") || ""}`.toLowerCase();
      let n = 0;
      if (i.type === "search") n += 5;
      if (/search/.test(s)) n += 4;
      if (/combobox|searchbox/.test(s)) n += 2;
      if (/product|item|grocer|what are you looking/.test(s)) n += 2;
      if (i.closest("form")?.getAttribute("role") === "search") n += 3;
      if (i.closest("header")) n += 1;
      return n;
    };
    inputs.sort((a, b) => score(b) - score(a));
    return inputs[0] && score(inputs[0]) > 0 ? inputs[0] : null;
  }

  function setNativeValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter ? setter.call(input, value) : (input.value = value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function search(query: string): Promise<SearchResult> {
    const input = findSearchInput();
    if (!input) throw new Error("No search box found on this page");
    const form = input.closest("form");
    // A plain GET form is the cleanest path: build the URL and let the page load.
    if (form && (form.method || "get").toLowerCase() === "get" && form.action && input.name) {
      const u = new URL(form.action, location.href);
      u.searchParams.set(input.name, query);
      const before = signature();
      location.assign(u.toString());
      await sleep(300);
      return { navigated: true, inPlace: false, url: u.toString() };
    }
    const before = signature();
    const beforeUrl = location.href;
    input.focus();
    setNativeValue(input, "");
    await sleep(50);
    setNativeValue(input, query);
    await sleep(150);
    const key = (type: string) => input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    key("keydown");
    key("keypress");
    key("keyup");
    if (form) form.requestSubmit?.() ?? form.submit();
    // Wait for the results to change in place (SPA) or for a navigation to start.
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      if (location.href !== beforeUrl && !document.body) return { navigated: true, inPlace: false, url: location.href };
      if (signature() !== before && findAddControls().length > 0) return { navigated: location.href !== beforeUrl, inPlace: true, url: location.href };
    }
    return { navigated: location.href !== beforeUrl, inPlace: true, url: location.href };
  }

  /** Cheap fingerprint of what products are on screen now. */
  function signature(): string {
    return findAddControls().slice(0, 12).map((b) => text(cardFor(b) ?? b).slice(0, 40)).join("|");
  }

  // ---------- collecting product tiles ----------

  function findAddControls(): HTMLElement[] {
    const sel = adapter?.addButton ? `${adapter.addButton}, button, [role=button], a, input[type=button], input[type=submit]` : "button, [role=button], a, input[type=button], input[type=submit]";
    const out: HTMLElement[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (!visible(el) || inChrome(el)) continue;
      const t = text(el);
      const aria = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
      const matchesAdapter = adapter?.addButton ? el.matches(adapter.addButton) : false;
      const isAdd = matchesAdapter || (t.length <= 40 && ADD_TEXT_RE.test(t)) || ADD_ARIA_RE.test(aria) || /^add to (cart|basket|bag)/i.test(t);
      if (!isAdd) continue;
      if (FORBIDDEN_RE.test(t) || FORBIDDEN_RE.test(aria)) continue;
      out.push(el);
    }
    return out;
  }

  /** The product tile an add control belongs to: the widest ancestor that still holds only this one add control. */
  function cardFor(add: HTMLElement): HTMLElement | null {
    if (adapter?.productCard) {
      const c = add.closest<HTMLElement>(adapter.productCard);
      if (c) return c;
    }
    let cur: HTMLElement | null = add.parentElement;
    let best: HTMLElement | null = null;
    for (let depth = 0; cur && cur !== document.body && depth < 12; depth++) {
      const adds = countAddControls(cur);
      if (adds > 1) break;
      best = cur;
      const t = cur.innerText || "";
      if (ANY_PRICE_RE.test(t) && (cur.querySelector("a[href], h1, h2, h3, h4, h5, h6, img[alt]") !== null) && t.length > 20) {
        // Keep climbing a little while the parent still has a single add control
        // and is not much bigger: tiles often wrap price and name in siblings.
        const parent = cur.parentElement;
        if (parent && parent !== document.body && countAddControls(parent) === 1 && (parent.innerText || "").length < t.length * 2.5) {
          cur = parent;
          continue;
        }
        return cur;
      }
      cur = cur.parentElement;
    }
    return best;
  }

  function countAddControls(root: HTMLElement): number {
    let n = 0;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("button, [role=button], a, input[type=button], input[type=submit]"))) {
      const t = text(el);
      const aria = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
      if ((adapter?.addButton && el.matches(adapter.addButton)) || (t.length <= 40 && ADD_TEXT_RE.test(t)) || ADD_ARIA_RE.test(aria) || /^add to (cart|basket|bag)/i.test(t)) {
        if (visible(el)) n++;
        if (n > 1) return n;
      }
    }
    return n;
  }

  /** Product names never include the price or the add control's own words. */
  function cleanName(s: string): string {
    return s
      .replace(/\s*(?:current price|now|sale|was|reg\.?|regular price)?\s*\$\s?\d[\d.,]*(?:\s*(?:\/|per)\s*\S+)?\s*/gi, " ")
      .replace(/\b(?:sponsored|best seller|rollback|add to cart|add)\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s,:-]+|[\s,:-]+$/g, "")
      .trim();
  }

  function nameFromAddLabel(add: HTMLElement): string {
    const aria = (add.getAttribute("aria-label") || add.getAttribute("title") || "").trim();
    const m = aria.match(/^add(?: to cart)?\s*[-:–,]?\s*(.+?)(?:,?\s*to (?:the |your )?cart)?$/i);
    return m && m[1].length > 2 && !/^(?:to )?cart$/i.test(m[1]) ? m[1].trim() : "";
  }

  function nameOf(card: HTMLElement, add: HTMLElement): string {
    const pick = (sel: string | undefined) => (sel ? text(card.querySelector(sel)) : "");
    let n = pick(adapter?.name);
    if (n) return cleanName(n);
    n = nameFromAddLabel(add);
    if (n) return cleanName(n);
    const heading = card.querySelector("h1, h2, h3, h4, h5, h6");
    n = cleanName(text(heading));
    if (n && n.length > 2) return n;
    const links = Array.from(card.querySelectorAll<HTMLElement>("a[href]"))
      .filter((a) => a !== add && !a.contains(add))
      .map((a) => cleanName(text(a) || (a.querySelector("img")?.getAttribute("alt") ?? "") || a.getAttribute("aria-label") || ""))
      .filter((s) => s.length > 2 && s.length < 180 && !ADD_TEXT_RE.test(s));
    if (links.length) return links.sort((a, b) => b.length - a.length)[0];
    const alt = card.querySelector("img[alt]")?.getAttribute("alt")?.trim();
    if (alt && alt.length > 2) return cleanName(alt);
    return cleanName((card.innerText || "").split("\n").map((s) => s.trim()).filter((s) => s.length > 3 && !ANY_PRICE_RE.test(s))[0] || "");
  }

  function candidateFrom(card: HTMLElement, add: HTMLElement, index: number): Candidate {
    const t = card.innerText || "";
    const priceEl = adapter?.price ? card.querySelector(adapter.price) : null;
    const priceText = priceEl ? text(priceEl) : (t.match(PRICE_RE)?.[0] ?? null);
    const sizeEl = adapter?.size ? card.querySelector(adapter.size) : null;
    const size = sizeEl ? text(sizeEl) : (t.match(SIZE_RE)?.[0] ?? null);
    const unitPrice = t.match(UNIT_PRICE_RE)?.[0] ?? null;
    return {
      index,
      name: nameOf(card, add).slice(0, 200),
      price: parsePrice(priceText),
      priceText,
      size,
      unitPrice,
      brand: null,
      addLabel: label(add).slice(0, 60),
      unavailable: UNAVAILABLE_RE.test(t) || (add as HTMLButtonElement).disabled === true,
    };
  }

  function collect(): CollectResult {
    lastCards = [];
    const seen = new Set<HTMLElement>();
    let strategy: CollectResult["strategy"] = "heuristic";
    let adds: HTMLElement[] = [];

    if (adapter?.productCard) {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(adapter.productCard)).filter(visible);
      for (const card of cards) {
        const add = (adapter.addButton ? card.querySelector<HTMLElement>(adapter.addButton) : null) ?? findAddControls().find((b) => card.contains(b)) ?? null;
        if (!add) continue;
        seen.add(card);
        lastCards.push({ el: card, add, candidate: candidateFrom(card, add, lastCards.length) });
        if (lastCards.length >= 15) break;
      }
      if (lastCards.length) strategy = "adapter";
    }

    if (!lastCards.length) {
      adds = findAddControls();
      for (const add of adds) {
        const card = cardFor(add);
        if (!card || seen.has(card)) continue;
        seen.add(card);
        const c = candidateFrom(card, add, lastCards.length);
        if (!c.name) continue;
        lastCards.push({ el: card, add, candidate: c });
        if (lastCards.length >= 15) break;
      }
    }

    enrichFromJsonLd();
    if (!lastCards.length) strategy = "none";
    return { candidates: lastCards.map((c) => c.candidate), strategy };
  }

  /** Many stores embed schema.org Product data; use it to fill brand and price. */
  function enrichFromJsonLd() {
    const products: { name: string; brand: string | null; price: number | null }[] = [];
    for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const walk = (node: any) => {
          if (!node || typeof node !== "object") return;
          if (Array.isArray(node)) return node.forEach(walk);
          const type = String(node["@type"] ?? "");
          if (/Product/.test(type) && node.name) {
            const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
            products.push({
              name: String(node.name),
              brand: typeof node.brand === "string" ? node.brand : node.brand?.name ?? null,
              price: offers?.price != null ? parseFloat(offers.price) : null,
            });
          }
          for (const v of Object.values(node)) walk(v);
        };
        walk(JSON.parse(s.textContent || "null"));
      } catch { /* not our JSON */ }
    }
    if (!products.length) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    for (const card of lastCards) {
      const n = norm(card.candidate.name);
      const hit = products.find((p) => norm(p.name) === n) ?? products.find((p) => n && (norm(p.name).includes(n) || n.includes(norm(p.name))));
      if (!hit) continue;
      card.candidate.brand = hit.brand;
      if (card.candidate.price === null && hit.price !== null && !isNaN(hit.price)) card.candidate.price = hit.price;
    }
  }

  // ---------- adding to the cart ----------

  function cartCount(): number | null {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[aria-label*="cart" i], [title*="cart" i], a[href*="cart" i], [class*="cart-count" i], [class*="cartCount" i], [class*="cart-badge" i], [data-testid*="cart" i]'));
    let best: number | null = null;
    for (const el of els) {
      const aria = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      if (ADD_ARIA_RE.test(aria) || SIGNIN_ADD_RE.test(aria)) continue; // a product's add button, not the badge
      const t = text(el);
      // "cart 3 items", "3 items in cart", or a bare "3" badge.
      const m = aria.match(/(\d{1,3})\s*items?/i) || (/^\d{1,3}$/.test(t) ? [t, t] : null) || t.match(/(\d{1,3})\s*items?\b/i);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (n < 500) best = best === null ? n : Math.max(best, n);
    }
    return best;
  }

  async function add(index: number): Promise<AddResult> {
    const card = lastCards[index];
    if (!card) throw new Error("That product is no longer on the page; search again");
    const btn = card.add;
    const t = label(btn);
    if (FORBIDDEN_RE.test(t)) throw new Error(`Refusing to click "${t}"`);
    if (!visible(btn)) return { clicked: false, verified: false, label: t, note: "add button not visible" };
    const countBefore = cartCount();
    const labelBefore = t;
    const cardTextBefore = card.el.innerText || "";
    const bodyHadToast = /added to (?:your )?cart/i.test(document.body.innerText.slice(0, 50000));
    btn.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(200);
    btn.click();
    for (let i = 0; i < 8; i++) {
      await sleep(500);
      const countAfter = cartCount();
      if (countBefore !== null && countAfter !== null && countAfter > countBefore) return { clicked: true, verified: true, label: t, note: "cart count went up" };
      if (!document.contains(btn) || label(btn) !== labelBefore) return { clicked: true, verified: true, label: t, note: "add button changed" };
      if (card.el.querySelector('input[type=number], [aria-label*="quantity" i], [aria-label*="decrease" i], [aria-label*="remove" i]') && !/input\[type=number\]/.test(cardTextBefore)) {
        return { clicked: true, verified: true, label: t, note: "quantity control appeared" };
      }
      if (!bodyHadToast && /added to (?:your )?cart/i.test(document.body.innerText.slice(0, 50000))) return { clicked: true, verified: true, label: t, note: "store confirmed" };
    }
    // Some stores need a second click on a "choose options" sheet; report honestly.
    return { clicked: true, verified: false, label: t, note: "clicked, but the page gave no confirmation" };
  }

  // ---------- cart ----------

  function cartInfo(): CartInfo {
    let cartUrl: string | null = null;
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) => /\/cart\b|\/basket\b|\/bag\b/i.test(a.getAttribute("href") || "") && !/checkout/i.test(a.href));
    if (link) cartUrl = link.href;
    let estimatedTotal: number | null = null;
    const body = document.body.innerText || "";
    const m = body.match(/(?:estimated|order|subtotal|cart)\s*(?:total|subtotal)?[^$\n]{0,30}\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i);
    if (m) estimatedTotal = parseFloat(m[1].replace(/,/g, ""));
    return { cartUrl, estimatedTotal, count: cartCount() };
  }

  // ---------- outline for selector inference ----------

  function outline(): PageOutline {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea")).filter(visible).slice(0, 15).map((i) => ({
      css: cssPath(i), type: i.type || "text", name: i.name || "", placeholder: i.placeholder || "", ariaLabel: i.getAttribute("aria-label") || "",
    }));
    const byText = new Map<string, { css: string; text: string; ariaLabel: string; count: number }>();
    for (const b of Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a")).filter(visible)) {
      const t = text(b).slice(0, 40);
      const aria = (b.getAttribute("aria-label") || "").slice(0, 60);
      if (!t && !aria) continue;
      const key = (t || aria).toLowerCase().replace(/\d+/g, "#");
      const cur = byText.get(key);
      if (cur) cur.count++;
      else byText.set(key, { css: cssPath(b, 3), text: t, ariaLabel: aria, count: 1 });
    }
    const buttons = Array.from(byText.values()).sort((a, b) => b.count - a.count).slice(0, 40);
    const repeats: PageOutline["repeats"] = [];
    const seen = new Set<string>();
    for (const parent of Array.from(document.querySelectorAll<HTMLElement>("ul, ol, div, section"))) {
      const kids = Array.from(parent.children) as HTMLElement[];
      if (kids.length < 4) continue;
      const groups = new Map<string, HTMLElement[]>();
      for (const k of kids) {
        const key = k.tagName + "." + Array.from(k.classList).slice(0, 2).join(".");
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(k);
      }
      for (const [key, els] of groups) {
        if (els.length < 4 || !visible(els[0])) continue;
        const sample = (els[0].innerText || "").replace(/\s+/g, " ").slice(0, 140);
        if (!ANY_PRICE_RE.test(sample)) continue;
        const css = cssPath(els[0], 3);
        if (seen.has(css)) continue;
        seen.add(css);
        repeats.push({ css, count: els.length, sample });
        if (repeats.length >= 20) break;
      }
      if (repeats.length >= 20) break;
    }
    return { url: location.href, title: document.title, inputs, buttons, repeats };
  }

  // ---------- teach mode ----------

  /**
   * The user clicks the search box, then one "Add" button. From those two clicks
   * we derive the selectors for the whole page: the tile is the add button's
   * ancestor whose class pattern repeats, and name/price come from inside it.
   */
  function teach(): Promise<Partial<Adapter> & { matches: number }> {
    return new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1f2937;color:#fff;padding:10px 16px;border-radius:10px;font:14px system-ui;box-shadow:0 4px 20px rgba(0,0,0,.3)";
      overlay.textContent = "Step 1 of 2: click the store's search box. (Esc cancels)";
      document.body.appendChild(overlay);
      const hi = document.createElement("div");
      hi.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #22c55e;border-radius:6px;background:rgba(34,197,94,.08)";
      document.body.appendChild(hi);
      let step = 1;
      let searchSel = "";
      const move = (e: MouseEvent) => {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        if (!el || el === overlay) return;
        const r = el.getBoundingClientRect();
        hi.style.cssText += `;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      };
      const done = () => {
        document.removeEventListener("mousemove", move, true);
        document.removeEventListener("click", click, true);
        document.removeEventListener("keydown", esc, true);
        overlay.remove();
        hi.remove();
      };
      const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { done(); reject(new Error("Teaching cancelled")); } };
      const click = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        if (!el) return;
        if (step === 1) {
          const input = el.closest("input, textarea") as HTMLInputElement | null;
          if (!input) { overlay.textContent = "That is not a text box. Click the search box."; return; }
          searchSel = input.id ? `#${CSS.escape(input.id)}` : input.name ? `input[name="${input.name}"]` : input.placeholder ? `input[placeholder="${input.placeholder}"]` : cssPath(input);
          step = 2;
          overlay.textContent = "Step 2 of 2: click the Add button on one product.";
          return;
        }
        const btn = el.closest("button, [role=button], a") as HTMLElement | null;
        if (!btn) { overlay.textContent = "That is not a button. Click a product's Add button."; return; }
        // Find the repeating ancestor: the tile.
        let tile: HTMLElement | null = btn.parentElement;
        let tileSel = "";
        for (let d = 0; tile && d < 10; d++) {
          const classes = Array.from(tile.classList).filter((c) => !/\d{3,}/.test(c)).slice(0, 2);
          if (classes.length) {
            const sel = `${tile.tagName.toLowerCase()}.${classes.map((c) => CSS.escape(c)).join(".")}`;
            const n = document.querySelectorAll(sel).length;
            if (n >= 3 && n <= 200 && ANY_PRICE_RE.test(tile.innerText || "")) { tileSel = sel; break; }
          }
          tile = tile.parentElement;
        }
        if (!tile || !tileSel) { overlay.textContent = "Could not find the product tile around that button. Try another product's Add button."; return; }
        const btnClasses = Array.from(btn.classList).filter((c) => !/\d{3,}/.test(c)).slice(0, 2);
        const addSel = btn.getAttribute("aria-label") ? `${btn.tagName.toLowerCase()}[aria-label*="${btn.getAttribute("aria-label")!.split(" ")[0]}"]` : btnClasses.length ? `${btn.tagName.toLowerCase()}.${btnClasses.map((c) => CSS.escape(c)).join(".")}` : btn.tagName.toLowerCase();
        const nameEl = tile.querySelector("h1, h2, h3, h4, h5, h6") ?? Array.from(tile.querySelectorAll("a[href]")).find((a) => text(a).length > 3 && !ANY_PRICE_RE.test(text(a)));
        const priceEl = Array.from(tile.querySelectorAll<HTMLElement>("span, div, p")).find((s) => PRICE_RE.test(text(s)) && text(s).length < 20);
        const rel = (e: Element | null | undefined) => {
          if (!e) return undefined;
          const classes = Array.from(e.classList).filter((c) => !/\d{3,}/.test(c)).slice(0, 2);
          return classes.length ? `${e.tagName.toLowerCase()}.${classes.map((c) => CSS.escape(c)).join(".")}` : e.tagName.toLowerCase();
        };
        done();
        resolve({ searchInput: searchSel, productCard: tileSel, addButton: addSel, name: rel(nameEl), price: rel(priceEl), matches: document.querySelectorAll(tileSel).length });
      };
      document.addEventListener("mousemove", move, true);
      document.addEventListener("click", click, true);
      document.addEventListener("keydown", esc, true);
    });
  }

  // ---------- message handling ----------

  async function handle(msg: ContentRequest): Promise<unknown> {
    switch (msg.type) {
      case "ping": return { ok: true, version: VERSION, host: location.hostname };
      case "configure": adapter = msg.adapter; return { ok: true };
      case "page-status": return pageStatus();
      case "search": return search(msg.query);
      case "collect": return collect();
      case "outline": return outline();
      case "add": return add(msg.index);
      case "cart-info": return cartInfo();
      case "teach": return teach();
    }
  }

  chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
    handle(msg).then(
      (result) => sendResponse({ ok: true, result }),
      (err) => sendResponse({ ok: false, error: String((err as Error)?.message ?? err) }),
    );
    return true;
  });
})();
