
-- Create storage location enum
CREATE TYPE public.storage_location AS ENUM ('fridge', 'freezer', 'pantry', 'cabinet', 'counter', 'other');

-- Create inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  storage_location storage_location NOT NULL DEFAULT 'pantry',
  barcode TEXT,
  price_per_unit NUMERIC,
  expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own inventory" ON public.inventory_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory" ON public.inventory_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON public.inventory_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory" ON public.inventory_items FOR DELETE USING (auth.uid() = user_id);
