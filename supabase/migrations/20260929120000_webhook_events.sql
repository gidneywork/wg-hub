-- FC-079 c2: webhook de-duplication ledger
--
-- One row per provider event, keyed so a retried delivery collides on the
-- primary key. The webhook routes insert with ON CONFLICT DO NOTHING and only
-- process an event when the insert actually created a row.
--   strava: dedupe_key = '<object_id>:<aspect_type>:<event_time>'
--   whoop:  dedupe_key = '<type>:<id>:<trace_id>'           (FC-080 c1b)
--
-- The routes fail OPEN: if this table is missing or the insert errors, the
-- event is processed anyway (and the error is logged). Applying this migration
-- before or after the deploy is therefore safe.
--
-- Secrets posture matches whoop_tokens: RLS enabled with NO policy, so only
-- the service role (the webhook routes) can read or write. Do not add a policy.
--
-- No pruning: a few thousand rows a year is negligible.

create table if not exists webhook_events (
  source      text        not null,             -- 'strava' | 'whoop'
  dedupe_key  text        not null,
  user_id     uuid        references auth.users(id),
  received_at timestamptz not null default now(),
  primary key (source, dedupe_key)
);

alter table webhook_events enable row level security; -- no policies: service role only
