-- Todos and completions for the Cadence Planner.
-- set_updated_at() trigger function is defined in 20260519000000_workout_planner.sql (CREATE OR REPLACE — idempotent).

create table if not exists public.todos (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,
  notes               text,
  repeat_kind         text        not null default 'none'
                                  check (repeat_kind in ('none','daily','weekday','weekly','monthly')),
  repeat_weekday      smallint,   -- Mon=0…Sun=6; used when repeat_kind='weekly'
  repeat_day_of_month smallint,   -- 1–31; used when repeat_kind='monthly'; months without this day skip
  start_date          date        not null,
  end_date            date,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger todos_updated_at
  before update on public.todos
  for each row execute function set_updated_at();

alter table public.todos enable row level security;

create policy "todos select"  on public.todos for select to authenticated using (true);
create policy "todos insert"  on public.todos for insert to authenticated with check (true);
create policy "todos update"  on public.todos for update to authenticated using (true) with check (true);
create policy "todos delete"  on public.todos for delete to authenticated using (true);

create index if not exists todos_start_date_idx  on public.todos (start_date);
create index if not exists todos_active_idx       on public.todos (start_date) where deleted_at is null;

-- ── Completions: one row per (todo, date) the user ticked off.

create table if not exists public.todo_completions (
  id              uuid        primary key default gen_random_uuid(),
  todo_id         uuid        not null references public.todos (id) on delete cascade,
  completion_date date        not null,
  completed_at    timestamptz not null default now(),
  unique (todo_id, completion_date)
);

alter table public.todo_completions enable row level security;

create policy "todo_completions select"  on public.todo_completions for select to authenticated using (true);
create policy "todo_completions insert"  on public.todo_completions for insert to authenticated with check (true);
create policy "todo_completions delete"  on public.todo_completions for delete to authenticated using (true);

create index if not exists todo_completions_date_idx        on public.todo_completions (completion_date);
create index if not exists todo_completions_todo_date_idx   on public.todo_completions (todo_id, completion_date);
