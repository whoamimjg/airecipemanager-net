-- Recipe tag taxonomy: split the mixed axis into two, and add the budget
-- profile fields the app already reads.
--
-- Every statement here is ADDITIVE and nullable. No existing row is rewritten,
-- so no user's data changes as a result of this migration. Backfill is done
-- separately by scripts/seed-demo.ts, scoped to the demo account only.

-- 1. Two-axis recipe tagging ------------------------------------------------
--
-- `category` currently mixes dish type ("Main Dish", "Snacks") with meal time
-- ("Dinner"). Splitting them lets a soup be a Dinner + Soup instead of being
-- forced into one bucket — and stops a soup ever being tagged Snack.
--
--   meal_type: Breakfast | Lunch | Dinner | Snack
--   dish_type: Main | Side | Soup | Salad | Dessert | Beverage
--
-- Left nullable on purpose: existing rows keep rendering from `category` via a
-- fallback in the UI, so nothing changes for accounts that aren't backfilled.

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS meal_type text,
  ADD COLUMN IF NOT EXISTS dish_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipes_meal_type_check'
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_meal_type_check
      CHECK (meal_type IS NULL OR meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipes_dish_type_check'
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_dish_type_check
      CHECK (dish_type IS NULL OR dish_type IN ('Main', 'Side', 'Soup', 'Salad', 'Dessert', 'Beverage'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS recipes_meal_type_idx ON public.recipes (user_id, meal_type);

-- 2. Budget profile fields ---------------------------------------------------
--
-- BudgetReport.tsx already reads and writes these three, but they exist in no
-- migration in this repo — they were added out-of-band, which is also why the
-- generated types.ts doesn't know about them and the file has a standing type
-- error. IF NOT EXISTS makes this a no-op where they're already present.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_grocery_budget numeric,
  ADD COLUMN IF NOT EXISTS household_size integer,
  ADD COLUMN IF NOT EXISTS grocery_goal text;
