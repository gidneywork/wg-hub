-- chart_annotations: user-added annotation events (Race, Deload, Illness).
-- PB annotations are auto-derived from activity data and not stored here.
--
-- Note: when multi-user transition lands, add user_id column to all data
-- tables in a coordinated migration. Asymmetric schema migration now solves
-- nothing — single-user app uses permissive RLS (any authenticated user).

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
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger chart_annotations_updated_at
  before update on chart_annotations
  for each row execute function set_updated_at();

-- RLS: any authenticated user can read/write (single-user app)
alter table chart_annotations enable row level security;

create policy "Authenticated users can select annotations"
  on chart_annotations for select
  to authenticated
  using (true);

create policy "Authenticated users can insert annotations"
  on chart_annotations for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update annotations"
  on chart_annotations for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete annotations"
  on chart_annotations for delete
  to authenticated
  using (true);
