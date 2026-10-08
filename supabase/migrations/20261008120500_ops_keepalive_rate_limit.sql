-- Operations (#9): keepalive RPC for the daily GitHub Action, and a per-IP
-- write limiter that PostgREST runs before every request (db_pre_request).

-- ---------------------------------------------------------------------------
-- Per-IP write limiter: 500 writes per 5 minutes per client IP.
-- Only write methods are counted (GET/HEAD run in read-only transactions).
-- The log lives in the same transaction as the request, so a request that
-- later fails (e.g. 409 "already entered") does not count.
-- ---------------------------------------------------------------------------
create table private.request_log (
  id bigint generated always as identity primary key,
  ip inet not null,
  at timestamptz not null default now()
);
create index request_log_ip_at on private.request_log (ip, at);
revoke all on private.request_log from public, anon, authenticated;

create function private.check_request() returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_method text := current_setting('request.method', true);
  v_ip inet;
  v_recent int;
begin
  -- PostgREST also runs POSTs to STABLE RPCs (e.g. public_raffle_state) in a
  -- read-only transaction; those are reads and cannot be logged anyway.
  if v_method is null or v_method not in ('POST', 'PATCH', 'PUT', 'DELETE')
     or current_setting('transaction_read_only') = 'on' then
    return;
  end if;

  begin
    v_ip := btrim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1))::inet;
  exception when others then
    v_ip := null;
  end;
  v_ip := coalesce(v_ip, '0.0.0.0'::inet);  -- unknown clients share one bucket

  delete from private.request_log where ip = v_ip and at < now() - interval '5 minutes';

  select count(*) into v_recent from private.request_log
   where ip = v_ip and at >= now() - interval '5 minutes';
  if v_recent >= 500 then
    raise exception 'rate_limited' using errcode = 'PT429',
      hint = 'Too many requests from this network. Try again in a few minutes.';
  end if;

  insert into private.request_log (ip) values (v_ip);
end $$;

revoke execute on function private.check_request() from public;
grant execute on function private.check_request() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request = 'private.check_request';
notify pgrst, 'reload config';

-- ---------------------------------------------------------------------------
-- Keepalive: called daily by anon from the GitHub Action. Also prunes the
-- whole request log of stale rows.
-- ---------------------------------------------------------------------------
create function public.keepalive() returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
begin
  delete from private.request_log where at < now() - interval '5 minutes';
  return now();
end $$;

revoke execute on function public.keepalive() from public, anon, authenticated;
grant execute on function public.keepalive() to anon, authenticated;
