ALTER TABLE finance_statement_documents
  ADD COLUMN closing_balance_pence BIGINT NULL,
  ADD COLUMN credit_limit_pence    BIGINT NULL,
  ADD COLUMN minimum_payment_pence BIGINT NULL,
  ADD COLUMN payment_due_date      DATE NULL;
