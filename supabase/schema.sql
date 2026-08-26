-- Fold Call or Jam: backend schema.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: everything is create-if-missing / or-replace.

-- ---------------------------------------------------------------------------
-- Per-player synced state: one row per account, owner-only via RLS.
-- `data` is the profile's localStorage keyspace as {key: {v, t}} stamps;
-- `profile` is the name/avatar needed to rebuild the profile on a new device.
-- ---------------------------------------------------------------------------
create table if not exists public.player_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_state enable row level security;

drop policy if exists "own state: select" on public.player_state;
create policy "own state: select" on public.player_state
  for select using (auth.uid() = user_id);

drop policy if exists "own state: insert" on public.player_state;
create policy "own state: insert" on public.player_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "own state: update" on public.player_state;
create policy "own state: update" on public.player_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own state: delete" on public.player_state;
create policy "own state: delete" on public.player_state
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Global Study-hand play counters. Anyone can read; nobody can write directly.
-- The only write path is the bounds-checked function below, so a counter can
-- be incremented but never set.
-- ---------------------------------------------------------------------------
create table if not exists public.hand_plays (
  hand_id text primary key,
  plays integer not null default 0,
  guesses integer not null default 0,
  matched integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.hand_plays enable row level security;

drop policy if exists "hand plays: public read" on public.hand_plays;
create policy "hand plays: public read" on public.hand_plays
  for select using (true);

create or replace function public.record_hand_play(p_hand_id text, p_guesses int, p_matched int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bounds so an abusive client can only ever add one plausible play.
  if p_hand_id is null or length(p_hand_id) > 64 then
    return;
  end if;
  if p_guesses is null or p_matched is null
     or p_guesses < 0 or p_guesses > 30
     or p_matched < 0 or p_matched > p_guesses then
    return;
  end if;

  insert into public.hand_plays as hp (hand_id, plays, guesses, matched)
  values (p_hand_id, 1, p_guesses, p_matched)
  on conflict (hand_id) do update
    set plays = hp.plays + 1,
        guesses = hp.guesses + excluded.guesses,
        matched = hp.matched + excluded.matched,
        updated_at = now();
end;
$$;

revoke all on function public.record_hand_play(text, int, int) from public;
grant execute on function public.record_hand_play(text, int, int) to anon, authenticated;
