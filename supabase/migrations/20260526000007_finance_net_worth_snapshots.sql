create table if not exists finance_net_worth_snapshots (
  id              uuid        primary key default gen_random_uuid(),
  taken_at        timestamptz not null    default now(),
  net_worth_pence bigint      not null
);

-- Enforce one snapshot per calendar day.
-- AT TIME ZONE 'UTC' is IMMUTABLE; plain ::date cast is not (depends on timezone setting).
CREATE UNIQUE INDEX finance_net_worth_snapshots_one_per_day_idx
  ON finance_net_worth_snapshots (((taken_at AT TIME ZONE 'UTC')::date));
