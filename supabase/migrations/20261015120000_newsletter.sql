-- Monthly blog digest. Subscribers confirm by email (double opt-in). Only the
-- newsletter edge function touches these tables, through the service role, so
-- RLS is on with no policies: nothing public or signed-in can read or write them.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  source text,
  confirm_token uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz
);

create unique index if not exists newsletter_subscribers_email_key on public.newsletter_subscribers (email);
create unique index if not exists newsletter_subscribers_confirm_token_key on public.newsletter_subscribers (confirm_token);
create unique index if not exists newsletter_subscribers_unsubscribe_token_key on public.newsletter_subscribers (unsubscribe_token);

alter table public.newsletter_subscribers enable row level security;

-- One row per month that has been sent, so a digest is never sent twice.
create table if not exists public.newsletter_digests (
  period text primary key check (period ~ '^\d{4}-\d{2}$'),
  post_slugs text[] not null default '{}',
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);

alter table public.newsletter_digests enable row level security;
