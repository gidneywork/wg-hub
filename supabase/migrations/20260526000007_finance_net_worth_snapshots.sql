create table if not exists finance_net_worth_snapshots (
  id              uuid        primary key default gen_random_uuid(),
  taken_at        timestamptz not null    default now(),
  net_worth_pence bigint      not null
);

-- Enforce one snapshot per calendar day (using expression unique index).
create unique index if not exists finance_net_worth_snapshots_date_uidx
  on finance_net_worth_snapshots ((taken_at::date));
