ALTER TABLE finance_debts
  ADD COLUMN debt_type             TEXT    NOT NULL DEFAULT 'revolving'
    CHECK (debt_type IN ('revolving','loan','mortgage')),
  ADD COLUMN term_months           INTEGER NULL,
  ADD COLUMN monthly_payment_pence BIGINT  NULL,
  ADD COLUMN arrears_pence         BIGINT  NULL,
  ADD COLUMN fixed_period_months   INTEGER NULL,
  ADD COLUMN revert_apr_bps        INTEGER NULL,
  ADD COLUMN include_in_strategy   BOOLEAN NOT NULL DEFAULT true;
