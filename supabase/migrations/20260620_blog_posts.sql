-- Blog posts for the public marketing blog (/blog), authored from /admin.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete set null,
  title text not null,
  slug text not null unique,
  excerpt text,
  cover_image_url text,
  body text not null default '',
  status text not null default 'draft',            -- 'draft' | 'published'
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (status, published_at desc);

alter table public.blog_posts enable row level security;

-- Anyone (incl. anonymous crawlers) can read published posts.
drop policy if exists "blog public read published" on public.blog_posts;
create policy "blog public read published" on public.blog_posts
  for select using (status = 'published');

-- The admin (matched by email) can read drafts and create/edit/delete.
drop policy if exists "blog admin full access" on public.blog_posts;
create policy "blog admin full access" on public.blog_posts
  for all
  using ((auth.jwt() ->> 'email') = 'whoamimjg50@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'whoamimjg50@gmail.com');
