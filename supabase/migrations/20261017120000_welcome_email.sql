-- Welcome email for every new account, once its email is confirmed: email sign-ups
-- when they click the confirmation link, Google and Apple sign-ups right away,
-- guests when they add a confirmed email. welcome_emails makes it once per person;
-- delivery reuses the notify-admin function and its Vault token (see
-- 20261004140000_admin_notifications.sql). Existing accounts are marked as already
-- welcomed so nobody gets one late (for example after changing their email).
create table if not exists public.welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'queued',   -- queued | sent | failed | existing
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  detail text
);
alter table public.welcome_emails enable row level security;

insert into public.welcome_emails (user_id, email, status)
select id, lower(email), 'existing' from auth.users where email is not null
on conflict (user_id) do nothing;

create or replace function public.queue_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url text;
  v_token text;
begin
  if new.email is null or coalesce(new.is_anonymous, false) or new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.welcome_emails (user_id, email) values (new.id, lower(new.email))
  on conflict (user_id) do nothing;
  if not found then
    return new; -- already welcomed (or an existing account)
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'admin_notify_url' limit 1;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'admin_notify_token' limit 1;
  if v_url is null or v_token is null then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-token', v_token),
    body := jsonb_build_object('welcome_user_id', new.id)
  );
  return new;
exception when others then
  raise warning 'queue_welcome_email failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists queue_welcome_email on auth.users;
create trigger queue_welcome_email
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.queue_welcome_email();
