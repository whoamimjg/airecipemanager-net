
CREATE TABLE public.receipt_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_name text,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric,
  image_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own receipts" ON public.receipt_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own receipts" ON public.receipt_scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own receipts" ON public.receipt_scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipt_scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  price numeric NOT NULL DEFAULT 0,
  added_to_inventory boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own receipt items" ON public.receipt_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own receipt items" ON public.receipt_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own receipt items" ON public.receipt_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own receipt items" ON public.receipt_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
