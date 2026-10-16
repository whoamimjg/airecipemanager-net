-- Click tracking for blog emails. Each link in a post's email gets a row in
-- newsletter_links; the email points at the newsletter function's /c/<link>/<subscriber>
-- redirect, which records a click and forwards to the stored URL (never an arbitrary
-- one, so it can't be used as an open redirect). Only the site owner can read results.
create table if not exists public.newsletter_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (slug, url)
);

create table if not exists public.newsletter_clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.newsletter_links(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  clicked_at timestamptz not null default now()
);
create index if not exists newsletter_clicks_link_idx on public.newsletter_clicks (link_id);

alter table public.newsletter_links enable row level security;
alter table public.newsletter_clicks enable row level security;

-- Results for one emailed post. Admin only.
create or replace function public.newsletter_post_stats(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sent public.newsletter_post_sends;
  v_result jsonb;
begin
  if (auth.jwt() ->> 'email') is distinct from 'whoamimjg50@gmail.com' then
    raise exception 'Not allowed';
  end if;
  select * into v_sent from public.newsletter_post_sends where slug = p_slug;
  if not found then
    return null;
  end if;
  select jsonb_build_object(
    'sent_at', v_sent.sent_at,
    'sent_to', v_sent.recipient_count,
    'clicks', coalesce((select count(*) from public.newsletter_clicks c join public.newsletter_links l on l.id = c.link_id where l.slug = p_slug), 0),
    'people_clicked', coalesce((select count(distinct c.subscriber_id) from public.newsletter_clicks c join public.newsletter_links l on l.id = c.link_id where l.slug = p_slug), 0),
    'unsubscribed_since', (select count(*) from public.newsletter_subscribers s where s.status = 'unsubscribed' and s.unsubscribed_at >= v_sent.sent_at),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('url', l.url, 'clicks', x.clicks, 'people', x.people) order by x.clicks desc)
        from public.newsletter_links l
        join lateral (
          select count(*) as clicks, count(distinct c.subscriber_id) as people
            from public.newsletter_clicks c where c.link_id = l.id
        ) x on true
       where l.slug = p_slug
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.newsletter_post_stats(text) from public, anon;
grant execute on function public.newsletter_post_stats(text) to authenticated;
