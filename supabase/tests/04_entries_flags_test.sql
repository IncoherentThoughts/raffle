-- Admin Entries view: Duplicate Flags (#7), dismissal, live vs Snapshot status,
-- new vs returning, and the Snapshot freezing flags.
begin;
\ir _helpers.psql
select plan(19);

-- An earlier Raffle so one Entrant is "returning".
select tests.remember('prev', tests.make_raffle(p_title => 'Previous', p_state => 'cancelled',
  p_created_at => now() - interval '60 days', p_close_time => now() - interval '50 days'));
select tests.make_entry(tests.id('prev'), 'Nora Back', 'nora@example.com');

select tests.remember('r', tests.make_raffle(p_title => 'Flags raffle', p_close_time => now() + interval '1 day'));
select tests.remember('jose1', tests.make_entry(tests.id('r'), 'José O''Brien', 'jose@thecomfortgroup.com', 'd1'));
select tests.remember('jose2', tests.make_entry(tests.id('r'), '  jose   obrien ', 'jose.personal@gmail.com', 'd2'));
select tests.remember('kim', tests.make_entry(tests.id('r'), 'Kim Lee', 'Kim.Lee+raffle@automatedcontrolsinc.com'));
select tests.remember('kimberly', tests.make_entry(tests.id('r'), 'Kimberly Lee', 'kimlee@thecomfortgroup.com', 'd3'));
select tests.remember('sam', tests.make_entry(tests.id('r'), 'Sam Same Device', 'sam@example.com', 'd3'));
select tests.remember('nora', tests.make_entry(tests.id('r'), 'Nora Back', 'nora@example.com'));
select tests.remember('noel', tests.make_entry(tests.id('r'), 'Noel', 'noel@example.com'));
select tests.remember('rae', tests.make_entry(tests.id('r'), 'Rae Removed', 'rae@example.com', 'd4', p_removed => true));
select tests.remember('ray', tests.make_entry(tests.id('r'), 'Ray', 'ray@example.com', 'd4'));

-- Access control -------------------------------------------------------------------
select tests.as_anon();
select throws_ok(format('select * from public.admin_entry_flags(%L)', tests.id('r')), '42501', null,
  'anon cannot read flags');
select throws_ok(format('select * from public.admin_entries(%L)', tests.id('r')), '42501', null,
  'anon cannot read the admin Entries view');
select tests.as_other_user();
select throws_ok(format('select * from public.admin_entries(%L)', tests.id('r')), '42501', 'not_admin',
  'a non-admin user cannot read the admin Entries view');

-- The three rules ------------------------------------------------------------------
select tests.as_admin();
select set_eq(
  $$ select e.full_name, f.rule::text, f.other_full_name, f.other_removed, f.dismissed
       from public.admin_entry_flags(tests.id('r')) f join public.entries e on e.id = f.entry_id $$,
  $$ values ('jose obrien'::text, 'same_name', 'José O''Brien', false, false),
            ('José O''Brien', 'same_name', 'jose obrien', false, false),
            ('Kim Lee', 'email_match', 'Kimberly Lee', false, false),
            ('Kimberly Lee', 'email_match', 'Kim Lee', false, false),
            ('Kimberly Lee', 'same_device', 'Sam Same Device', false, false),
            ('Ray', 'same_device', 'Rae Removed', true, false),
            ('Rae Removed', 'same_device', 'Ray', false, false),
            ('Sam Same Device', 'same_device', 'Kimberly Lee', false, false) $$,
  'same name (accents, punctuation, spacing), email match (+tag, dots, company domains) and same device are flagged; removed Entries count');

-- Dismissal ------------------------------------------------------------------------
select throws_ok(
  format($$select public.dismiss_flag(%L, 'email_match', %L, %L, '')$$, tests.id('r'), tests.id('kim'), tests.id('kimberly')),
  '22023', 'reason_required', 'dismissing a flag needs a reason');
select throws_ok(
  format($$select public.dismiss_flag(%L, 'same_name', %L, %L, 'not a pair')$$, tests.id('r'), tests.id('kim'), tests.id('noel')),
  '22023', 'not_flagged', 'only an actually flagged pair can be dismissed');
select lives_ok(
  format($$select public.dismiss_flag(%L, 'email_match', %L, %L, 'Kim uses both mailboxes')$$,
         tests.id('r'), tests.id('kimberly'), tests.id('kim')),
  'the admin dismisses a pair (either order) with a reason');
select is(
  (select array_agg(dismissed) from public.admin_entry_flags(tests.id('r')) where rule = 'email_match'),
  array[true, true], 'a dismissed pair reads as dismissed on both sides');
select is(
  (select reason from public.activity_log where action = 'flag_dismiss' and raffle_id = tests.id('r')),
  'Kim uses both mailboxes', 'the dismissal is written to the Activity Log');

-- admin_entries: live preview before the Draw -----------------------------------------
select results_eq(
  $$ select status_source, count(*)::int from public.admin_entries(tests.id('r')) group by 1 $$,
  $$ values ('live', 9) $$, 'before the Draw every row carries a live status');
select set_eq(
  $$ select full_name, flags::text[] from public.admin_entries(tests.id('r')) $$,
  $$ values ('José O''Brien', array['same_name']), ('jose obrien', array['same_name']),
            ('Kim Lee', '{}'::text[]), ('Kimberly Lee', array['same_device']),
            ('Sam Same Device', array['same_device']), ('Nora Back', '{}'),
            ('Noel', '{}'), ('Rae Removed', array['same_device']), ('Ray', array['same_device']) $$,
  'flags lists each Entry''s undismissed rule names');
select results_eq(
  $$ select full_name, eligible, reason::text from public.admin_entries(tests.id('r'))
      where full_name in ('Rae Removed', 'Noel') order by full_name $$,
  $$ values ('Noel', true, 'eligible'), ('Rae Removed', false, 'removed') $$,
  'live status uses the eligibility rules');
select results_eq(
  $$ select full_name from public.admin_entries(tests.id('r')) where is_returning $$,
  $$ values ('Nora Back') $$, 'an Entrant with an Entry in an earlier Raffle (Cancelled included) is returning');

-- The Draw freezes flags -------------------------------------------------------------
select tests.as_postgres();
update public.raffles set close_time = now() - interval '1 second' where id = tests.id('r');
select tests.as_admin();
select lives_ok(format('select public.draw(%L)', tests.id('r')), 'Draw the flagged Raffle (flags never block)');
select set_eq(
  $$ select full_name, flags::text[] from public.draw_snapshot_entries
      where raffle_id = tests.id('r') and flags <> '{}' $$,
  $$ values ('José O''Brien', array['same_name']), ('jose obrien', array['same_name']),
            ('Kimberly Lee', array['same_device']), ('Sam Same Device', array['same_device']),
            ('Rae Removed', array['same_device']), ('Ray', array['same_device']) $$,
  'the Snapshot freezes each Entry''s undismissed flags');
select is((select flagged_count from public.draw_snapshots where raffle_id = tests.id('r')), 6,
  'the Snapshot header counts flagged Entries');

select lives_ok(
  format($$select public.dismiss_flag(%L, 'same_name', %L, %L, 'same person, two emails')$$,
         tests.id('r'), tests.id('jose1'), tests.id('jose2')),
  'a flag can still be dismissed after the Draw');
select is(
  (select flags::text[] from public.draw_snapshot_entries where entry_id = tests.id('jose1')),
  array['same_name'], 'a later dismissal does not change the frozen Snapshot');
select results_eq(
  $$ select status_source, flags::text[] from public.admin_entries(tests.id('r')) where id = tests.id('jose1') $$,
  $$ values ('snapshot', '{}'::text[]) $$,
  'after the Draw status comes from the Snapshot while flags stay live');

select * from finish();
rollback;
