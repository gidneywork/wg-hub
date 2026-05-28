CREATE TABLE finance_debts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID        NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  balance_pence     BIGINT      NULL,
  apr_bps           INTEGER     NULL,
  min_payment_pence BIGINT      NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finance_debts_account_id_idx
  ON finance_debts(account_id);

-- At most one linked debt row per account (NULL excluded so manual rows are unconstrained).
CREATE UNIQUE INDEX finance_debts_one_per_account_idx
  ON finance_debts(account_id) WHERE account_id IS NOT NULL;

ALTER TABLE finance_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own debts"
  ON finance_debts FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert own debts"
  ON finance_debts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update own debts"
  ON finance_debts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete own debts"
  ON finance_debts FOR DELETE TO authenticated USING (true);
