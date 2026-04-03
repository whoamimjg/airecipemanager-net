-- Allow anyone (even unauthenticated) to view individual recipes by ID for sharing
CREATE POLICY "Anyone can view shared recipes"
ON public.recipes
FOR SELECT
TO anon
USING (true);