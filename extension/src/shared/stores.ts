import type { Adapter } from "./types";

/** Where "Open store" points for each store id the website lets the user pick. */
export const STORE_HOME: Record<string, string> = {
  kroger: "https://www.kroger.com/",
  walmart: "https://www.walmart.com/grocery",
  meijer: "https://www.meijer.com/",
  giant_eagle: "https://www.gianteagle.com/",
  aldi: "https://www.instacart.com/store/aldi/storefront",
  target: "https://www.target.com/c/grocery/-/N-5xt1a",
  costco: "https://www.costco.com/grocery-household.html",
};

/**
 * Tuned adapters for the big chains. A search URL beats typing into a box:
 * it survives page redesigns, and a full navigation gives a clean results page.
 * Card/name/price/add selectors are optional; the generic engine fills in
 * whatever is missing, so a stale selector degrades to the heuristic path
 * instead of breaking the store.
 */
export const BUILTIN_ADAPTERS: Adapter[] = [
  {
    hosts: ["kroger.com", "fredmeyer.com", "ralphs.com", "kingsoopers.com", "frysfood.com", "smithsfoodanddrug.com", "harristeeter.com", "marianos.com", "picknsave.com", "foodsco.net", "qfc.com", "dillons.com", "bakersplus.com", "gerbes.com", "jaycfoods.com", "citymarket.com", "food4less.com", "metromarket.net", "owensmarket.com", "paylessmarket.com"],
    searchUrl: "https://www.{host}/search?query={q}&searchType=default_search",
    cartUrl: "https://www.{host}/cart",
    searchInput: "#SearchBar-input",
    productCard: '[data-testid^="product-card-"]',
    addButton: '[data-testid="pc-add-to-cart"]',
    name: '[data-testid="cart-page-item-description"]',
    notes: ["Kroger: make sure the pickup store or delivery address at the top of the page is the one you want."],
    source: "builtin",
  },
  {
    hosts: ["walmart.com"],
    searchUrl: "https://www.walmart.com/search?q={q}",
    cartUrl: "https://www.walmart.com/cart",
    searchInput: '[data-automation-id="header-input-search"]',
    productCard: '[data-testid="item-stack"] > div',
    addButton: '[data-automation-id="add-to-cart"]',
    notes: ["Walmart sometimes shows a press-and-hold bot check. The run stops if it appears; finish the check yourself and press Start again."],
    source: "builtin",
  },
  {
    hosts: ["meijer.com"],
    searchUrl: "https://www.meijer.com/shopping/search/{q}",
    cartUrl: "https://www.meijer.com/shopping/cart.html",
    notes: ["Meijer: choose pickup or delivery before you start so items go into the right cart."],
    source: "builtin",
  },
  {
    hosts: ["gianteagle.com"],
    searchUrl: "https://www.gianteagle.com/grocery/search?q={q}",
    cartUrl: "https://www.gianteagle.com/grocery/cart",
    source: "builtin",
  },
  {
    hosts: ["target.com"],
    searchUrl: "https://www.target.com/s?searchTerm={q}",
    cartUrl: "https://www.target.com/cart",
    source: "builtin",
  },
  {
    hosts: ["costco.com"],
    searchUrl: "https://www.costco.com/s?keyword={q}",
    cartUrl: "https://www.costco.com/CheckoutCartDisplayView",
    notes: ["Costco sells most groceries in bulk; expect substitutions with larger sizes."],
    source: "builtin",
  },
  {
    hosts: ["instacart.com"],
    searchUrl: "https://www.instacart.com/store/s?k={q}",
    notes: ["Instacart: open the store you want first; the search stays inside that store."],
    source: "builtin",
  },
  {
    hosts: ["aldi.us"],
    searchUrl: "https://www.aldi.us/results?q={q}",
    notes: ["Aldi online orders are fulfilled through Instacart; the cart may hand off to instacart.com."],
    source: "builtin",
  },
  {
    hosts: ["heb.com"],
    searchUrl: "https://www.heb.com/search?q={q}",
    cartUrl: "https://www.heb.com/cart",
    source: "builtin",
  },
  {
    hosts: ["wegmans.com"],
    searchUrl: "https://shop.wegmans.com/search?search_term={q}",
    source: "builtin",
  },
  {
    hosts: ["publix.com"],
    searchUrl: "https://www.publix.com/search?searchTerm={q}",
    source: "builtin",
  },
  {
    hosts: ["safeway.com", "albertsons.com", "vons.com", "jewelosco.com", "acmemarkets.com", "shaws.com", "tomthumb.com", "randalls.com", "pavilions.com", "carrsqc.com", "starmarket.com"],
    searchUrl: "https://www.{host}/shop/search-results.html?q={q}",
    source: "builtin",
  },
  {
    hosts: ["wholefoodsmarket.com"],
    searchUrl: "https://www.wholefoodsmarket.com/search?text={q}",
    notes: ["Whole Foods online ordering runs through Amazon; sign in there first."],
    source: "builtin",
  },
  {
    hosts: ["amazon.com"],
    searchUrl: "https://www.amazon.com/s?k={q}&i=grocery",
    cartUrl: "https://www.amazon.com/gp/cart/view.html",
    source: "builtin",
  },
  {
    hosts: ["shoprite.com"],
    searchUrl: "https://www.shoprite.com/sm/pickup/rsid/3000/results?q={q}",
    source: "builtin",
  },
  {
    hosts: ["stopandshop.com", "giantfood.com", "giantfoodstores.com", "foodlion.com", "hannaford.com"],
    searchUrl: "https://www.{host}/product-search/{q}",
    source: "builtin",
  },
  {
    hosts: ["samsclub.com"],
    searchUrl: "https://www.samsclub.com/s/{q}",
    cartUrl: "https://www.samsclub.com/cart",
    source: "builtin",
  },
];

/** Longest matching host suffix wins, so "shop.wegmans.com" finds "wegmans.com". */
export function builtinAdapterFor(host: string): Adapter | null {
  const h = host.toLowerCase();
  let best: Adapter | null = null;
  let bestLen = 0;
  for (const a of BUILTIN_ADAPTERS) {
    for (const suffix of a.hosts) {
      if ((h === suffix || h.endsWith("." + suffix)) && suffix.length > bestLen) {
        best = a;
        bestLen = suffix.length;
      }
    }
  }
  return best;
}

/** Fill {host} and {q} in a search or cart URL template. */
export function fillUrl(template: string, host: string, query = ""): string {
  const bare = host.replace(/^www\./, "");
  return template.replace("{host}", bare).replace("{q}", encodeURIComponent(query));
}
