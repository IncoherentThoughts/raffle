-- Admin read RPCs for the Entries tab: per-Entry status (live preview before
-- the Draw, Snapshot verdict after it), Duplicate Flags, new vs returning;
-- plus flag dismissal.

create function public.admin_entries(p_raffle_id uuid)
returns table (
  id uuid, raffle_id uuid, full_name text, email text, email_normalized text,
  device_id text, added_by_admin boolean, created_at timestamptz,
  removed_at timestamptz, removed_reason text,
  eligible boolean, reason public.verdict_reason,
  excluding_won_at timestamptz, override_reason text,
  status_source text,               -- 'live' before the Draw, 'snapshot' after
  flags public.flag_rule[],         -- undismissed Duplicate Flag rules (live)
  is_returning boolean              -- Entrant has an Entry in an earlier Raffle
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select e.id, e.raffle_id, e.full_name, e.email, e.email_normalized,
           e.device_id, e.added_by_admin, e.created_at, e.removed_at, e.removed_reason,
           coalesce(s.eligible, v.eligible),
           coalesce(s.reason, v.reason),
           case when s.entry_id is not null then s.excluding_won_at else v.excluding_won_at end,
           case when s.entry_id is not null then s.override_reason else v.override_reason end,
           case when s.entry_id is not null then 'snapshot' else 'live' end,
           coalesce(f.flags, '{}'),
           exists (select 1 from public.entries pe
                     join public.raffles pr on pr.id = pe.raffle_id
                    where pe.email_normalized = e.email_normalized
                      and pr.created_at < r.created_at)
      from public.raffles r
      join public.entries e on e.raffle_id = r.id
      left join public.draw_snapshot_entries s on s.raffle_id = r.id and s.entry_id = e.id
      left join private.entry_verdicts(p_raffle_id, now()) v on v.entry_id = e.id
      left join private.entry_flag_rules(p_raffle_id) f on f.entry_id = e.id
     where r.id = p_raffle_id
     order by e.created_at desc;
end $$;

-- One row per (Entry, rule, other Entry); each pair appears from both sides.
create function public.admin_entry_flags(p_raffle_id uuid)
returns table (entry_id uuid, rule public.flag_rule, other_entry_id uuid,
               other_full_name text, other_removed boolean, dismissed boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select * from private.entry_flags(p_raffle_id);
end $$;

-- Dismiss one flagged pair for one rule, with a reason. Entry order is free.
create function public.dismiss_flag(p_raffle_id uuid, p_rule public.flag_rule,
                                    p_entry_a uuid, p_entry_b uuid, p_reason text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_reason text;
  v_a uuid := least(p_entry_a, p_entry_b);
  v_b uuid := greatest(p_entry_a, p_entry_b);
  v_id uuid;
begin
  perform private.require_admin();
  v_reason := private.require_reason(p_reason);
  if not exists (select 1 from private.flag_pairs(p_raffle_id) fp
                  where fp.rule = p_rule and fp.entry_a = v_a and fp.entry_b = v_b) then
    raise exception 'not_flagged' using errcode = '22023',
      hint = 'These two Entries are not flagged for this rule in this Raffle.';
  end if;

  insert into public.flag_dismissals (raffle_id, rule, entry_a, entry_b, reason)
  values (p_raffle_id, p_rule, v_a, v_b, v_reason)
  on conflict on constraint flag_dismissals_unique do nothing
  returning id into v_id;

  if v_id is null then  -- already dismissed: idempotent
    select d.id into v_id from public.flag_dismissals d
     where d.raffle_id = p_raffle_id and d.rule = p_rule and d.entry_a = v_a and d.entry_b = v_b;
    return v_id;
  end if;

  perform private.log('flag_dismiss', p_raffle_id, 'flag', v_id,
    (select string_agg(full_name, ' / ' order by id) from public.entries where id in (v_a, v_b)),
    v_reason, jsonb_build_object('rule', p_rule, 'entry_a', v_a, 'entry_b', v_b));
  return v_id;
end $$;

revoke execute on function public.admin_entries(uuid) from public, anon, authenticated;
revoke execute on function public.admin_entry_flags(uuid) from public, anon, authenticated;
revoke execute on function public.dismiss_flag(uuid, public.flag_rule, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_entries(uuid) to authenticated;
grant execute on function public.admin_entry_flags(uuid) to authenticated;
grant execute on function public.dismiss_flag(uuid, public.flag_rule, uuid, uuid, text) to authenticated;
