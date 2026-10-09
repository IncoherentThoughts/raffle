-- Several admin accounts instead of one shared Auth user. Every admin has the same rights:
-- private.is_admin() (behind every admin RPC and read policy) now checks membership here.
-- Add one in the SQL editor after creating the Auth user (see README):
--   insert into private.admins (user_id) select id from auth.users where email = '<email>'
--   on conflict do nothing;
create table private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on private.admins from public, anon, authenticated;

-- Carry over the admin configured so far.
insert into private.admins (user_id)
select admin_user_id from private.app_config where id and admin_user_id is not null
on conflict do nothing;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()))
$$;

drop table private.app_config;
