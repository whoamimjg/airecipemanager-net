// Types shared by the service worker, the content script and the side panel.

/** One grocery list item as the MCP server returns it. */
export interface ListItem {
  key: string;
  name: string;
  quantity?: string;
  unit?: string;
  category?: string;
  note?: string;
  recipes?: string[];
}

export interface ShoppingList {
  list_id: string;
  saved_at: string;
  status: string;
  store: string | null;
  store_label: string;
  zip_code: string | null;
  planned_for: string | null;
  item_count: number;
  items_by_aisle: Record<string, ListItem[]>;
  shopper: {
    account_email: string | null;
    first_name: string | null;
    diet_restrictions: string[];
    household_size: number | null;
  };
  previous_result: unknown;
  rules: string[];
}

/** A product tile the content script found on a results page. */
export interface Candidate {
  index: number;
  name: string;
  price: number | null;
  priceText: string | null;
  size: string | null;
  unitPrice: string | null;
  brand: string | null;
  /** Text on the add control, e.g. "Add to cart". */
  addLabel: string;
  /** Whether the tile shows the product as out of stock / unavailable. */
  unavailable: boolean;
}

export type ItemStatus = "added" | "substituted" | "not_found" | "skipped";

export interface ItemResult {
  key: string;
  name: string;
  status: ItemStatus;
  product?: string;
  price?: number;
  note?: string;
  /** "ai" when Gemini chose, "rules" when the local matcher chose. */
  chosenBy?: "ai" | "rules";
  verified?: boolean;
}

/** Selectors that describe one store's results page. Built-in, learned, or taught. */
export interface Adapter {
  /** Hostname suffixes this adapter applies to. */
  hosts: string[];
  /** Search URL with {q} for the encoded query. Preferred over typing into a box. */
  searchUrl?: string;
  searchInput?: string;
  productCard?: string;
  name?: string;
  price?: string;
  size?: string;
  addButton?: string;
  cartUrl?: string;
  /** Free-form notes shown to the user before the run (e.g. known bot checks). */
  notes?: string[];
  source: "builtin" | "learned" | "taught";
}

export type RunPhase = "idle" | "preparing" | "running" | "finished" | "stopped" | "blocked";

export interface RunState {
  phase: RunPhase;
  listId: string | null;
  store: string | null;
  storeUrl: string | null;
  tabId: number | null;
  items: ListItem[];
  results: ItemResult[];
  currentKey: string | null;
  message: string | null;
  cartUrl: string | null;
  estimatedTotal: number | null;
  reported: boolean;
  startedAt: number | null;
}

/** Messages the side panel sends to the service worker. */
export type PanelRequest =
  | { type: "get-state" }
  | { type: "sign-in" }
  | { type: "sign-out" }
  | { type: "load-list" }
  | { type: "start-run"; storeUrl: string; useAi: boolean }
  | { type: "stop-run" }
  | { type: "send-report" }
  | { type: "teach-store"; storeUrl: string };

/** Messages the service worker sends to the content script. */
export type ContentRequest =
  | { type: "ping" }
  | { type: "configure"; adapter: Adapter | null }
  | { type: "page-status" }
  | { type: "search"; query: string }
  | { type: "collect" }
  | { type: "outline" }
  | { type: "add"; index: number }
  | { type: "cart-info" }
  | { type: "teach" };

export interface PageStatus {
  url: string;
  host: string;
  botCheck: boolean;
  loginWall: boolean;
  checkoutPage: boolean;
  title: string;
}

export interface SearchResult {
  /** The search started a full navigation; the worker must re-inject and collect after load. */
  navigated: boolean;
  /** The engine typed into a box and waited for results in place. */
  inPlace: boolean;
  url: string;
}

export interface CollectResult {
  candidates: Candidate[];
  /** Which strategy produced the candidates. */
  strategy: "adapter" | "jsonld" | "heuristic" | "none";
}

export interface AddResult {
  clicked: boolean;
  verified: boolean;
  label: string;
  note?: string;
}

export interface CartInfo {
  cartUrl: string | null;
  estimatedTotal: number | null;
  count: number | null;
}

/** Compact description of a page for the selector-inference call. */
export interface PageOutline {
  url: string;
  title: string;
  inputs: { css: string; type: string; name: string; placeholder: string; ariaLabel: string }[];
  buttons: { css: string; text: string; ariaLabel: string; count: number }[];
  repeats: { css: string; count: number; sample: string }[];
}

export interface AuthState {
  signedIn: boolean;
  email: string | null;
}
