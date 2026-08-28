begin;

create table public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and length(btrim(title)) <= 500),
  visibility text not null check (visibility in ('private','shared')),
  creator_user_id uuid not null references public.app_users(user_id),
  assignee_user_id uuid not null references public.app_users(user_id),
  due_date date,
  context_type text,
  context_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_tasks_context_pair check ((context_type is null) = (context_id is null)),
  constraint work_tasks_context_type check (context_type is null or context_type = 'job'),
  constraint work_tasks_private_owner check (visibility = 'shared' or creator_user_id = assignee_user_id),
  constraint work_tasks_shared_participants check (visibility = 'private' or creator_user_id <> assignee_user_id)
);

create index work_tasks_assignee_open_idx on public.work_tasks(assignee_user_id, created_at desc) where completed_at is null;
create index work_tasks_creator_shared_idx on public.work_tasks(creator_user_id, created_at desc) where visibility = 'shared';
create index work_tasks_context_idx on public.work_tasks(context_type, context_id) where context_id is not null;

create or replace function public.work_task_touch_updated_at()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin new.updated_at:=clock_timestamp();return new;end $$;
create trigger work_tasks_touch_updated_at before update on public.work_tasks
for each row execute function public.work_task_touch_updated_at();

alter table public.work_tasks enable row level security;
create policy work_tasks_participant_select on public.work_tasks
for select to authenticated using (
  exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.is_active)
  and (assignee_user_id=auth.uid() or (visibility='shared' and creator_user_id=auth.uid()))
);
revoke all on public.work_tasks from public,anon,authenticated;
grant select on public.work_tasks to authenticated;
grant all on public.work_tasks to service_role;

create or replace function public.list_my_work_tasks()
returns table(id uuid,title text,visibility text,creator_user_id uuid,creator_name text,assignee_user_id uuid,assignee_name text,due_date date,context_type text,context_id uuid,job_number text,job_name text,completed_at timestamptz,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select t.id,t.title,t.visibility,t.creator_user_id,creator.display_name,t.assignee_user_id,assignee.display_name,t.due_date,t.context_type,t.context_id,j.job_number,j.name,t.completed_at,t.created_at,t.updated_at
  from public.work_tasks t
  join public.app_users creator on creator.user_id=t.creator_user_id
  join public.app_users assignee on assignee.user_id=t.assignee_user_id
  left join public.jobs j on t.context_type='job' and j.id=t.context_id
  where exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
    and (t.assignee_user_id=auth.uid() or (t.visibility='shared' and t.creator_user_id=auth.uid()))
  order by t.created_at desc
$$;

create or replace function public.create_my_work_task(
  p_title text,
  p_assignee_user_id uuid default null,
  p_due_date date default null,
  p_context_type text default null,
  p_context_id uuid default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; assignee public.app_users%rowtype; created_id uuid:=gen_random_uuid(); task_visibility text; job_record public.jobs%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if nullif(btrim(p_title),'') is null then raise exception 'Task title is required.' using errcode='22023'; end if;
  if (p_context_type is null) <> (p_context_id is null) then raise exception 'Task context is incomplete.' using errcode='22023'; end if;
  if p_context_type is not null and p_context_type <> 'job' then raise exception 'Unsupported task context.' using errcode='22023'; end if;
  if p_context_type='job' then select * into strict job_record from public.jobs where id=p_context_id and archived_at is null; end if;
  if p_assignee_user_id is null or p_assignee_user_id=auth.uid() then
    assignee:=actor;task_visibility:='private';
  else
    select * into strict assignee from public.app_users where user_id=p_assignee_user_id and is_active;
    task_visibility:='shared';
  end if;
  insert into public.work_tasks(id,title,visibility,creator_user_id,assignee_user_id,due_date,context_type,context_id)
  values(created_id,btrim(p_title),task_visibility,actor.user_id,assignee.user_id,p_due_date,p_context_type,p_context_id);
  if task_visibility='shared' then
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(assignee.user_id,'shared-task-assigned:'||created_id,'shared_task_assigned','Shared task from '||actor.display_name,btrim(p_title),jsonb_strip_nulls(jsonb_build_object('task_id',created_id,'job_id',case when p_context_type='job' then p_context_id end,'purpose','open-my-work-task')))
    on conflict(user_id,notification_key) do nothing;
  end if;
  return created_id;
end $$;

create or replace function public.set_my_work_task_completed(p_task_id uuid,p_completed boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare task public.work_tasks%rowtype; actor public.app_users%rowtype; was_complete boolean;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict task from public.work_tasks where id=p_task_id and (assignee_user_id=auth.uid() or (visibility='shared' and creator_user_id=auth.uid())) for update;
  was_complete:=task.completed_at is not null;
  update public.work_tasks set completed_at=case when p_completed then coalesce(completed_at,clock_timestamp()) else null end where id=task.id;
  if task.visibility='shared' and p_completed and not was_complete and task.creator_user_id<>auth.uid() then
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(task.creator_user_id,'shared-task-completed:'||task.id,'shared_task_completed',actor.display_name||' completed a shared task',task.title,jsonb_strip_nulls(jsonb_build_object('task_id',task.id,'job_id',case when task.context_type='job' then task.context_id end,'purpose','open-my-work-task')))
    on conflict(user_id,notification_key) do nothing;
  end if;
end $$;

alter function public.create_my_work_task(text,uuid,date,text,uuid) owner to postgres;
alter function public.set_my_work_task_completed(uuid,boolean) owner to postgres;
alter function public.list_my_work_tasks() owner to postgres;
revoke all on function public.create_my_work_task(text,uuid,date,text,uuid) from public,anon;
revoke all on function public.set_my_work_task_completed(uuid,boolean) from public,anon;
revoke all on function public.list_my_work_tasks() from public,anon;
grant execute on function public.create_my_work_task(text,uuid,date,text,uuid) to authenticated,service_role;
grant execute on function public.set_my_work_task_completed(uuid,boolean) to authenticated,service_role;
grant execute on function public.list_my_work_tasks() to authenticated,service_role;

comment on table public.work_tasks is 'Participant-scoped private and shared My Work tasks. Private task content is visible only to its owner.';
commit;
