-- SEFER için Supabase tablosu (Emanet ile aynı projede, ayrı tablo).
-- Supabase paneli → SQL Editor → New query → bu dosyanın tamamını yapıştırıp "Run".
-- Her kullanıcının SEFER verisi tek satırda durur; yalnızca sahibi okuyup yazabilir.
create table if not exists public.sefer_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb  not null,
  updated_at bigint not null default 0
);
alter table public.sefer_state enable row level security;

drop policy if exists "sefer_state_sahibi" on public.sefer_state;
create policy "sefer_state_sahibi" on public.sefer_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
