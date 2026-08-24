-- Local-only identity surface for exercising TenOps account setup and recovery.
-- This isolated work directory never loads the production migration history.

create table public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  role text not null check (role in ('guest', 'member', 'lead', 'developer', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

create policy app_users_read_self
on public.app_users
for select
to authenticated
using (user_id = auth.uid());

grant select on public.app_users to authenticated;
grant all on public.app_users to service_role;

create or replace function public.get_my_app_user()
returns table(user_id uuid, display_name text, role text, is_active boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select u.user_id, u.display_name, u.role, u.is_active
  from public.app_users u
  where u.user_id = auth.uid();
$$;

revoke all on function public.get_my_app_user() from public;
grant execute on function public.get_my_app_user() to authenticated;

create or replace function public.ensure_my_welcome_notification()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
end;
$$;

revoke all on function public.ensure_my_welcome_notification() from public;
grant execute on function public.ensure_my_welcome_notification() to authenticated;
