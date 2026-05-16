CREATE TABLE public.grocery_checked_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

ALTER TABLE public.grocery_checked_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checked keys"
  ON public.grocery_checked_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checked keys"
  ON public.grocery_checked_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own checked keys"
  ON public.grocery_checked_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_grocery_checked_keys_user ON public.grocery_checked_keys(user_id);