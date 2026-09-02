-- Personal My Work Task Groups. Existing task rows, colors, participants, and Job links remain unchanged.
begin;

create table public.my_work_task_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(user_id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  color_key text not null check (color_key in ('neutral','blue','teal','green','yellow','orange','rose','violet')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(owner_user_id,name)
);
create index my_work_task_groups_owner_idx on public.my_work_task_groups(owner_user_id,lower(name),id);

create table public.my_work_task_group_memberships (
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  group_id uuid not null references public.my_work_task_groups(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(task_id,user_id)
);
create index my_work_task_group_memberships_group_idx on public.my_work_task_group_memberships(group_id,task_id);

alter table public.my_work_task_groups enable row level security;
alter table public.my_work_task_group_memberships enable row level security;
revoke all on public.my_work_task_groups,public.my_work_task_group_memberships from public,anon,authenticated;
grant all on public.my_work_task_groups,public.my_work_task_group_memberships to service_role;

create function public.my_work_task_participant(p_task_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.work_tasks task join public.app_users actor on actor.user_id=p_user_id and actor.is_active where task.id=p_task_id and p_user_id in(task.creator_user_id,task.assignee_user_id));
$$;

create function public.list_my_work_task_groups()
returns table(id uuid,name text,color_key text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select group_row.id,group_row.name,group_row.color_key,group_row.created_at,group_row.updated_at
  from public.my_work_task_groups group_row
  where group_row.owner_user_id=auth.uid() and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  order by lower(group_row.name),group_row.id;
$$;

create function public.list_my_work_task_group_memberships()
returns table(task_id uuid,group_id uuid)
language sql stable security definer set search_path=pg_catalog,public as $$
  select membership.task_id,membership.group_id
  from public.my_work_task_group_memberships membership
  join public.my_work_task_groups group_row on group_row.id=membership.group_id
  where membership.user_id=auth.uid() and group_row.owner_user_id=auth.uid()
    and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
    and public.my_work_task_participant(membership.task_id,auth.uid());
$$;

create function public.create_my_work_task_group(p_name text,p_color_key text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare created_id uuid; normalized_name text:=btrim(coalesce(p_name,''));
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active user access is required.' using errcode='42501';end if;
  if char_length(normalized_name) not between 1 and 100 then raise exception 'Task Group name is required and must be 100 characters or fewer.' using errcode='22023';end if;
  if p_color_key not in ('neutral','blue','teal','green','yellow','orange','rose','violet') then raise exception 'Unsupported Task Group color.' using errcode='22023';end if;
  insert into public.my_work_task_groups(owner_user_id,name,color_key)values(auth.uid(),normalized_name,p_color_key)returning id into created_id;
  return created_id;
end$$;

create function public.update_my_work_task_group(p_group_id uuid,p_name text,p_color_key text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare normalized_name text:=btrim(coalesce(p_name,''));
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active user access is required.' using errcode='42501';end if;
  if char_length(normalized_name) not between 1 and 100 then raise exception 'Task Group name is required and must be 100 characters or fewer.' using errcode='22023';end if;
  if p_color_key not in ('neutral','blue','teal','green','yellow','orange','rose','violet') then raise exception 'Unsupported Task Group color.' using errcode='22023';end if;
  update public.my_work_task_groups set name=normalized_name,color_key=p_color_key,updated_at=clock_timestamp() where id=p_group_id and owner_user_id=auth.uid();
  if not found then raise exception 'Task Group was not found.' using errcode='P0002';end if;
end$$;

create function public.set_my_work_task_group(p_task_id uuid,p_group_id uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active user access is required.' using errcode='42501';end if;
  if not public.my_work_task_participant(p_task_id,auth.uid()) then raise exception 'Task participant access is required.' using errcode='42501';end if;
  if p_group_id is null then delete from public.my_work_task_group_memberships where task_id=p_task_id and user_id=auth.uid();return;end if;
  if not exists(select 1 from public.my_work_task_groups where id=p_group_id and owner_user_id=auth.uid()) then raise exception 'Task Group was not found.' using errcode='P0002';end if;
  insert into public.my_work_task_group_memberships(task_id,user_id,group_id)values(p_task_id,auth.uid(),p_group_id)
  on conflict(task_id,user_id)do update set group_id=excluded.group_id,updated_at=clock_timestamp();
end$$;

create function public.delete_my_work_task_group(p_group_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare removed integer;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active user access is required.' using errcode='42501';end if;
  if not exists(select 1 from public.my_work_task_groups where id=p_group_id and owner_user_id=auth.uid()) then raise exception 'Task Group was not found.' using errcode='P0002';end if;
  select count(*) into removed from public.my_work_task_group_memberships where group_id=p_group_id and user_id=auth.uid();
  delete from public.my_work_task_groups where id=p_group_id and owner_user_id=auth.uid();
  return removed;
end$$;

alter function public.my_work_task_participant(uuid,uuid) owner to postgres;
alter function public.list_my_work_task_groups() owner to postgres;
alter function public.list_my_work_task_group_memberships() owner to postgres;
alter function public.create_my_work_task_group(text,text) owner to postgres;
alter function public.update_my_work_task_group(uuid,text,text) owner to postgres;
alter function public.set_my_work_task_group(uuid,uuid) owner to postgres;
alter function public.delete_my_work_task_group(uuid) owner to postgres;
revoke all on function public.my_work_task_participant(uuid,uuid),public.list_my_work_task_groups(),public.list_my_work_task_group_memberships(),public.create_my_work_task_group(text,text),public.update_my_work_task_group(uuid,text,text),public.set_my_work_task_group(uuid,uuid),public.delete_my_work_task_group(uuid) from public,anon;
revoke all on function public.my_work_task_participant(uuid,uuid) from authenticated;
grant execute on function public.list_my_work_task_groups(),public.list_my_work_task_group_memberships(),public.create_my_work_task_group(text,text),public.update_my_work_task_group(uuid,text,text),public.set_my_work_task_group(uuid,uuid),public.delete_my_work_task_group(uuid) to authenticated,service_role;
grant execute on function public.my_work_task_participant(uuid,uuid) to service_role;

comment on table public.my_work_task_groups is 'Private personal organization metadata for My Work; never a task-content authorization boundary.';
comment on table public.my_work_task_group_memberships is 'Viewer-specific one-group membership for a task; shared-task participants organize independently.';
commit;
