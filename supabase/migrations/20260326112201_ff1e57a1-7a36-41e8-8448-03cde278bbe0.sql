
-- Create billing_history table
CREATE TABLE public.billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'paid',
  payment_method text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own billing history"
ON public.billing_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own billing history"
ON public.billing_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
