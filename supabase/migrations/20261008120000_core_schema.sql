-- Company Raffle: core schema, RLS and the public (anon) surface.
-- Vocabulary follows GLOSSARY.md. Decisions: issues #2, #4, #6, #7, #9.
--
-- Security model
--   * anon: INSERT-only on entries (4 columns), gated on an Open, not-yet-closed
--     Raffle; no SELECT anywhere. Public state comes from public_raffle_state().
--   * Admin: the single shared Supabase Auth user whose UUID is stored in
--     private.app_config. It may SELECT every table; every write goes through a
--     SECURITY DEFINER RPC that checks private.is_admin() and writes the
--     Activity Log in the same transaction.
--   * Any other authenticated user is treated like anon.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Nothing new in public is reachable by API roles unless granted explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- private schema: helpers and config. Not exposed by the Data API.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public;

-- Admin config: a single row holding the shared admin Auth user's UUID.
-- Set it after creating that user (see README):
--   insert into private.app_config (admin_user_id)
--   select id from auth.users where email = '<admin email>'
--   on conflict (id) do update set admin_user_id = excluded.admin_user_id, updated_at = now();
create table private.app_config (
  id boolean primary key default true check (id),
  admin_user_id uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
revoke all on private.app_config from public, anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select c.admin_user_id = (select auth.uid()) from private.app_config c where c.id),
    false)
$$;

create function private.require_admin() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501',
      hint = 'Only the configured admin user may do this.';
  end if;
end $$;

-- Mandatory reasons (Redraw, Entry removal, cancel, overrides, dismissals):
-- at least 3 characters after trimming (#6). Returns the trimmed reason.
create function private.require_reason(p_reason text) returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023',
      hint = 'A reason of at least 3 characters is required.';
  end if;
  return btrim(p_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Normalization rules. Defined once here and used everywhere.
-- ---------------------------------------------------------------------------

-- Entrant identity (#4): trim + lowercase, nothing else.
create function private.normalize_email(p_email text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select lower(btrim(p_email, E' \t\r\n')) $$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.raffle_state as enum ('open', 'drawn', 'cancelled');
create type public.winner_source as enum ('draw', 'redraw', 'past');
create type public.winner_status as enum ('standing', 'replaced');
create type public.override_kind as enum ('force_eligible', 'force_excluded');
create type public.flag_rule as enum ('same_name', 'email_match', 'same_device');
create type public.verdict_reason as enum
  ('eligible', 'override_eligible', 'override_excluded', 'exclusion_window', 'removed');

-- ---------------------------------------------------------------------------
-- Raffles. Stored state Open/Drawn/Cancelled; Closed is derived (see status()).
-- ---------------------------------------------------------------------------
create table public.raffles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  prize text check (prize is null or length(prize) <= 500),
  details text check (details is null or length(details) <= 5000),
  close_time timestamptz not null,
  winner_count int not null default 1 check (winner_count between 1 and 100),
  exclusion_enabled boolean not null default true,
  exclusion_months int not null default 12 check (exclusion_months between 1 and 120),
  state public.raffle_state not null default 'open',
  created_at timestamptz not null default now(),   -- the Raffle's "Opened" time
  drawn_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  constraint raffles_drawn_at check ((state = 'drawn') = (drawn_at is not null)),
  constraint raffles_cancelled check ((state = 'cancelled') = (cancelled_at is not null and cancel_reason is not null))
);
-- Only one Open Raffle at a time (Open includes derived Closed).
create unique index raffles_one_open on public.raffles ((true)) where state = 'open';
create index raffles_created_at on public.raffles (created_at desc);

-- Derived status: 'open' | 'closed' | 'drawn' | 'cancelled'.
-- PostgREST computed field: GET /raffles?select=*,status
create function public.status(r public.raffles) returns text
language sql stable set search_path = ''
as $$
  select case when r.state = 'open' and r.close_time <= now() then 'closed'
              else r.state::text end
$$;

-- ---------------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles (id),
  full_name text not null check (length(full_name) between 1 and 200),
  email text not null check (length(email) <= 254
                             and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  email_normalized text generated always as (private.normalize_email(email)) stored,
  device_id text check (device_id is null or length(device_id) <= 100),
  added_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_reason text,
  constraint entries_removed check ((removed_at is null) = (removed_reason is null)),
  -- "Already entered": an INSERT that hits this raises 23505 with this name.
  constraint entries_raffle_email_key unique (raffle_id, email_normalized)
);
create index entries_email_normalized on public.entries (email_normalized);

create function private.entries_tidy() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.full_name := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  new.email := btrim(new.email, E' \t\r\n');
  new.device_id := nullif(btrim(new.device_id), '');
  return new;
end $$;

create trigger entries_tidy before insert or update on public.entries
for each row execute function private.entries_tidy();

-- Gate for the anon insert policy (anon cannot read raffles itself).
create function private.raffle_accepts_entries(p_raffle_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.raffles r
                 where r.id = p_raffle_id and r.state = 'open' and r.close_time > now())
$$;

-- ---------------------------------------------------------------------------
-- Winners (drawn, redrawn alternates, and Past Winners)
-- ---------------------------------------------------------------------------
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  source public.winner_source not null,
  raffle_id uuid references public.raffles (id),
  position int check (position >= 1),
  entry_id uuid references public.entries (id),
  replaces_winner_id uuid references public.winners (id),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text not null check (length(email) <= 254),
  email_normalized text generated always as (private.normalize_email(email)) stored,
  won_at timestamptz not null,
  status public.winner_status not null default 'standing',
  replaced_at timestamptz,
  replaced_reason text,
  note text check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  constraint winners_past_has_no_raffle check ((source = 'past') = (raffle_id is null)),
  constraint winners_past_has_no_position check ((source = 'past') = (position is null)),
  constraint winners_drawn_has_entry check (source = 'past' or entry_id is not null),
  constraint winners_redraw_chain check ((source = 'redraw') = (replaces_winner_id is not null)),
  constraint winners_past_standing check (source <> 'past' or status = 'standing'),
  constraint winners_replaced check ((status = 'replaced') = (replaced_at is not null and replaced_reason is not null))
);
create unique index winners_one_standing_per_slot on public.winners (raffle_id, position)
  where status = 'standing' and raffle_id is not null;
create index winners_email_normalized on public.winners (email_normalized);
create index winners_raffle on public.winners (raffle_id);

-- ---------------------------------------------------------------------------
-- Eligibility Overrides (per Entrant = normalized email)
-- ---------------------------------------------------------------------------
create table public.eligibility_overrides (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254),
  email_normalized text generated always as (private.normalize_email(email)) stored,
  kind public.override_kind not null,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_reason text,
  constraint overrides_cleared check ((cleared_at is null) = (cleared_reason is null))
);
-- At most one uncleared Override per Entrant (an expired one still counts
-- until set_override supersedes it).
create unique index overrides_one_current on public.eligibility_overrides (email_normalized)
  where cleared_at is null;

-- ---------------------------------------------------------------------------
-- Draw Snapshot: one per Draw, every Entry in the pool with its verdict.
-- ---------------------------------------------------------------------------
create table public.draw_snapshots (
  raffle_id uuid primary key references public.raffles (id),
  drawn_at timestamptz not null,
  winner_count int not null,
  eligible_count int not null,
  excluded_count int not null,
  flagged_count int not null
);

create table public.draw_snapshot_entries (
  raffle_id uuid not null references public.draw_snapshots (raffle_id),
  entry_id uuid not null references public.entries (id),
  full_name text not null,
  email text not null,
  email_normalized text not null,
  eligible boolean not null,
  reason public.verdict_reason not null,
  excluding_winner_id uuid,          -- for exclusion_window (no FK: Past Winners may be deleted)
  excluding_won_at timestamptz,
  override_id uuid,                  -- for override_* verdicts
  override_reason text,
  flags public.flag_rule[] not null default '{}',  -- undismissed Duplicate Flags, frozen
  primary key (raffle_id, entry_id)
);

-- ---------------------------------------------------------------------------
-- Duplicate Flag dismissals: per (Raffle, rule, Entry pair), with reason (#7).
-- ---------------------------------------------------------------------------
create table public.flag_dismissals (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles (id),
  rule public.flag_rule not null,
  entry_a uuid not null references public.entries (id),
  entry_b uuid not null references public.entries (id),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint flag_dismissals_ordered check (entry_a < entry_b),
  constraint flag_dismissals_unique unique (raffle_id, rule, entry_a, entry_b)
);

-- ---------------------------------------------------------------------------
-- Activity Log: append-only record of every Admin action.
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null check (action in (
    'raffle_create', 'raffle_edit', 'raffle_close_early', 'raffle_cancel',
    'draw', 'redraw',
    'entry_add', 'entry_remove', 'entry_restore',
    'past_winner_add', 'past_winner_delete',
    'override_set', 'override_clear',
    'flag_dismiss')),
  raffle_id uuid references public.raffles (id),
  target_type text not null check (target_type in ('raffle', 'entry', 'winner', 'override', 'flag')),
  target_id uuid,
  target_label text,
  reason text,
  details jsonb not null default '{}'
);
create index activity_log_raffle on public.activity_log (raffle_id, at);
create index activity_log_at on public.activity_log (at desc);

create function private.activity_log_append_only() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'activity_log is append-only' using errcode = '42501';
end $$;

create trigger activity_log_no_update before update or delete on public.activity_log
for each row execute function private.activity_log_append_only();
create trigger activity_log_no_truncate before truncate on public.activity_log
for each statement execute function private.activity_log_append_only();

create function private.log(
  p_action text, p_raffle_id uuid, p_target_type text, p_target_id uuid,
  p_target_label text, p_reason text default null, p_details jsonb default '{}'
) returns void
language sql security definer set search_path = ''
as $$
  insert into public.activity_log (action, raffle_id, target_type, target_id, target_label, reason, details)
  values (p_action, p_raffle_id, p_target_type, p_target_id, p_target_label, p_reason, coalesce(p_details, '{}'))
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.raffles enable row level security;
alter table public.entries enable row level security;
alter table public.winners enable row level security;
alter table public.eligibility_overrides enable row level security;
alter table public.draw_snapshots enable row level security;
alter table public.draw_snapshot_entries enable row level security;
alter table public.flag_dismissals enable row level security;
alter table public.activity_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Admin reads everything; all admin writes go through RPCs.
grant select on all tables in schema public to authenticated;
create policy admin_read on public.raffles for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.entries for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.winners for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.eligibility_overrides for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.draw_snapshots for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.draw_snapshot_entries for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.flag_dismissals for select to authenticated using ((select private.is_admin()));
create policy admin_read on public.activity_log for select to authenticated using ((select private.is_admin()));

-- Public entry form: INSERT-only, four columns, Open and not yet closed.
-- (authenticated included so the form still works in a browser where the
-- admin is signed in.)
grant insert (raffle_id, full_name, email, device_id) on public.entries to anon, authenticated;
create policy public_enter on public.entries for insert to anon, authenticated
  with check (private.raffle_accepts_entries(raffle_id)
              and not added_by_admin and removed_at is null);

revoke execute on all functions in schema private from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.raffle_accepts_entries(uuid) to anon, authenticated;
grant execute on function private.normalize_email(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public state for the entry page.
-- status: 'open' | 'closed' | 'drawn' | 'none'. raffle_id is what the form
-- inserts with. winner_names: Standing Winners by position; Vacant Slots omitted.
-- ---------------------------------------------------------------------------
create function public.public_raffle_state()
returns table (raffle_id uuid, title text, prize text, details text,
               close_time timestamptz, status text, winner_names text[])
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.raffles;
begin
  select * into r from public.raffles order by created_at desc limit 1;
  if not found or r.state = 'cancelled' then
    return query select null::uuid, null::text, null::text, null::text,
                        null::timestamptz, 'none'::text, '{}'::text[];
    return;
  end if;
  return query
    select r.id, r.title, r.prize, r.details, r.close_time, public.status(r),
           coalesce(array(select w.full_name from public.winners w
                           where w.raffle_id = r.id and w.status = 'standing'
                           order by w.position), '{}');
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.public_raffle_state() to anon, authenticated;
grant execute on function public.status(public.raffles) to authenticated;
