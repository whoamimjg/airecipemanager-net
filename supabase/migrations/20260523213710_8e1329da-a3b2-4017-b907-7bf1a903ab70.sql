
-- Track soft-deleted grocery items (both recipe-derived and manual)
CREATE TABLE IF NOT EXISTS public.grocery_deleted_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  display_name text NOT NULL,
  quantity text,
  unit text,
  category text,
  source text NOT NULL DEFAULT 'recipe',
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

ALTER TABLE public.grocery_deleted_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grocery deletions"
  ON public.grocery_deleted_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grocery deletions"
  ON public.grocery_deleted_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery deletions"
  ON public.grocery_deleted_keys FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
