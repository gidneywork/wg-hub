-- Phase 1 performance indexes
-- Run manually in Supabase SQL editor. IF NOT EXISTS makes this idempotent.

CREATE INDEX IF NOT EXISTS idx_daily_logs_date
  ON daily_logs (date DESC);

CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date
  ON strava_activities (start_date DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_date
  ON scheduled_sessions (scheduled_date ASC);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_status
  ON scheduled_sessions (status);

CREATE INDEX IF NOT EXISTS idx_chart_annotations_start_date
  ON chart_annotations (start_date DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);
