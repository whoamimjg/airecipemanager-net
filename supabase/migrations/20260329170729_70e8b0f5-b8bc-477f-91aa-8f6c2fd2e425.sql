
CREATE TABLE public.admin_totp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  totp_secret text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_totp ENABLE ROW LEVEL SECURITY;

-- Only the admin user can read their own TOTP record
CREATE POLICY "Users can view own totp" ON public.admin_totp
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own totp" ON public.admin_totp
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own totp" ON public.admin_totp
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
