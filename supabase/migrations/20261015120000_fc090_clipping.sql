-- FC-090 c1: Clipping — setup-week tracker storage
--
-- Five per-user tables for the Clipping section (YouTube Shorts side business).
-- Part 1 is the setup-week tracker; later parts add campaigns, campaign rules,
-- per-post entries and performance alongside these without reshaping them.
--
--   clip_pages             one row per page/channel
--   clip_phases            date-bounded phases; ramp and engagement rules in config
--   clip_page_days         one row per page per London date (phase derived from date)
--   clip_task_completions  checklist ticks; row present = done, untick deletes
--   clip_day_notes         one check-in note per London date
--
-- user_id follows cronometer_data: NOT NULL, references auth.users, no
-- DEFAULT (auth.uid() defaults arrive with B3). The client stamps user_id on
-- every write via currentUserId().
-- RLS is at the B3 standard (user_id = auth.uid()) from day one, as
-- cronometer_data already is. Four named policies per table, authenticated only.
--
-- Seeds Will's five pages and the setup-week phase. Idempotent: re-running
-- creates nothing twice.
--
-- NOT APPLIED by commit. Will pastes this into the Supabase SQL editor, then
-- runs the verify block at the end.

begin;

-- ── clip_pages ──────────────────────────────────────────────────────────────
create table if not exists public.clip_pages (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id),
  slug          text        not null,
  name          text        not null,
  short_name    text        not null,
  kind          text        not null check (kind in ('themed','clip')),
  monetisation  text        not null default 'none'
                            check (monetisation in ('none','whop','partnership')),
  sort_order    smallint    not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  constraint clip_pages_user_slug_uniq unique (user_id, slug)
);

-- ── clip_phases ─────────────────────────────────────────────────────────────
-- config: {"ramp":[{"from_day":1,"to_day":3,"posts":1},…],
--          "min_engagement_mins":15,
--          "page_overrides":{"<slug>":{"ramp":[…],"min_engagement_mins":n}}}
create table if not exists public.clip_phases (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id),
  slug        text        not null,
  name        text        not null,
  start_date  date        not null,
  end_date    date        not null,
  config      jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint clip_phases_user_slug_uniq unique (user_id, slug),
  constraint clip_phases_date_order     check (end_date >= start_date)
);

-- ── clip_page_days ──────────────────────────────────────────────────────────
create table if not exists public.clip_page_days (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id),
  page_id          uuid        not null references public.clip_pages(id) on delete cascade,
  log_date         date        not null,
  posts            integer     not null default 0 check (posts >= 0),
  engagement_mins  integer     not null default 0 check (engagement_mins >= 0),
  whop_linked      boolean     not null default false,
  views            integer     check (views is null or views >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint clip_page_days_user_page_date_uniq unique (user_id, page_id, log_date)
);

drop trigger if exists clip_page_days_updated_at on public.clip_page_days;
create trigger clip_page_days_updated_at
  before update on public.clip_page_days
  for each row execute function set_updated_at();

-- ── clip_task_completions ───────────────────────────────────────────────────
create table if not exists public.clip_task_completions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id),
  phase_id      uuid        not null references public.clip_phases(id) on delete cascade,
  task_key      text        not null,
  completed_at  timestamptz not null default now(),
  constraint clip_task_completions_user_phase_task_uniq unique (user_id, phase_id, task_key)
);

-- ── clip_day_notes ──────────────────────────────────────────────────────────
create table if not exists public.clip_day_notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id),
  note_date   date        not null,
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clip_day_notes_user_date_uniq unique (user_id, note_date)
);

drop trigger if exists clip_day_notes_updated_at on public.clip_day_notes;
create trigger clip_day_notes_updated_at
  before update on public.clip_day_notes
  for each row execute function set_updated_at();

-- ── RLS: user_id = auth.uid(), authenticated only ───────────────────────────
alter table public.clip_pages            enable row level security;
alter table public.clip_phases           enable row level security;
alter table public.clip_page_days        enable row level security;
alter table public.clip_task_completions enable row level security;
alter table public.clip_day_notes        enable row level security;

-- clip_pages
drop policy if exists "clip_pages_select" on public.clip_pages;
drop policy if exists "clip_pages_insert" on public.clip_pages;
drop policy if exists "clip_pages_update" on public.clip_pages;
drop policy if exists "clip_pages_delete" on public.clip_pages;
create policy "clip_pages_select" on public.clip_pages for select to authenticated using (user_id = auth.uid());
create policy "clip_pages_insert" on public.clip_pages for insert to authenticated with check (user_id = auth.uid());
create policy "clip_pages_update" on public.clip_pages for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_pages_delete" on public.clip_pages for delete to authenticated using (user_id = auth.uid());

-- clip_phases
drop policy if exists "clip_phases_select" on public.clip_phases;
drop policy if exists "clip_phases_insert" on public.clip_phases;
drop policy if exists "clip_phases_update" on public.clip_phases;
drop policy if exists "clip_phases_delete" on public.clip_phases;
create policy "clip_phases_select" on public.clip_phases for select to authenticated using (user_id = auth.uid());
create policy "clip_phases_insert" on public.clip_phases for insert to authenticated with check (user_id = auth.uid());
create policy "clip_phases_update" on public.clip_phases for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_phases_delete" on public.clip_phases for delete to authenticated using (user_id = auth.uid());

-- clip_page_days
drop policy if exists "clip_page_days_select" on public.clip_page_days;
drop policy if exists "clip_page_days_insert" on public.clip_page_days;
drop policy if exists "clip_page_days_update" on public.clip_page_days;
drop policy if exists "clip_page_days_delete" on public.clip_page_days;
create policy "clip_page_days_select" on public.clip_page_days for select to authenticated using (user_id = auth.uid());
create policy "clip_page_days_insert" on public.clip_page_days for insert to authenticated with check (user_id = auth.uid());
create policy "clip_page_days_update" on public.clip_page_days for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_page_days_delete" on public.clip_page_days for delete to authenticated using (user_id = auth.uid());

-- clip_task_completions
drop policy if exists "clip_task_completions_select" on public.clip_task_completions;
drop policy if exists "clip_task_completions_insert" on public.clip_task_completions;
drop policy if exists "clip_task_completions_update" on public.clip_task_completions;
drop policy if exists "clip_task_completions_delete" on public.clip_task_completions;
create policy "clip_task_completions_select" on public.clip_task_completions for select to authenticated using (user_id = auth.uid());
create policy "clip_task_completions_insert" on public.clip_task_completions for insert to authenticated with check (user_id = auth.uid());
create policy "clip_task_completions_update" on public.clip_task_completions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_task_completions_delete" on public.clip_task_completions for delete to authenticated using (user_id = auth.uid());

-- clip_day_notes
drop policy if exists "clip_day_notes_select" on public.clip_day_notes;
drop policy if exists "clip_day_notes_insert" on public.clip_day_notes;
drop policy if exists "clip_day_notes_update" on public.clip_day_notes;
drop policy if exists "clip_day_notes_delete" on public.clip_day_notes;
create policy "clip_day_notes_select" on public.clip_day_notes for select to authenticated using (user_id = auth.uid());
create policy "clip_day_notes_insert" on public.clip_day_notes for insert to authenticated with check (user_id = auth.uid());
create policy "clip_day_notes_update" on public.clip_day_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_day_notes_delete" on public.clip_day_notes for delete to authenticated using (user_id = auth.uid());

-- ── Seed: Will's pages and the setup-week phase ─────────────────────────────
insert into public.clip_pages (user_id, slug, name, short_name, kind, monetisation, sort_order) values
  ('81ede4f2-2a42-4558-a6b6-a441aade5da0', 'bodycam',  'Body Cam',             'Body Cam', 'themed', 'none', 1),
  ('81ede4f2-2a42-4558-a6b6-a441aade5da0', 'combat',   'Combat Sports',        'Combat',   'themed', 'none', 2),
  ('81ede4f2-2a42-4558-a6b6-a441aade5da0', 'streamer', 'Jeffs Streamer Clips', 'Streamer', 'clip',   'whop', 3),
  ('81ede4f2-2a42-4558-a6b6-a441aade5da0', 'comedy',   'Jeffs Comedy Clips',   'Comedy',   'clip',   'whop', 4),
  ('81ede4f2-2a42-4558-a6b6-a441aade5da0', 'fitness',  'Jeffs Gym Clips',      'Gym',      'clip',   'whop', 5)
on conflict (user_id, slug) do nothing;

insert into public.clip_phases (user_id, slug, name, start_date, end_date, config) values
  ('81ede4f2-2a42-4558-a6b6-a441aade5da0', 'setup-week', 'Setup week', '2026-10-15', '2026-10-21',
   '{"ramp":[{"from_day":1,"to_day":3,"posts":1},{"from_day":4,"to_day":7,"posts":3}],"min_engagement_mins":15,"page_overrides":{}}'::jsonb)
on conflict (user_id, slug) do nothing;

commit;

-- ── Verify (run after the migration) ────────────────────────────────────────

-- 1. Five tables, RLS on (expect 5 rows, all true).
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'clip\_%' order by tablename;

-- 2. Policies (expect 20 rows: 4 per table, all {authenticated}, qual/with_check = (user_id = auth.uid())).
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename like 'clip\_%' order by tablename, cmd;

-- 3. Pages seeded (expect 5 rows in sort order).
select slug, name, short_name, kind, monetisation, sort_order, active from public.clip_pages
where user_id = '81ede4f2-2a42-4558-a6b6-a441aade5da0' order by sort_order;

-- 4. Phase seeded (expect 1 row, 2026-10-15 to 2026-10-21, ramp of 2 steps).
select slug, name, start_date, end_date, jsonb_array_length(config->'ramp') as ramp_steps,
       config->>'min_engagement_mins' as min_mins from public.clip_phases
where user_id = '81ede4f2-2a42-4558-a6b6-a441aade5da0';

-- 5. Unique and check constraints (expect 5 unique + clip_phases_date_order among them).
select conrelid::regclass as tbl, conname, contype from pg_constraint
where conrelid::regclass::text like 'clip\_%' and contype in ('u','c') order by 1, 2;

-- 6. Triggers (expect clip_page_days_updated_at, clip_day_notes_updated_at).
select tgname from pg_trigger where tgname like 'clip\_%' and not tgisinternal;
