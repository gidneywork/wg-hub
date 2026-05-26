-- FC-039: Restore notes column omitted from Commit 1 migration.
ALTER TABLE finance_statement_documents ADD COLUMN notes TEXT NULL;
