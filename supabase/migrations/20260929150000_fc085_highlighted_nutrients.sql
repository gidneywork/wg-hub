-- FC-085 c1: Highlighted nutrients — storage
--
-- Two columns on cronometer_data, written by the sync route on today's row
-- only, on every successful run (past days keep the snapshot they last had):
--
--   micro_targets — Cronometer's per-nutrient targets, from
--     GET /api/v3/user/<id>/targets, keyed by Cronometer nutrient id:
--     { "291": { "min": 38, "max": null }, "307": { "min": 1500, "max": 2300 }, … }
--     min only = at least; min and max = range; max only = limit; neither =
--     no target.
--   highlighted — the diary's Highlighted nutrients list, in slot order, as
--     Cronometer nutrient ids: [291, 303, 301, 320, 401, 418, 417, 306].
--     Read from the settings keys CT.0–CT.7 (Cronometer's defaults for slots
--     not set; empty slots left out).
--
-- Consumed values are already stored in `nutrients` (the full export row).
-- No new policies: the existing select policy (user_id = auth.uid()) covers
-- the new columns, and writes stay service-role only.

begin;

alter table cronometer_data add column if not exists micro_targets jsonb;
alter table cronometer_data add column if not exists highlighted   jsonb;

commit;

-- Verify (run after the migration):
--
-- 1. Both columns exist, as jsonb, nullable (expect 2 rows).
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'cronometer_data'
--   and column_name in ('micro_targets', 'highlighted')
-- order by column_name;
--
-- 2. Column count on cronometer_data (expect 18: 16 before + 2).
-- select count(*) from information_schema.columns
-- where table_schema = 'public' and table_name = 'cronometer_data';
--
-- 3. Policies unchanged (expect one row: cronometer_data_select, SELECT,
--    (user_id = auth.uid())).
-- select policyname, cmd, qual from pg_policies
-- where schemaname = 'public' and tablename = 'cronometer_data';
--
-- 4. Existing rows untouched (new columns null until the next sync).
-- select date, micro_targets is null as targets_null, highlighted is null as list_null
-- from cronometer_data order by date desc limit 3;
