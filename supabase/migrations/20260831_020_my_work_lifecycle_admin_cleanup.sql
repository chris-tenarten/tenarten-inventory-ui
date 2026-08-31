-- Additive Inbox edit history and deliberate Admin cleanup for individual messages/tasks.
-- Existing participant privacy remains unchanged; no conversation entity is introduced.
begin;

alter table public.my_work_messages
  add column edited_at timestamptz,
  add column edit_count integer not null default 0 check (edit_count >= 0);

create table public.my_work_message_versions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.my_work_messages(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  prior_body text not null check (length(btrim(prior_body)) between 1 and 10000),
  editor_user_id uuid not null references public.app_users(user_id),
  edited_at timestamptz not null default clock_timestamp(),
  unique(message_id, version_number)
);
create index my_work_message_versions_message_idx
  on public.my_work_message_versions(message_id, version_number);
alter table public.my_work_message_versions enable row level security;
create policy my_work_message_versions_participant_select
on public.my_work_message_versions for select to authenticated using (
  exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.my_work_messages message
    where message.id=message_id
      and message.delivery_status='ready'
      and (message.sender_user_id=auth.uid() or message.recipient_user_id=auth.uid())
  )
);
revoke all on public.my_work_message_versions from public,anon,authenticated;
grant select on public.my_work_message_versions to authenticated;
grant all on public.my_work_message_versions to service_role;

create table public.my_work_message_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  deleted_message_id uuid not null unique,
  actor_user_id uuid not null,
  original_sender_user_id uuid not null,
  original_recipient_user_id uuid not null,
  attachment_count integer not null check (attachment_count >= 0),
  deleted_at timestamptz not null default clock_timestamp()
);
alter table public.my_work_message_deletion_audit enable row level security;
revoke all on public.my_work_message_deletion_audit from public,anon,authenticated;
grant select on public.my_work_message_deletion_audit to service_role;

create table public.work_task_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  deleted_task_id uuid not null unique,
  actor_user_id uuid not null,
  original_creator_user_id uuid not null,
  original_assignee_user_id uuid not null,
  original_visibility text not null check (original_visibility in ('private','shared')),
  attachment_count integer not null check (attachment_count >= 0),
  preference_count integer not null check (preference_count >= 0),
  notification_count integer not null check (notification_count >= 0),
  deleted_at timestamptz not null default clock_timestamp()
);
alter table public.work_task_deletion_audit enable row level security;
revoke all on public.work_task_deletion_audit from public,anon,authenticated;
grant select on public.work_task_deletion_audit to service_role;

create or replace function public.list_my_work_inbox_recipients()
returns table(user_id uuid,display_name text,role text)
language sql stable security definer set search_path=public as $$
  select candidate.user_id,candidate.display_name,candidate.role
  from public.app_users candidate
  cross join lateral (
    select actor.role from public.app_users actor
    where actor.user_id=auth.uid() and actor.is_active
  ) actor
  where candidate.is_active
    and candidate.user_id<>auth.uid()
    and (candidate.role<>'developer' or actor.role='admin')
  order by lower(candidate.display_name),candidate.user_id;
$$;

create function public.list_my_work_inbox_messages_v2()
returns table(
  id uuid, sender_user_id uuid, sender_name text, recipient_user_id uuid, recipient_name text,
  body text, job_id uuid, job_number text, job_name text, read_at timestamptz,
  created_at timestamptz, edited_at timestamptz
) language sql stable security definer set search_path=public as $$
  select message.id,
    coalesce(message.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid),
    case when message.sender_kind='system' then 'TenOps' else sender.display_name end,
    message.recipient_user_id,recipient.display_name,message.body,message.job_id,
    job.job_number,job.name,message.read_at,message.created_at,message.edited_at
  from public.my_work_messages message
  left join public.app_users sender on sender.user_id=message.sender_user_id
  join public.app_users recipient on recipient.user_id=message.recipient_user_id
  left join public.jobs job on job.id=message.job_id
  where message.delivery_status='ready'
    and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
    and (message.sender_user_id=auth.uid() or message.recipient_user_id=auth.uid())
  order by message.created_at,message.id;
$$;

create function public.edit_my_work_inbox_message(p_message_id uuid,p_body text)
returns timestamptz language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; message public.my_work_messages%rowtype; changed_at timestamptz:=clock_timestamp();
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict message from public.my_work_messages where id=p_message_id for update;
  if message.sender_kind<>'user' or message.sender_user_id is null then
    raise exception 'TenOps system messages cannot be edited.' using errcode='42501';
  end if;
  if message.sender_user_id<>actor.user_id then
    raise exception 'Only the original sender can edit this message.' using errcode='42501';
  end if;
  if message.delivery_status<>'ready' then raise exception 'Only delivered messages can be edited.' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'Message is required.' using errcode='22023'; end if;
  if length(btrim(p_body))>10000 then raise exception 'Message is too long.' using errcode='22023'; end if;
  if message.body=btrim(p_body) then raise exception 'Make a change before saving.' using errcode='22023'; end if;
  insert into public.my_work_message_versions(message_id,version_number,prior_body,editor_user_id,edited_at)
  values(message.id,message.edit_count+1,message.body,actor.user_id,changed_at);
  update public.my_work_messages
  set body=btrim(p_body),edited_at=changed_at,edit_count=edit_count+1
  where id=message.id;
  return changed_at;
end;$$;

create function public.prepare_admin_delete_my_work_message(p_message_id uuid)
returns table(storage_path text) language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare message public.my_work_messages%rowtype;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Active Admin access is required.' using errcode='42501';
  end if;
  select * into strict message from public.my_work_messages where id=p_message_id;
  if message.sender_kind='system' then
    raise exception 'TenOps system messages are protected by release-delivery semantics and cannot be permanently deleted.' using errcode='42501';
  end if;
  return query select attachment.storage_path from public.my_work_message_attachments attachment
    where attachment.message_id=message.id order by attachment.created_at,attachment.id;
end;$$;

create function public.admin_permanently_delete_my_work_message(p_message_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare message public.my_work_messages%rowtype; attachment_total integer;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Active Admin access is required.' using errcode='42501';
  end if;
  if p_confirmation<>'PERMANENTLY_DELETE_MESSAGE' then raise exception 'Explicit permanent-delete confirmation is required.' using errcode='22023'; end if;
  select * into strict message from public.my_work_messages where id=p_message_id for update;
  if message.sender_kind='system' then
    raise exception 'TenOps system messages are protected by release-delivery semantics and cannot be permanently deleted.' using errcode='42501';
  end if;
  select count(*) into attachment_total from public.my_work_message_attachments where message_id=message.id;
  if exists(
    select 1 from public.my_work_message_attachments attachment
    join storage.objects object on object.bucket_id='my-work-inbox-attachments' and object.name=attachment.storage_path
    where attachment.message_id=message.id
  ) then raise exception 'Message attachment cleanup must complete before permanent deletion.' using errcode='23503'; end if;
  insert into public.my_work_message_deletion_audit(
    deleted_message_id,actor_user_id,original_sender_user_id,original_recipient_user_id,attachment_count
  ) values(message.id,auth.uid(),message.sender_user_id,message.recipient_user_id,attachment_total);
  delete from public.account_notifications
  where notification_key='inbox-message:'||message.id::text or metadata->>'message_id'=message.id::text;
  delete from public.my_work_messages where id=message.id;
end;$$;

create function public.prepare_admin_delete_work_task(p_task_id uuid)
returns table(storage_path text) language plpgsql security definer set search_path=pg_catalog,public,storage as $$
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Active Admin access is required.' using errcode='42501';
  end if;
  if not exists(select 1 from public.work_tasks where id=p_task_id) then raise exception 'Task not found.' using errcode='P0002'; end if;
  return query select attachment.storage_path from public.work_task_attachments attachment
    where attachment.task_id=p_task_id order by attachment.created_at,attachment.id;
end;$$;

create function public.admin_permanently_delete_work_task(p_task_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare task public.work_tasks%rowtype; attachment_total integer; preference_total integer; notification_total integer;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Active Admin access is required.' using errcode='42501';
  end if;
  if p_confirmation<>'PERMANENTLY_DELETE_TASK' then raise exception 'Explicit permanent-delete confirmation is required.' using errcode='22023'; end if;
  select * into strict task from public.work_tasks where id=p_task_id for update;
  select count(*) into attachment_total from public.work_task_attachments where task_id=task.id;
  select count(*) into preference_total from public.work_task_preferences where task_id=task.id;
  select count(*) into notification_total from public.account_notifications where metadata->>'task_id'=task.id::text;
  if exists(
    select 1 from public.work_task_attachments attachment
    join storage.objects object on object.bucket_id='my-work-attachments' and object.name=attachment.storage_path
    where attachment.task_id=task.id
  ) then raise exception 'Task attachment cleanup must complete before permanent deletion.' using errcode='23503'; end if;
  insert into public.work_task_deletion_audit(
    deleted_task_id,actor_user_id,original_creator_user_id,original_assignee_user_id,
    original_visibility,attachment_count,preference_count,notification_count
  ) values(task.id,auth.uid(),task.creator_user_id,task.assignee_user_id,task.visibility,attachment_total,preference_total,notification_total);
  delete from public.account_notifications where metadata->>'task_id'=task.id::text;
  delete from public.work_tasks where id=task.id;
end;$$;

create policy my_work_inbox_attachment_object_admin_delete
on storage.objects for delete to authenticated using (
  bucket_id='my-work-inbox-attachments'
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active and actor.role='admin')
);
create policy my_work_task_attachment_object_admin_delete
on storage.objects for delete to authenticated using (
  bucket_id='my-work-attachments'
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active and actor.role='admin')
);

alter function public.list_my_work_inbox_recipients() owner to postgres;
alter function public.list_my_work_inbox_messages_v2() owner to postgres;
alter function public.edit_my_work_inbox_message(uuid,text) owner to postgres;
alter function public.prepare_admin_delete_my_work_message(uuid) owner to postgres;
alter function public.admin_permanently_delete_my_work_message(uuid,text) owner to postgres;
alter function public.prepare_admin_delete_work_task(uuid) owner to postgres;
alter function public.admin_permanently_delete_work_task(uuid,text) owner to postgres;
revoke all on function public.list_my_work_inbox_messages_v2() from public,anon;
revoke all on function public.edit_my_work_inbox_message(uuid,text) from public,anon;
revoke all on function public.prepare_admin_delete_my_work_message(uuid) from public,anon;
revoke all on function public.admin_permanently_delete_my_work_message(uuid,text) from public,anon;
revoke all on function public.prepare_admin_delete_work_task(uuid) from public,anon;
revoke all on function public.admin_permanently_delete_work_task(uuid,text) from public,anon;
grant execute on function public.list_my_work_inbox_messages_v2() to authenticated,service_role;
grant execute on function public.edit_my_work_inbox_message(uuid,text) to authenticated,service_role;
grant execute on function public.prepare_admin_delete_my_work_message(uuid) to authenticated;
grant execute on function public.admin_permanently_delete_my_work_message(uuid,text) to authenticated;
grant execute on function public.prepare_admin_delete_work_task(uuid) to authenticated;
grant execute on function public.admin_permanently_delete_work_task(uuid,text) to authenticated;

comment on table public.my_work_message_versions is 'Immutable prior message bodies, readable only by active message participants.';
comment on table public.my_work_message_deletion_audit is 'Content-free accountability record for Admin permanent message deletion.';
comment on table public.work_task_deletion_audit is 'Content-free accountability record for Admin permanent task deletion.';

commit;
