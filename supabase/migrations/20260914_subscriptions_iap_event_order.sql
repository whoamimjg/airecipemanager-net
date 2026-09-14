-- RevenueCat retries failed webhooks and can deliver events out of order. Record
-- the timestamp of the last App Store event applied so an older retried event
-- can never overwrite a newer purchase or plan change.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS iap_event_at_ms bigint;
