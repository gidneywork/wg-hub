-- FC-090e: clip provider and campaign on clip page-days
--
-- ALREADY APPLIED: run manually by Will in the Supabase SQL editor on
-- 15 Oct 2026. Committed afterwards as a record of what was run.
-- Additive and nullable; existing RLS policies cover the new columns.
--
-- provider replaces the whop_linked tick (any non-empty provider counts on a
-- clip page); campaign replaces whop_campaign. whop_linked and whop_campaign
-- stay in place, unread and unwritten by the app, until a later cleanup
-- drops them.

alter table clip_page_days add column provider text;
alter table clip_page_days add column campaign text;

-- Backfill from the old columns. The two ALTERs are as given; these UPDATEs
-- record the backfill as described (provider 'Whop' where whop_linked,
-- campaign from whop_campaign) and may differ in form from what was run.
update clip_page_days set provider = 'Whop' where whop_linked;
update clip_page_days set campaign = whop_campaign where whop_campaign is not null;
