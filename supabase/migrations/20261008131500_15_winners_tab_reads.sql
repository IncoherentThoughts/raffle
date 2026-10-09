-- Admin read RPCs for the Winners tab (#15): every Winner with its Exclusion
-- Window status and current Eligibility Override, and the active Overrides.
-- Read-only; the writes (add_past_winner, delete_past_winner, set_override,
-- clear_override) already exist and log to the Activity Log.
--
-- Status uses the same rule as private.entry_verdicts (#4): a Standing Winner
-- excludes their Entrant while won_at <= t and won_at > t - window; Replaced
-- Winners never exclude. Here t = now() (a live preview, like admin_entries
-- before the Draw), and the window is the reference window below.

-- The Exclusion Window a Draw would apply right now: the current Open/Closed
-- Raffle's setting, or the new-Raffle form default (on, 12 months) when there
-- is none.
create function private.reference_exclusion_window()
returns table (enabled boolean, months int, raffle_id uuid)
language sql stable set search_path = ''
as $$
  select coalesce(r.exclusion_enabled, true), coalesce(r.exclusion_months, 12), r.id
    from (select 1) d
    left join public.raffles r on r.state = 'open'
$$;

-- An Override is active while uncleared and not past its expiry (as in entry_verdicts).
create function private.active_override(p_email_normalized text, p_at timestamptz)
returns table (id uuid, kind public.override_kind, reason text, expires_at timestamptz)
language sql stable set search_path = ''
as $$
  select o.id, o.kind, o.reason, o.expires_at
    from public.eligibility_overrides o
   where o.email_normalized = p_email_normalized
     and o.cleared_at is null
     and (o.expires_at is null or o.expires_at > p_at)
   limit 1
$$;

-- Every Winner (Standing and Replaced), newest Won Date first.
create function public.admin_winners()
returns table (
  id uuid, source public.winner_source, raffle_id uuid, raffle_title text, "position" int,
  full_name text, email text, email_normalized text, won_at timestamptz,
  status public.winner_status, replaced_at timestamptz, replaced_reason text, note text,
  window_enabled boolean, window_months int,
  excluded boolean,                 -- inside the reference Exclusion Window now
  excluded_until timestamptz,       -- won_at + window, for Standing Winners with the window on
  override_id uuid, override_kind public.override_kind, override_reason text,
  override_expires_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select w.id, w.source, w.raffle_id, r.title, w.position,
           w.full_name, w.email, w.email_normalized, w.won_at,
           w.status, w.replaced_at, w.replaced_reason, w.note,
           x.enabled, x.months,
           (x.enabled and w.status = 'standing'
              and w.won_at <= now()
              and w.won_at > now() - make_interval(months => x.months)),
           case when x.enabled and w.status = 'standing'
                then w.won_at + make_interval(months => x.months) end,
           o.id, o.kind, o.reason, o.expires_at
      from public.winners w
      left join public.raffles r on r.id = w.raffle_id
      cross join private.reference_exclusion_window() x
      left join lateral private.active_override(w.email_normalized, now()) o on true
     order by w.won_at desc, w.created_at desc;
end $$;

-- Active Overrides, newest first, with the Entrant's display name (latest
-- Entry's name, else latest Winner record's name; null for an unknown email).
create function public.admin_overrides()
returns table (
  id uuid, email text, email_normalized text, full_name text,
  kind public.override_kind, reason text, expires_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select o.id, o.email, o.email_normalized,
           coalesce(
             (select e.full_name from public.entries e
               where e.email_normalized = o.email_normalized
               order by e.created_at desc limit 1),
             (select w.full_name from public.winners w
               where w.email_normalized = o.email_normalized
               order by w.won_at desc limit 1)),
           o.kind, o.reason, o.expires_at, o.created_at
      from public.eligibility_overrides o
     where o.cleared_at is null
       and (o.expires_at is null or o.expires_at > now())
     order by o.created_at desc;
end $$;

revoke execute on function private.reference_exclusion_window() from public;
revoke execute on function private.active_override(text, timestamptz) from public;
revoke execute on function public.admin_winners() from public, anon;
revoke execute on function public.admin_overrides() from public, anon;
grant execute on function public.admin_winners() to authenticated;
grant execute on function public.admin_overrides() to authenticated;
