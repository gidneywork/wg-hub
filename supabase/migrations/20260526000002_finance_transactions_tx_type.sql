-- FC-039: Restore tx_type column on finance_transactions.
-- Listed in the original FC-039 Commit 1 spec; silently dropped during Commit 1 implementation.
-- Run manually via Supabase dashboard SQL editor after this commit lands.

ALTER TABLE finance_transactions ADD COLUMN tx_type TEXT NULL;
