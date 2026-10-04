-- Every recipe falls into one of five categories, picked from a dropdown:
-- Breakfast, Lunch, Dinner, Snacks, Special Occasion.
--
-- Fold the free-text and AI-written values already stored ("Main Course",
-- "Side Dish", "Dessert", "Appetizer, Dinner, Main Course", …) onto those
-- buckets with the same rules the apps and website use to display them.
-- NULL stays NULL so the user can pick. Mirrors RecipeCategories.kt and
-- src/lib/recipe-categories.ts.
UPDATE public.recipes
SET category = CASE
  WHEN lower(category) LIKE '%breakfast%' OR lower(category) LIKE '%brunch%' THEN 'Breakfast'
  WHEN lower(category) LIKE '%lunch%' THEN 'Lunch'
  WHEN lower(category) LIKE '%special%' OR lower(category) LIKE '%occasion%' OR lower(category) LIKE '%holiday%'
    OR lower(category) LIKE '%dessert%' OR lower(category) LIKE '%party%' OR lower(category) LIKE '%celebrat%'
    OR lower(category) LIKE '%thanksgiving%' OR lower(category) LIKE '%christmas%' OR lower(category) LIKE '%easter%'
    OR lower(category) LIKE '%birthday%' THEN 'Special Occasion'
  WHEN lower(category) LIKE '%dinner%' OR lower(category) LIKE '%main%' OR lower(category) LIKE '%entree%'
    OR lower(category) LIKE '%entrée%' OR lower(category) LIKE '%supper%' OR lower(category) LIKE '%soup%'
    OR lower(category) LIKE '%salad%' OR lower(category) LIKE '%side%' THEN 'Dinner'
  ELSE 'Snacks'
END
WHERE category IS NOT NULL
  AND btrim(category) <> ''
  AND category NOT IN ('Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Special Occasion');
