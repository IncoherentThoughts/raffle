-- Admin mutation RPCs. Each checks the configured admin, validates, writes,
-- and appends to the Activity Log in one transaction. Reasons are mandatory
-- for cancel, Entry removal, Override set/clear (and Redraw, dismissals).

-- ---------------------------------------------------------------------------
-- Raffles
-- ---------------------------------------------------------------------------
create function public.create_raffle(
  p_title text,
  p_close_time timestamptz,
  p_prize text default null,
  p_details text default null,
  p_winner_count int default 1,
  p_exclusion_enabled boolean default true,
  p_exclusion_months int default 12
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_admin();
  if p_close_time is null or p_close_time <= now() then
    raise exception 'close_time_in_past' using errcode = '22023';
  end if;
  if exists (select 1 from public.raffles where state = 'open') then
    raise exception 'raffle_already_open' using errcode = '55000',
      hint = 'Draw or cancel the current Raffle first.';
  end if;

  insert into public.raffles (title, prize, details, close_time, winner_count,
                              exclusion_enabled, exclusion_months)
  values (btrim(p_title), nullif(btrim(p_prize), ''), nullif(btrim(p_details), ''), p_close_time,
          coalesce(p_winner_count, 1), coalesce(p_exclusion_enabled, true), coalesce(p_exclusion_months, 12))
  returning id into v_id;

  perform private.log('raffle_create', v_id, 'raffle', v_id, btrim(p_title), null,
    (select to_jsonb(r) from public.raffles r where r.id = v_id));
  return v_id;
end $$;

-- Full edit from the Edit modal (all editable fields). Allowed while Open or
-- Closed. A Close Time in the past closes early; a future Close Time on a
-- Closed Raffle reopens it.
create function public.update_raffle(
  p_raffle_id uuid,
  p_title text,
  p_close_time timestamptz,
  p_prize text,
  p_details text,
  p_winner_count int,
  p_exclusion_enabled boolean,
  p_exclusion_months int
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  before public.raffles;
  after public.raffles;
  v_was_closed boolean;
  v_now_closed boolean;
begin
  perform private.require_admin();
  select * into before from public.raffles where id = p_raffle_id for update;
  if not found then
    raise exception 'raffle_not_found' using errcode = 'P0002';
  end if;
  if before.state <> 'open' then
    raise exception 'raffle_not_editable' using errcode = '55000',
      hint = 'Only Open or Closed Raffles can be edited.';
  end if;

  update public.raffles
     set title = btrim(p_title),
         prize = nullif(btrim(p_prize), ''),
         details = nullif(btrim(p_details), ''),
         close_time = p_close_time,
         winner_count = p_winner_count,
         exclusion_enabled = p_exclusion_enabled,
         exclusion_months = p_exclusion_months
   where id = p_raffle_id
  returning * into after;

  v_was_closed := before.close_time <= now();
  v_now_closed := after.close_time <= now();

  perform private.log('raffle_edit', p_raffle_id, 'raffle', p_raffle_id, after.title, null,
    jsonb_build_object('before', to_jsonb(before), 'after', to_jsonb(after),
                       'reopened', v_was_closed and not v_now_closed,
                       'closed_early', v_now_closed and not v_was_closed));
end $$;

create function public.close_raffle_early(p_raffle_id uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r public.raffles;
begin
  perform private.require_admin();
  select * into r from public.raffles where id = p_raffle_id for update;
  if not found then
    raise exception 'raffle_not_found' using errcode = 'P0002';
  end if;
  if r.state <> 'open' then
    raise exception 'raffle_not_open' using errcode = '55000';
  end if;
  if r.close_time <= now() then
    raise exception 'raffle_already_closed' using errcode = '55000';
  end if;
  update public.raffles set close_time = now() where id = p_raffle_id;
  perform private.log('raffle_close_early', p_raffle_id, 'raffle', p_raffle_id, r.title, null,
    jsonb_build_object('previous_close_time', r.close_time));
end $$;

create function public.cancel_raffle(p_raffle_id uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r public.raffles;
  v_reason text;
begin
  perform private.require_admin();
  v_reason := private.require_reason(p_reason);
  select * into r from public.raffles where id = p_raffle_id for update;
  if not found then
    raise exception 'raffle_not_found' using errcode = 'P0002';
  end if;
  if r.state <> 'open' then
    raise exception 'raffle_not_open' using errcode = '55000',
      hint = 'Only Open or Closed Raffles can be cancelled.';
  end if;
  update public.raffles
     set state = 'cancelled', cancelled_at = now(), cancel_reason = v_reason
   where id = p_raffle_id;
  perform private.log('raffle_cancel', p_raffle_id, 'raffle', p_raffle_id, r.title, v_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Entries (Open or Closed Raffles only; after the Draw the Snapshot rules)
-- ---------------------------------------------------------------------------
create function private.require_raffle_accepting_admin_changes(p_raffle_id uuid) returns public.raffles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r public.raffles;
begin
  select * into r from public.raffles where id = p_raffle_id for update;
  if not found then
    raise exception 'raffle_not_found' using errcode = 'P0002';
  end if;
  if r.state <> 'open' then
    raise exception 'raffle_not_open' using errcode = '55000',
      hint = 'Entries can only be changed while the Raffle is Open or Closed.';
  end if;
  return r;
end $$;

create function public.add_entry(p_raffle_id uuid, p_full_name text, p_email text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_existing public.entries;
  v_id uuid;
begin
  perform private.require_admin();
  perform private.require_raffle_accepting_admin_changes(p_raffle_id);

  select * into v_existing from public.entries
   where raffle_id = p_raffle_id and email_normalized = private.normalize_email(p_email);
  if found then
    if v_existing.removed_at is not null then
      raise exception 'already_entered_removed' using errcode = '23505',
        detail = v_existing.id::text, hint = 'This Entrant''s Entry was removed; restore it instead.';
    end if;
    raise exception 'already_entered' using errcode = '23505', detail = v_existing.id::text;
  end if;

  insert into public.entries (raffle_id, full_name, email, added_by_admin)
  values (p_raffle_id, p_full_name, p_email, true)
  returning id into v_id;

  perform private.log('entry_add', p_raffle_id, 'entry', v_id,
    (select full_name || ' <' || email || '>' from public.entries where id = v_id));
  return v_id;
end $$;

create function public.remove_entry(p_entry_id uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e public.entries;
  v_reason text;
begin
  perform private.require_admin();
  v_reason := private.require_reason(p_reason);
  select * into e from public.entries where id = p_entry_id;
  if not found then
    raise exception 'entry_not_found' using errcode = 'P0002';
  end if;
  perform private.require_raffle_accepting_admin_changes(e.raffle_id);
  select * into e from public.entries where id = p_entry_id for update;
  if e.removed_at is not null then
    raise exception 'entry_already_removed' using errcode = '55000';
  end if;
  update public.entries set removed_at = now(), removed_reason = v_reason where id = p_entry_id;
  perform private.log('entry_remove', e.raffle_id, 'entry', e.id,
    e.full_name || ' <' || e.email || '>', v_reason);
end $$;

create function public.restore_entry(p_entry_id uuid, p_reason text default null) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e public.entries;
begin
  perform private.require_admin();
  select * into e from public.entries where id = p_entry_id;
  if not found then
    raise exception 'entry_not_found' using errcode = 'P0002';
  end if;
  perform private.require_raffle_accepting_admin_changes(e.raffle_id);
  select * into e from public.entries where id = p_entry_id for update;
  if e.removed_at is null then
    raise exception 'entry_not_removed' using errcode = '55000';
  end if;
  update public.entries set removed_at = null, removed_reason = null where id = p_entry_id;
  perform private.log('entry_restore', e.raffle_id, 'entry', e.id,
    e.full_name || ' <' || e.email || '>', nullif(btrim(p_reason), ''),
    jsonb_build_object('removed_at', e.removed_at, 'removed_reason', e.removed_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Past Winners
-- ---------------------------------------------------------------------------
create function public.add_past_winner(p_full_name text, p_email text, p_won_at timestamptz,
                                       p_note text default null) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_admin();
  if p_won_at is null or p_won_at > now() then
    raise exception 'won_at_in_future' using errcode = '22023';
  end if;
  if p_email is null or btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  insert into public.winners (source, full_name, email, won_at, note)
  values ('past', btrim(p_full_name), btrim(p_email), p_won_at, nullif(btrim(p_note), ''))
  returning id into v_id;
  perform private.log('past_winner_add', null, 'winner', v_id, btrim(p_full_name) || ' <' || btrim(p_email) || '>',
    null, jsonb_build_object('won_at', p_won_at, 'note', p_note));
  return v_id;
end $$;

-- Only Past Winners can be deleted; drawn Winners change only by Redraw.
create function public.delete_past_winner(p_winner_id uuid, p_reason text default null) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  w public.winners;
begin
  perform private.require_admin();
  select * into w from public.winners where id = p_winner_id for update;
  if not found then
    raise exception 'winner_not_found' using errcode = 'P0002';
  end if;
  if w.source <> 'past' then
    raise exception 'not_past_winner' using errcode = '55000',
      hint = 'Drawn Winners can only be replaced by Redraw.';
  end if;
  delete from public.winners where id = p_winner_id;
  perform private.log('past_winner_delete', null, 'winner', w.id, w.full_name || ' <' || w.email || '>',
    nullif(btrim(p_reason), ''), to_jsonb(w));
end $$;

-- ---------------------------------------------------------------------------
-- Eligibility Overrides
-- ---------------------------------------------------------------------------
-- Sets the Entrant's Override, superseding (clearing) any current one.
create function public.set_override(p_email text, p_kind public.override_kind, p_reason text,
                                    p_expires_at timestamptz default null) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_reason text;
  v_email text := btrim(p_email);
  v_id uuid;
begin
  perform private.require_admin();
  v_reason := private.require_reason(p_reason);
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_kind is null then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;

  update public.eligibility_overrides
     set cleared_at = now(), cleared_reason = 'superseded: ' || v_reason
   where email_normalized = private.normalize_email(v_email) and cleared_at is null;

  insert into public.eligibility_overrides (email, kind, reason, expires_at)
  values (v_email, p_kind, v_reason, p_expires_at)
  returning id into v_id;

  perform private.log('override_set', null, 'override', v_id, private.normalize_email(v_email), v_reason,
    jsonb_build_object('kind', p_kind, 'expires_at', p_expires_at));
  return v_id;
end $$;

create function public.clear_override(p_override_id uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  o public.eligibility_overrides;
  v_reason text;
begin
  perform private.require_admin();
  v_reason := private.require_reason(p_reason);
  select * into o from public.eligibility_overrides where id = p_override_id for update;
  if not found then
    raise exception 'override_not_found' using errcode = 'P0002';
  end if;
  if o.cleared_at is not null then
    raise exception 'override_already_cleared' using errcode = '55000';
  end if;
  update public.eligibility_overrides set cleared_at = now(), cleared_reason = v_reason where id = o.id;
  perform private.log('override_clear', null, 'override', o.id, o.email_normalized, v_reason,
    jsonb_build_object('kind', o.kind));
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.raffle_accepts_entries(uuid) to anon, authenticated;
grant execute on function private.normalize_email(text) to anon, authenticated;

revoke execute on function public.create_raffle(text, timestamptz, text, text, int, boolean, int) from public, anon, authenticated;
revoke execute on function public.update_raffle(uuid, text, timestamptz, text, text, int, boolean, int) from public, anon, authenticated;
revoke execute on function public.close_raffle_early(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_raffle(uuid, text) from public, anon, authenticated;
revoke execute on function public.add_entry(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.remove_entry(uuid, text) from public, anon, authenticated;
revoke execute on function public.restore_entry(uuid, text) from public, anon, authenticated;
revoke execute on function public.add_past_winner(text, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.delete_past_winner(uuid, text) from public, anon, authenticated;
revoke execute on function public.set_override(text, public.override_kind, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.clear_override(uuid, text) from public, anon, authenticated;

grant execute on function public.create_raffle(text, timestamptz, text, text, int, boolean, int) to authenticated;
grant execute on function public.update_raffle(uuid, text, timestamptz, text, text, int, boolean, int) to authenticated;
grant execute on function public.close_raffle_early(uuid) to authenticated;
grant execute on function public.cancel_raffle(uuid, text) to authenticated;
grant execute on function public.add_entry(uuid, text, text) to authenticated;
grant execute on function public.remove_entry(uuid, text) to authenticated;
grant execute on function public.restore_entry(uuid, text) to authenticated;
grant execute on function public.add_past_winner(text, text, timestamptz, text) to authenticated;
grant execute on function public.delete_past_winner(uuid, text) to authenticated;
grant execute on function public.set_override(text, public.override_kind, text, timestamptz) to authenticated;
grant execute on function public.clear_override(uuid, text) to authenticated;
