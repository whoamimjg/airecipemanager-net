-- Per-recipe nutrition (macros), sourced from USDA FoodData Central.
--
-- Backward-compatible by design: both columns are nullable with no default, so
-- older app versions still in the wild keep reading/writing `recipes` unchanged.
-- A NULL `nutrition` simply means "not computed yet" and every client is
-- expected to render the panel only when it is present.
--
-- Shape of `nutrition` (totals are for the whole recipe; per_serving is derived
-- at compute time so clients never have to divide):
--   {
--     "calories": 2412.4, "protein_g": 120.5, "carbs_g": 210.2, "fat_g": 88.1,
--     "per_serving": { "calories": 603.1, "protein_g": 30.1, "carbs_g": 52.6, "fat_g": 22.0 },
--     "servings": 4,
--     "matched":   [ { "ingredient": "flour", "fdc_id": 169761,
--                      "description": "Wheat flour, white, all-purpose", "grams": 250.0 } ],
--     "unmatched": [ "salt to taste" ],
--     "source": "usda_fdc",
--     "computed_at": "2026-08-02T21:15:00.000Z"
--   }

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS nutrition JSONB,
  ADD COLUMN IF NOT EXISTS nutrition_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.recipes.nutrition IS
  'USDA FoodData Central macros for this recipe. NULL = not computed yet.';
COMMENT ON COLUMN public.recipes.nutrition_updated_at IS
  'When `nutrition` was last computed, so clients can flag it as stale after an ingredient edit.';

-- Existing RLS policies on `recipes` are row-level (auth.uid() = user_id) and
-- therefore already cover these columns. No policy changes required.
