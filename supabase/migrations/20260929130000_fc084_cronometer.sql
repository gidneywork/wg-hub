-- FC-084 c1: Cronometer nutrition sync — storage
--
-- cronometer_data — one row per user per London date.
--   Consumed totals come from Cronometer's daily-summary export (computed by
--   Cronometer's server, so they match the diary). Targets come from the
--   getDailyMacroTargetTemplate call, fetched on the first successful run of
--   each London day and reused for the rest of that day.
--   Cadence merges these at read time; a manual nutrition entry always wins.
--   `nutrients` keeps the full export row (every column Cronometer sends) so
--   nothing is lost if a field is wanted later; the flat columns are the ones
--   Cadence reads.
--   Energy balance uses Cadence's own WHOOP burn; Cronometer's "net" energy
--   figure is deliberately not stored.
--
-- cronometer_session — the reusable Cronometer web session (cookies), so a run
--   logs in again only when the session has expired (Cronometer rate-limits
--   logins). This is a credential in all but name: RLS on with NO policy, so
--   only the service role can read or write it — same posture as whoop_tokens.
--   Do not add a policy.
--
-- Non-secret status (last sync, last error, exports used today / 10) lives in
-- app_settings under 'cronometer_connection', mirroring 'whoop_connection'.

begin;

create table if not exists cronometer_data (
  user_id            uuid        not null references auth.users(id),
  date               date        not null,
  -- consumed (daily-summary export)
  calories           numeric,              -- kcal
  protein            numeric,              -- g
  carbs              numeric,              -- g, total carbohydrate
  net_carbs          numeric,              -- g, the figure Cronometer's targets use
  fat                numeric,              -- g
  fibre              numeric,              -- g
  nutrients          jsonb,                -- full export row, for reference
  -- targets (getDailyMacroTargetTemplate)
  target_calories    numeric,
  target_protein     numeric,
  target_net_carbs   numeric,
  target_fat         numeric,
  targets_fetched_at timestamptz,
  synced_at          timestamptz not null default now(),
  primary key (user_id, date)
);

alter table cronometer_data enable row level security;

-- A signed-in user reads only their own rows (the app merges them at read
-- time). Already at the B3 lockdown standard (user_id = auth.uid()), by
-- explicit decision, ahead of the other per-user tables. Writes are
-- service-role only (the sync route), so there is no insert/update policy.
drop policy if exists "cronometer_data_select" on cronometer_data;
create policy "cronometer_data_select" on cronometer_data
  for select to authenticated using (user_id = auth.uid());

create table if not exists cronometer_session (
  user_id     uuid        primary key references auth.users(id),
  cookies     jsonb       not null,          -- cookie jar; never logged or returned
  updated_at  timestamptz not null default now()
);

alter table cronometer_session enable row level security; -- no policies: service role only

-- Live updates for the app (same as whoop_data), added only if not already present.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cronometer_data'
  ) then
    alter publication supabase_realtime add table cronometer_data;
  end if;
end $$;

commit;
