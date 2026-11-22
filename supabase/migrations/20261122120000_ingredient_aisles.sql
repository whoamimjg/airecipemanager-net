-- Shared grocery-aisle lookup: canonical ingredient key → store aisle.
--
-- Until now every phone and the website asked the AI to sort ingredients into aisles on
-- every load, and the answer lived only in that app's memory. This table makes each food a
-- one-time question for the whole user base: clients read it directly (fast, no AI), the
-- categorize-ingredients function consults it first and writes back whatever the AI had to
-- answer. It can also be bulk-seeded from a public food database (USDA FoodData Central
-- food groups) — that seed is a separate, later migration.
--
-- Keys are the app's canonical cleaned, singular food names ("egg", "gruyere cheese"), the
-- same key used for ticks and removals.

create table if not exists public.ingredient_aisles (
  item_key     text primary key,
  aisle        text not null,
  -- shopping-friendly name to show ("sharp cheddar cheese"), when it differs from the key
  display_name text,
  -- small icon for list rows: an emoji today, or an image URL / storage path later
  icon         text,
  -- USDA FoodData Central id when the row came from the USDA seed
  fdc_id       integer,
  -- where the answer came from: 'ai' | 'usda' | 'manual'
  source       text not null default 'ai',
  -- true for the USDA seed and rows a person has checked; AI additions start false so
  -- they can be reviewed (and are only written at all when the model says the name is a
  -- common grocery item, not a brand, a dish or something personal)
  verified     boolean not null default false,
  -- how many times clients have asked about this key — a cheap popularity signal for review
  hits         integer not null default 1,
  updated_at   timestamptz not null default now()
);

alter table public.ingredient_aisles enable row level security;

-- Any signed-in user may read; nothing but the service role (edge function / seeds) writes.
drop policy if exists "Signed-in users read ingredient aisles" on public.ingredient_aisles;
create policy "Signed-in users read ingredient aisles"
  on public.ingredient_aisles for select to authenticated using (true);

revoke insert, update, delete on public.ingredient_aisles from anon, authenticated;

-- Counter bump used by the categorize function (service role only; clients can't call it).
create or replace function public.bump_ingredient_hits(keys text[])
returns void language sql security definer set search_path = public as $$
  update public.ingredient_aisles set hits = hits + 1 where item_key = any(keys);
$$;
revoke all on function public.bump_ingredient_hits(text[]) from public, anon, authenticated;
