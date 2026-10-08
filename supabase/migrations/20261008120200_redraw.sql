-- Redraw: replace one Standing drawn Winner with an alternate taken from the
-- Draw Snapshot's remaining Eligible Entries (never a fresh pool). The
-- Replaced Winner keeps the record (reason + time) and is eligible again in
-- later Raffles. With no alternates left the slot becomes a Vacant Slot.
create function public.redraw(p_winner_id uuid, p_reason text)
returns table (replaced_winner_id uuid, new_winner_id uuid, "position" int, vacant boolean)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  w public.winners;
  r public.raffles;
  v_reason text;
  v_at timestamptz := now();
  v_new public.winners;
begin
  perform private.require_admin();
  v_reason := private.require_reason(p_reason);

  select * into w from public.winners where id = p_winner_id;
  if not found then
    raise exception 'winner_not_found' using errcode = 'P0002';
  end if;
  if w.source = 'past' then
    raise exception 'not_drawn_winner' using errcode = '55000',
      hint = 'Past Winners have no Draw to redraw from.';
  end if;

  -- Serialize Redraws on the same Raffle.
  select * into r from public.raffles where id = w.raffle_id for update;
  select * into w from public.winners where id = p_winner_id for update;
  if w.status <> 'standing' then
    raise exception 'winner_not_standing' using errcode = '55000';
  end if;

  update public.winners
     set status = 'replaced', replaced_at = v_at, replaced_reason = v_reason
   where id = w.id;

  -- Alternates: Eligible Snapshot Entries whose Entrant has never been a
  -- Winner of this Raffle (standing or replaced).
  insert into public.winners (source, raffle_id, position, entry_id, replaces_winner_id,
                              full_name, email, won_at)
  select 'redraw', r.id, w.position, s.entry_id, w.id, s.full_name, s.email, v_at
    from public.draw_snapshot_entries s
   where s.raffle_id = r.id
     and s.eligible
     and not exists (select 1 from public.winners x
                      where x.raffle_id = r.id and x.email_normalized = s.email_normalized)
   order by extensions.gen_random_bytes(16)
   limit 1
  returning * into v_new;

  perform private.log('redraw', r.id, 'winner', w.id, w.full_name, v_reason,
    jsonb_build_object(
      'position', w.position,
      'replaced_winner_id', w.id, 'replaced_name', w.full_name, 'replaced_email', w.email,
      'new_winner_id', v_new.id, 'new_name', v_new.full_name, 'new_email', v_new.email,
      'vacant', v_new.id is null));

  return query select w.id, v_new.id, w.position, v_new.id is null;
end $$;

revoke execute on function public.redraw(uuid, text) from public, anon, authenticated;
grant execute on function public.redraw(uuid, text) to authenticated;

-- How many alternates a Redraw on this Raffle could still draw from (for the
-- Redraw confirm dialog: 0 means the slot will go vacant).
create function public.alternates_remaining(p_raffle_id uuid) returns int
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return (select count(*)::int from public.draw_snapshot_entries s
           where s.raffle_id = p_raffle_id and s.eligible
             and not exists (select 1 from public.winners x
                              where x.raffle_id = p_raffle_id
                                and x.email_normalized = s.email_normalized));
end $$;

revoke execute on function public.alternates_remaining(uuid) from public, anon, authenticated;
grant execute on function public.alternates_remaining(uuid) to authenticated;
