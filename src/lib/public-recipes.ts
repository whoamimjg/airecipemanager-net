import { supabase } from "@/integrations/supabase/client";
import { normalizeRecipeCategory } from "@/lib/recipe-categories";
import type { Database } from "@/integrations/supabase/types";

export type IngredientLine = string | { heading: string } | { quantity?: string; unit?: string; name?: string; notes?: string };
export type InstructionStep = string | { heading: string } | { text?: string; image_url?: string };

export interface PublicRecipe {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  image_url: string | null;
  ingredients: IngredientLine[];
  instructions: InstructionStep[];
  tags: string[];
  published_at: string | null;
}

export const PUBLIC_RECIPE_LIST_COLUMNS = "id, slug, title, description, category, prep_time, cook_time, servings, image_url, tags, published_at";

export const canonicalRecipeUrl = (slug: string) => `https://airecipemanager.com/recipes/${slug}`;

export async function fetchPublishedRecipes(): Promise<PublicRecipe[]> {
  const { data, error } = await supabase
    .from("public_recipes")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as PublicRecipe[];
}

export async function fetchPublishedRecipe(slug: string): Promise<PublicRecipe | null> {
  const { data, error } = await supabase
    .from("public_recipes")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PublicRecipe) ?? null;
}

/**
 * The row a visitor's copy gets in their own recipes table. Ingredients and steps
 * keep their shape, so the apps and the website render them the same way.
 * source_url points back at the public page, which the add button checks to avoid duplicates.
 */
export function toUserRecipeInsert(recipe: PublicRecipe, userId: string): Database["public"]["Tables"]["recipes"]["Insert"] {
  return {
    user_id: userId,
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients as never,
    instructions: recipe.instructions as never,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    servings: recipe.servings,
    image_url: recipe.image_url,
    category: normalizeRecipeCategory(recipe.category),
    tags: recipe.tags ?? [],
    source_url: canonicalRecipeUrl(recipe.slug),
    is_ai_generated: false,
  };
}

/** Ingredient text for display; handles the same shapes the apps store. */
export function ingredientText(ing: IngredientLine): string {
  if (typeof ing === "string") return ing;
  const o = ing as { quantity?: string; unit?: string; name?: string; notes?: string };
  return [o.quantity, o.unit, o.name].filter(Boolean).join(" ") + (o.notes ? `, ${o.notes}` : "");
}

export const isHeadingLine = (x: unknown): x is { heading: string } =>
  !!x && typeof x === "object" && typeof (x as { heading?: unknown }).heading === "string";

/** Admin editor: one ingredient per line. A line starting with "## " is a section heading. */
export function linesToIngredients(text: string): IngredientLine[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("## ") ? { heading: l.slice(3).trim() } : l));
}

export function ingredientsToLines(items: IngredientLine[]): string {
  return items.map((i) => (isHeadingLine(i) ? `## ${i.heading}` : ingredientText(i))).join("\n");
}

/** Admin editor: one step per line. A line starting with "## " is a section heading. */
export function linesToInstructions(text: string): InstructionStep[] {
  return linesToIngredients(text) as InstructionStep[];
}

export function instructionsToLines(items: InstructionStep[]): string {
  return items
    .map((s) => {
      if (isHeadingLine(s)) return `## ${s.heading}`;
      if (typeof s === "string") return s;
      return (s as { text?: string }).text ?? "";
    })
    .join("\n");
}
