-- Additive My Work task attachments. Existing task rows and relationships remain unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'my-work-attachments',
  'my-work-attachments',
  false,
  26214400,
  array[
    'image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',
    'application/pdf','application/octet-stream','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table public.work_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  uploader_user_id uuid not null references public.app_users(user_id),
  storage_path text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 500),
  content_type text not null default 'application/octet-stream' check (length(content_type) <= 255),
  byte_size bigint not null check (byte_size between 0 and 26214400),
  created_at timestamptz not null default clock_timestamp(),
  constraint work_task_attachment_scoped_path check (storage_path like task_id::text||'/'||id::text||'/%')
);

create index work_task_attachments_task_created_idx on public.work_task_attachments(task_id,created_at,id);
alter table public.work_task_attachments enable row level security;

create policy work_task_attachments_participant_select on public.work_task_attachments
for select to authenticated using (
  exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.work_tasks task
    where task.id=task_id
      and (task.assignee_user_id=auth.uid() or (task.visibility='shared' and task.creator_user_id=auth.uid()))
  )
);
create policy work_task_attachments_participant_insert on public.work_task_attachments
for insert to authenticated with check (
  uploader_user_id=auth.uid()
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.work_tasks task
    where task.id=task_id
      and (task.assignee_user_id=auth.uid() or (task.visibility='shared' and task.creator_user_id=auth.uid()))
  )
);
create policy work_task_attachments_authorized_delete on public.work_task_attachments
for delete to authenticated using (
  exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.work_tasks task
    where task.id=task_id
      and (uploader_user_id=auth.uid() or task.creator_user_id=auth.uid())
      and (task.assignee_user_id=auth.uid() or (task.visibility='shared' and task.creator_user_id=auth.uid()))
  )
);

revoke all on public.work_task_attachments from public,anon;
grant select,insert,delete on public.work_task_attachments to authenticated;
grant all on public.work_task_attachments to service_role;

create policy my_work_attachment_object_select on storage.objects
for select to authenticated using (
  bucket_id='my-work-attachments'
  and exists(
    select 1 from public.work_tasks task
    where task.id=(storage.foldername(name))[1]::uuid
      and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
      and (task.assignee_user_id=auth.uid() or (task.visibility='shared' and task.creator_user_id=auth.uid()))
  )
);
create policy my_work_attachment_object_insert on storage.objects
for insert to authenticated with check (
  bucket_id='my-work-attachments'
  and exists(
    select 1 from public.work_tasks task
    where task.id=(storage.foldername(name))[1]::uuid
      and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
      and (task.assignee_user_id=auth.uid() or (task.visibility='shared' and task.creator_user_id=auth.uid()))
  )
);
create policy my_work_attachment_object_delete on storage.objects
for delete to authenticated using (
  bucket_id='my-work-attachments'
  and exists(
    select 1 from public.work_task_attachments attachment
    join public.work_tasks task on task.id=attachment.task_id
    where attachment.storage_path=name
      and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
      and (attachment.uploader_user_id=auth.uid() or task.creator_user_id=auth.uid())
      and (task.assignee_user_id=auth.uid() or (task.visibility='shared' and task.creator_user_id=auth.uid()))
  )
);

-- Creation writes the complete task record but deliberately defers the assignment notification.
create function public.create_my_work_task_complete(
  p_title text,
  p_assignee_user_id uuid default null,
  p_due_date date default null,
  p_context_type text default null,
  p_context_id uuid default null,
  p_notes text default '',
  p_color_key text default 'neutral'
) returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.app_users%rowtype; assignee public.app_users%rowtype; created_id uuid:=gen_random_uuid(); task_visibility text; job_record public.jobs%rowtype;
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if nullif(btrim(p_title),'') is null then raise exception 'Task title is required.' using errcode='22023'; end if;
  if length(coalesce(p_notes,''))>10000 then raise exception 'Task notes are too long.' using errcode='22023'; end if;
  if p_color_key not in ('neutral','blue','teal','green','yellow','orange','rose','violet') then raise exception 'Unsupported task color.' using errcode='22023'; end if;
  if (p_context_type is null) <> (p_context_id is null) then raise exception 'Task context is incomplete.' using errcode='22023'; end if;
  if p_context_type is not null and p_context_type<>'job' then raise exception 'Unsupported task context.' using errcode='22023'; end if;
  if p_context_type='job' then select * into strict job_record from public.jobs where id=p_context_id; end if;
  if p_assignee_user_id is null or p_assignee_user_id=auth.uid() then assignee:=actor;task_visibility:='private';
  else select * into strict assignee from public.app_users where user_id=p_assignee_user_id and is_active;task_visibility:='shared'; end if;
  insert into public.work_tasks(id,title,notes,visibility,creator_user_id,assignee_user_id,due_date,context_type,context_id)
  values(created_id,btrim(p_title),coalesce(p_notes,''),task_visibility,actor.user_id,assignee.user_id,p_due_date,p_context_type,p_context_id);
  if p_color_key<>'neutral' then insert into public.work_task_preferences(task_id,user_id,color_key) values(created_id,actor.user_id,p_color_key); end if;
  return created_id;
end;$$;

create function public.finalize_my_work_task_creation(p_task_id uuid,p_expected_attachment_count integer default 0)
returns void language plpgsql security definer set search_path=public as $$
declare task public.work_tasks%rowtype; actor public.app_users%rowtype; attachment_count integer;
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict task from public.work_tasks where id=p_task_id and creator_user_id=auth.uid() for update;
  if p_expected_attachment_count<0 then raise exception 'Invalid attachment count.' using errcode='22023'; end if;
  select count(*) into attachment_count from public.work_task_attachments where task_id=task.id;
  if attachment_count<>p_expected_attachment_count then raise exception 'Task attachments are not complete.' using errcode='22023'; end if;
  if task.visibility='shared' then
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(task.assignee_user_id,'shared-task-assigned:'||task.id,'shared_task_assigned','Shared task from '||actor.display_name,task.title,jsonb_strip_nulls(jsonb_build_object('task_id',task.id,'job_id',case when task.context_type='job' then task.context_id end,'due_date',task.due_date,'purpose','open-my-work-task')))
    on conflict(user_id,notification_key) do nothing;
  end if;
end;$$;

alter function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text) owner to postgres;
alter function public.finalize_my_work_task_creation(uuid,integer) owner to postgres;
revoke all on function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text) from public,anon;
revoke all on function public.finalize_my_work_task_creation(uuid,integer) from public,anon;
grant execute on function public.create_my_work_task_complete(text,uuid,date,text,uuid,text,text) to authenticated,service_role;
grant execute on function public.finalize_my_work_task_creation(uuid,integer) to authenticated,service_role;

comment on table public.work_task_attachments is 'Participant-scoped private attachment metadata for durable My Work tasks.';
