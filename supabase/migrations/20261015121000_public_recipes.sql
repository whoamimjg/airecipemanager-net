-- Recipes published on the website (/recipes). Written by the site owner from
-- /admin/recipes. Visitors can read published rows and copy one into their own
-- AI Recipe Manager recipes; the copy goes through the normal recipes table, so
-- row-level security and the plan recipe limit both apply.
create table if not exists public.public_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text,
  prep_time integer,
  cook_time integer,
  servings integer,
  image_url text,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_recipes_published_idx on public.public_recipes (status, published_at desc);

alter table public.public_recipes enable row level security;

drop policy if exists "public recipes read published" on public.public_recipes;
create policy "public recipes read published" on public.public_recipes
  for select using (status = 'published');

-- Same owner check as the blog admin policy.
drop policy if exists "public recipes admin full access" on public.public_recipes;
create policy "public recipes admin full access" on public.public_recipes
  for all
  using ((auth.jwt() ->> 'email') = 'whoamimjg50@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'whoamimjg50@gmail.com');

drop trigger if exists public_recipes_updated_at on public.public_recipes;
create trigger public_recipes_updated_at before update on public.public_recipes
  for each row execute function public.update_updated_at_column();
