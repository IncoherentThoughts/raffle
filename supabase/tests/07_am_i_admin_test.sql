-- am_i_admin(): tells the signed-in account whether it is the configured admin.
begin;
\ir _helpers.psql
select plan(4);

select tests.as_admin();
select is((select public.am_i_admin()), true, 'the configured admin gets true');

select tests.as_other_user();
select is((select public.am_i_admin()), false, 'another signed-in account gets false');

select tests.as_anon();
select throws_ok($$ select public.am_i_admin() $$, '42501', null, 'anon cannot call it');

select tests.as_postgres();
select is((select has_function_privilege('authenticated', 'public.am_i_admin()', 'execute')), true,
  'authenticated may execute it');

select * from finish();
rollback;
