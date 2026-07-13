-- WH-001a: WHOOP OAuth token storage
--
-- Secrets. Single-user app: exactly one row, guarded by a fixed primary key.
-- RLS is ENABLED with NO policy on purpose — the anon and authenticated browser
-- keys therefore get zero access to this table. Only the service role (used
-- server-side in lib/whoop.js and the /api/whoop/* routes) can read or write,
-- because it bypasses RLS.
--
-- This deliberately does NOT follow the app_settings pattern used by Strava,
-- whose tokens sit under permissive RLS and are readable by the anon key. Do
-- not add a permissive policy here. Public, non-secret connection info lives
-- separately in app_settings under the 'whoop_connection' key (mirroring
-- 'strava_connection').
--
-- WHOOP ROTATES the refresh_token on every refresh; the new value must be
-- persisted each time — see getValidWhoopToken() in lib/whoop.js.

CREATE TABLE whoop_tokens (
  id            BOOLEAN     PRIMARY KEY DEFAULT TRUE,
  access_token  TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT        NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whoop_tokens_singleton CHECK (id = TRUE)
);

ALTER TABLE whoop_tokens ENABLE ROW LEVEL SECURITY;

-- No policy is defined, intentionally: the service role bypasses RLS, and every
-- browser-facing key (anon, authenticated) is denied. Do not add a policy.
