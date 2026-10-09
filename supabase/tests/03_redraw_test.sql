-- redraw(winner, reason): alternates from the Draw Snapshot, chains, Vacant
-- Slots, mandatory reasons, Replaced Winners regaining eligibility.
begin;
\ir _helpers.psql
select plan(27);

create function tests.slot_winner(p_raffle uuid, p_position int) returns uuid language sql stable as $$
  select id from public.winners where raffle_id = p_raffle and position = p_position and status = 'standing'
$$;
grant execute on function tests.slot_winner(uuid, int) to authenticated, anon;

select tests.make_past_winner('Fay Excluded', 'fay@example.com', now() - interval '1 month');
select tests.remember('r', tests.make_raffle(p_title => 'Redraw raffle', p_winner_count => 2));
select tests.make_entry(tests.id('r'), 'Amy', 'amy@example.com');
select tests.make_entry(tests.id('r'), 'Ben', 'ben@example.com');
select tests.make_entry(tests.id('r'), 'Cat', 'cat@example.com');
select tests.make_entry(tests.id('r'), 'Dan', 'dan@example.com');
select tests.make_entry(tests.id('r'), 'Eve', 'eve@example.com');
select tests.make_entry(tests.id('r'), 'Fay Excluded', 'fay@example.com');
select tests.make_entry(tests.id('r'), 'Rex Removed', 'rex@example.com', p_removed => true);

select tests.as_admin();
select lives_ok(format('select public.draw(%L)', tests.id('r')), 'Draw two of five Eligible Entries');
select tests.as_postgres();
select tests.remember('w1', tests.slot_winner(tests.id('r'), 1));
select tests.remember('w2', tests.slot_winner(tests.id('r'), 2));
-- An Entry that appears after the Draw is not in the Snapshot and never an alternate.
select tests.make_entry(tests.id('r'), 'Late Lou', 'lou@example.com');

-- Access control and reasons --------------------------------------------------
select tests.as_anon();
select throws_ok(format($$select public.redraw(%L, 'no show')$$, tests.id('w1')), '42501', null,
  'anon cannot Redraw');
select tests.as_other_user();
select throws_ok(format($$select public.redraw(%L, 'no show')$$, tests.id('w1')), '42501', 'not_admin',
  'a non-admin authenticated user cannot Redraw');
select tests.as_admin();
select throws_ok(format($$select public.redraw(%L, null)$$, tests.id('w1')), '22023', 'reason_required',
  'a Redraw without a reason is refused');
select throws_ok(format($$select public.redraw(%L, '  ok  ')$$, tests.id('w1')), '22023', 'reason_required',
  'a Redraw reason must be at least 3 characters');
select is((select status::text from public.winners where id = tests.id('w1')), 'standing',
  'a refused Redraw changes nothing');

-- First Redraw -----------------------------------------------------------------------
select tests.as_admin();
create temp table r1 as select * from public.redraw(tests.id('w1'), '  Cannot attend the game  ');
grant select on r1 to authenticated, anon;
select results_eq($$ select replaced_winner_id, position, vacant from r1 $$,
  $$ values (tests.id('w1'), 1, false) $$, 'Redraw replaces the chosen Winner in the same position');
select results_eq(
  $$ select status::text, replaced_reason, replaced_at = now() from public.winners where id = tests.id('w1') $$,
  $$ values ('replaced', 'Cannot attend the game', true) $$,
  'the Replaced Winner keeps the record with the trimmed reason and time');
select results_eq(
  $$ select w.source::text, w.position, w.status::text, w.replaces_winner_id, w.won_at = now()
       from public.winners w join r1 on w.id = r1.new_winner_id $$,
  $$ values ('redraw', 1, 'standing', tests.id('w1'), true) $$,
  'the alternate is a Standing Winner chained to the one it replaces, won at the Redraw');
select ok(
  (select s.eligible from public.winners w join r1 on w.id = r1.new_winner_id
     join public.draw_snapshot_entries s on s.raffle_id = w.raffle_id and s.entry_id = w.entry_id),
  'the alternate comes from the Snapshot''s Eligible Entries');
select ok(
  (select w.email_normalized not in (select email_normalized from public.winners where id in (tests.id('w1'), tests.id('w2')))
     from public.winners w join r1 on w.id = r1.new_winner_id),
  'the alternate is neither the Replaced Winner nor the other Standing Winner');
select throws_ok(format($$select public.redraw(%L, 'again please')$$, tests.id('w1')), '55000', 'winner_not_standing',
  'a Replaced Winner cannot be Redrawn again');

-- Chain until the Snapshot has no alternates left (5 eligible: 2 drawn + 3 alternates) --------
select is((select vacant from public.redraw(tests.slot_winner(tests.id('r'), 1), 'second no show')), false,
  'second Redraw finds an alternate');
select is((select vacant from public.redraw(tests.slot_winner(tests.id('r'), 1), 'third no show')), false,
  'third Redraw uses the last alternate');
select tests.as_postgres();
select tests.remember('last', tests.slot_winner(tests.id('r'), 1));
select tests.as_admin();
create temp table r4 as select * from public.redraw(tests.id('last'), 'fourth no show');
grant select on r4 to authenticated, anon;
select results_eq($$ select replaced_winner_id, new_winner_id, position, vacant from r4 $$,
  $$ values (tests.id('last'), null::uuid, 1, true) $$,
  'with no alternates left the Winner is still Replaced and the slot becomes vacant');
select is((select status::text from public.winners where id = tests.id('last')), 'replaced',
  'the Winner whose slot went vacant is Replaced');
select results_eq($$ select position, vacant from public.raffle_slots(tests.id('r')) $$,
  $$ values (1, true), (2, false) $$, 'slot 1 is a Vacant Slot, slot 2 still stands');

select is(
  (select count(distinct email_normalized)::int from public.winners where raffle_id = tests.id('r')), 5,
  'across the chain every Eligible Entrant was drawn at most once');
select is(
  (select count(*)::int from public.winners
    where raffle_id = tests.id('r') and email_normalized in ('fay@example.com', 'rex@example.com', 'lou@example.com')),
  0, 'excluded, removed and post-Draw Entries are never alternates');
select is((select count(*)::int from public.winners where raffle_id = tests.id('r') and status = 'replaced'), 4,
  'Redraw count = number of Replaced Winners on the Raffle');
select is(
  (select array_agg(reason order by id) from public.activity_log where action = 'redraw' and raffle_id = tests.id('r')),
  array['Cannot attend the game', 'second no show', 'third no show', 'fourth no show'],
  'each Redraw is written to the Activity Log with its reason');
select ok(
  (select (details->>'vacant')::boolean from public.activity_log
    where action = 'redraw' and raffle_id = tests.id('r') order by id desc limit 1),
  'the Activity Log records that the last Redraw left the slot vacant');

select tests.as_postgres();
create temp table expected_names as select array[full_name] as names from public.winners where id = tests.id('w2');
grant select on expected_names to anon;
select tests.as_anon();
select is((select winner_names from public.public_raffle_state()),
  (select names from expected_names),
  'the public page stops naming Replaced Winners and omits the Vacant Slot');

-- Past Winners and unknown ids -----------------------------------------------------------
select tests.as_postgres();
select tests.remember('past', tests.make_past_winner('Old Timer', 'old@example.com', now() - interval '2 years'));
select tests.as_admin();
select throws_ok(format($$select public.redraw(%L, 'not drawn')$$, tests.id('past')), '55000', 'not_drawn_winner',
  'a Past Winner cannot be Redrawn');
select throws_ok(format($$select public.redraw(%L, 'who is this')$$, gen_random_uuid()), 'P0002', 'winner_not_found',
  'Redrawing an unknown Winner fails');

-- Replaced Winners regain eligibility in later Raffles --------------------------------------
select tests.as_postgres();
select tests.remember('next', tests.make_raffle(p_title => 'Next raffle', p_created_at => now()));
insert into public.entries (raffle_id, full_name, email)
select tests.id('next'), full_name, email from public.winners where id in (tests.id('w1'), tests.id('w2'));
select tests.as_admin();
select lives_ok(format('select public.draw(%L)', tests.id('next')), 'Draw the next Raffle');
select results_eq(
  $$ select s.reason::text from public.draw_snapshot_entries s
      where s.raffle_id = tests.id('next')
      order by (s.email_normalized = (select email_normalized from public.winners where id = tests.id('w1'))) desc $$,
  $$ values ('eligible'), ('exclusion_window') $$,
  'a Replaced Winner is eligible again while a Standing Winner is excluded');

select * from finish();
rollback;
