-- The "Anyone can view shared recipes" policy let anonymous clients read every
-- row in public.recipes, including other people's recipes and their owner ids.
-- Remove it. Share links (/recipe/:id) now read through get_shared_recipe, which
-- returns one recipe for an exact id and no owner id. Listing or searching
-- recipes anonymously is no longer possible. Ids are random UUIDs, so a link
-- works only for someone who has it, as before.
drop policy if exists "Anyone can view shared recipes" on public.recipes;

create or replace function public.get_shared_recipe(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  ingredients jsonb,
  instructions jsonb,
  prep_time integer,
  cook_time integer,
  servings integer,
  source_url text,
  image_url text,
  category text,
  rating integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.description, r.ingredients, r.instructions, r.prep_time, r.cook_time,
         r.servings, r.source_url, r.image_url, r.category, r.rating
    from public.recipes r
   where r.id = p_id;
$$;

revoke all on function public.get_shared_recipe(uuid) from public;
grant execute on function public.get_shared_recipe(uuid) to anon, authenticated;
