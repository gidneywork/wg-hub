-- PR-001: Calendar events for the Planner.
--
-- Single-user, permissive RLS — the same pattern as todos and the other app
-- tables (NOT the restrictive posture used for whoop_tokens; these are not
-- secrets and the client reads them directly).
--
-- end_date is always set (the data layer defaults it to start_date for a
-- single-day event), so one range-overlap query serves both single- and
-- multi-day events, and a future event surfaces when its week arrives with no
-- separate mechanism:  start_date <= winEnd AND end_date >= winStart.
--
-- No recurrence field (out of scope), no colour column (colour is by type via
-- tokens), no location. set_updated_at() is defined in
-- 20260519000000_workout_planner.sql (CREATE OR REPLACE — idempotent).

create table if not exists public.calendar_events (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  notes       text,
  start_date  date        not null,
  end_date    date        not null,          -- single-day → = start_date
  all_day     boolean     not null default true,
  start_time  time,                          -- used when all_day = false
  end_time    time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_date_order check (end_date >= start_date)
);

create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function set_updated_at();

alter table public.calendar_events enable row level security;

create policy "calendar_events select" on public.calendar_events for select to authenticated using (true);
create policy "calendar_events insert" on public.calendar_events for insert to authenticated with check (true);
create policy "calendar_events update" on public.calendar_events for update to authenticated using (true) with check (true);
create policy "calendar_events delete" on public.calendar_events for delete to authenticated using (true);

create index if not exists calendar_events_start_idx on public.calendar_events (start_date);
create index if not exists calendar_events_range_idx on public.calendar_events (start_date, end_date);
