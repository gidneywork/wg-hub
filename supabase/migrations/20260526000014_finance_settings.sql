create table if not exists finance_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table finance_settings enable row level security;

create policy "Allow all for authenticated" on finance_settings
  for all using (true) with check (true);
