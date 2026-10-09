-- #17: let the login flow ask "is the signed-in account the configured admin?" right
-- after sign-in, instead of finding out on the first admin call.
create function public.am_i_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_admin() $$;

revoke execute on function public.am_i_admin() from public, anon, authenticated;
grant execute on function public.am_i_admin() to authenticated;
