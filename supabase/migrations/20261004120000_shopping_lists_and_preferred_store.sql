-- "Shop my list": the grocery list can be handed to a store or to an AI agent.
--
-- preferred_store is where the user shops (kroger, walmart, meijer, giant_eagle,
-- aldi, target, costco, other). The grocery list page and the MCP server both
-- read it so the user never has to say where to shop.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_store text;

-- A snapshot of the "To buy" list taken when the user presses "Shop my list".
-- The list itself is computed client-side from the meal plan, inventory, ticks,
-- removals and manual items; this row is what an AI agent (via the MCP server)
-- shops from, and the agent writes its result back so the app can show what
-- landed in the cart. Nothing here ever hides an item on the live list.
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store text,
  zip_code text,
  range_label text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  -- ready: waiting to be shopped. in_cart / partial / failed: reported by the agent.
  status text NOT NULL DEFAULT 'ready',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_lists_user_created_idx
  ON public.shopping_lists (user_id, created_at DESC);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_lists_select_own" ON public.shopping_lists;
CREATE POLICY "shopping_lists_select_own" ON public.shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_lists_insert_own" ON public.shopping_lists;
CREATE POLICY "shopping_lists_insert_own" ON public.shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_lists_update_own" ON public.shopping_lists;
CREATE POLICY "shopping_lists_update_own" ON public.shopping_lists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_lists_delete_own" ON public.shopping_lists;
CREATE POLICY "shopping_lists_delete_own" ON public.shopping_lists
  FOR DELETE USING (auth.uid() = user_id);
