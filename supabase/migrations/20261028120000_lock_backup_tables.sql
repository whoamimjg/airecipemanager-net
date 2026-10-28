-- Supabase advisor "rls_disabled_in_public": three backup tables left over from
-- September migrations were readable and writable with the public key (one holds
-- billing history). Nothing in the website, functions or apps uses them. Keep the
-- data but lock it: RLS on with no policies, and no table privileges for the
-- public roles. Only the service role can read them now.
do $$
declare
  t text;
begin
  foreach t in array array[
    'billing_history_backup_20260914',
    'grocery_checked_keys_backup_20260908',
    'grocery_deleted_keys_backup_20260907'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
