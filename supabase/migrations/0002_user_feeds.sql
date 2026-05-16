-- Custom RSS feeds + enabled-feed toggle state per user.
-- Applied 2026-05-15 to the "speedr" project (ref reojrvyczjrdaobgnrod).

create table if not exists public.user_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  name text not null,
  category text not null default 'Custom',
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

alter table public.user_feeds enable row level security;

drop policy if exists "user_feeds_all_own" on public.user_feeds;
create policy "user_feeds_all_own" on public.user_feeds
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_feeds_user_idx on public.user_feeds (user_id);

create table if not exists public.user_feed_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled_feed_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_feed_prefs enable row level security;

drop policy if exists "user_feed_prefs_all_own" on public.user_feed_prefs;
create policy "user_feed_prefs_all_own" on public.user_feed_prefs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
