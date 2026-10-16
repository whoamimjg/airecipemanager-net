-- Blog emails go to account holders too, not only people who signed up on the blog.
-- Account holders with a confirmed email are added automatically; anyone who
-- unsubscribes stays unsubscribed (the sync never re-subscribes them).
-- Each blog post is emailed at most once (newsletter_post_sends).

alter table public.newsletter_subscribers
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists newsletter_subscribers_user_id_key
  on public.newsletter_subscribers (user_id) where user_id is not null;

create or replace function public.newsletter_sync_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or coalesce(new.is_anonymous, false) or new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.newsletter_subscribers (email, status, source, user_id, confirmed_at)
  values (lower(new.email), 'confirmed', 'account', new.id, now())
  on conflict (email) do update
    set user_id = coalesce(public.newsletter_subscribers.user_id, excluded.user_id),
        updated_at = now();
  return new;
exception when others then
  -- Never block a sign-in or sign-up because of the mailing list.
  raise warning 'newsletter_sync_account: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists newsletter_sync_account on auth.users;
create trigger newsletter_sync_account
  after insert or update of email, email_confirmed_at, is_anonymous on auth.users
  for each row execute function public.newsletter_sync_account();

-- Existing account holders.
insert into public.newsletter_subscribers (email, status, source, user_id, confirmed_at)
select lower(u.email), 'confirmed', 'account', u.id, now()
  from auth.users u
 where u.email is not null and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
on conflict (email) do update
  set user_id = coalesce(public.newsletter_subscribers.user_id, excluded.user_id);

-- Account settings switch: read and set your own subscription.
create or replace function public.get_my_blog_emails()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.status = 'confirmed'
      from public.newsletter_subscribers s
     where s.user_id = auth.uid()
        or s.email = lower((select email from auth.users where id = auth.uid()))
     order by (s.user_id = auth.uid()) desc
     limit 1
  ), false);
$$;

create or replace function public.set_my_blog_emails(p_subscribed boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Add an email address to your account first.';
  end if;
  insert into public.newsletter_subscribers (email, status, source, user_id, confirmed_at, unsubscribed_at)
  values (v_email, case when p_subscribed then 'confirmed' else 'unsubscribed' end, 'account', auth.uid(),
          case when p_subscribed then now() end, case when p_subscribed then null else now() end)
  on conflict (email) do update
    set status = excluded.status,
        user_id = coalesce(public.newsletter_subscribers.user_id, excluded.user_id),
        confirmed_at = coalesce(excluded.confirmed_at, public.newsletter_subscribers.confirmed_at),
        unsubscribed_at = excluded.unsubscribed_at,
        updated_at = now();
  return p_subscribed;
end;
$$;

revoke all on function public.get_my_blog_emails() from public, anon;
revoke all on function public.set_my_blog_emails(boolean) from public, anon;
grant execute on function public.get_my_blog_emails() to authenticated;
grant execute on function public.set_my_blog_emails(boolean) to authenticated;

-- One row per blog post that has been emailed.
create table if not exists public.newsletter_post_sends (
  slug text primary key,
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);
alter table public.newsletter_post_sends enable row level security;
drop policy if exists "post sends admin read" on public.newsletter_post_sends;
create policy "post sends admin read" on public.newsletter_post_sends
  for select using ((auth.jwt() ->> 'email') = 'whoamimjg50@gmail.com');
