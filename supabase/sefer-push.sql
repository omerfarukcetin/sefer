-- SEFER bildirimleri: cihaz kayıtları ve her dakika çalışan gönderici.
-- Supabase paneli → SQL Editor → New query → bu dosyanın tamamını yapıştırıp "Run". Birden çok kez çalıştırılabilir.

-- 1) Cihazlar: her cihazın abonelik bilgisi ve önümüzdeki günlerin bildirim sırası. Yalnızca sahibi görür.
create table if not exists public.sefer_push (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  sub        jsonb not null,
  queue      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.sefer_push enable row level security;
drop policy if exists "sefer_push_sahibi" on public.sefer_push;
create policy "sefer_push_sahibi" on public.sefer_push
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Her dakika "sefer-push" işlevini çağır.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('sefer-push') where exists (select 1 from cron.job where jobname = 'sefer-push');
select cron.schedule('sefer-push', '* * * * *', $$
  select net.http_post(
    url := 'https://clwgjupnigenndbbkcnk.supabase.co/functions/v1/sefer-push',
    headers := '{"content-type":"application/json"}'::jsonb,
    body := '{}'::jsonb)
$$);
