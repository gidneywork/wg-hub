-- FC-084 water: logged water (ml) on cronometer_data
--
-- ALREADY APPLIED: pasted manually by Will in the Supabase SQL editor on
-- 29 Sep 2026 (verified: water_ml numeric present, 16 columns). Committed
-- afterwards as a record; the SQL below is exactly what was run.

alter table cronometer_data add column if not exists water_ml numeric;

-- verify: one row, water_ml | numeric
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'cronometer_data' and column_name = 'water_ml';

-- verify: 16 columns (was 15)
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'cronometer_data';
