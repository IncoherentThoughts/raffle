-- Public page seam: public_raffle_state() and the anon INSERT-only path on entries.
begin;
\ir _helpers.psql
select plan(22);

-- No Raffle at all ---------------------------------------------------------
select tests.as_anon();
select is((select status from public.public_raffle_state()), 'none',
  'with no Raffle the public state is none');
select tests.as_postgres();

-- Open Raffle --------------------------------------------------------------
select tests.remember('open', tests.make_raffle(p_title => 'Titans vs Colts', p_close_time => now() + interval '2 days'));

select tests.as_anon();
select results_eq(
  $$ select raffle_id, title, prize, details, status, winner_names from public.public_raffle_state() $$,
  $$ values (tests.id('open'), 'Titans vs Colts', 'Two tickets', 'Section 101', 'open', '{}'::text[]) $$,
  'an Open Raffle exposes title, prize, details and the open status');

select lives_ok(
  format($$ insert into public.entries (raffle_id, full_name, email, device_id)
            values (%L, '  Ada Lovelace ', '  Ada@TheComfortGroup.com ', 'dev-1') $$, tests.id('open')),
  'anon can enter an Open Raffle');

select throws_ok(
  format($$ insert into public.entries (raffle_id, full_name, email)
            values (%L, 'Ada L', 'ada@thecomfortgroup.com') $$, tests.id('open')),
  '23505', null,
  'a second Entry with the same trimmed lowercase email is refused as already entered');

select lives_ok(
  format($$ insert into public.entries (raffle_id, full_name, email)
            values (%L, 'Ada Lovelace', 'a.da@thecomfortgroup.com') $$, tests.id('open')),
  'a loosely-similar email is a different Entrant (only a flag, never a block)');

select throws_ok(
  format($$ insert into public.entries (raffle_id, full_name, email, added_by_admin)
            values (%L, 'Sneaky', 'sneaky@example.com', true) $$, tests.id('open')),
  '42501', null, 'anon cannot mark an Entry as added by admin');

select throws_ok(
  format($$ insert into public.entries (raffle_id, full_name, email, removed_at)
            values (%L, 'Sneaky', 'sneaky@example.com', now()) $$, tests.id('open')),
  '42501', null, 'anon cannot set removal columns');

select throws_ok(
  format($$ insert into public.entries (raffle_id, full_name, email)
            values (%L, '   ', 'blank@example.com') $$, tests.id('open')),
  '23514', null, 'a blank name is rejected');

select throws_ok(
  format($$ insert into public.entries (raffle_id, full_name, email)
            values (%L, 'No At', 'not-an-email') $$, tests.id('open')),
  '23514', null, 'an email without @ and domain is rejected');

select throws_ok($$ select * from public.entries $$, '42501', null,
  'anon cannot read entries');
select throws_ok($$ select * from public.raffles $$, '42501', null,
  'anon cannot read raffles');
select throws_ok($$ select * from public.winners $$, '42501', null,
  'anon cannot read winners');
select throws_ok($$ select * from public.activity_log $$, '42501', null,
  'anon cannot read the Activity Log');
select throws_ok($$ update public.entries set full_name = 'x' $$, '42501', null,
  'anon cannot update entries');
select throws_ok($$ delete from public.entries $$, '42501', null,
  'anon cannot delete entries');

select tests.as_postgres();
select is((select email from public.entries where full_name = 'Ada Lovelace' and device_id = 'dev-1'),
  'Ada@TheComfortGroup.com', 'email is stored trimmed as typed');
select is((select email_normalized from public.entries where device_id = 'dev-1'),
  'ada@thecomfortgroup.com', 'Entrant identity is trimmed lowercase email');
select is((select full_name from public.entries where device_id = 'dev-1'),
  'Ada Lovelace', 'name is stored trimmed');

-- Closed Raffle (Close Time passed, not Drawn) -------------------------------
update public.raffles set close_time = now() - interval '1 second' where id = tests.id('open');
select tests.as_anon();
select is((select status from public.public_raffle_state()), 'closed',
  'a Raffle past its Close Time reads as closed');
select throws_ok(
  format($$ insert into public.entries (raffle_id, full_name, email)
            values (%L, 'Late Larry', 'larry@example.com') $$, tests.id('open')),
  '42501', null, 'anon cannot enter a Closed Raffle');

-- Drawn Raffle: winner names, Vacant Slots omitted ---------------------------
select tests.as_postgres();
update public.raffles set state = 'drawn', drawn_at = now() where id = tests.id('open');
insert into public.winners (raffle_id, position, source, entry_id, full_name, email, won_at)
select tests.id('open'), 2, 'draw', id, full_name, email, now() from public.entries where device_id = 'dev-1';
select tests.as_anon();
select results_eq(
  $$ select status, winner_names from public.public_raffle_state() $$,
  $$ values ('drawn', array['Ada Lovelace']) $$,
  'a Drawn Raffle names its Standing Winners and omits Vacant Slots');

-- Cancelled latest Raffle -> nothing open --------------------------------------
select tests.as_postgres();
select tests.make_raffle(p_title => 'Cancelled one', p_state => 'cancelled', p_created_at => now());
select tests.as_anon();
select results_eq(
  $$ select status, raffle_id from public.public_raffle_state() $$,
  $$ values ('none', null::uuid) $$,
  'when the latest Raffle is Cancelled the public page shows nothing open');

select * from finish();
rollback;
