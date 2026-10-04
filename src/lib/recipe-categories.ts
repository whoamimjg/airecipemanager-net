/**
 * Every recipe lives in exactly one of five categories. The apps use the same
 * list (sharedLogic RecipeCategories.kt) and the AI functions are told to pick
 * from it; `normalizeRecipeCategory` folds anything older or free-text onto it.
 * Keep this, the Kotlin object and the data migration in step.
 */
export const RECIPE_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snacks", "Special Occasion"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export function normalizeRecipeCategory(raw: string | null | undefined): RecipeCategory | null {
  const c = (raw ?? "").trim().toLowerCase();
  if (!c) return null;
  const has = (...words: string[]) => words.some((w) => c.includes(w));
  if (has("breakfast", "brunch")) return "Breakfast";
  if (has("lunch")) return "Lunch";
  if (has("special", "occasion", "holiday", "dessert", "party", "celebrat", "thanksgiving", "christmas", "easter", "birthday")) {
    return "Special Occasion";
  }
  if (has("dinner", "main", "entree", "entrée", "supper", "soup", "salad", "side")) return "Dinner";
  return "Snacks";
}
