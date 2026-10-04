/**
 * Grocery stores the user can pick as their preferred store. Shared by Account
 * settings (where it's chosen), the grocery list's "Shop my list" dialog, and
 * mirrored in the MCP server's labels (supabase/functions/mcp/index.ts).
 */
export type StoreId = "kroger" | "walmart" | "meijer" | "giant_eagle" | "aldi" | "target" | "costco" | "other";

export interface StoreInfo {
  id: StoreId;
  label: string;
  /** Where "Open store" sends the user. */
  url: string;
  /** Whether the store sells groceries online for pickup/delivery. */
  onlineOrdering: boolean;
}

export const STORES: StoreInfo[] = [
  { id: "kroger", label: "Kroger", url: "https://www.kroger.com/", onlineOrdering: true },
  { id: "walmart", label: "Walmart", url: "https://www.walmart.com/grocery", onlineOrdering: true },
  { id: "meijer", label: "Meijer", url: "https://www.meijer.com/", onlineOrdering: true },
  { id: "giant_eagle", label: "Giant Eagle", url: "https://www.gianteagle.com/", onlineOrdering: true },
  { id: "aldi", label: "Aldi", url: "https://www.aldi.us/", onlineOrdering: true },
  { id: "target", label: "Target", url: "https://www.target.com/c/grocery/-/N-5xt1a", onlineOrdering: true },
  { id: "costco", label: "Costco", url: "https://www.costco.com/grocery-household.html", onlineOrdering: true },
  { id: "other", label: "Another store", url: "", onlineOrdering: false },
];

export const storeById = (id: string | null | undefined): StoreInfo | undefined =>
  STORES.find((s) => s.id === id);

export const storeLabel = (id: string | null | undefined): string =>
  storeById(id)?.label ?? (id ? id : "your store");

/** The MCP server AI agents connect to. Same project as the app. */
export const MCP_SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;

/** Skill file for Claude Code and other agents that read SKILL.md. */
export const SKILL_URL = "https://airecipemanager.com/skills/shop-my-list/SKILL.md";

/** What the user says to Claude to start a run. */
export const shoppingPrompt = (store: string | null | undefined) => {
  const label = storeLabel(store);
  return (
    `Shop my AI Recipe Manager grocery list at ${label}. ` +
    `Use the AI Recipe Manager connector to get my saved list, add every item to my ${label} cart in my browser, ` +
    `tell me what you couldn't find or substituted, then stop before checkout so I can place the order myself.`
  );
};
