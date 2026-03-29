
-- Create admin views that bypass RLS using security_invoker=off (default)
-- These will be accessed via service role in edge functions

-- View for all profiles (admin use)
CREATE OR REPLACE VIEW public.admin_profiles AS
SELECT p.user_id, p.display_name, p.email, p.avatar_url, p.diet_restrictions, p.created_at
FROM public.profiles p;

-- View for all subscriptions with profile info
CREATE OR REPLACE VIEW public.admin_subscriptions AS
SELECT s.id, s.user_id, s.plan, s.recipe_limit, s.price_monthly, s.is_active, 
       s.next_billing_date, s.payment_method, s.created_at, s.updated_at,
       p.display_name, p.email
FROM public.subscriptions s
LEFT JOIN public.profiles p ON s.user_id = p.user_id;

-- View for all billing history with profile info
CREATE OR REPLACE VIEW public.admin_billing AS
SELECT b.id, b.user_id, b.invoice_number, b.plan, b.amount, b.status, 
       b.date, b.payment_method, b.description, b.created_at,
       p.display_name, p.email
FROM public.billing_history b
LEFT JOIN public.profiles p ON b.user_id = p.user_id;

-- View for recipe counts per user
CREATE OR REPLACE VIEW public.admin_recipe_stats AS
SELECT r.user_id, p.display_name, p.email, COUNT(*) as recipe_count,
       COUNT(*) FILTER (WHERE r.is_ai_generated = true) as ai_generated_count,
       MAX(r.created_at) as last_recipe_at
FROM public.recipes r
LEFT JOIN public.profiles p ON r.user_id = p.user_id
GROUP BY r.user_id, p.display_name, p.email;
