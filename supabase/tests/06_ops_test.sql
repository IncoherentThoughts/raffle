-- Operations: keepalive RPC and the per-IP write limiter run by PostgREST
-- before every request (db_pre_request).
begin;
\ir _helpers.psql
select plan(10);

create function tests.request(p_method text, p_ip text) returns void language plpgsql as $$
begin
  perform set_config('request.method', p_method, true);
  perform set_config('request.headers',
    case when p_ip is null then '{}' else json_build_object('x-forwarded-for', p_ip || ', 10.0.0.1')::text end, true);
  perform private.check_request();
end $$;
grant execute on function tests.request(text, text) to anon, authenticated;

-- Keepalive ----------------------------------------------------------------------
insert into private.request_log (ip, at) values ('9.9.9.9', now() - interval '6 minutes');
select tests.as_anon();
select isnt((select public.keepalive()), null, 'anon can call keepalive');
select tests.as_postgres();
select is((select count(*)::int from private.request_log where at < now() - interval '5 minutes'), 0,
  'keepalive prunes the request log');

-- Limiter wiring -----------------------------------------------------------------
select ok(
  exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
           where r.rolname = 'authenticator'
             and 'pgrst.db_pre_request=private.check_request' = any (s.setconfig)),
  'PostgREST is configured to run private.check_request before each request');

-- Reads are never limited or logged ------------------------------------------------
select tests.as_anon();
select lives_ok($$ select tests.request('GET', '1.2.3.4') $$, 'a GET passes');
select tests.as_postgres();
select is((select count(*)::int from private.request_log), 0, 'reads are not logged');

-- Writes are logged per client IP (first x-forwarded-for hop) ---------------------------
insert into private.request_log (ip, at) select '1.2.3.4', now() - interval '10 minutes' from generate_series(1, 50);
select tests.as_anon();
select lives_ok($$ select tests.request('POST', '1.2.3.4') $$, 'a POST passes');
select tests.as_postgres();
select results_eq($$ select host(ip), count(*)::int from private.request_log group by 1 $$,
  $$ values ('1.2.3.4', 1) $$, 'writes are logged against the client IP and that IP''s stale rows are pruned');

-- 500 writes per 5 minutes per IP ------------------------------------------------------
insert into private.request_log (ip, at) select '1.2.3.4', now() - interval '1 minute' from generate_series(1, 499);
select tests.as_anon();
select throws_ok($$ select tests.request('POST', '1.2.3.4') $$, 'PT429', 'rate_limited',
  'the 501st write within 5 minutes from one IP is refused with HTTP 429');
select lives_ok($$ select tests.request('PATCH', '5.6.7.8') $$, 'other IPs are unaffected');
select tests.as_admin();
select throws_ok($$ select tests.request('POST', '1.2.3.4') $$, 'PT429', 'rate_limited',
  'the authenticated admin shares the same per-IP budget');

select * from finish();
rollback;
