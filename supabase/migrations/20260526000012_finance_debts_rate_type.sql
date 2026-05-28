-- Rate type for debt entries.
-- apr: nominal annual rate divided by 12 (standard UK revolving/loan default)
-- ear: effective annual rate de-compounded to monthly via (1+r)^(1/12)−1
-- flat: total interest pre-fixed at origination; not a reducing-balance rate
-- DEFAULT 'apr' preserves all existing rows at zero behaviour change.
ALTER TABLE finance_debts
  ADD COLUMN rate_type TEXT NOT NULL DEFAULT 'apr'
    CHECK (rate_type IN ('apr', 'ear', 'flat'));
