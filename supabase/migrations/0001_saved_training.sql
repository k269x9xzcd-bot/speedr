-- saved_training: one row per completed speed-reading training session.
-- Applied to the "speedr" project (ref reojrvyczjrdaobgnrod).

create table if not exists public.saved_training (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  passage_title text,
  passage_track text,
  target_wpm integer,
  actual_wpm integer,
  comprehension integer,
  xp_earned integer,
  created_at timestamptz not null default now()
);

alter table public.saved_training enable row level security;

drop policy if exists "saved_training_select_own" on public.saved_training;
create policy "saved_training_select_own" on public.saved_training
  for select to authenticated using (auth.uid()::text = user_id);

drop policy if exists "saved_training_insert_own" on public.saved_training;
create policy "saved_training_insert_own" on public.saved_training
  for insert to authenticated with check (auth.uid()::text = user_id);

create index if not exists saved_training_user_created_idx
  on public.saved_training (user_id, created_at desc);
