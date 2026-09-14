-- The user's IANA time zone (e.g. "America/New_York"), captured from their
-- browser or device.
--
-- Meal times are stored as wall-clock times with no zone ("08:00:00"). The
-- calendar feed wrote them as floating ICS times, which Google Calendar reads
-- as UTC, so an 8:00 AM breakfast showed at 4:00 AM Eastern and different
-- calendars disagreed. The feed now converts to UTC using this zone.
-- Nullable: the feed falls back to America/New_York until a client records it.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
