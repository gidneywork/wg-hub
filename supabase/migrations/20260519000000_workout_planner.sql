-- workout_planner: two new tables for workout templates and scheduled sessions.
--
-- set_updated_at() is already defined by 20260512000000_chart_annotations.sql;
-- CREATE OR REPLACE is idempotent so including it here is safe.
--
-- Migration ordering: run this file in the Supabase SQL editor before any
-- application code that references these tables is deployed.

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── workout_templates ─────────────────────────────────────────────────────────
-- Reusable session structures. is_seed distinguishes built-in templates (read-only
-- in UI) from user-created ones. lifts is a JSONB array of lift entries:
-- [{ exercise, targetSets, targetReps, targetWeight }, ...]

create table if not exists workout_templates (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  notes      text,
  lifts      jsonb       not null,
  is_seed    boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workout_templates_updated_at
  before update on workout_templates
  for each row execute function set_updated_at();

alter table workout_templates enable row level security;

create policy "Authenticated users can select workout_templates"
  on workout_templates for select
  to authenticated using (true);

create policy "Authenticated users can insert workout_templates"
  on workout_templates for insert
  to authenticated with check (true);

create policy "Authenticated users can update workout_templates"
  on workout_templates for update
  to authenticated using (true) with check (true);

create policy "Authenticated users can delete workout_templates"
  on workout_templates for delete
  to authenticated using (true);

-- ── scheduled_sessions ────────────────────────────────────────────────────────
-- Dated instances of templates. template_name and lifts are snapshotted at
-- scheduling time — no FK to workout_templates. Template edits or deletions
-- do not affect scheduled history.

create table if not exists scheduled_sessions (
  id             uuid        primary key default gen_random_uuid(),
  scheduled_date date        not null,
  template_name  text        not null,
  lifts          jsonb       not null,
  status         text        not null default 'scheduled'
                             check (status in ('scheduled', 'completed', 'skipped')),
  completed_at   timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger scheduled_sessions_updated_at
  before update on scheduled_sessions
  for each row execute function set_updated_at();

alter table scheduled_sessions enable row level security;

create policy "Authenticated users can select scheduled_sessions"
  on scheduled_sessions for select
  to authenticated using (true);

create policy "Authenticated users can insert scheduled_sessions"
  on scheduled_sessions for insert
  to authenticated with check (true);

create policy "Authenticated users can update scheduled_sessions"
  on scheduled_sessions for update
  to authenticated using (true) with check (true);

create policy "Authenticated users can delete scheduled_sessions"
  on scheduled_sessions for delete
  to authenticated using (true);

-- ── Seed templates ────────────────────────────────────────────────────────────
-- Exercise names must match exercises.js exactly (middle-dot variants included).
-- targetWeight is null throughout — too personal to seed.
-- Compound heavy lifts default to 5×5; accessory work defaults to 3×8.

insert into workout_templates (name, lifts, is_seed) values

('Upper Push', '[
  {"exercise":"Bench press",         "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Overhead press",      "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Incline bench press", "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Dips",                "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Tricep pushdown",     "targetSets":3,"targetReps":8,"targetWeight":null}
]'::jsonb, true),

('Upper Pull', '[
  {"exercise":"Pull-up · bodyweight","targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Barbell row",             "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Lat pulldown",            "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Face pull",               "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Dumbbell curl",           "targetSets":3,"targetReps":8,"targetWeight":null}
]'::jsonb, true),

('Lower Heavy', '[
  {"exercise":"Back squat",            "targetSets":5,"targetReps":5,"targetWeight":null},
  {"exercise":"Romanian deadlift",     "targetSets":5,"targetReps":5,"targetWeight":null},
  {"exercise":"Bulgarian split squat", "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Leg curl",              "targetSets":3,"targetReps":8,"targetWeight":null}
]'::jsonb, true),

('Lower Volume', '[
  {"exercise":"Front squat",   "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Leg press",     "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Lunge",         "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Leg extension", "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Glute bridge",  "targetSets":3,"targetReps":8,"targetWeight":null}
]'::jsonb, true),

('Full Body', '[
  {"exercise":"Deadlift",                "targetSets":5,"targetReps":5,"targetWeight":null},
  {"exercise":"Bench press",             "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Pull-up · bodyweight","targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Overhead press",          "targetSets":3,"targetReps":8,"targetWeight":null},
  {"exercise":"Hanging leg raise",       "targetSets":3,"targetReps":8,"targetWeight":null}
]'::jsonb, true);
