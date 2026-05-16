-- saved_articles: one row per article a user saves to their library.
-- This table was created out-of-band (the rss edge function has always read/
-- written it) but no migration enabled RLS. Without RLS, per-user isolation
-- depended entirely on every query carrying an explicit `.eq('user_id', ...)`.
-- This migration makes RLS the enforced backstop. Same pattern/identity model
-- as saved_training (0001): user_id is text, compared to auth.uid()::text.

create table if not exists public.saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text,
  url text,
  source text,
  text text,
  word_count integer,
  is_deleted boolean not null default false,
  saved_at timestamptz not null default now()
);

alter table public.saved_articles enable row level security;

drop policy if exists "saved_articles_select_own" on public.saved_articles;
create policy "saved_articles_select_own" on public.saved_articles
  for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "saved_articles_insert_own" on public.saved_articles;
create policy "saved_articles_insert_own" on public.saved_articles
  for insert to authenticated with check (auth.uid()::text = user_id);

-- Update is used only for the soft-delete (is_deleted = true).
drop policy if exists "saved_articles_update_own" on public.saved_articles;
create policy "saved_articles_update_own" on public.saved_articles
  for update to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create index if not exists saved_articles_user_saved_idx
  on public.saved_articles (user_id, saved_at desc)
  where is_deleted = false;
