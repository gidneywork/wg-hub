-- Properties: first-class assets (independent of mortgages)
CREATE TABLE finance_properties (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  value_pence    BIGINT      NOT NULL,
  valuation_date DATE        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_properties_select_authenticated"
  ON finance_properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "finance_properties_insert_authenticated"
  ON finance_properties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "finance_properties_update_authenticated"
  ON finance_properties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_properties_delete_authenticated"
  ON finance_properties FOR DELETE TO authenticated USING (true);

-- Mortgage/loan → property link (the debt secured against the property)
ALTER TABLE finance_debts
  ADD COLUMN property_id UUID NULL REFERENCES finance_properties(id) ON DELETE SET NULL;
