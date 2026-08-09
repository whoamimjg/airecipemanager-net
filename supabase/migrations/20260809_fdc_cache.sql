-- Persistent cache for USDA FoodData Central lookups.
-- Keyed by (cleaned ingredient name, conversion need) so the same query never
-- hits the FDC API twice across recipe calculations. Result is null when FDC
-- returned no usable match (negative cache entry).
CREATE TABLE IF NOT EXISTS public.fdc_cache (
  query      text        NOT NULL,
  need       text        NOT NULL,
  result     jsonb,
  cached_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (query, need)
);

-- Only the edge function's service-role client reads/writes this table.
ALTER TABLE public.fdc_cache ENABLE ROW LEVEL SECURITY;

-- Index lets the cleanup query (WHERE cached_at < now() - interval '30 days') use a scan.
CREATE INDEX IF NOT EXISTS fdc_cache_cached_at_idx ON public.fdc_cache (cached_at);
