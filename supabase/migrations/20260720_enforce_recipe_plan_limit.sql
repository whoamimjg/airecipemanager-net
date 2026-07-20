-- Enforce each user's plan recipe limit in the database.
--
-- Until now the limits in public.subscriptions.recipe_limit were advisory: nothing on any
-- surface (web, iOS, Android) actually stopped a user from exceeding their plan. The apps
-- now check client-side for a friendly message, but this trigger is the real boundary —
-- it can't be bypassed by a modified client or a direct PostgREST call.
--
-- Rules:
--   * recipe_limit < 0        -> unlimited
--   * no subscriptions row    -> Free limits (25)
--   * is_active = false       -> Free limits (lapsed/cancelled paid plan)
--   * updates are unaffected  -> only INSERT is gated, so an over-limit user can still
--                               edit and delete what they already have.

create or replace function public.enforce_recipe_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  integer;
  v_active boolean;
  v_count  integer;
begin
  select recipe_limit, is_active
    into v_limit, v_active
    from public.subscriptions
   where user_id = new.user_id;

  -- No subscription row, or a plan that is no longer active, falls back to Free.
  if v_limit is null or v_active is distinct from true then
    v_limit := 25;
  end if;

  -- Negative limit means unlimited.
  if v_limit < 0 then
    return new;
  end if;

  select count(*) into v_count
    from public.recipes
   where user_id = new.user_id;

  if v_count >= v_limit then
    raise exception
      'You have reached the %-recipe limit for your plan. Log in to your account on the web to increase your limit.',
      v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists recipes_enforce_plan_limit on public.recipes;

create trigger recipes_enforce_plan_limit
  before insert on public.recipes
  for each row
  execute function public.enforce_recipe_plan_limit();
