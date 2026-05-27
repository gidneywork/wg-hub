-- Track patterns dismissed by user for recurring transaction detection (FC-053)
CREATE TABLE finance_dismissed_patterns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  merchant_clean  TEXT        NOT NULL,
  dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, merchant_clean)
);

CREATE INDEX finance_dismissed_patterns_account_id_idx
  ON finance_dismissed_patterns(account_id);

ALTER TABLE finance_dismissed_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_dismissed_patterns_select_authenticated"
  ON finance_dismissed_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "finance_dismissed_patterns_insert_authenticated"
  ON finance_dismissed_patterns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "finance_dismissed_patterns_delete_authenticated"
  ON finance_dismissed_patterns FOR DELETE TO authenticated USING (true);
CREATE POLICY "finance_dismissed_patterns_update_authenticated"
  ON finance_dismissed_patterns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
