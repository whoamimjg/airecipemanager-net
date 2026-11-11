-- A separate import ledger; no changes to recipes or existing import functions.
-- All access is service-role only. No client can choose an identity or raise its limits.
create table public.video_import_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  per_minute integer not null default 3 check (per_minute between 1 and 60),
  per_day integer not null default 10 check (per_day between 1 and 1000),
  monthly_credit_cap integer not null default 100 check (monthly_credit_cap >= 0)
);
insert into public.video_import_settings (id) values (true);

create table public.video_import_attempts (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  lease_until timestamptz not null default (now() + interval '120 seconds'),
  finished_at timestamptz,
  reserved_credits integer not null default 4 check (reserved_credits = 4)
);
create index video_import_attempts_user_started on public.video_import_attempts (user_id, started_at desc);
create index video_import_attempts_started on public.video_import_attempts (started_at);
alter table public.video_import_settings enable row level security;
alter table public.video_import_attempts enable row level security;
revoke all on public.video_import_settings, public.video_import_attempts from public, anon, authenticated;
grant select, update on public.video_import_settings to service_role;
grant select, insert, update, delete on public.video_import_attempts to service_role;

-- One locked settings row serializes all reservations, including the global cap.
-- SECURITY INVOKER + explicit grants: no definer/RLS bypass exposed to users.
create function public.reserve_video_import(p_user_id uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cfg public.video_import_settings%rowtype;
  minute_start timestamptz := now() - interval '1 minute';
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  minute_count integer;
  day_count integer;
  month_credits bigint;
begin
  select * into strict cfg from public.video_import_settings where id = true for update;
  if not cfg.enabled then return jsonb_build_object('allowed', false, 'code', 'unavailable'); end if;
  if exists (select 1 from public.video_import_attempts where request_id = p_request_id) then
    return jsonb_build_object('allowed', false, 'code', 'in_progress', 'retry_after', 120);
  end if;
  if exists (select 1 from public.video_import_attempts where user_id = p_user_id and started_at >= now() - interval '120 seconds' and finished_at is null and lease_until > now()) then
    return jsonb_build_object('allowed', false, 'code', 'in_progress', 'retry_after', 120);
  end if;
  select count(*) into minute_count from public.video_import_attempts where user_id = p_user_id and started_at >= minute_start;
  select count(*) into day_count from public.video_import_attempts where user_id = p_user_id and started_at >= day_start;
  if minute_count >= cfg.per_minute then
    return jsonb_build_object('allowed', false, 'code', 'rate_limited', 'retry_after', 60);
  end if;
  if day_count >= cfg.per_day then
    return jsonb_build_object('allowed', false, 'code', 'daily_limit', 'retry_after', ceil(extract(epoch from day_start + interval '1 day' - now()))::integer);
  end if;
  select coalesce(sum(reserved_credits), 0) into month_credits from public.video_import_attempts where started_at >= month_start;
  if month_credits + 4 > cfg.monthly_credit_cap then
    return jsonb_build_object('allowed', false, 'code', 'quota_exceeded');
  end if;
  insert into public.video_import_attempts (request_id, user_id) values (p_request_id, p_user_id);
  return jsonb_build_object('allowed', true);
end;
$$;

create function public.finish_video_import(p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  update public.video_import_attempts set finished_at = now() where request_id = p_request_id and finished_at is null;
  return jsonb_build_object('finished', true);
end;
$$;
revoke all on function public.reserve_video_import(uuid, uuid), public.finish_video_import(uuid) from public, anon, authenticated;
grant execute on function public.reserve_video_import(uuid, uuid), public.finish_video_import(uuid) to service_role;
