create table if not exists user_exercises (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null unique,
  muscle_groups  text[]      not null default '{}',
  created_at     timestamptz not null default now()
);

alter table user_exercises enable row level security;
create policy "allow_all" on user_exercises for all using (true) with check (true);
