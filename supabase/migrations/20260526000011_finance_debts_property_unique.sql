-- 1:1 constraint: each property can be linked to at most one mortgage/loan.
-- NULL values are excluded — many debts have no property link.
CREATE UNIQUE INDEX finance_debts_property_id_unique
  ON finance_debts(property_id) WHERE property_id IS NOT NULL;
