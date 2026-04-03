-- Add a unique calendar token to profiles for subscription feed authentication
ALTER TABLE public.profiles
ADD COLUMN calendar_token UUID DEFAULT gen_random_uuid();

-- Ensure existing rows get a token
UPDATE public.profiles SET calendar_token = gen_random_uuid() WHERE calendar_token IS NULL;

-- Make it not null and unique after populating
ALTER TABLE public.profiles ALTER COLUMN calendar_token SET NOT NULL;
CREATE UNIQUE INDEX idx_profiles_calendar_token ON public.profiles (calendar_token);
