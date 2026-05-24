CREATE TABLE public.grocery_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  quantity text,
  unit text,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

ALTER TABLE public.grocery_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grocery overrides"
  ON public.grocery_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grocery overrides"
  ON public.grocery_overrides FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery overrides"
  ON public.grocery_overrides FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery overrides"
  ON public.grocery_overrides FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_grocery_overrides_updated_at
  BEFORE UPDATE ON public.grocery_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();