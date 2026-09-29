-- FC-075a · Migration A — user_id columns (nullable) + close the anon hole
--
-- Adds a nullable user_id to every per-user and split table. This migration is
-- deliberately inert on existing behaviour, with ONE exception (the anon fix
-- below). It does NOT: backfill, set NOT NULL, add DEFAULT auth.uid(), change
-- any primary key, or tighten any per-user policy to auth.uid(). Those are
-- step 3 (manual backfill) and step 4 (migration B), in that order.
--
-- Baseline (verified live, 2026-07-13): RLS is enabled on all 30 public tables,
-- so migration B replaces policy bodies only — it does not enable RLS anywhere.
--
-- THE ONE BEHAVIOURAL CHANGE — close the anon hole:
--   finance_contributions, finance_savings_goals and finance_settings each carry
--   a single policy "Allow all for authenticated" declared with NO `to` clause,
--   which resolves to PUBLIC — the anon role can read AND write them. The anon
--   key ships in the client bundle, so today anyone with no account can touch
--   these three tables; they merely appear safe because they are empty. This
--   migration drops those public policies and replaces each with the standard
--   four-policy authenticated pattern used by the other finance tables. They
--   stay USING (true) for now — migration B tightens every table to auth.uid()
--   together. This commit only removes anon access.
--
-- Backfill target (step 3, NOT here): 81ede4f2-2a42-4558-a6b6-a441aade5da0
--
-- GLOBAL table biomarker_definitions gets NO user_id — it is a shared catalogue.
--   KNOWN DEBT: its personal_target_min / personal_target_max /
--   cadence_override_months columns are per-user overrides welded onto a global
--   row. All 28 rows are NULL today so it is inert, but it WILL break for a
--   second user who personalises a target. Not fixed here — flagged for a later
--   FC to move those overrides to a per-user overlay.
--
-- whoop_tokens: RLS on, zero client policies (service-role only) — correct
--   posture, unchanged. It still gets a user_id column here because the sync
--   route currently grabs "the one row"; migration B/step 5 make it select the
--   right user's token. No client policy is added.

begin;

-- ── Per-user tables — nullable user_id (27) ─────────────────────────────────
alter table app_settings                add column if not exists user_id uuid references auth.users(id);
alter table audit_log                    add column if not exists user_id uuid references auth.users(id);
alter table biomarker_documents          add column if not exists user_id uuid references auth.users(id);
alter table biomarker_results            add column if not exists user_id uuid references auth.users(id);
alter table calendar_events              add column if not exists user_id uuid references auth.users(id);
alter table chart_annotations            add column if not exists user_id uuid references auth.users(id);
alter table daily_logs                   add column if not exists user_id uuid references auth.users(id);
alter table finance_accounts             add column if not exists user_id uuid references auth.users(id);
alter table finance_bill_payments        add column if not exists user_id uuid references auth.users(id);
alter table finance_bills                add column if not exists user_id uuid references auth.users(id);
alter table finance_category_rules       add column if not exists user_id uuid references auth.users(id);
alter table finance_contributions        add column if not exists user_id uuid references auth.users(id);
alter table finance_debts                add column if not exists user_id uuid references auth.users(id);
alter table finance_dismissed_patterns   add column if not exists user_id uuid references auth.users(id);
alter table finance_income               add column if not exists user_id uuid references auth.users(id);
alter table finance_net_worth_snapshots  add column if not exists user_id uuid references auth.users(id);
alter table finance_properties           add column if not exists user_id uuid references auth.users(id);
alter table finance_savings_goals        add column if not exists user_id uuid references auth.users(id);
alter table finance_settings             add column if not exists user_id uuid references auth.users(id);
alter table finance_statement_documents  add column if not exists user_id uuid references auth.users(id);
alter table finance_transactions         add column if not exists user_id uuid references auth.users(id);
alter table scheduled_sessions           add column if not exists user_id uuid references auth.users(id);
alter table strava_activities            add column if not exists user_id uuid references auth.users(id);
alter table todo_completions             add column if not exists user_id uuid references auth.users(id);
alter table todos                        add column if not exists user_id uuid references auth.users(id);
alter table whoop_data                   add column if not exists user_id uuid references auth.users(id);
alter table whoop_tokens                 add column if not exists user_id uuid references auth.users(id);

-- ── Split tables — nullable user_id; seed / system rows stay NULL (2) ───────
-- finance_categories: 26 is_system=true rows stay NULL (global); user rows own.
-- workout_templates:  5 is_seed=true rows stay NULL (global); user rows own.
alter table finance_categories           add column if not exists user_id uuid references auth.users(id);
alter table workout_templates            add column if not exists user_id uuid references auth.users(id);

-- ── Global table — intentionally NO user_id ─────────────────────────────────
-- biomarker_definitions: shared catalogue, left unchanged. See header KNOWN DEBT.

-- ── Close the anon hole — drop PUBLIC policies, replace with authenticated ──
-- Each block drops the old public "Allow all" policy AND the four new names, so
-- re-running the migration is safe (CREATE POLICY has no IF NOT EXISTS).

-- finance_contributions
drop policy if exists "Allow all for authenticated"     on finance_contributions;
drop policy if exists "finance_contributions_select"    on finance_contributions;
drop policy if exists "finance_contributions_insert"    on finance_contributions;
drop policy if exists "finance_contributions_update"    on finance_contributions;
drop policy if exists "finance_contributions_delete"    on finance_contributions;
create policy "finance_contributions_select" on finance_contributions for select to authenticated using (true);
create policy "finance_contributions_insert" on finance_contributions for insert to authenticated with check (true);
create policy "finance_contributions_update" on finance_contributions for update to authenticated using (true) with check (true);
create policy "finance_contributions_delete" on finance_contributions for delete to authenticated using (true);

-- finance_savings_goals
drop policy if exists "Allow all for authenticated"     on finance_savings_goals;
drop policy if exists "finance_savings_goals_select"    on finance_savings_goals;
drop policy if exists "finance_savings_goals_insert"    on finance_savings_goals;
drop policy if exists "finance_savings_goals_update"    on finance_savings_goals;
drop policy if exists "finance_savings_goals_delete"    on finance_savings_goals;
create policy "finance_savings_goals_select" on finance_savings_goals for select to authenticated using (true);
create policy "finance_savings_goals_insert" on finance_savings_goals for insert to authenticated with check (true);
create policy "finance_savings_goals_update" on finance_savings_goals for update to authenticated using (true) with check (true);
create policy "finance_savings_goals_delete" on finance_savings_goals for delete to authenticated using (true);

-- finance_settings
drop policy if exists "Allow all for authenticated"     on finance_settings;
drop policy if exists "finance_settings_select"         on finance_settings;
drop policy if exists "finance_settings_insert"         on finance_settings;
drop policy if exists "finance_settings_update"         on finance_settings;
drop policy if exists "finance_settings_delete"         on finance_settings;
create policy "finance_settings_select" on finance_settings for select to authenticated using (true);
create policy "finance_settings_insert" on finance_settings for insert to authenticated with check (true);
create policy "finance_settings_update" on finance_settings for update to authenticated using (true) with check (true);
create policy "finance_settings_delete" on finance_settings for delete to authenticated using (true);

commit;
