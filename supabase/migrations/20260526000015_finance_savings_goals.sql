create table finance_savings_goals (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  target_pence  bigint      not null check (target_pence > 0),
  account_id    uuid        null references finance_accounts(id) on delete set null,
  current_pence bigint      null,
  notes         text        null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index finance_savings_goals_account_unique
  on finance_savings_goals (account_id) where account_id is not null;

alter table finance_savings_goals enable row level security;

create policy "Allow all for authenticated" on finance_savings_goals
  for all using (true) with check (true);
