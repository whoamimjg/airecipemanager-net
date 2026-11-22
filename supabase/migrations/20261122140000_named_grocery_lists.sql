-- Named grocery lists ("Costco", "Thanksgiving") beside the main meal-plan list.
--
-- The main list stays exactly as it is (meal-plan ingredients + grocery_items). Named lists
-- live in their own two tables so older app versions and the website, which read
-- grocery_items without a list filter, never see these rows until they are updated.

create table if not exists public.grocery_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_grocery_lists_user on public.grocery_lists(user_id);

create table if not exists public.grocery_list_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  list_id    uuid not null references public.grocery_lists(id) on delete cascade,
  name       text not null,
  quantity   text,
  unit       text,
  category   text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_grocery_list_items_list on public.grocery_list_items(list_id);
create index if not exists idx_grocery_list_items_user on public.grocery_list_items(user_id);

alter table public.grocery_lists enable row level security;
alter table public.grocery_list_items enable row level security;

drop policy if exists "Users manage own grocery lists" on public.grocery_lists;
create policy "Users manage own grocery lists" on public.grocery_lists
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own grocery list items" on public.grocery_list_items;
create policy "Users manage own grocery list items" on public.grocery_list_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
