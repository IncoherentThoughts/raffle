-- draw(raffle): eligibility, Exclusion Window, Eligibility Overrides, Removed
-- Entries, the Draw Snapshot, partial Draws and access control.
begin;
\ir _helpers.psql
select plan(28);

-- An older Drawn Raffle whose Winner (Hank) was later Replaced.
select tests.remember('old', tests.make_raffle(p_title => 'Old raffle', p_state => 'drawn',
  p_close_time => now() - interval '2 months', p_created_at => now() - interval '3 months'));
select tests.remember('hank_old', tests.make_entry(tests.id('old'), 'Hank Old', 'hank@thecomfortgroup.com'));
insert into public.winners (source, raffle_id, position, entry_id, full_name, email, won_at,
                            status, replaced_at, replaced_reason)
values ('draw', tests.id('old'), 1, tests.id('hank_old'), 'Hank Old', 'hank@thecomfortgroup.com',
        now() - interval '2 months', 'replaced', now() - interval '2 months', 'could not attend');

-- Past Winners
select tests.make_past_winner('Bob Recent', 'BOB@thecomfortgroup.com', now() - interval '3 months');
select tests.make_past_winner('Carol Long Ago', 'carol@thecomfortgroup.com', now() - interval '13 months');
select tests.make_past_winner('Erin Recent', 'erin@thecomfortgroup.com', now() - interval '1 month');

-- Overrides
insert into public.eligibility_overrides (email, kind, reason)
values ('erin@thecomfortgroup.com', 'force_eligible', 'prize was unused'),
       ('frank@thecomfortgroup.com', 'force_excluded', 'organizer of this raffle'),
       ('ivy@thecomfortgroup.com', 'force_eligible', 'test');
insert into public.eligibility_overrides (email, kind, reason, expires_at)
values ('gina@thecomfortgroup.com', 'force_excluded', 'expired one', now() - interval '1 day');

-- The Raffle under test: Closed, two Winners, 12-month window.
select tests.remember('r', tests.make_raffle(p_title => 'Titans vs Jaguars', p_winner_count => 2,
  p_close_time => now() - interval '1 hour'));
select tests.make_entry(tests.id('r'), 'Alice Able', 'alice@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Bob Recent', 'bob@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Carol Long Ago', 'carol@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Dave Removed', 'dave@thecomfortgroup.com', p_removed => true);
select tests.make_entry(tests.id('r'), 'Erin Recent', 'erin@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Frank Excluded', 'frank@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Gina Expired', 'gina@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Hank Old', 'hank@thecomfortgroup.com');
select tests.make_entry(tests.id('r'), 'Ivy Removed', 'ivy@thecomfortgroup.com', p_removed => true);

-- Access control ------------------------------------------------------------
select tests.as_anon();
select throws_ok(format('select public.draw(%L)', tests.id('r')), '42501', null,
  'anon cannot Draw');
select tests.as_other_user();
select throws_ok(format('select public.draw(%L)', tests.id('r')), '42501', 'not_admin',
  'an authenticated user who is not the configured admin cannot Draw');
select tests.as_postgres();

-- Not yet closed --------------------------------------------------------------
update public.raffles set close_time = now() + interval '1 hour' where id = tests.id('r');
select tests.as_admin();
select throws_ok(format('select public.draw(%L)', tests.id('r')), '55000', 'raffle_not_closed',
  'a Raffle cannot be Drawn before its Close Time');
select tests.as_postgres();
update public.raffles set close_time = now() - interval '1 hour' where id = tests.id('r');

-- The Draw ----------------------------------------------------------------------
select tests.as_admin();
select is((select count(*)::int from public.draw(tests.id('r'))), 2,
  'the admin Draws Winner Count Winners');

select results_eq(
  $$ select e.full_name, s.eligible, s.reason::text
       from public.draw_snapshot_entries s join public.entries e on e.id = s.entry_id
      where s.raffle_id = tests.id('r') order by e.full_name $$,
  $$ values ('Alice Able', true, 'eligible'),
            ('Bob Recent', false, 'exclusion_window'),
            ('Carol Long Ago', true, 'eligible'),
            ('Dave Removed', false, 'removed'),
            ('Erin Recent', true, 'override_eligible'),
            ('Frank Excluded', false, 'override_excluded'),
            ('Gina Expired', true, 'eligible'),
            ('Hank Old', true, 'eligible'),
            ('Ivy Removed', false, 'removed') $$,
  'the Snapshot records every Entry with its verdict and reason');

select ok((select excluding_won_at::date = (now() - interval '3 months')::date
             from public.draw_snapshot_entries
            where raffle_id = tests.id('r') and email_normalized = 'bob@thecomfortgroup.com'),
  'an Exclusion Window verdict records the Won Date that excluded the Entry');
select is((select override_reason from public.draw_snapshot_entries
            where raffle_id = tests.id('r') and email_normalized = 'erin@thecomfortgroup.com'),
  'prize was unused', 'an Override verdict records the Override reason');

select results_eq(
  $$ select winner_count, eligible_count, excluded_count from public.draw_snapshots where raffle_id = tests.id('r') $$,
  $$ values (2, 5, 4) $$, 'the Snapshot header records the pool counts');

select results_eq(
  $$ select array_agg(position order by position) from public.winners
      where raffle_id = tests.id('r') and status = 'standing' $$,
  $$ values (array[1, 2]) $$, 'Winners take positions 1..N');

select is(
  (select count(*)::int from public.winners w
     join public.draw_snapshot_entries s on s.entry_id = w.entry_id and s.raffle_id = w.raffle_id
    where w.raffle_id = tests.id('r') and s.eligible),
  2, 'every Winner comes from an Eligible Entry');

select is((select count(distinct email_normalized)::int from public.winners where raffle_id = tests.id('r')), 2,
  'Winners are distinct Entrants');

select ok((select bool_and(source = 'draw' and won_at = now()) from public.winners where raffle_id = tests.id('r')),
  'drawn Winners have source draw and the Draw moment as Won Date');

select results_eq(
  $$ select state::text, drawn_at = now(), public.status(r) from public.raffles r where id = tests.id('r') $$,
  $$ values ('drawn', true, 'drawn') $$, 'the Raffle is Drawn');

select is((select count(*)::int from public.activity_log
            where action = 'draw' and raffle_id = tests.id('r')), 1,
  'the Draw is written to the Activity Log');

select throws_ok(format('select public.draw(%L)', tests.id('r')), '55000', 'raffle_not_open',
  'a Raffle can be Drawn only once');

select tests.as_anon();
select is((select array_length(winner_names, 1) from public.public_raffle_state()), 2,
  'the public page shows both Winner names immediately');

-- Exclusion Window off -------------------------------------------------------
select tests.as_postgres();
select tests.remember('nowin', tests.make_raffle(p_title => 'No window', p_exclusion_enabled => false,
  p_winner_count => 10, p_created_at => now() - interval '1 day'));
select tests.make_entry(tests.id('nowin'), 'Bob Recent', 'bob@thecomfortgroup.com');
select tests.make_entry(tests.id('nowin'), 'Frank Excluded', 'frank@thecomfortgroup.com');
select tests.make_entry(tests.id('nowin'), 'Dave Removed', 'dave@thecomfortgroup.com', p_removed => true);
select tests.as_admin();
select lives_ok(format('select public.draw(%L)', tests.id('nowin')), 'Draw with the window off');
select results_eq(
  $$ select s.full_name, s.eligible, s.reason::text from public.draw_snapshot_entries s
      where s.raffle_id = tests.id('nowin') order by s.full_name $$,
  $$ values ('Bob Recent', true, 'eligible'),
            ('Dave Removed', false, 'removed'),
            ('Frank Excluded', false, 'override_excluded') $$,
  'with the window off recent Winners are eligible; Overrides and removals still apply');

-- Winner Count > eligible: partial Draw, remaining slots vacant -------------------
select tests.as_postgres();
select tests.remember('partial', tests.make_raffle(p_title => 'Partial', p_winner_count => 3,
  p_created_at => now() - interval '12 hours'));
select tests.make_entry(tests.id('partial'), 'Zed Only', 'zed@example.com');
select tests.make_entry(tests.id('partial'), 'Bob Recent', 'bob@thecomfortgroup.com');
select tests.as_admin();
select is((select count(*)::int from public.draw(tests.id('partial'))), 1,
  'with fewer Eligible Entries than Winner Count, every Eligible Entry wins');
select results_eq(
  $$ select position, full_name from public.winners where raffle_id = tests.id('partial') $$,
  $$ values (1, 'Zed Only') $$, 'the partial Draw fills position 1 only');
select results_eq(
  $$ select position, vacant from public.raffle_slots(tests.id('partial')) order by position $$,
  $$ values (1, false), (2, true), (3, true) $$,
  'the unfilled positions are Vacant Slots');
select tests.as_anon();
select is((select winner_names from public.public_raffle_state()), array['Zed Only'],
  'the public page omits Vacant Slots');

-- No eligible Entries at all ------------------------------------------------------
select tests.as_postgres();
select tests.remember('empty', tests.make_raffle(p_title => 'Empty', p_created_at => now() - interval '6 hours'));
select tests.make_entry(tests.id('empty'), 'Bob Recent', 'bob@thecomfortgroup.com');
select tests.as_admin();
select throws_ok(format('select public.draw(%L)', tests.id('empty')), '55000', 'no_eligible_entries',
  'a Draw with no Eligible Entries is refused');
select is((select state::text from public.raffles where id = tests.id('empty')), 'open',
  'a refused Draw leaves the Raffle undrawn');

-- Cancelled Raffles cannot be Drawn ---------------------------------------------------
select tests.as_postgres();
update public.raffles set state = 'cancelled', cancelled_at = now(), cancel_reason = 'test'
 where id = tests.id('empty');
select tests.as_admin();
select throws_ok(format('select public.draw(%L)', tests.id('empty')), '55000', 'raffle_not_open',
  'a Cancelled Raffle cannot be Drawn');
select throws_ok(format('select public.draw(%L)', gen_random_uuid()), 'P0002', 'raffle_not_found',
  'drawing an unknown Raffle fails');

-- Exclusion Window counts from the Won Date to the Draw moment ---------------------------
select tests.as_postgres();
select tests.remember('edge', tests.make_raffle(p_title => 'Edge', p_exclusion_months => 2,
  p_created_at => now() - interval '3 hours'));
select tests.make_past_winner('Pat Three', 'pat@thecomfortgroup.com', now() - interval '3 months');
select tests.make_entry(tests.id('edge'), 'Pat Three', 'pat@thecomfortgroup.com');     -- won 3 months ago
select tests.make_entry(tests.id('edge'), 'Erin Recent', 'erin@thecomfortgroup.com'); -- override eligible
select tests.make_entry(tests.id('edge'), 'Zed Only', 'zed@example.com');             -- won the partial Draw just now
select tests.as_admin();
select lives_ok(format('select public.draw(%L)', tests.id('edge')), 'Draw with a 2-month window');
select results_eq(
  $$ select full_name, reason::text from public.draw_snapshot_entries
      where raffle_id = tests.id('edge') order by full_name $$,
  $$ values ('Erin Recent', 'override_eligible'), ('Pat Three', 'eligible'), ('Zed Only', 'exclusion_window') $$,
  'the window length is per Raffle and a Winner drawn earlier today is excluded');

select * from finish();
rollback;
