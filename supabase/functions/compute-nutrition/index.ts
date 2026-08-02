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
    /\b(chopped|minced|diced|sliced|grated|shredded|crushed|ground|melted|softened|beaten|peeled|seeded|trimmed|rinsed|drained|cooked|uncooked|raw|divided|packed|room temperature|plus more|for serving|for garnish|optional)\b/g,
    " ");
  s = s.replace(/\b(large|medium|small|extra)\b/g, " ");
  s = s.replace(/[^a-z\s-]/g, " ");
  return s.replace(/\s+/g, " ").trim();
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

    const label = String(
      p.measureUnit?.name && p.measureUnit.name !== "undetermined"
        ? p.measureUnit.name
        : p.portionDescription ?? p.modifier ?? "",
    ).toLowerCase();

    const volumeKey = Object.keys(VOLUME_ML).find((u) =>
      new RegExp(`\\b${u.replace(/\s/g, "\\s")}\\b`).test(label)
    );
    if (volumeKey && density === null) {
      density = grams / (amount * VOLUME_ML[volumeKey]);
    }
    if (!volumeKey && unitGrams === null) {
      unitGrams = grams / amount; // "1 large", "1 slice", "1 clove", ...
    }
  }
  return { density, unitGrams };
}

async function lookupFood(query: string): Promise<FdcFood | null> {
  if (cache.has(query)) return cache.get(query)!;

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", query);
  // Foundation/SR Legacy are the whole-food reference sets — far better for
  // recipe ingredients than Branded, which is full of specific retail products.
  url.searchParams.set("dataType", "Foundation,SR Legacy");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("api_key", FDC_API_KEY!);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`FDC search failed (${res.status})`);

  const food = (await res.json())?.foods?.[0];
  if (!food) { cache.set(query, null); return null; }

  const nutrients = food.foodNutrients ?? [];
  const { density, unitGrams } = readPortions(food.foodMeasures ?? food.foodPortions ?? []);

  const result: FdcFood = {
    fdcId: food.fdcId,
    description: food.description,
    per100g: {
      kcal: nutrientValue(nutrients, N_ENERGY),
      protein: nutrientValue(nutrients, N_PROTEIN),
      fat: nutrientValue(nutrients, N_FAT),
      carbs: nutrientValue(nutrients, N_CARBS),
    },
    densityGPerMl: density,
    unitGrams,
  };
  cache.set(query, result);
  return result;
}

/** Converts a written amount to grams, or null when it isn't measurable. */
function toGrams(quantity: number, unit: string, food: FdcFood): number | null {
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

      const food = await lookupFood(query);
      if (!food) return { label, ok: false as const };

      const qty = parseQuantity(row.quantity);
      if (qty === null) return { label, ok: false as const };

      const grams = toGrams(qty, row.unit, food);
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
