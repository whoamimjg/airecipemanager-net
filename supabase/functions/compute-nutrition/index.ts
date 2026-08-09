// deno-lint-ignore-file no-explicit-any
//
// compute-nutrition — per-recipe macros from USDA FoodData Central.
//
// Takes a recipe's ingredient rows, resolves each one to an FDC food, converts
// the written amount to grams, and sums calories/protein/carbs/fat over the
// whole recipe (plus a per-serving breakdown).
//
// Needs FDC_API_KEY (free: https://fdc.nal.usda.gov/api-key-signup.html):
//   supabase secrets set FDC_API_KEY=... --project-ref puokewpqhparawdcwkbw
//
// Body: { ingredients: [...], servings?: number, recipeId?: string }
//   - `ingredients` accepts both shapes the app stores: the structured row
//     {quantity, unit, name, notes} and the legacy plain string "2 cups flour".
//   - When `recipeId` is given the result is also written back to that recipe,
//     using the CALLER's JWT so RLS still enforces ownership.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FDC_API_KEY = Deno.env.get("FDC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// USDA nutrient numbers. Energy is reported twice (kcal 208, kJ 268) — we only
// ever take the kcal row.
const N_ENERGY = "208";
const N_PROTEIN = "203";
const N_FAT = "204";
const N_CARBS = "205";

const MASS_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  mg: 0.001,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

const VOLUME_ML: Record<string, number> = {
  cup: 236.588, cups: 236.588,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868, tbs: 14.7868, t: 14.7868,
  tsp: 4.9289, teaspoon: 4.9289, teaspoons: 4.9289,
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  "fl oz": 29.5735, "fluid ounce": 29.5735, "fluid ounces": 29.5735,
  pint: 473.176, pints: 473.176,
  quart: 946.353, quarts: 946.353,
  gallon: 3785.41, gallons: 3785.41,
};

/**
 * Typical weight of one item, for countable ingredients whose FDC entry has no
 * portion table. Without this the most common things a recipe counts rather
 * than measures — eggs above all — go uncounted entirely. USDA reference
 * weights; matched against the cleaned singular ingredient name.
 */
const COUNT_FALLBACK_G: Record<string, number> = {
  egg: 50,
  "garlic clove": 3, clove: 3,
  onion: 110, shallot: 25,
  tomato: 123, potato: 213, carrot: 61, celery: 40,
  banana: 118, apple: 182, lemon: 58, lime: 67, orange: 131, avocado: 150,
  "bell pepper": 119, jalapeno: 14, cucumber: 301, zucchini: 196,
  "chicken breast": 174, "chicken thigh": 82,
  "bread slice": 28, tortilla: 45,
};

/** Amounts we can't measure — seasoning noise that would only add error. */
const IGNORABLE = /^(to taste|as needed|for serving|for garnish|optional|pinch|dash)$/i;

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/**
 * Parses "1 1/2", "1/2", "0.75", "2", "½", "1½", "2-3" (takes the low end).
 * Returns null when there is no usable number.
 */
function parseQuantity(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;

  // Range ("2-3 cups") — use the lower bound so we never overstate macros.
  const range = s.match(/^([^-–]+)[-–]/);
  if (range) s = range[1].trim();

  let total = 0;
  let matched = false;

  // Unicode fractions, possibly glued to a leading integer ("1½").
  for (const [glyph, value] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(glyph)) {
      total += value;
      matched = true;
      s = s.replace(glyph, " ");
    }
  }

  for (const token of s.split(/\s+/).filter(Boolean)) {
    const frac = token.match(/^(\d+)\/(\d+)$/);
    if (frac) {
      const denom = Number(frac[2]);
      if (denom !== 0) { total += Number(frac[1]) / denom; matched = true; }
      continue;
    }
    const num = Number(token.replace(/,/g, ""));
    if (Number.isFinite(num)) { total += num; matched = true; }
  }

  return matched && total > 0 ? total : null;
}

/** Splits a legacy "2 cups all-purpose flour" string into the structured shape. */
function parseLegacyString(str: string): { quantity: string; unit: string; name: string } {
  const s = str.trim();
  const m = s.match(/^([\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞-]+)\s*(.*)$/);
  if (!m) return { quantity: "", unit: "", name: s };

  const rest = m[2].trim();
  const firstWord = rest.split(/\s+/)[0]?.toLowerCase().replace(/\.$/, "") ?? "";
  const isUnit = firstWord in MASS_G || firstWord in VOLUME_ML;

  return {
    quantity: m[1].trim(),
    unit: isUnit ? firstWord : "",
    name: isUnit ? rest.split(/\s+/).slice(1).join(" ") : rest,
  };
}

/**
 * Strips prep noise so the FDC search hits the food itself:
 * "finely chopped fresh basil leaves, divided" -> "basil".
 */
function cleanName(name: string): string {
  let s = name.toLowerCase();
  s = s.split(",")[0];                       // drop everything after the first comma
  s = s.replace(/\([^)]*\)/g, " ");          // drop parentheticals
  s = s.replace(
    /\b(finely|freshly|thinly|roughly|coarsely|lightly|well|very)\b/g, " ");
  s = s.replace(
    /\b(chopped|minced|diced|sliced|grated|shredded|crushed|ground|melted|softened|beaten|peeled|seeded|trimmed|rinsed|drained|cooked|uncooked|raw|dried|fresh|divided|packed|room temperature|plus more|for serving|for garnish|optional)\b/g,
    " ");
  s = s.replace(/\b(large|medium|small|extra)\b/g, " ");
  s = s.replace(/[^a-z\s-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // FDC describes foods in the singular ("Egg, whole, raw"), and the plural
  // form pulls in the wrong entries entirely — "eggs" ranks bagels and bread
  // above the egg itself. Only the head noun needs it.
  const words = s.split(" ");
  if (words.length > 0) {
    words[words.length - 1] = singularize(words[words.length - 1]);
  }
  return words.join(" ").trim();
}

/** Light plural→singular for the head noun; deliberately conservative. */
function singularize(word: string): string {
  if (word.length <= 3 || word.endsWith("ss")) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (/(oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

type FdcFood = {
  fdcId: number;
  description: string;
  per100g: { kcal: number; protein: number; fat: number; carbs: number };
  /** grams per ml, derived from the food's own portion table when available. */
  densityGPerMl: number | null;
  /** gram weight of "1 <something>" — used for countable units like "1 egg". */
  unitGrams: number | null;
};

const cache = new Map<string, FdcFood | null>();

function nutrientValue(nutrients: any[], number: string): number {
  for (const n of nutrients ?? []) {
    // Search results and food-detail responses nest nutrients differently.
    const num = n.nutrientNumber ?? n.nutrient?.number;
    if (String(num) !== number) continue;
    const unit = (n.unitName ?? n.nutrient?.unitName ?? "").toUpperCase();
    if (number === N_ENERGY && unit && unit !== "KCAL") continue; // skip the kJ row
    const value = n.value ?? n.amount;
    if (typeof value === "number") return value;
  }
  return 0;
}

/** Derives g/ml and "1 unit" gram weight from the food's portion table. */
function readPortions(portions: any[]): { density: number | null; unitGrams: number | null } {
  let density: number | null = null;
  let unitGrams: number | null = null;

  for (const p of portions ?? []) {
    const grams = p.gramWeight;
    const amount = p.amount ?? 1;
    if (typeof grams !== "number" || grams <= 0 || amount <= 0) continue;

    // The unit hides in a different field depending on the dataset: Foundation
    // tends to fill measureUnit.name, SR Legacy leaves it "undetermined" and
    // puts "cup" in modifier. Join them all and match against the lot.
    const unitName = p.measureUnit?.name && p.measureUnit.name !== "undetermined"
      ? p.measureUnit.name
      : "";
    const label = [unitName, p.portionDescription, p.modifier]
      .filter((v: unknown) => typeof v === "string" && v.trim() !== "")
      .join(" ")
      .toLowerCase();
    if (!label) continue;
    // "RACC" (reference amount customarily consumed) and unspecified portions
    // are abstract — they describe no measure a recipe would ever write.
    if (/\bracc\b|quantity not specified/.test(label)) continue;

    const volumeKey = Object.keys(VOLUME_ML).find((u) =>
      new RegExp(`\\b${u.replace(/\s/g, "\\s")}\\b`).test(label)
    );
    if (volumeKey && density === null) {
      density = grams / (amount * VOLUME_ML[volumeKey]);
    }
    // For a countable amount we want the weight of one WHOLE item. FDC lists
    // subdivisions first as often as not — the leading portion for onion is a
    // single slice (14 g), which would price a whole onion at an eighth of it.
    if (!volumeKey && unitGrams === null) {
      const isWholeItem = /\b(large|medium|small|whole|each|fruit|head|ear|stalk|clove|bulb)\b/
        .test(label);
      const isSubdivision =
        /\b(slice|sliced|chopped|diced|minced|shredded|grated|strip|ring|piece|wedge|half|cubic|serving)\b/
          .test(label);
      if (isWholeItem && !isSubdivision) unitGrams = grams / amount;
    }
  }
  return { density, unitGrams };
}

/**
 * Forms that are a poor stand-in for a recipe ingredient unless the recipe
 * actually asked for them — FDC's top hit for "chicken breast" is otherwise
 * happily "Lunchmeat, chicken breast, sliced".
 */
const OFF_FORM =
  /\b(lunchmeat|luncheon|baby food|infant|formula|dehydrated|dried|powdered|powder|canned|breaded|battered|fried|imitation|substitute|reduced sodium|low sodium|fat[- ]free|light|spread)\b/;

/**
 * Parts and unripe variants. Deliberately narrow: "white" is excluded because
 * it is load-bearing in "Wheat flour, white" — the whole-egg bonus is what
 * separates egg white from egg whole.
 */
const PART_FORM = /\b(yolk|albumen|green|unripe|immature|sprouted|skin only)\b/;

/** Ranks candidates by how well they match what the recipe actually wrote. */
function rankCandidates(candidates: any[], query: string): any[] {
  const words = query.split(/\s+/).filter(Boolean);

  return candidates
    .map((c) => {
      const desc = String(c.description ?? "").toLowerCase();
      let score = 0;

      // Every word the recipe used should appear somewhere in the description.
      for (const w of words) if (desc.includes(w)) score += 10;
      // A description that leads with the ingredient is usually the plain form.
      if (words[0] && desc.startsWith(words[0])) score += 6;
      // Prefer simple entries ("Butter, salted") over heavily qualified ones.
      score -= desc.split(",").length * 2;
      // Only penalise a processed form when the recipe didn't ask for it.
      if (OFF_FORM.test(desc) && !OFF_FORM.test(query)) score -= 25;

      // FDC descriptions lead with the food itself, so if that leading word
      // isn't in the query we're looking at a different food that merely
      // mentions it — "Cheese, mozzarella, whole milk" for "whole milk".
      // Match the whole leading segment, not just its first word — "Wheat
      // flour, white, all-purpose" is the right hit for "all-purpose flour".
      const headWords = desc.split(",")[0].trim().split(/\s+/).filter(Boolean);
      const headOverlaps = headWords.some((h) =>
        words.some((w) => w.includes(h) || h.includes(w))
      );
      // Only penalise when the query words don't appear anywhere in the
      // description. FDC uses category prefixes ("Spices,", "Leavening agents,",
      // "Soup,") that never match recipe terms, so checking just the head segment
      // causes false -30 hits for parsley, baking powder, chicken broth, etc.
      const bodyOverlaps = words.some((w) => desc.includes(w));
      if (headWords.length > 0 && !headOverlaps && !bodyOverlaps) score -= 30;

      // Recipes list ingredients raw unless they say otherwise.
      if (/\braw\b/.test(desc) && !/\b(cooked|roasted|grilled|boiled|fried)\b/.test(query)) {
        score += 8;
      }

      // A bare "egg" means the whole egg, not the yolk; a bare "tomato" means
      // the ripe one, not the green. Reject part/variant forms the recipe
      // didn't ask for — these are silent 3x errors, not near misses.
      if (PART_FORM.test(desc) && !PART_FORM.test(query)) score -= 20;
      if (/\bwhole\b/.test(desc) && !PART_FORM.test(query)) score += 6;

      return { food: c, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** What kind of conversion the written amount will need. */
type Need = "mass" | "volume" | "count";

function needFor(unit: string): Need {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (u in MASS_G) return "mass";
  if (u in VOLUME_ML) return "volume";
  return "count";
}

async function lookupFood(query: string, need: Need): Promise<FdcFood | null> {
  const cacheKey = `${need}:${query}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", query);
  // Foundation/SR Legacy are the whole-food reference sets — far better for
  // recipe ingredients than Branded, which is full of specific retail products.
  url.searchParams.set("dataType", "Foundation,SR Legacy");
  // Take a slate of candidates and rank them ourselves; FDC's own top hit is
  // frequently a processed variant of what the recipe meant.
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("api_key", FDC_API_KEY!);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`FDC search failed (${res.status})`);

  const ranked = rankCandidates((await res.json())?.foods ?? [], query);
  if (ranked.length === 0) { cache.set(cacheKey, null); return null; }

  // Search results omit the portion table, so without a detail call every
  // volume amount silently falls back to water density and every countable
  // ingredient ("3 large eggs") goes unmatched. Worse, the best-*named* match
  // is often a Foundation entry whose only portion is an abstract "RACC", so
  // check the leading candidates and prefer one that can actually be measured.
  // Countable amounts are the fussiest — the plain entry carrying a "1 large"
  // portion is often further down the list, so look a little deeper for those.
  const considered = ranked.slice(0, need === "count" ? 5 : 3);
  const details = await mapLimit(considered, 3, async ({ food: candidate, score }) => {
    const detailUrl =
      `https://api.nal.usda.gov/fdc/v1/food/${candidate.fdcId}?api_key=${FDC_API_KEY}`;
    try {
      const detailRes = await fetch(detailUrl, { headers: { Accept: "application/json" } });
      if (!detailRes.ok) return { candidate, score, portions: [] as any[], nutrients: null };
      const detail = await detailRes.json();
      return {
        candidate,
        score,
        portions: (detail?.foodPortions ?? []) as any[],
        nutrients: detail?.foodNutrients ?? null,
      };
    } catch {
      return { candidate, score, portions: [] as any[], nutrients: null };
    }
  });

  // A mass amount ("1 lb chicken") converts without any portion data, so never
  // trade away the better-named food for a measurable one. Only volume and
  // countable amounts need portions — and even then the candidates are already
  // ranked by name, so taking a later one is a genuine trade-off.
  let chosen = details[0];
  if (need !== "mass") {
    // Only trade down to a measurable candidate when it is still a comparable
    // name match. Without this floor a badly-ranked entry that happens to carry
    // a portion table wins outright — "3 large eggs" resolving to "Egg
    // substitute, powder" purely because the real egg had no portions.
    const MAX_SCORE_DROP = 15;
    const measurable = details.find((d) => {
      if (d.score < details[0].score - MAX_SCORE_DROP) return false;
      const { density, unitGrams } = readPortions(d.portions);
      return need === "volume" ? density !== null : unitGrams !== null;
    });
    if (measurable) chosen = measurable;
  }

  const nutrients = chosen.nutrients ?? chosen.candidate.foodNutrients ?? [];
  const { density, unitGrams } = readPortions(chosen.portions);

  const result: FdcFood = {
    fdcId: chosen.candidate.fdcId,
    description: chosen.candidate.description,
    per100g: {
      kcal: nutrientValue(nutrients, N_ENERGY),
      protein: nutrientValue(nutrients, N_PROTEIN),
      fat: nutrientValue(nutrients, N_FAT),
      carbs: nutrientValue(nutrients, N_CARBS),
    },
    densityGPerMl: density,
    unitGrams,
  };
  cache.set(cacheKey, result);
  return result;
}

/** Converts a written amount to grams, or null when it isn't measurable. */
function toGrams(quantity: number, unit: string, food: FdcFood, query: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");

  if (u in MASS_G) return quantity * MASS_G[u];

  if (u in VOLUME_ML) {
    // Water density is the fallback; it is wrong for flour (~0.53) and oil
    // (~0.92), so prefer the food's own portion table whenever FDC has one.
    const density = food.densityGPerMl ?? 1.0;
    return quantity * VOLUME_ML[u] * density;
  }

  // Countable ("2 eggs", "1 clove garlic") or unit-less.
  if (food.unitGrams) return quantity * food.unitGrams;

  // FDC had no portion for it — fall back to a standard weight for the staples
  // people count rather than measure. Longest key wins so "chicken breast"
  // beats a hypothetical "chicken".
  const key = Object.keys(COUNT_FALLBACK_G)
    .filter((k) => query === k || query.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (key) return quantity * COUNT_FALLBACK_G[key];

  return null;
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Runs `worker` over `items` with a small concurrency cap (FDC rate limits). */
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
      }
    }),
  );
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!FDC_API_KEY) {
      return json({ error: "FDC_API_KEY is not configured" }, 500);
    }

    const { ingredients, servings, recipeId } = await req.json();
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return json({ error: "ingredients array is required" }, 400);
    }

    // Normalize both stored shapes, dropping section headings.
    const rows = ingredients
      .map((ing: any) => {
        if (typeof ing === "string") return parseLegacyString(ing);
        if (ing?.heading !== undefined && !ing?.name) return null;
        return {
          quantity: String(ing?.quantity ?? ing?.amount ?? ""),
          unit: String(ing?.unit ?? ""),
          name: String(ing?.name ?? ""),
        };
      })
      .filter((r: any): r is { quantity: string; unit: string; name: string } => !!r && !!r.name.trim());

    if (rows.length === 0) {
      return json({ error: "no usable ingredients" }, 400);
    }

    const matched: any[] = [];
    const unmatched: string[] = [];
    const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

    const results = await mapLimit(rows, 4, async (row) => {
      const label = `${row.quantity} ${row.unit} ${row.name}`.replace(/\s+/g, " ").trim();
      const query = cleanName(row.name);
      if (!query || IGNORABLE.test(row.quantity.trim())) {
        return { label, ok: false as const };
      }

      const food = await lookupFood(query, needFor(row.unit));
      if (!food) return { label, ok: false as const };

      const qty = parseQuantity(row.quantity);
      if (qty === null) return { label, ok: false as const };

      const grams = toGrams(qty, row.unit, food, query);
      if (grams === null || !Number.isFinite(grams) || grams <= 0) {
        return { label, ok: false as const };
      }

      const scale = grams / 100;
      return {
        label,
        ok: true as const,
        grams,
        food,
        macros: {
          kcal: food.per100g.kcal * scale,
          protein: food.per100g.protein * scale,
          fat: food.per100g.fat * scale,
          carbs: food.per100g.carbs * scale,
        },
      };
    });

    for (const r of results) {
      if (!r.ok) { unmatched.push(r.label); continue; }
      totals.kcal += r.macros.kcal;
      totals.protein += r.macros.protein;
      totals.fat += r.macros.fat;
      totals.carbs += r.macros.carbs;
      matched.push({
        ingredient: r.label,
        fdc_id: r.food.fdcId,
        description: r.food.description,
        grams: round(r.grams),
      });
    }

    if (matched.length === 0) {
      return json({ error: "Could not match any ingredients to USDA foods" }, 422);
    }

    if (unmatched.length > 0) {
      console.log("[compute-nutrition] unmatched:", JSON.stringify(unmatched));
      console.log("[compute-nutrition] matched:", JSON.stringify(matched.map(m => ({ i: m.ingredient, d: m.description }))));
    }

    const servingCount = Number(servings) > 0 ? Number(servings) : null;
    const perServing = servingCount
      ? {
          calories: round(totals.kcal / servingCount),
          protein_g: round(totals.protein / servingCount),
          carbs_g: round(totals.carbs / servingCount),
          fat_g: round(totals.fat / servingCount),
        }
      : null;

    const nutrition = {
      calories: round(totals.kcal),
      protein_g: round(totals.protein),
      carbs_g: round(totals.carbs),
      fat_g: round(totals.fat),
      per_serving: perServing,
      servings: servingCount,
      matched,
      unmatched,
      source: "usda_fdc",
      computed_at: new Date().toISOString(),
    };

    // Persist under the caller's own JWT so RLS decides whether they own the row.
    if (recipeId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });
        const { error } = await supabase
          .from("recipes")
          .update({ nutrition, nutrition_updated_at: nutrition.computed_at })
          .eq("id", recipeId);
        // A failed save shouldn't lose the numbers the caller just paid for —
        // return them anyway and let the client surface the save problem.
        if (error) return json({ nutrition, saved: false, saveError: error.message });
        return json({ nutrition, saved: true });
      }
    }

    return json({ nutrition, saved: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
