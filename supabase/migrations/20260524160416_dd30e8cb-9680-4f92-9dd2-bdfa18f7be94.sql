
-- Add ZIP code to profiles for store location lookup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zip_code text;

-- Cache table for fetched grocery prices (24h TTL)
CREATE TABLE IF NOT EXISTS public.grocery_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL,
  store text NOT NULL,
  zip_code text NOT NULL,
  price numeric,
  product_name text,
  product_size text,
  currency text NOT NULL DEFAULT 'USD',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_key, store, zip_code)
);

ALTER TABLE public.grocery_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read price cache"
  ON public.grocery_price_cache FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_price_cache_lookup
  ON public.grocery_price_cache (item_key, store, zip_code, fetched_at DESC);
