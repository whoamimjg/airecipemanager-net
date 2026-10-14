-- Store page layouts the Chrome shopping extension has learned (AI read the
-- page) or been taught (a user clicked the search box and an Add button).
-- Keyed by host; "learned" rows never overwrite "taught" ones. Only the
-- shop-assist edge function writes here (service role); signed-in users may
-- read, so a store one person taught works for everyone.
CREATE TABLE IF NOT EXISTS public.store_adapters (
  host text PRIMARY KEY,
  selectors jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'learned' CHECK (source IN ('learned', 'taught')),
  success_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_adapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_adapters_read_signed_in" ON public.store_adapters;
CREATE POLICY "store_adapters_read_signed_in" ON public.store_adapters
  FOR SELECT TO authenticated USING (true);
-- No insert/update/delete policies on purpose: writes go through shop-assist.
