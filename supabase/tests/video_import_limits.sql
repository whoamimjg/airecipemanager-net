-- Run against a project with at least one Auth user; all fixture changes roll back.
begin;
do $$
declare
  test_user uuid;
  req uuid;
  ids uuid[] := array[]::uuid[];
  result jsonb;
  i integer;
begin
  select id into strict test_user from auth.users order by id limit 1;
  -- Never change an existing customer's attempts. Use a settings lock to isolate this test.
  perform 1 from public.video_import_settings where id = true for update;
  if exists (select 1 from public.video_import_attempts where user_id = test_user and started_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then
    raise exception 'Choose a user with no imports today for the rollback-only quota test';
  end if;
  update public.video_import_settings set enabled = true, per_minute = 3, per_day = 10, monthly_credit_cap = 100000;
  req := gen_random_uuid(); ids := array_append(ids, req);
  result := public.reserve_video_import(test_user, req);
  if result->>'allowed' <> 'true' then raise exception 'First reservation failed: %', result; end if;
  result := public.reserve_video_import(test_user, gen_random_uuid());
  if result->>'code' <> 'in_progress' then raise exception 'Concurrency gate failed'; end if;
  perform public.finish_video_import(req);
  for i in 1..2 loop
    req := gen_random_uuid(); ids := array_append(ids, req);
    perform public.reserve_video_import(test_user, req);
    perform public.finish_video_import(req);
  end loop;
  result := public.reserve_video_import(test_user, gen_random_uuid());
  if result->>'code' <> 'rate_limited' then raise exception 'Minute limit failed'; end if;
  delete from public.video_import_attempts where request_id = any(ids);
  ids := array[]::uuid[];
  update public.video_import_settings set per_day = 1;
  req := gen_random_uuid(); ids := array_append(ids, req);
  perform public.reserve_video_import(test_user, req);
  perform public.finish_video_import(req);
  result := public.reserve_video_import(test_user, gen_random_uuid());
  if result->>'code' <> 'daily_limit' then raise exception 'Daily limit failed'; end if;
  delete from public.video_import_attempts where request_id = any(ids);
  update public.video_import_settings set per_day = 10, monthly_credit_cap = 0;
  result := public.reserve_video_import(test_user, gen_random_uuid());
  if result->>'code' <> 'quota_exceeded' then raise exception 'Global budget gate failed'; end if;
  update public.video_import_settings set enabled = false;
  result := public.reserve_video_import(test_user, gen_random_uuid());
  if result->>'code' <> 'unavailable' then raise exception 'Kill switch failed'; end if;
  if has_function_privilege('anon', 'public.reserve_video_import(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.reserve_video_import(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.finish_video_import(uuid)', 'execute')
    or has_table_privilege('authenticated', 'public.video_import_settings', 'update')
    or has_table_privilege('anon', 'public.video_import_attempts', 'select') then
    raise exception 'Client role unexpectedly has import metering access';
  end if;
end;
$$;
-- Also verify SECURITY INVOKER RPCs work with their intended database role.
set local role service_role;
do $$
declare u uuid; r uuid := gen_random_uuid(); result jsonb;
begin
  update public.video_import_settings set enabled = true, monthly_credit_cap = 100000;
  select user_id into strict u from public.profiles order by user_id limit 1;
  result := public.reserve_video_import(u, r);
  if result->>'allowed' <> 'true' then raise exception 'Service role reservation failed: %', result; end if;
  perform public.finish_video_import(r);
end;
$$;
rollback;
