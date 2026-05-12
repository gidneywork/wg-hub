-- chart_annotations: user-added annotations surfaced on the Charts page.
--
-- Kinds: 'race' | 'deload' | 'illness'
-- PBs are auto-derived from activity data, never stored here.
--
-- RLS: permissive — any authenticated user can CRUD all rows.
-- This matches the pattern on daily_logs, app_settings, whoop_data,
-- strava_activities (all single-tenant, no user_id column).
--
-- Note: when multi-user transition lands, add user_id column to all data
-- tables in a coordinated migration. Do not add it asymmetrically here now.

create table if not exists chart_annotations (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null check (kind in ('race', 'deload', 'illness')),
  title      text        not null,
  note       text,
  start_date date        not null,
  end_date   date        check (end_date is null or end_date >= start_date),
  scope      text        not null default 'all',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger chart_annotations_updated_at
  before update on chart_annotations
  for each row execute procedure set_updated_at();

-- RLS: enable, then grant authenticated users full access
alter table chart_annotations enable row level security;

create policy "authenticated users can select annotations"
  on chart_annotations for select
  to authenticated
  using (true);

create policy "authenticated users can insert annotations"
  on chart_annotations for insert
  to authenticated
  with check (true);

create policy "authenticated users can update annotations"
  on chart_annotations for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete annotations"
  on chart_annotations for delete
  to authenticated
  using (true);
