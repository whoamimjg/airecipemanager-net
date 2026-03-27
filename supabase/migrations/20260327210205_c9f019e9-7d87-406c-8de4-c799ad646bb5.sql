
CREATE TABLE public.inventory_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_name text NOT NULL,
  category text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  price_per_unit numeric,
  total_cost numeric,
  reason text NOT NULL,
  notes text,
  deleted_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own deletion logs" ON public.inventory_deletions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own deletion logs" ON public.inventory_deletions FOR SELECT TO authenticated USING (auth.uid() = user_id);
