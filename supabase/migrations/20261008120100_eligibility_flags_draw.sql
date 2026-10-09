-- Eligibility verdicts, Duplicate Flags, Draw and Redraw.
-- The eligibility rules and flag normalization rules are each defined once
-- here; the live Entries view, the Draw Snapshot and Redraw all use them.

-- ---------------------------------------------------------------------------
-- Duplicate Flag normalization (#7). Entrant identity stays normalize_email().
-- ---------------------------------------------------------------------------

-- Company domains treated as one for the email-match flag. Constant, not
-- admin-editable; the first is the canonical form.
create function private.company_domains() returns text[]
language sql immutable parallel safe set search_path = ''
as $$ select array['thecomfortgroup.com', 'automatedcontrolsinc.com'] $$;

-- Same-name rule: trim, collapse whitespace, lowercase, strip diacritics and
-- punctuation; compared exactly.
create function private.flag_name(p_name text) returns text
language sql stable parallel safe set search_path = ''
as $$
  select btrim(regexp_replace(
           regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_name)),
                          '[^[:alnum:][:space:]]', '', 'g'),
           '\s+', ' ', 'g'))
$$;

-- Email-match rule: Entrant email with +tag and local-part dots stripped and
-- company domains folded into one.
create function private.flag_email(p_email text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select case when position('@' in n) = 0 then n else
           replace(split_part(split_part(n, '@', 1), '+', 1), '.', '') || '@' ||
           case when split_part(n, '@', 2) = any (private.company_domains())
                then (private.company_domains())[1]
                else split_part(n, '@', 2) end
         end
  from (select private.normalize_email(p_email) as n) x
$$;

-- Every flagged Entry pair in one Raffle (removed Entries included), entry_a < entry_b.
create function private.flag_pairs(p_raffle_id uuid)
returns table (rule public.flag_rule, entry_a uuid, entry_b uuid)
language sql stable set search_path = ''
as $$
  with e as (
    select id, private.flag_name(full_name) as n, private.flag_email(email) as fe, device_id as d
      from public.entries where raffle_id = p_raffle_id
  )
  select 'same_name'::public.flag_rule, a.id, b.id from e a join e b on a.id < b.id and a.n = b.n and a.n <> ''
  union all
  select 'email_match', a.id, b.id from e a join e b on a.id < b.id and a.fe = b.fe
  union all
  select 'same_device', a.id, b.id from e a join e b on a.id < b.id and a.d = b.d
$$;

-- Per-Entry view of the pairs: one row per (entry, rule, other entry).
create function private.entry_flags(p_raffle_id uuid)
returns table (entry_id uuid, rule public.flag_rule, other_entry_id uuid,
               other_full_name text, other_removed boolean, dismissed boolean)
language sql stable set search_path = ''
as $$
  with p as (
    select fp.rule, fp.entry_a, fp.entry_b,
           exists (select 1 from public.flag_dismissals d
                    where d.raffle_id = p_raffle_id and d.rule = fp.rule
                      and d.entry_a = fp.entry_a and d.entry_b = fp.entry_b) as dismissed
      from private.flag_pairs(p_raffle_id) fp
  ), sides as (
    select entry_a as entry_id, rule, entry_b as other_entry_id, dismissed from p
    union all
    select entry_b, rule, entry_a, dismissed from p
  )
  select s.entry_id, s.rule, s.other_entry_id, o.full_name, o.removed_at is not null, s.dismissed
    from sides s join public.entries o on o.id = s.other_entry_id
$$;

-- Undismissed rule names per Entry (what the Snapshot freezes and the CSV exports).
create function private.entry_flag_rules(p_raffle_id uuid)
returns table (entry_id uuid, flags public.flag_rule[])
language sql stable set search_path = ''
as $$
  select entry_id, array_agg(distinct rule order by rule)
    from private.entry_flags(p_raffle_id)
   where not dismissed
   group by entry_id
$$;

-- ---------------------------------------------------------------------------
-- Eligibility (#4). Order of precedence:
--   1. Removed Entry                       -> excluded 'removed'
--   2. active Override force_excluded      -> excluded 'override_excluded'
--      active Override force_eligible      -> eligible 'override_eligible'
--   3. Exclusion Window on and the Entrant has a Standing Winner record whose
--      Won Date is within the window before p_at -> excluded 'exclusion_window'
--   4. otherwise                           -> eligible
-- Replaced Winners never exclude.
-- ---------------------------------------------------------------------------
create function private.entry_verdicts(p_raffle_id uuid, p_at timestamptz)
returns table (entry_id uuid, eligible boolean, reason public.verdict_reason,
               excluding_winner_id uuid, excluding_won_at timestamptz,
               override_id uuid, override_reason text)
language sql stable set search_path = ''
as $$
  select e.id,
         c.reason in ('eligible', 'override_eligible'),
         c.reason,
         case when c.reason = 'exclusion_window' then w.id end,
         case when c.reason = 'exclusion_window' then w.won_at end,
         case when c.reason in ('override_eligible', 'override_excluded') then o.id end,
         case when c.reason in ('override_eligible', 'override_excluded') then o.reason end
    from public.raffles r
    join public.entries e on e.raffle_id = r.id
    left join lateral (
      select o.id, o.kind, o.reason from public.eligibility_overrides o
       where o.email_normalized = e.email_normalized
         and o.cleared_at is null
         and (o.expires_at is null or o.expires_at > p_at)
       limit 1) o on true
    left join lateral (
      select w.id, w.won_at from public.winners w
       where r.exclusion_enabled
         and w.email_normalized = e.email_normalized
         and w.status = 'standing'
         and w.raffle_id is distinct from r.id
         and w.won_at <= p_at
         and w.won_at > p_at - make_interval(months => r.exclusion_months)
       order by w.won_at desc
       limit 1) w on true
    cross join lateral (
      select (case
                when e.removed_at is not null then 'removed'
                when o.kind = 'force_excluded' then 'override_excluded'
                when o.kind = 'force_eligible' then 'override_eligible'
                when w.id is not null then 'exclusion_window'
                else 'eligible'
              end)::public.verdict_reason as reason) c
   where r.id = p_raffle_id
$$;

-- ---------------------------------------------------------------------------
-- Draw
-- ---------------------------------------------------------------------------
-- Picks min(Winner Count, eligible) distinct Entrants from the Eligible
-- Entries using pgcrypto's CSPRNG, writes the Draw Snapshot, marks the Raffle
-- Drawn and logs it, atomically. Refused before the Close Time, when already
-- Drawn/Cancelled, or with no Eligible Entries. Unfilled positions are Vacant
-- Slots (see raffle_slots()).
create function public.draw(p_raffle_id uuid)
returns setof public.winners
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r public.raffles;
  v_at timestamptz := now();
  v_eligible int;
  v_excluded int;
  v_flagged int;
begin
  perform private.require_admin();

  select * into r from public.raffles where id = p_raffle_id for update;
  if not found then
    raise exception 'raffle_not_found' using errcode = 'P0002';
  end if;
  if r.state <> 'open' then
    raise exception 'raffle_not_open' using errcode = '55000';
  end if;
  if r.close_time > v_at then
    raise exception 'raffle_not_closed' using errcode = '55000';
  end if;

  select count(*) filter (where v.eligible), count(*) filter (where not v.eligible)
    into v_eligible, v_excluded
    from private.entry_verdicts(p_raffle_id, v_at) v;
  if v_eligible = 0 then
    raise exception 'no_eligible_entries' using errcode = '55000';
  end if;

  insert into public.draw_snapshots (raffle_id, drawn_at, winner_count, eligible_count, excluded_count, flagged_count)
  values (p_raffle_id, v_at, r.winner_count, v_eligible, v_excluded, 0);

  insert into public.draw_snapshot_entries
    (raffle_id, entry_id, full_name, email, email_normalized, eligible, reason,
     excluding_winner_id, excluding_won_at, override_id, override_reason, flags)
  select p_raffle_id, e.id, e.full_name, e.email, e.email_normalized, v.eligible, v.reason,
         v.excluding_winner_id, v.excluding_won_at, v.override_id, v.override_reason,
         coalesce(f.flags, '{}')
    from private.entry_verdicts(p_raffle_id, v_at) v
    join public.entries e on e.id = v.entry_id
    left join private.entry_flag_rules(p_raffle_id) f on f.entry_id = e.id;

  select count(*) into v_flagged from public.draw_snapshot_entries
   where raffle_id = p_raffle_id and flags <> '{}';
  update public.draw_snapshots set flagged_count = v_flagged where raffle_id = p_raffle_id;

  insert into public.winners (source, raffle_id, position, entry_id, full_name, email, won_at)
  select 'draw', p_raffle_id, row_number() over (order by k), entry_id, full_name, email, v_at
    from (select s.entry_id, s.full_name, s.email, extensions.gen_random_bytes(16) as k
            from public.draw_snapshot_entries s
           where s.raffle_id = p_raffle_id and s.eligible
           offset 0) pool
   order by k
   limit r.winner_count;

  update public.raffles set state = 'drawn', drawn_at = v_at where id = p_raffle_id;

  perform private.log('draw', p_raffle_id, 'raffle', p_raffle_id, r.title, null,
    jsonb_build_object(
      'winner_count', r.winner_count, 'eligible', v_eligible, 'excluded', v_excluded,
      'flagged', v_flagged,
      'winners', (select jsonb_agg(jsonb_build_object('position', w.position, 'winner_id', w.id,
                                                      'name', w.full_name, 'email', w.email)
                                   order by w.position)
                    from public.winners w where w.raffle_id = p_raffle_id)));

  return query select * from public.winners where raffle_id = p_raffle_id order by position;
end $$;

-- ---------------------------------------------------------------------------
-- Slots of a Drawn Raffle: positions 1..Winner Count with the Standing Winner
-- in each, or vacant. Replaced Winners are in the winners table (status
-- 'replaced', replaces_winner_id chain).
-- ---------------------------------------------------------------------------
create function public.raffle_slots(p_raffle_id uuid)
returns table ("position" int, vacant boolean, winner_id uuid, full_name text, email text,
               won_at timestamptz, source public.winner_source)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select g.n, w.id is null, w.id, w.full_name, w.email, w.won_at, w.source
      from public.raffles r
      cross join lateral generate_series(1, r.winner_count) g(n)
      left join public.winners w
        on w.raffle_id = r.id and w.position = g.n and w.status = 'standing'
     where r.id = p_raffle_id and r.state = 'drawn'
     order by g.n;
end $$;

revoke execute on all functions in schema private from public;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.public_raffle_state() to anon, authenticated;
grant execute on function public.status(public.raffles) to authenticated;
grant execute on function public.draw(uuid) to authenticated;
grant execute on function public.raffle_slots(uuid) to authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.raffle_accepts_entries(uuid) to anon, authenticated;
grant execute on function private.normalize_email(text) to anon, authenticated;
