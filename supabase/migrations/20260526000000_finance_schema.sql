-- FC-039: Finance pillar — accounts, transactions, categories, rules, statements
--
-- MANUAL STEP: Create the 'finance-statements' storage bucket in the Supabase
-- dashboard → Storage → New bucket. Set to private (not public).
-- Suggested settings:
--   File size limit:    20 MB
--   Allowed MIME types: text/csv, application/vnd.ms-excel, text/plain
-- After creation, add four RLS policies on storage.objects for this bucket
-- (dashboard → Storage → Policies → finance-statements):
--   finance_statements_objects_select — SELECT  TO authenticated USING (true)
--   finance_statements_objects_insert — INSERT  TO authenticated WITH CHECK (true)
--   finance_statements_objects_update — UPDATE  TO authenticated USING (true) WITH CHECK (true)
--   finance_statements_objects_delete — DELETE  TO authenticated USING (true)

-- ─── finance_accounts ──────────────────────────────────────────────────────────

CREATE TABLE finance_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  account_type     TEXT        NOT NULL
                               CHECK (account_type IN ('current','credit_card','savings','other')),
  bank             TEXT        NOT NULL
                               CHECK (bank IN ('lloyds','barclays','hsbc','natwest','monzo',
                                               'starling','nationwide','santander',
                                               'first_direct','other')),
  bank_other_text  TEXT        NULL,
  currency         TEXT        NOT NULL DEFAULT 'GBP',
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order    INTEGER     NOT NULL DEFAULT 0,
  notes            TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_accounts_select"
  ON finance_accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_accounts_insert"
  ON finance_accounts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_accounts_update"
  ON finance_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_accounts_delete"
  ON finance_accounts FOR DELETE TO authenticated USING (true);

-- ─── finance_categories ────────────────────────────────────────────────────────

CREATE TABLE finance_categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  kind          TEXT        NOT NULL
                            CHECK (kind IN ('expense','income','transfer')),
  parent_id     UUID        NULL REFERENCES finance_categories(id) ON DELETE SET NULL,
  display_order INTEGER     NOT NULL DEFAULT 0,
  is_system     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_categories_select"
  ON finance_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_categories_insert"
  ON finance_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_categories_update"
  ON finance_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_categories_delete"
  ON finance_categories FOR DELETE TO authenticated USING (true);

-- ─── finance_statement_documents ───────────────────────────────────────────────

CREATE TABLE finance_statement_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID        NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  file_url     TEXT        NOT NULL,
  file_name    TEXT        NOT NULL,
  period_from  DATE        NULL,
  period_to    DATE        NULL,
  row_count    INTEGER     NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','processing','imported','failed')),
  error_detail TEXT        NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_at  TIMESTAMPTZ NULL
);

ALTER TABLE finance_statement_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_statement_documents_select"
  ON finance_statement_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_statement_documents_insert"
  ON finance_statement_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_statement_documents_update"
  ON finance_statement_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_statement_documents_delete"
  ON finance_statement_documents FOR DELETE TO authenticated USING (true);

-- ─── finance_transactions ──────────────────────────────────────────────────────
-- amount_pence sign convention: negative = debit (money out), positive = credit (money in)
-- dedupe_hash: SHA-256 of (account_id || tx_date || amount_pence || normalised_description)
--   where normalised_description = whitespace-collapsed, uppercased

CREATE TABLE finance_transactions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID        NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  tx_date                 DATE        NOT NULL,
  amount_pence            BIGINT      NOT NULL,
  description             TEXT        NOT NULL,
  merchant_clean          TEXT        NULL,
  category_id             UUID        NULL REFERENCES finance_categories(id) ON DELETE SET NULL,
  is_transfer             BOOLEAN     NOT NULL DEFAULT FALSE,
  counterparty_account_id UUID        NULL REFERENCES finance_accounts(id) ON DELETE SET NULL,
  source_document_id      UUID        NULL REFERENCES finance_statement_documents(id) ON DELETE SET NULL,
  dedupe_hash             TEXT        NOT NULL,
  notes                   TEXT        NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_transactions_select"
  ON finance_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_transactions_insert"
  ON finance_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_transactions_update"
  ON finance_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_transactions_delete"
  ON finance_transactions FOR DELETE TO authenticated USING (true);

-- ─── finance_category_rules ────────────────────────────────────────────────────

CREATE TABLE finance_category_rules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID        NOT NULL REFERENCES finance_categories(id) ON DELETE CASCADE,
  match_type    TEXT        NOT NULL
                            CHECK (match_type IN ('contains','starts_with','exact','regex')),
  match_field   TEXT        NOT NULL
                            CHECK (match_field IN ('description','merchant_clean')),
  match_value   TEXT        NOT NULL,
  priority      INTEGER     NOT NULL DEFAULT 100,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_category_rules_select"
  ON finance_category_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_category_rules_insert"
  ON finance_category_rules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "finance_category_rules_update"
  ON finance_category_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "finance_category_rules_delete"
  ON finance_category_rules FOR DELETE TO authenticated USING (true);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

-- Unique index on dedupe_hash enforces idempotency at the DB level
CREATE UNIQUE INDEX finance_transactions_dedupe_hash_key
  ON finance_transactions (dedupe_hash);

CREATE INDEX finance_transactions_account_date_idx
  ON finance_transactions (account_id, tx_date DESC);

CREATE INDEX finance_transactions_category_idx
  ON finance_transactions (category_id);

CREATE INDEX finance_transactions_date_idx
  ON finance_transactions (tx_date DESC);

-- Partial index covers only active rules — the categorisation engine's access pattern
CREATE INDEX finance_category_rules_priority_idx
  ON finance_category_rules (priority) WHERE is_active;

CREATE INDEX finance_statement_docs_account_idx
  ON finance_statement_documents (account_id, uploaded_at DESC);

-- ─── Seed: finance_categories ──────────────────────────────────────────────────

INSERT INTO finance_categories (slug, name, kind, display_order, is_system)
VALUES
  ('income',        'Income',        'income',   10, TRUE),
  ('housing',       'Housing',       'expense',  20, TRUE),
  ('utilities',     'Utilities',     'expense',  30, TRUE),
  ('food_drink',    'Food & drink',  'expense',  40, TRUE),
  ('transport',     'Transport',     'expense',  50, TRUE),
  ('personal',      'Personal',      'expense',  60, TRUE),
  ('entertainment', 'Entertainment', 'expense',  70, TRUE),
  ('financial',     'Financial',     'expense',  80, TRUE),
  ('transfer',      'Transfer',      'transfer', 90, TRUE);

INSERT INTO finance_categories (slug, name, kind, parent_id, display_order, is_system)
SELECT s.slug, s.name, s.kind, p.id, s.display_order, TRUE
FROM (VALUES
  ('salary',           'Salary',            'income',  'income',        10),
  ('freelance',        'Freelance',         'income',  'income',        20),
  ('rent_mortgage',    'Rent / mortgage',   'expense', 'housing',       10),
  ('council_tax',      'Council tax',       'expense', 'housing',       20),
  ('gas_electricity',  'Gas & electricity', 'expense', 'utilities',     10),
  ('water',            'Water',             'expense', 'utilities',     20),
  ('broadband',        'Broadband',         'expense', 'utilities',     30),
  ('mobile',           'Mobile',            'expense', 'utilities',     40),
  ('groceries',        'Groceries',         'expense', 'food_drink',    10),
  ('eating_out',       'Eating out',        'expense', 'food_drink',    20),
  ('fuel',             'Fuel',              'expense', 'transport',     10),
  ('public_transport', 'Public transport',  'expense', 'transport',     20),
  ('fitness_sport',    'Fitness & sport',   'expense', 'personal',      10),
  ('subscriptions',    'Subscriptions',     'expense', 'entertainment', 10),
  ('insurance',        'Insurance',         'expense', 'financial',     10),
  ('bank_fees',        'Bank fees',         'expense', 'financial',     20),
  ('cash_withdrawal',  'Cash withdrawal',   'expense', 'financial',     30)
) AS s(slug, name, kind, parent_slug, display_order)
JOIN finance_categories p ON p.slug = s.parent_slug;
