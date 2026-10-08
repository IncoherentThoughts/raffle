-- Admin mutations: every write goes through an RPC that checks the admin and
-- writes the Activity Log atomically. Tables are read-only to the admin.
begin;
\ir _helpers.psql
select plan(51);

-- A Drawn Raffle from the past with one drawn Winner, for later checks.
select tests.remember('old', tests.make_raffle(p_title => 'Old', p_state => 'drawn',
  p_created_at => now() - interval '90 days', p_close_time => now() - interval '80 days'));
select tests.remember('old_entry', tests.make_entry(tests.id('old'), 'Olga', 'olga@example.com'));
insert into public.winners (source, raffle_id, position, entry_id, full_name, email, won_at)
values ('draw', tests.id('old'), 1, tests.id('old_entry'), 'Olga', 'olga@example.com', now() - interval '80 days');
select tests.remember('olga_win', (select id from public.winners where entry_id = tests.id('old_entry')));

create function tests.log_count(p_action text) returns int language sql stable security definer as $$
  select count(*)::int from public.activity_log where action = p_action
$$;
grant execute on function tests.log_count(text) to authenticated, anon;

-- Raffle lifecycle ----------------------------------------------------------------
select tests.as_anon();
select throws_ok($$ select public.create_raffle('X', now() + interval '1 day') $$, '42501', null,
  'anon cannot create a Raffle');
select tests.as_other_user();
select throws_ok($$ select public.create_raffle('X', now() + interval '1 day') $$, '42501', 'not_admin',
  'a non-admin user cannot create a Raffle');

select tests.as_admin();
select throws_ok($$ select public.create_raffle('X', now() - interval '1 minute') $$, '22023', 'close_time_in_past',
  'a new Raffle needs a future Close Time');
select tests.remember('r', public.create_raffle(
  p_title => 'Titans vs Texans', p_close_time => now() + interval '3 days',
  p_prize => 'Two lower-bowl seats', p_details => 'Pick up at front desk'));
select results_eq(
  $$ select title, prize, winner_count, exclusion_enabled, exclusion_months, public.status(r)
       from public.raffles r where id = tests.id('r') $$,
  $$ values ('Titans vs Texans', 'Two lower-bowl seats', 1, true, 12, 'open') $$,
  'create_raffle opens a Raffle with the defaults (1 Winner, 12-month window on)');
select is(tests.log_count('raffle_create'), 1, 'creating a Raffle is logged');
select throws_ok($$ select public.create_raffle('Second', now() + interval '1 day') $$, '55000', 'raffle_already_open',
  'only one Raffle may be open at a time');

select lives_ok(format($$ select public.update_raffle(%L, 'Titans vs Texans (home)', now() + interval '4 days',
                          'Two seats', null, 2, false, 6) $$, tests.id('r')),
  'the admin edits an Open Raffle');
select results_eq(
  $$ select title, prize, details, winner_count, exclusion_enabled, exclusion_months
       from public.raffles where id = tests.id('r') $$,
  $$ values ('Titans vs Texans (home)', 'Two seats', null::text, 2, false, 6) $$,
  'every editable field is saved');
select is(tests.log_count('raffle_edit'), 1, 'the edit is logged');
select throws_ok(format($$ select public.update_raffle(%L, 'T', now() + interval '1 day', null, null, 0, true, 12) $$, tests.id('r')),
  '23514', null, 'Winner Count must be at least 1');

select lives_ok(format('select public.close_raffle_early(%L)', tests.id('r')), 'close early');
select results_eq($$ select public.status(r), close_time = now() from public.raffles r where id = tests.id('r') $$,
  $$ values ('closed', true) $$, 'closing early sets the Close Time to now, so the Raffle reads Closed');
select is(tests.log_count('raffle_close_early'), 1, 'closing early is logged');
select throws_ok(format('select public.close_raffle_early(%L)', tests.id('r')), '55000', 'raffle_already_closed',
  'a Closed Raffle cannot be closed early again');

select lives_ok(format($$ select public.update_raffle(%L, 'Titans vs Texans (home)', now() + interval '1 day',
                          'Two seats', null, 2, false, 6) $$, tests.id('r')),
  'moving the Close Time back into the future');
select is((select public.status(r) from public.raffles r where id = tests.id('r')), 'open',
  'reopens the Raffle');
select ok((select (details->>'reopened')::boolean from public.activity_log where action = 'raffle_edit' order by id desc limit 1),
  'the Activity Log notes the reopen');

-- Entries ------------------------------------------------------------------------
select tests.as_anon();
select throws_ok(format($$ select public.add_entry(%L, 'Pat', 'pat@example.com') $$, tests.id('r')), '42501', null,
  'anon cannot use the admin add-entry RPC');
select tests.as_admin();
select tests.remember('pat', public.add_entry(tests.id('r'), ' Pat Added ', ' Pat@Example.com '));
select results_eq($$ select full_name, email_normalized, added_by_admin, device_id from public.entries where id = tests.id('pat') $$,
  $$ values ('Pat Added', 'pat@example.com', true, null::text) $$, 'add_entry marks the Entry as added by admin');
select is(tests.log_count('entry_add'), 1, 'adding an Entry is logged');
select throws_ok(format($$ select public.add_entry(%L, 'Pat Again', 'PAT@example.com') $$, tests.id('r')),
  '23505', 'already_entered', 'an Entrant already in the Raffle cannot be added twice');

select throws_ok(format($$ select public.remove_entry(%L, ' ') $$, tests.id('pat')), '22023', 'reason_required',
  'removing an Entry needs a reason');
select lives_ok(format($$ select public.remove_entry(%L, 'Entered by mistake') $$, tests.id('pat')), 'remove an Entry');
select results_eq($$ select removed_at = now(), removed_reason from public.entries where id = tests.id('pat') $$,
  $$ values (true, 'Entered by mistake') $$, 'a Removed Entry stays on record with its reason');
select is((select reason from public.activity_log where action = 'entry_remove'), 'Entered by mistake',
  'the removal is logged with its reason');
select throws_ok(format($$ select public.remove_entry(%L, 'again!') $$, tests.id('pat')), '55000', 'entry_already_removed',
  'a Removed Entry cannot be removed twice');
select throws_ok(format($$ select public.add_entry(%L, 'Pat', 'pat@example.com') $$, tests.id('r')),
  '23505', 'already_entered_removed', 'adding a Removed Entrant suggests Restore instead');

select lives_ok(format($$ select public.restore_entry(%L) $$, tests.id('pat')), 'restore the Entry');
select results_eq($$ select removed_at, removed_reason from public.entries where id = tests.id('pat') $$,
  $$ values (null::timestamptz, null::text) $$, 'a Restored Entry is back in the Raffle');
select is(tests.log_count('entry_restore'), 1, 'restoring is logged');
select throws_ok(format($$ select public.restore_entry(%L) $$, tests.id('pat')), '55000', 'entry_not_removed',
  'only a Removed Entry can be restored');

-- Direct table writes are not possible, even for the admin -------------------------
select throws_ok($$ update public.raffles set title = 'hack' $$, '42501', null,
  'the admin cannot update tables directly');
select throws_ok($$ insert into public.activity_log (action, target_type) values ('draw', 'raffle') $$, '42501', null,
  'the admin cannot write the Activity Log directly');
select tests.as_postgres();
select throws_ok($$ delete from public.activity_log $$, '42501', 'activity_log is append-only',
  'the Activity Log is append-only even for the database owner');
select tests.as_admin();

-- Cancel ------------------------------------------------------------------------------
select throws_ok(format($$ select public.cancel_raffle(%L, '') $$, tests.id('r')), '22023', 'reason_required',
  'cancelling needs a reason');
select lives_ok(format($$ select public.cancel_raffle(%L, 'Game rescheduled') $$, tests.id('r')), 'cancel the Raffle');
select results_eq($$ select state::text, cancel_reason, cancelled_at = now() from public.raffles where id = tests.id('r') $$,
  $$ values ('cancelled', 'Game rescheduled', true) $$, 'a Cancelled Raffle keeps its reason');
select is((select count(*)::int from public.entries where raffle_id = tests.id('r')), 1,
  'a Cancelled Raffle keeps its Entries');
select throws_ok(format($$ select public.update_raffle(%L, 'T', now() + interval '1 day', null, null, 1, true, 12) $$, tests.id('r')),
  '55000', 'raffle_not_editable', 'a Cancelled Raffle cannot be edited (or reopened)');
select throws_ok(format($$ select public.cancel_raffle(%L, 'twice over') $$, tests.id('old')),
  '55000', 'raffle_not_open', 'a Drawn Raffle cannot be cancelled');
select throws_ok(format($$ select public.add_entry(%L, 'Late', 'late@example.com') $$, tests.id('r')),
  '55000', 'raffle_not_open', 'no Entries can be added to a Cancelled Raffle');
select lives_ok($$ select public.create_raffle('Next one', now() + interval '1 day') $$,
  'a new Raffle can be opened after a cancel');

-- Past Winners -------------------------------------------------------------------------
select tests.remember('past', public.add_past_winner('Quinn Past', 'quinn@example.com', now() - interval '5 months', 'Titans 2025 home opener'));
select results_eq($$ select source::text, status::text, raffle_id, note from public.winners where id = tests.id('past') $$,
  $$ values ('past', 'standing', null::uuid, 'Titans 2025 home opener') $$, 'add_past_winner records a Past Winner');
select throws_ok(format($$ select public.delete_past_winner(%L) $$, tests.id('olga_win')), '55000', 'not_past_winner',
  'drawn Winners can never be deleted');
select lives_ok(format($$ select public.delete_past_winner(%L) $$, tests.id('past')), 'delete a Past Winner');
select is((select count(*)::int from public.winners where id = tests.id('past')), 0, 'the Past Winner is gone');
select is(tests.log_count('past_winner_add') + tests.log_count('past_winner_delete'), 2,
  'adding and deleting Past Winners is logged');

-- Eligibility Overrides ---------------------------------------------------------------
select throws_ok($$ select public.set_override('olga@example.com', 'force_eligible', null) $$, '22023', 'reason_required',
  'an Override needs a reason');
select tests.remember('ov1', public.set_override(' Olga@Example.com ', 'force_eligible', 'Gave her tickets away', now() + interval '30 days'));
select tests.remember('ov2', public.set_override('olga@example.com', 'force_excluded', 'Changed our mind'));
select results_eq(
  $$ select kind::text, cleared_at is null from public.eligibility_overrides where email_normalized = 'olga@example.com' order by created_at, kind $$,
  $$ values ('force_eligible', false), ('force_excluded', true) $$,
  'setting a new Override supersedes the current one');
select lives_ok(format($$ select public.clear_override(%L, 'Back to normal') $$, tests.id('ov2')), 'clear an Override');
select is((select count(*)::int from public.eligibility_overrides where cleared_at is null), 0, 'no Override remains active');

select * from finish();
rollback;
