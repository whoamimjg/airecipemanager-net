/**
 * Maps a raw recipe ingredient line to a pantry-level food name, and from there
 * to an actual inventory ITEM.
 *
 * The grocery list used to key itself on the raw ingredient string, which meant
 * "Already in Inventory" rendered lines like
 *   "½ cup unsalted butter, softened to room temperature"
 * instead of "Butter", and "¼ cup granulated sugar" / "1 cup granulated sugar"
 * counted as two separate items. Matching was also a two-way substring test, so
 * inventory "Salt" matched the ingredient "salted butter".
 *
 * The cleaning rules started life as cleanName() in supabase/functions/
 * compute-nutrition/index.ts. The important difference: that version receives an
 * already-separated `name` field, so it can split on the first comma. Raw recipe
 * lines can't be treated that way — "boneless, skinless chicken breasts" would
 * be truncated to "boneless". Here noise words are removed everywhere instead.
 */

/** Unicode fractions that show up constantly in scraped recipes. */
const FRACTIONS = /[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g;

/**
 * Measurement units. Stripped anywhere in the line, not just at the front —
 * scraped recipes lose their leading number often enough that a bare
 * "-ounce boneless, skinless chicken breasts" is a real case.
 */
const UNITS = [
  "cup", "cups", "c",
  "tablespoon", "tablespoons", "tbsp", "tbs", "tb",
  "teaspoon", "teaspoons", "tsp", "ts",
  "ounce", "ounces", "oz",
  "pound", "pounds", "lb", "lbs",
  "gram", "grams", "g", "kilogram", "kilograms", "kg",
  "milliliter", "milliliters", "ml", "liter", "liters", "l",
  "pint", "pints", "quart", "quarts", "gallon", "gallons",
  "clove", "cloves", "stick", "sticks", "slice", "slices",
  "can", "cans", "jar", "jars", "box", "boxes", "bag", "bags",
  "package", "packages", "pkg", "container", "containers",
  "head", "heads", "bunch", "bunches", "sprig", "sprigs",
  "pinch", "pinches", "dash", "dashes", "handful",
  "piece", "pieces", "pc", "pcs",
  // Counting words scraped recipes lead with: "strips bacon", "scoops powder".
  "strip", "strips", "round", "rounds", "scoop", "scoops",
  "block", "blocks", "rack", "racks", "wedge", "wedges",
  "envelope", "envelopes", "packet", "packets", "bottle", "bottles",
  "stalk", "stalks", "ear", "ears", "sheet", "sheets", "loaf", "loaves",
];

/** Preparation verbs and qualifiers — describe handling, not the food. */
const PREP = [
  "finely", "freshly", "thinly", "roughly", "coarsely", "lightly", "well", "very",
  "chopped", "minced", "diced", "sliced", "grated", "shredded", "crushed",
  // "ground" is NOT here: ground beef is a different product from beef, and
  // ground cumin from cumin seed. It names what you buy, not how you prep it.
  "melted", "softened", "beaten", "peeled", "seeded", "trimmed",
  "rinsed", "drained", "cooked", "uncooked", "raw", "divided", "packed",
  "cubed", "julienned", "quartered", "halved", "crumbled", "shaved",
  "room", "temperature", "optional", "garnish", "serving", "taste", "needed",
  "plus", "more", "about", "approximately", "such", "as", "preferably",
];

/**
 * Quality adjectives that don't change which pantry item you'd buy.
 * Colour/flavour words that DO distinguish foods (sweet potato, black bean,
 * red onion, brown rice) are deliberately absent.
 */
const QUALITY = [
  "boneless", "skinless", "lean", "extra-lean", "organic", "natural", "frozen",
  "plain", "low-fat", "reduced-fat", "fat-free", "low-sodium", "reduced-sodium",
  "unsalted", "salted", "sweetened", "unsweetened", "blanched", "roasted",
  "toasted", "pitted", "hulled", "deveined", "shelled", "granulated", "powdered",
  "all-purpose", "fresh", "dried", "large", "medium", "small", "extra", "jumbo",
  "ripe", "warm", "cold", "hot", "cooled", "softened",
  "homemade", "store-bought", "bought", "mixed", "assorted", "prepared",
];

/**
 * Hyphenated qualifiers, removed before hyphens are split to spaces — otherwise
 * "all-purpose" arrives as two tokens that match nothing.
 */
const HYPHENATED_QUALITY = [
  "all-purpose", "extra-virgin", "extra-lean", "low-fat", "reduced-fat",
  "fat-free", "low-sodium", "reduced-sodium", "part-skim", "bite-sized",
];

/** Grammatical filler left behind once quantities and prep notes are gone. */
const STOPWORDS = ["to", "of", "for", "into", "at", "and", "or", "the", "a", "an", "with", "in", "on"];

const wordSet = (words: string[]) => new Set(words);
const UNIT_SET = wordSet(UNITS);
const PREP_SET = wordSet(PREP);
const QUALITY_SET = wordSet(QUALITY);
const STOPWORD_SET = wordSet(STOPWORDS);

const FRACTION_VALUES: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/**
 * Parses the amount a recipe wrote: "1 1/2", "½", "1½", "0.75", "2-3" (low end).
 *
 * parseFloat() alone returns NaN for "½ cup", which is why half-cup rows showed
 * on the grocery list with no quantity at all.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;

  const range = s.match(/^([^-–]+)[-–]/);
  if (range) s = range[1].trim();

  let total = 0;
  let matched = false;

  for (const [glyph, value] of Object.entries(FRACTION_VALUES)) {
    if (s.includes(glyph)) {
      total += value;
      matched = true;
      s = s.split(glyph).join(" ");
    }
  }

  for (const token of s.split(/\s+/).filter(Boolean)) {
    const frac = token.match(/^(\d+)\/(\d+)$/);
    if (frac) {
      const denom = Number(frac[2]);
      if (denom !== 0) { total += Number(frac[1]) / denom; matched = true; }
      continue;
    }
    const n = Number(token.replace(/,/g, ""));
    if (Number.isFinite(n)) { total += n; matched = true; }
  }

  return matched && total > 0 ? total : null;
}

/** Trims float noise: 0.30000000000000004 -> "0.3", 2 -> "2". */
export function formatAmount(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Singular-looking words that merely end in "s". Without these, "asparagus"
 * became "asparagu" on the shopping list.
 */
const ALREADY_SINGULAR = new Set([
  "asparagus", "hummus", "couscous", "molasses", "watercress",
  "swiss", "bass", "citrus", "cactus",
]);

/** Light plural→singular for the head noun. Deliberately conservative. */
export function singularize(word: string): string {
  if (word.length <= 3 || word.endsWith("ss")) return word;
  if (ALREADY_SINGULAR.has(word) || word.endsWith("us")) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (/(oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/**
 * Reduce a raw ingredient line to its core food name, lowercased.
 *
 *   "½ cup unsalted butter, softened to room temperature" -> "butter"
 *   "-ounce boneless, skinless chicken breasts"           -> "chicken breast"
 *   "¼ cup granulated sugar"                              -> "sugar"
 *
 * Returns "" when nothing meaningful survives, which callers treat as unmatchable.
 */
export function cleanIngredientName(raw: string): string {
  if (!raw) return "";
  // Fold accents first: the a-z filter below would otherwise turn "jalapeño"
  // into "jalape o" and put two words on the shopping list.
  let s = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  s = s.replace(/\([^)]*\)/g, " ");   // parentheticals: "(about 2 cups)"
  s = s.replace(/[*_`]+/g, " ");      // markdown emphasis from scraped lines
  s = s.replace(FRACTIONS, " ");
  s = s.replace(/\d+([./]\d+)?/g, " "); // whole numbers, decimals, 1/2 style

  // Recipe lines read "FOOD, prep clause, prep clause" — everything after the
  // food describes handling. Cleaning noise words while keeping every clause
  // produced grocery rows like "strips bacon until crispy broken" and
  // "scallions green white parts separated". Split on the clause boundaries and
  // take the FIRST clause that still contains a food once the noise is gone.
  // Splitting only on the first comma would be wrong — "boneless, skinless
  // chicken breasts" has no food until the second clause — which is exactly why
  // the first surviving clause wins rather than the first clause.
  const clauses = s.split(/[,;:]|\s+-\s+/);

  for (const clause of clauses) {
    // "Parsley or basil" offers a substitution, so the first alternative is the
    // item to buy. But "or" also joins adjectives — "small or medium racks baby
    // back ribs", "red and/or yellow bell peppers" — where taking the first
    // alternative yields "membranes removed" or "red". Only trust the split when
    // the left side is a food in its own right, not an empty or colour-only
    // fragment; otherwise read the clause whole.
    const [alternative] = clause.split(/\s+(?:and\/or|or)\s+/);
    const fromAlternative = cleanClause(alternative);
    if (fromAlternative && !isColorOnly(fromAlternative)) return fromAlternative;

    const whole = cleanClause(clause);
    if (whole) return whole;
  }
  return "";
}

/** Colour words describe a variety, but alone they name no food. */
const COLORS = new Set([
  "red", "yellow", "green", "white", "black", "orange",
  "purple", "brown", "golden", "pink",
]);

const isColorOnly = (cleaned: string) =>
  cleaned.split(/\s+/).every((w) => COLORS.has(w));

/** Strips noise words from one clause. Returns "" when nothing survives. */
function cleanClause(clause: string): string {
  let s = clause.replace(/[^a-z\s-]/g, " ");

  // Multi-word qualifiers go before the hyphen split, or they fragment into
  // tokens ("all", "purpose") that match nothing downstream.
  s = s.replace(new RegExp(`\\b(${HYPHENATED_QUALITY.join("|")})\\b`, "g"), " ");

  // Hyphenated units lose their number upstream ("-ounce"); treat the hyphen as
  // a separator so the unit token can be matched and dropped on its own.
  s = s.replace(/-/g, " ");

  const kept = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !UNIT_SET.has(w))
    .filter((w) => !PREP_SET.has(w))
    .filter((w) => !QUALITY_SET.has(w))
    .filter((w) => !STOPWORD_SET.has(w));

  if (kept.length === 0) return "";

  kept[kept.length - 1] = singularize(kept[kept.length - 1]);
  return kept.join(" ").trim();
}

/**
 * Same cleaning, but WITHOUT singularising the head noun.
 *
 * Singularising is right for matching and dedup — it makes "apples" and "apple"
 * one key — but it must not leak into the UI, where it produced shopping-list
 * rows reading "Apple - 8" and "Strawberry - 2 cups". Use this for display and
 * cleanIngredientName() for keys.
 */
export function cleanIngredientSurface(raw: string): string {
  const key = cleanIngredientName(raw);
  if (!key) return "";

  const words = raw.toLowerCase().match(/[a-z]+/g) ?? [];
  const head = key.split(" ").pop()!;
  // Recover the plural the line actually used, if it used one.
  const plural = words.find((w) => w !== head && singularize(w) === head);
  if (!plural) return key;

  const parts = key.split(" ");
  parts[parts.length - 1] = plural;
  return parts.join(" ");
}

/** Words that are acronyms, not words — title case would render "Bbq Sauce". */
const ACRONYMS = new Set(["bbq", "blt"]);

/** "chicken breast" -> "Chicken Breast". Preserves existing intra-word caps. */
export function toDisplayName(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Units you actually buy in, as opposed to units you measure with. "1 head of
 * cabbage" and "1 can black beans" are shopping instructions; dropping the unit
 * left a bare "Cabbage" with no idea how much to get. Measurement units (cup,
 * tsp) are deliberately excluded — those belong to the recipe, not the trip.
 */
const PURCHASE_UNITS = [
  "head", "bunch", "can", "jar", "bottle", "package", "packet", "container",
  "bag", "box", "loaf", "rack", "block", "stick", "clove", "ear", "stalk",
  "sprig", "envelope", "sheet",
];

/**
 * The purchase unit a line mentions, singular, or "" if none. Used only when
 * the recipe supplied no unit of its own.
 */
export function detectPurchaseUnit(raw: string): string {
  if (!raw) return "";
  const words = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]+/g) ?? [];
  for (const w of words) {
    const singular = singularize(w);
    if (PURCHASE_UNITS.includes(singular)) return singular;
  }
  return "";
}

/** The head noun is the last surviving token: "chicken breast" -> "breast". */
export function headNoun(cleaned: string): string {
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export interface InventoryLike {
  id?: string;
  name: string;
}

/**
 * True when an inventory item covers a recipe ingredient.
 *
 * Requires the head noun to agree, then that every remaining inventory token
 * also appears in the ingredient. Head-noun agreement is what stops the two
 * classic false positives:
 *
 *   inventory "Chicken Breast" vs ingredient "chicken broth"  (breast != broth)
 *   inventory "Salt"           vs ingredient "salted butter"  (salt != butter)
 *
 * The second is doubly safe: "salted" is stripped as a quality adjective before
 * comparison ever happens.
 */
export function covers(inventoryName: string, ingredientRaw: string): boolean {
  const inv = cleanIngredientName(inventoryName);
  const ing = cleanIngredientName(ingredientRaw);
  if (!inv || !ing) return false;
  if (inv === ing) return true;

  // Compound foods are written both ways. Inventory "Bread Crumbs" cleans to
  // "bread crumb" and the recipe's "plain breadcrumbs" to "breadcrumb"; without
  // this the user is told to buy something already in the pantry.
  const squash = (s: string) => s.replace(/[\s-]/g, "");
  if (squash(inv) === squash(ing)) return true;

  // A more general pantry item must NOT cover a more specific ingredient.
  // "Granulated Sugar" cleans to "sugar" (granulated is a quality word) and
  // would otherwise cover "brown sugar", because the token check below runs
  // .every() over an empty array and vacuously passes. Any modifier the recipe
  // names and the inventory item lacks makes them different foods.
  const invTokens = new Set(inv.split(/\s+/));
  const ingExtras = ing.split(/\s+/).filter((t) => !invTokens.has(t));
  if (ingExtras.length > 0) return false;

  if (headNoun(inv) !== headNoun(ing)) return false;

  const ingTokens = new Set(ing.split(/\s+/));
  return inv
    .split(/\s+/)
    .slice(0, -1) // head already compared
    .every((t) => ingTokens.has(t));
}

/** The inventory item covering this ingredient, or null. Most specific wins. */
export function matchInventoryItem<T extends InventoryLike>(
  ingredientRaw: string,
  inventory: T[],
): T | null {
  const candidates = inventory.filter((item) => covers(item.name, ingredientRaw));
  if (candidates.length === 0) return null;
  // "Chicken Breast" beats "Chicken" for "boneless chicken breasts".
  return candidates.sort(
    (a, b) => cleanIngredientName(b.name).split(/\s+/).length - cleanIngredientName(a.name).split(/\s+/).length,
  )[0];
}

export interface ResolvedIngredient<T extends InventoryLike = InventoryLike> {
  /** Stable dedup key — the cleaned food name. */
  key: string;
  /** What the UI shows: the inventory item's name when matched, else the cleaned food name. */
  displayName: string;
  inventoryItem: T | null;
  inInventory: boolean;
  /** Every raw line that collapsed into this entry, for debugging and tooltips. */
  sources: string[];
}

/**
 * Collapse raw ingredient lines into deduplicated, pantry-level entries.
 *
 * Two lines that clean to the same food share one entry, which is what makes
 * "¼ cup granulated sugar" and "1 cup granulated sugar" a single "Sugar".
 */
export function resolveIngredients<T extends InventoryLike>(
  rawLines: string[],
  inventory: T[],
): ResolvedIngredient<T>[] {
  const byKey = new Map<string, ResolvedIngredient<T>>();

  for (const raw of rawLines) {
    const key = cleanIngredientName(raw);
    if (!key) continue;

    const existing = byKey.get(key);
    if (existing) {
      if (!existing.sources.includes(raw)) existing.sources.push(raw);
      continue;
    }

    const item = matchInventoryItem(raw, inventory);
    byKey.set(key, {
      key,
      // Matched -> the inventory item's own name. Unmatched -> the surface form,
      // so the buy list reads "Apples - 8" rather than "Apple - 8".
      displayName: item ? item.name : toDisplayName(cleanIngredientSurface(raw) || key),
      inventoryItem: item,
      inInventory: item !== null,
      sources: [raw],
    });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.inInventory !== b.inInventory) return a.inInventory ? 1 : -1;
    return a.displayName.localeCompare(b.displayName);
  });
}
