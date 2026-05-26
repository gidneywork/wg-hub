-- FC-040: Bills + bill payments tables

-- ─── finance_bills ──────────────────────────────────────────────────────────

CREATE TABLE finance_bills (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID        NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  bill_type             TEXT        NOT NULL
                                    CHECK (bill_type IN ('utility','subscription',
                                                         'rent_mortgage','insurance',
                                                         'loan','council_tax','other')),
  category_id           UUID        NULL REFERENCES finance_categories(id) ON DELETE SET NULL,
  expected_amount_pence BIGINT      NOT NULL CHECK (expected_amount_pence > 0),
  tolerance_pct         INTEGER     NOT NULL DEFAULT 20
                                    CHECK (tolerance_pct BETWEEN 0 AND 100),
  frequency             TEXT        NOT NULL
                                    CHECK (frequency IN ('monthly','quarterly','annual')),
  next_due_date         DATE        NOT NULL,
  anchor_day            INTEGER     NULL,
  description_pattern   TEXT        NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  notes                 TEXT        NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER finance_bills_updated_at
  BEFORE UPDATE ON finance_bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE finance_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_bills_select"
  ON finance_bills FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_bills_insert"
  ON finance_bills FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_bills_update"
  ON finance_bills FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_bills_delete"
  ON finance_bills FOR DELETE TO authenticated USING (true);

-- ─── finance_bill_payments ───────────────────────────────────────────────────

CREATE TABLE finance_bill_payments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        UUID        NOT NULL REFERENCES finance_bills(id) ON DELETE CASCADE,
  transaction_id UUID        NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  due_date       DATE        NOT NULL,
  link_source    TEXT        NOT NULL
                             CHECK (link_source IN ('auto','manual')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, due_date)
);

ALTER TABLE finance_bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_bill_payments_select"
  ON finance_bill_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_bill_payments_insert"
  ON finance_bill_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_bill_payments_update"
  ON finance_bill_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_bill_payments_delete"
  ON finance_bill_payments FOR DELETE TO authenticated USING (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX finance_bills_account_id_idx
  ON finance_bills (account_id);

CREATE INDEX finance_bills_next_due_date_idx
  ON finance_bills (next_due_date) WHERE is_active = true;

CREATE INDEX finance_bill_payments_bill_id_idx
  ON finance_bill_payments (bill_id);

CREATE INDEX finance_bill_payments_transaction_id_idx
  ON finance_bill_payments (transaction_id);
