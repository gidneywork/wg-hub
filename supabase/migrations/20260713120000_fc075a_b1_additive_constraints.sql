-- FC-075a · Migration B1 — additive composite unique constraints
--
-- Purely additive. Adds one unique constraint per natural-key table so that a
-- later code change (B2) can move its upsert onConflict target onto the
-- (user_id, …) tuple. Each new constraint COEXISTS with the table's existing
-- primary key — nothing is dropped, nothing is set NOT NULL, no policy changes,
-- no PK changes. The running app must not notice this migration at all.
--
-- The old PKs (daily_logs_pkey, whoop_data_pkey, app_settings_pkey,
-- finance_settings_pkey) and the whoop_tokens singleton (whoop_tokens_pkey +
-- whoop_tokens_singleton CHECK) are all left in place. B3 drops them, AFTER B2
-- has shipped and been verified live. Until then both constraints hold together.
--
-- These validate against current data without error: the backfill (verified
-- 2026-07-13) left every row owned by 81ede4f2-2a42-4558-a6b6-a441aade5da0 with
-- distinct dates / keys, so no (user_id, date) or (user_id, key) pair repeats;
-- whoop_tokens holds a single row.
--
-- Idempotent: each constraint is dropped-if-exists then added, so a re-run is
-- clean (ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS form).

begin;

-- daily_logs — (user_id, date) alongside daily_logs_pkey (date)
alter table daily_logs        drop constraint if exists daily_logs_user_date_uniq;
alter table daily_logs        add  constraint daily_logs_user_date_uniq        unique (user_id, date);

-- whoop_data — (user_id, date) alongside whoop_data_pkey (date)
alter table whoop_data        drop constraint if exists whoop_data_user_date_uniq;
alter table whoop_data        add  constraint whoop_data_user_date_uniq        unique (user_id, date);

-- app_settings — (user_id, key) alongside app_settings_pkey (key)
alter table app_settings      drop constraint if exists app_settings_user_key_uniq;
alter table app_settings      add  constraint app_settings_user_key_uniq       unique (user_id, key);

-- finance_settings — (user_id, key) alongside finance_settings_pkey (key)
alter table finance_settings  drop constraint if exists finance_settings_user_key_uniq;
alter table finance_settings  add  constraint finance_settings_user_key_uniq   unique (user_id, key);

-- whoop_tokens — (user_id) alongside whoop_tokens_pkey (id) + whoop_tokens_singleton
-- The singleton CHECK and id PK stay until B3; this unique is what identity
-- moves onto then. One row today, so it holds.
alter table whoop_tokens      drop constraint if exists whoop_tokens_user_uniq;
alter table whoop_tokens      add  constraint whoop_tokens_user_uniq           unique (user_id);

commit;
