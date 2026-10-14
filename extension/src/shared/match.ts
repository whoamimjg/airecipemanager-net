// Local product matching: no AI, no network. Used when the user has not
// consented to AI, and as the tie-breaker/sanity check when they have.
import type { Candidate, ListItem } from "./types";

const STOP = new Set(["the", "a", "an", "of", "and", "or", "for", "with", "fresh", "organic", "large", "small", "medium", "to", "taste", "chopped", "diced", "sliced", "minced", "ground", "whole", "cup", "cups", "tbsp", "tsp", "oz", "lb", "lbs", "can", "cans", "package", "pkg", "bag", "bunch", "pinch", "dash", "optional"]);

/** A product containing one of these is a different thing from the plain ingredient. */
const FORM_WORDS = new Set(["soup", "sauce", "mix", "seasoning", "flavored", "flavor", "chip", "snack", "drink", "juice", "powder", "dip", "salad", "spread", "dressing", "syrup", "candy", "cereal", "bar", "cookie", "cracker", "seed", "extract", "oil", "vinegar", "supplement", "capsule", "treat", "food", "litter", "shampoo", "lotion", "scented", "candle"]);

export function words(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(singular)
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
}

export function singular(w: string): string {
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("oes") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4 && /(sh|ch|ss|x)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/** The query to type into the store's search box: the food, not the recipe prep. */
export function searchQuery(item: ListItem): string {
  const base = String(item.name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/,.*$/, "")
    .replace(/\b(chopped|diced|sliced|minced|finely|roughly|peeled|cubed|shredded|grated|melted|softened|to taste|for serving|for garnish|divided|optional)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base || String(item.name || "").trim();
}

const UNIT_TO_OZ: Record<string, number> = {
  oz: 1, ounce: 1, ounces: 1,
  lb: 16, lbs: 16, pound: 16, pounds: 16,
  g: 0.035274, gram: 0.035274, grams: 0.035274,
  kg: 35.274, kilogram: 35.274,
  "fl oz": 1, floz: 1,
  ml: 0.033814, l: 33.814, liter: 33.814, litre: 33.814,
  qt: 32, quart: 32, pt: 16, pint: 16, gal: 128, gallon: 128,
  cup: 8, cups: 8,
};

/** Rough size in ounces from text such as "2 lb" or "15.5 oz can" or "32 fl oz". */
export function sizeInOunces(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = String(text).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(fl\s?oz|floz|oz|ounces?|lbs?|pounds?|kg|kilograms?|g|grams?|ml|liters?|litres?|l|qt|quarts?|pt|pints?|gal|gallons?|cups?)\b/);
  if (!m) return null;
  const unit = m[2].replace(/\s+/g, " ").replace("fl oz", "fl oz");
  const factor = UNIT_TO_OZ[unit] ?? UNIT_TO_OZ[unit.replace(/s$/, "")];
  return factor ? parseFloat(m[1]) * factor : null;
}

export function countInText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = String(text).toLowerCase().match(/(\d+)\s*(?:ct|count|pk|pack|pieces|pcs|each|ea)\b/);
  return m ? parseInt(m[1], 10) : null;
}

export interface ScoredCandidate {
  candidate: Candidate;
  score: number;
  reasons: string[];
}

/**
 * Rank the tiles for one list item. Higher is better. Negative means "do not add".
 * Name-word coverage dominates; size closeness, pack size, availability and
 * diet keywords adjust it.
 */
export function rankCandidates(item: ListItem, candidates: Candidate[], dietRestrictions: string[] = []): ScoredCandidate[] {
  const want = words(searchQuery(item));
  const wantSet = new Set(want);
  const wantOz = sizeInOunces(`${item.quantity ?? ""} ${item.unit ?? ""}`) ?? sizeInOunces(item.name);
  const wantCount = /^(\d+)$/.test(String(item.quantity ?? "").trim()) ? parseInt(String(item.quantity), 10) : null;
  const avoid = dietWords(dietRestrictions);

  return candidates
    .map((c) => {
      const reasons: string[] = [];
      const have = words(`${c.brand ?? ""} ${c.name}`);
      const haveSet = new Set(have);
      let score = 0;

      const hit = want.filter((w) => haveSet.has(w) || have.some((h) => h.startsWith(w) || w.startsWith(h))).length;
      const coverage = want.length ? hit / want.length : 0;
      score += coverage * 100;
      reasons.push(`matches ${hit}/${want.length} words`);
      if (want.length > 0 && hit === 0) score -= 100;

      // Extra words on the product that the item did not ask for dilute the match
      // ("chicken broth" for "chicken"), but mildly.
      const extras = have.filter((w) => !wantSet.has(w));
      score -= Math.min(extras.length, 8) * 2;
      // Words that make it a different product: "black bean soup" is not black beans.
      const changers = extras.filter((w) => FORM_WORDS.has(w));
      if (changers.length) {
        score -= 20 * changers.length;
        reasons.push(`is a ${changers.join(" ")}`);
      }

      if (c.unavailable) {
        score -= 60;
        reasons.push("out of stock");
      }

      const haveOz = sizeInOunces(c.size) ?? sizeInOunces(c.name);
      if (wantOz && haveOz) {
        const ratio = haveOz / wantOz;
        if (ratio >= 0.8 && ratio <= 1.6) {
          score += 15;
          reasons.push("size fits");
        } else if (ratio > 3) {
          score -= 15;
          reasons.push("much larger than needed");
        } else if (ratio < 0.5) {
          score -= 10;
          reasons.push("much smaller than needed");
        }
      }

      const haveCount = countInText(c.size) ?? countInText(c.name);
      if (haveCount && haveCount > 1 && (wantCount === null || wantCount <= 2)) {
        score -= 8;
        reasons.push("multipack");
      }
      if (/\b(case|bulk|variety pack)\b/i.test(c.name)) score -= 10;

      const violates = avoid.filter((w) => haveSet.has(w));
      if (violates.length) {
        score -= 80;
        reasons.push(`contains ${violates.join(", ")}`);
      }

      if (c.price !== null && c.price > 0) score += Math.max(0, 5 - c.price / 10);

      return { candidate: c, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** Words that must not appear in a product for the user's restrictions. */
export function dietWords(restrictions: string[]): string[] {
  const out: string[] = [];
  for (const r of restrictions) {
    const t = r.toLowerCase();
    if (/peanut/.test(t)) out.push("peanut");
    if (/tree nut|nut/.test(t)) out.push("almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia");
    if (/dairy|lactose|milk/.test(t)) out.push("milk", "cheese", "butter", "cream", "yogurt", "whey");
    if (/gluten|wheat|celiac/.test(t)) out.push("wheat", "barley", "rye", "flour", "bread", "pasta");
    if (/shellfish/.test(t)) out.push("shrimp", "crab", "lobster", "clam", "oyster", "scallop");
    if (/egg/.test(t)) out.push("egg", "eggs");
    if (/soy/.test(t)) out.push("soy", "tofu", "edamame");
    if (/sesame/.test(t)) out.push("sesame", "tahini");
    if (/vegan/.test(t)) out.push("beef", "chicken", "pork", "fish", "egg", "milk", "cheese", "butter");
    if (/vegetarian/.test(t)) out.push("beef", "chicken", "pork", "fish", "turkey", "lamb");
    if (/pork|halal|kosher/.test(t)) out.push("pork", "bacon", "ham");
  }
  return Array.from(new Set(out.map(singular)));
}

/** Pick locally: the top candidate if it is a believable match, else nothing. */
export function pickLocally(item: ListItem, candidates: Candidate[], dietRestrictions: string[] = []) {
  const ranked = rankCandidates(item, candidates, dietRestrictions);
  const top = ranked[0];
  if (!top || top.score < 25) return { chosen: null as Candidate | null, ranked };
  return { chosen: top.candidate, ranked };
}
