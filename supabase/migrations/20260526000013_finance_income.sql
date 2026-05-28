-- FC-058 c4: Income sources table.
-- Frequency CHECK mirrors finance_bills ('monthly','quarterly','annual') and adds
-- 'weekly' and 'one-off'. Manual updated_at (no trigger — matches c2 pattern).

CREATE TABLE finance_income (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT        NOT NULL,
  amount_pence BIGINT      NOT NULL CHECK (amount_pence > 0),
  frequency    TEXT        NOT NULL
                           CHECK (frequency IN ('monthly','quarterly','annual','weekly','one-off')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_income_select_authenticated"
  ON finance_income FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_income_insert_authenticated"
  ON finance_income FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_income_update_authenticated"
  ON finance_income FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_income_delete_authenticated"
  ON finance_income FOR DELETE TO authenticated USING (true);
