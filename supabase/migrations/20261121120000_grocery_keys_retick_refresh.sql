-- Re-ticking or re-removing a grocery item must refresh its timestamp.
--
-- Both clients upsert {user_id, item_key} ON CONFLICT (user_id, item_key). When a row
-- already exists (a tick from a previous trip, or one older than the 7-day window)
-- that upsert becomes an UPDATE — and these tables had no UPDATE policy, so under RLS
-- the write failed silently and created_at / deleted_at stayed at the old value.
-- Result: the item could never be checked off or removed again ("stays on the list").
--
-- Fix, backend-only so every installed app version benefits immediately:
--   1. allow users to update their own rows;
--   2. stamp the row with now() on every update so the recency rule sees a fresh tick.

-- grocery_checked_keys ---------------------------------------------------------
drop policy if exists "Users can update own checked keys" on public.grocery_checked_keys;
create policy "Users can update own checked keys"
  on public.grocery_checked_keys for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.grocery_checked_keys_touch()
returns trigger language plpgsql as $$
begin
  new.created_at := now();
  return new;
end $$;

drop trigger if exists grocery_checked_keys_touch on public.grocery_checked_keys;
create trigger grocery_checked_keys_touch
  before update on public.grocery_checked_keys
  for each row execute function public.grocery_checked_keys_touch();

-- grocery_deleted_keys ---------------------------------------------------------
drop policy if exists "Users can update own grocery deletions" on public.grocery_deleted_keys;
create policy "Users can update own grocery deletions"
  on public.grocery_deleted_keys for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.grocery_deleted_keys_touch()
returns trigger language plpgsql as $$
begin
  new.deleted_at := now();
  return new;
end $$;

drop trigger if exists grocery_deleted_keys_touch on public.grocery_deleted_keys;
create trigger grocery_deleted_keys_touch
  before update on public.grocery_deleted_keys
  for each row execute function public.grocery_deleted_keys_touch();
