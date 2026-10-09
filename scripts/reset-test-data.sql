-- Wipes ALL raffle data (Raffles, Entries, Winners, Overrides, Snapshots, dismissals, Activity Log).
-- Run in the Supabase SQL editor after testing, before the real launch. Keeps the admin login
-- and private.app_config. The Activity Log's append-only triggers are paused only inside this
-- transaction.
begin;
alter table public.activity_log disable trigger user;
truncate public.draw_snapshot_entries, public.draw_snapshots, public.flag_dismissals, public.winners,
  public.eligibility_overrides, public.entries, public.raffles, public.activity_log cascade;
alter table public.activity_log enable trigger user;
truncate private.request_log;
commit;
