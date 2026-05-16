-- Server-side XML cache for RSS feeds: lets edge fn issue conditional GETs
-- (If-None-Match / If-Modified-Since) and serve cached XML on 304.
-- Applied 2026-05-15 to the "speedr" project (ref reojrvyczjrdaobgnrod).
--
-- Access model: no RLS policies → all client access denied. Only the edge
-- function (running as service_role) can read/write. Bypassing RLS for cache
-- data is fine since the contents are public RSS XML.

create table if not exists public.feed_cache (
  url text primary key,
  etag text,
  last_modified text,
  xml text,
  fetched_at timestamptz not null default now()
);

alter table public.feed_cache enable row level security;

create index if not exists feed_cache_fetched_idx on public.feed_cache (fetched_at);
