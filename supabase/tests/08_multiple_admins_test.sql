-- Several admin accounts: each one in private.admins has the full admin rights.
begin;
\ir _helpers.psql
select plan(6);

-- A second admin account.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000c0c0', 'pgtap-admin2@tests.invalid', 'authenticated', 'authenticated');
insert into private.admins (user_id) values ('00000000-0000-0000-0000-00000000c0c0');
select tests.remember('raffle', tests.make_raffle());

create function tests.as_admin2() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000c0c0', 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
grant execute on function tests.as_admin2() to authenticated;

select tests.as_admin2();
select is((select public.am_i_admin()), true, 'the second admin gets true');
select is((select count(*)::int from public.raffles), 1, 'the second admin can read admin-only tables');
select lives_ok($$ select public.cancel_raffle(tests.id('raffle'), 'second admin cancels') $$,
  'the second admin can call admin RPCs');

select tests.as_admin();
select is((select public.am_i_admin()), true, 'the first admin is still an admin');

select tests.as_other_user();
select is((select public.am_i_admin()), false, 'an account not in private.admins is not');

-- Deleting the Auth user removes its admin row.
select tests.as_postgres();
delete from auth.users where id = '00000000-0000-0000-0000-00000000c0c0';
select is((select count(*)::int from private.admins where user_id = '00000000-0000-0000-0000-00000000c0c0'), 0,
  'deleting the Auth user removes its admin access');

select * from finish();
rollback;
