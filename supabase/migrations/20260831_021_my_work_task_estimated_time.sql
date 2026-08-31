begin;

alter table public.work_tasks
  add column estimated_minutes integer,
  add constraint work_tasks_estimated_minutes_check
    check (estimated_minutes is null or estimated_minutes between 1 and 10080);

comment on column public.work_tasks.estimated_minutes is
  'Optional expected effort in whole minutes; not scheduled or actual labor.';

drop function public.list_my_work_tasks();
create function public.list_my_work_tasks()
returns table(id uuid,title text,notes text,visibility text,creator_user_id uuid,creator_name text,assignee_user_id uuid,assignee_name text,due_date date,estimated_minutes integer,context_type text,context_id uuid,job_number text,job_name text,job_customer text,color_key text,completed_at timestamptz,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select t.id,t.title,t.notes,t.visibility,t.creator_user_id,creator.display_name,t.assignee_user_id,assignee.display_name,t.due_date,t.estimated_minutes,t.context_type,t.context_id,j.job_number,j.name,j.customer,coalesce(preference.color_key,'neutral'),t.completed_at,t.created_at,t.updated_at
  from public.work_tasks t
  join public.app_users creator on creator.user_id=t.creator_user_id
  join public.app_users assignee on assignee.user_id=t.assignee_user_id
  left join public.jobs j on t.context_type='job' and j.id=t.context_id
  left join public.work_task_preferences preference on preference.task_id=t.id and preference.user_id=auth.uid()
  where exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
    and (t.assignee_user_id=auth.uid() or (t.visibility='shared' and t.creator_user_id=auth.uid()))
  order by t.created_at desc
$$;

drop function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text);
create function public.create_my_work_task_complete(
  p_title text,
  p_assignee_user_id uuid default null,
  p_due_date date default null,
  p_context_type text default null,
  p_context_id uuid default null,
  p_notes text default '',
  p_color_key text default 'neutral',
  p_estimated_minutes integer default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; assignee public.app_users%rowtype; created_id uuid:=gen_random_uuid(); task_visibility text; job_record public.jobs%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if nullif(btrim(p_title),'') is null then raise exception 'Task title is required.' using errcode='22023'; end if;
  if length(coalesce(p_notes,''))>10000 then raise exception 'Task notes are too long.' using errcode='22023'; end if;
  if p_color_key not in ('neutral','blue','teal','green','yellow','orange','rose','violet') then raise exception 'Unsupported task color.' using errcode='22023'; end if;
  if p_estimated_minutes is not null and p_estimated_minutes not between 1 and 10080 then raise exception 'Estimated time must be between 1 and 10080 minutes.' using errcode='22023'; end if;
  if (p_context_type is null) <> (p_context_id is null) then raise exception 'Task context is incomplete.' using errcode='22023'; end if;
  if p_context_type is not null and p_context_type<>'job' then raise exception 'Unsupported task context.' using errcode='22023'; end if;
  if p_context_type='job' then select * into strict job_record from public.jobs where id=p_context_id and archived_at is null; end if;
  if p_assignee_user_id is null or p_assignee_user_id=auth.uid() then assignee:=actor;task_visibility:='private';
  else select * into strict assignee from public.app_users where user_id=p_assignee_user_id and is_active;task_visibility:='shared'; end if;
  insert into public.work_tasks(id,title,notes,visibility,creator_user_id,assignee_user_id,due_date,estimated_minutes,context_type,context_id)
  values(created_id,btrim(p_title),coalesce(p_notes,''),task_visibility,actor.user_id,assignee.user_id,p_due_date,p_estimated_minutes,p_context_type,p_context_id);
  if p_color_key<>'neutral' then insert into public.work_task_preferences(task_id,user_id,color_key) values(created_id,actor.user_id,p_color_key); end if;
  return created_id;
end $$;

drop function public.update_my_work_task(uuid,text,text,uuid,date,text,uuid,text);
create function public.update_my_work_task(
  p_task_id uuid,
  p_title text,
  p_notes text,
  p_assignee_user_id uuid,
  p_due_date date,
  p_context_type text,
  p_context_id uuid,
  p_color_key text,
  p_estimated_minutes integer default null
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; task public.work_tasks%rowtype; next_assignee public.app_users%rowtype; next_visibility text; prior_assignee uuid; job_record public.jobs%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict task from public.work_tasks where id=p_task_id and (assignee_user_id=auth.uid() or (visibility='shared' and creator_user_id=auth.uid())) for update;
  if nullif(btrim(p_title),'') is null then raise exception 'Task title is required.' using errcode='22023'; end if;
  if length(coalesce(p_notes,''))>10000 then raise exception 'Task notes are too long.' using errcode='22023'; end if;
  if p_color_key not in ('neutral','blue','teal','green','yellow','orange','rose','violet') then raise exception 'Unsupported task color.' using errcode='22023'; end if;
  if p_estimated_minutes is not null and p_estimated_minutes not between 1 and 10080 then raise exception 'Estimated time must be between 1 and 10080 minutes.' using errcode='22023'; end if;
  if (p_context_type is null) <> (p_context_id is null) then raise exception 'Task context is incomplete.' using errcode='22023'; end if;
  if p_context_type is not null and p_context_type<>'job' then raise exception 'Unsupported task context.' using errcode='22023'; end if;
  if p_context_type='job' then select * into strict job_record from public.jobs where id=p_context_id and archived_at is null; end if;
  prior_assignee:=task.assignee_user_id;
  if task.creator_user_id<>auth.uid() and p_assignee_user_id<>task.assignee_user_id then raise exception 'Only the task creator can change sharing.' using errcode='42501'; end if;
  if p_assignee_user_id is null or p_assignee_user_id=task.creator_user_id then select * into strict next_assignee from public.app_users where user_id=task.creator_user_id and is_active;next_visibility:='private';
  else select * into strict next_assignee from public.app_users where user_id=p_assignee_user_id and is_active;next_visibility:='shared'; end if;
  update public.work_tasks set title=btrim(p_title),notes=coalesce(p_notes,''),assignee_user_id=next_assignee.user_id,visibility=next_visibility,due_date=p_due_date,estimated_minutes=p_estimated_minutes,context_type=p_context_type,context_id=p_context_id where id=task.id;
  insert into public.work_task_preferences(task_id,user_id,color_key,updated_at) values(task.id,actor.user_id,p_color_key,clock_timestamp())
  on conflict(task_id,user_id) do update set color_key=excluded.color_key,updated_at=excluded.updated_at;
  if next_visibility='shared' and next_assignee.user_id<>prior_assignee then
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(next_assignee.user_id,'shared-task-assigned:'||task.id,'shared_task_assigned','Shared task from '||actor.display_name,btrim(p_title),jsonb_strip_nulls(jsonb_build_object('task_id',task.id,'job_id',case when p_context_type='job' then p_context_id end,'purpose','open-my-work-task')))
    on conflict(user_id,notification_key) do nothing;
  end if;
end $$;

alter function public.list_my_work_tasks() owner to postgres;
alter function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text,integer) owner to postgres;
alter function public.update_my_work_task(uuid,text,text,uuid,date,text,uuid,text,integer) owner to postgres;
revoke all on function public.list_my_work_tasks() from public,anon;
revoke all on function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text,integer) from public,anon;
revoke all on function public.update_my_work_task(uuid,text,text,uuid,date,text,uuid,text,integer) from public,anon;
grant execute on function public.list_my_work_tasks() to authenticated,service_role;
grant execute on function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text,integer) to authenticated,service_role;
grant execute on function public.update_my_work_task(uuid,text,text,uuid,date,text,uuid,text,integer) to authenticated,service_role;

commit;
