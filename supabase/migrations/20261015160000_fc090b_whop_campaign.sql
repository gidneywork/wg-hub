-- FC-090b: Whop campaign summary on clip page-days
--
-- ALREADY APPLIED: pasted manually by Will in the Supabase SQL editor on
-- 15 Oct 2026. Committed afterwards as a record; the SQL below is exactly
-- what was run. Additive, nullable; existing RLS policies cover it.

alter table public.clip_page_days add column if not exists whop_campaign text;
