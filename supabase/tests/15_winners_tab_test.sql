-- Winners tab reads (#15): admin_winners() status uses the same Exclusion
-- Window rule as the Draw; admin_overrides() lists active Overrides.
begin;
\ir _helpers.psql
select plan(19);

-- Fixtures: a Drawn Raffle with a Replaced Winner and its alternate, plus Past Winners.
select tests.remember('old', tests.make_raffle(p_title => 'Titans Home Opener', p_state => 'drawn',
  p_created_at => now() - interval '100 days', p_close_time => now() - interval '90 days'));
select tests.remember('e_amy', tests.make_entry(tests.id('old'), 'Amy Ng', 'amy@example.com'));
select tests.remember('e_bo', tests.make_entry(tests.id('old'), 'Bo Diaz', 'Bo@Example.com'));
insert into public.winners (source, raffle_id, position, entry_id, full_name, email, won_at,
                            status, replaced_at, replaced_reason)
values ('draw', tests.id('old'), 1, tests.id('e_amy'), 'Amy Ng', 'amy@example.com',
        now() - interval '90 days', 'replaced', now() - interval '89 days', 'could not attend');
select tests.remember('amy_win', (select id from public.winners where entry_id = tests.id('e_amy')));
insert into public.winners (source, raffle_id, position, entry_id, replaces_winner_id, full_name, email, won_at)
values ('redraw', tests.id('old'), 1, tests.id('e_bo'), tests.id('amy_win'), 'Bo Diaz', 'Bo@Example.com',
        now() - interval '89 days');
select tests.remember('bo_win', (select id from public.winners where entry_id = tests.id('e_bo')));
select tests.remember('cy_win', tests.make_past_winner('Cy Park', 'cy@example.com', now() - interval '13 months'));
select tests.remember('di_win', tests.make_past_winner('Di Lowe', 'di@example.com', now() - interval '5 months'));

-- Access ---------------------------------------------------------------------------
select tests.as_anon();
select throws_ok('select * from public.admin_winners()', '42501', null, 'anon cannot list Winners');
select tests.as_other_user();
select throws_ok('select * from public.admin_winners()', '42501', 'not_admin', 'a non-admin cannot list Winners');
select throws_ok('select * from public.admin_overrides()', '42501', 'not_admin', 'a non-admin cannot list Overrides');

-- No current Raffle: default window (on, 12 months) -----------------------------------
select tests.as_admin();
select results_eq(
  $$ select full_name, status::text, excluded from public.admin_winners() $$,
  $$ values ('Bo Diaz', 'standing', true), ('Amy Ng', 'replaced', false),
            ('Di Lowe', 'standing', true), ('Cy Park', 'standing', false) $$,
  'newest first; Standing inside 12 months excluded, Replaced and older ones not');
select results_eq(
  $$ select window_enabled, window_months from public.admin_winners() limit 1 $$,
  $$ values (true, 12) $$, 'with no current Raffle the window is the 12-month default');
select is((select raffle_title from public.admin_winners() where id = tests.id('bo_win')), 'Titans Home Opener',
  'drawn Winners carry their Raffle title');
select is((select raffle_title from public.admin_winners() where id = tests.id('di_win')), null,
  'Past Winners have no Raffle');
select is((select excluded_until from public.admin_winners() where id = tests.id('di_win')),
  (select won_at + interval '12 months' from public.winners where id = tests.id('di_win')),
  'excluded_until is the Won Date plus the window');
select is((select excluded_until from public.admin_winners() where id = tests.id('amy_win')), null,
  'Replaced Winners have no exclusion end');

-- A current Raffle's window is the reference, and matches the Draw's verdicts ------------
select tests.as_postgres();
select tests.remember('cur', tests.make_raffle(p_title => 'Current', p_close_time => now() + interval '1 day',
  p_exclusion_months => 4, p_created_at => now() - interval '1 day'));
select tests.make_entry(tests.id('cur'), 'Bo Diaz', 'bo@example.com');
select tests.make_entry(tests.id('cur'), 'Di Lowe', 'di@example.com');
select tests.make_entry(tests.id('cur'), 'Cy Park', 'cy@example.com');
select tests.as_admin();
select results_eq(
  $$ select full_name, excluded, window_months from public.admin_winners() where status = 'standing' $$,
  $$ values ('Bo Diaz', true, 4), ('Di Lowe', false, 4), ('Cy Park', false, 4) $$,
  'the current Raffle''s window (4 months) is used');
select tests.as_postgres();
create temp table excl (email text);
grant select, insert on excl to authenticated;
select tests.as_admin();
insert into excl select distinct email_normalized from public.admin_winners() where excluded;
select tests.as_postgres();
select results_eq(
  $$ select e.email_normalized from private.entry_verdicts(tests.id('cur'), now()) v
       join public.entries e on e.id = v.entry_id
      where v.reason = 'exclusion_window' order by 1 $$,
  $$ select email from excl order by 1 $$,
  'the Winners excluded here are exactly the ones the Draw would exclude');

-- Window off on the current Raffle: nobody excluded.
update public.raffles set exclusion_enabled = false where id = tests.id('cur');
select tests.as_admin();
select is((select count(*)::int from public.admin_winners() where excluded), 0,
  'with the current Raffle''s window off nobody is excluded');
select is((select count(*)::int from public.admin_winners() where excluded_until is not null), 0,
  'and there is no exclusion end');

-- Overrides ---------------------------------------------------------------------------
select public.set_override('Bo@example.com', 'force_eligible', 'manager approved');
select public.set_override('eve@example.com', 'force_excluded', 'prize vendor staff', now() + interval '30 days');
select tests.as_postgres();
insert into public.eligibility_overrides (email, kind, reason, expires_at)
values ('cy@example.com', 'force_excluded', 'expired one', now() - interval '1 day');
select tests.as_admin();
select results_eq(
  $$ select override_kind::text, override_reason from public.admin_winners() where id = tests.id('bo_win') $$,
  $$ values ('force_eligible', 'manager approved') $$,
  'a Winner row shows its Entrant''s active Override (matched on normalized email)');
select is((select override_id from public.admin_winners() where id = tests.id('cy_win')), null,
  'an expired Override is not shown');
select results_eq(
  $$ select email_normalized, full_name, kind::text from public.admin_overrides() order by email_normalized $$,
  $$ values ('bo@example.com', 'Bo Diaz', 'force_eligible'), ('eve@example.com', null, 'force_excluded') $$,
  'admin_overrides lists active Overrides with the Entrant''s name (null for a non-Entrant)');
select is((select full_name from public.admin_overrides() where email_normalized = 'bo@example.com'), 'Bo Diaz',
  'the name is the latest Entry''s name');
select lives_ok(format($$ select public.clear_override(%L, 'no longer needed') $$,
  (select id from public.admin_overrides() where email_normalized = 'eve@example.com')), 'clear an Override');
select is((select count(*)::int from public.admin_overrides()), 1, 'a cleared Override drops off the list');

select * from finish();
rollback;
