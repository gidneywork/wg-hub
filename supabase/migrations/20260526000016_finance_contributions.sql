create table finance_contributions (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null,
  amount_pence       bigint      not null check (amount_pence > 0),
  frequency          text        not null
                                 check (frequency in ('monthly','quarterly','annual','weekly','one-off')),
  savings_account_id uuid        null references finance_accounts(id) on delete set null,
  notes              text        null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table finance_contributions enable row level security;
create policy "Allow all for authenticated" on finance_contributions
  for all using (true) with check (true);
