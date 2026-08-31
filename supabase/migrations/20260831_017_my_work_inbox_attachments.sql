-- Additive private attachments for My Work Inbox messages. Migration 016 remains unchanged.

alter table public.my_work_messages
  add column delivery_status text not null default 'ready'
  check (delivery_status in ('draft','ready'));

drop policy my_work_messages_participant_select on public.my_work_messages;
create policy my_work_messages_participant_select on public.my_work_messages
for select to authenticated using (
  exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and (sender_user_id=auth.uid() or (recipient_user_id=auth.uid() and delivery_status='ready'))
);

create table public.my_work_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.my_work_messages(id) on delete cascade,
  uploader_user_id uuid not null references public.app_users(user_id),
  storage_path text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 500),
  content_type text not null default 'application/octet-stream' check (length(content_type)<=255),
  byte_size bigint not null check (byte_size between 0 and 26214400),
  created_at timestamptz not null default clock_timestamp(),
  constraint my_work_message_attachment_scoped_path check (storage_path like message_id::text||'/'||id::text||'/%')
);
create index my_work_message_attachments_message_idx on public.my_work_message_attachments(message_id,created_at,id);
alter table public.my_work_message_attachments enable row level security;

create policy my_work_message_attachments_participant_select on public.my_work_message_attachments
for select to authenticated using (exists(
  select 1 from public.my_work_messages message
  where message.id=message_id and (message.sender_user_id=auth.uid() or (message.recipient_user_id=auth.uid() and message.delivery_status='ready'))
));
create policy my_work_message_attachments_sender_insert on public.my_work_message_attachments
for insert to authenticated with check (
  uploader_user_id=auth.uid() and exists(select 1 from public.my_work_messages message where message.id=message_id and message.sender_user_id=auth.uid() and message.delivery_status='draft')
);
create policy my_work_message_attachments_draft_delete on public.my_work_message_attachments
for delete to authenticated using (exists(select 1 from public.my_work_messages message where message.id=message_id and message.sender_user_id=auth.uid() and message.delivery_status='draft'));
revoke all on public.my_work_message_attachments from public,anon;
grant select,insert,delete on public.my_work_message_attachments to authenticated;
grant all on public.my_work_message_attachments to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(
  'my-work-inbox-attachments','my-work-inbox-attachments',false,26214400,
  array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif','application/pdf','application/octet-stream','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']
) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy my_work_inbox_attachment_object_select on storage.objects
for select to authenticated using (bucket_id='my-work-inbox-attachments' and exists(
  select 1 from public.my_work_messages message where message.id=(storage.foldername(name))[1]::uuid
    and (message.sender_user_id=auth.uid() or (message.recipient_user_id=auth.uid() and message.delivery_status='ready'))
));
create policy my_work_inbox_attachment_object_insert on storage.objects
for insert to authenticated with check (bucket_id='my-work-inbox-attachments' and exists(
  select 1 from public.my_work_messages message where message.id=(storage.foldername(name))[1]::uuid and message.sender_user_id=auth.uid() and message.delivery_status='draft'
));
create policy my_work_inbox_attachment_object_delete on storage.objects
for delete to authenticated using (bucket_id='my-work-inbox-attachments' and exists(
  select 1 from public.my_work_messages message where message.id=(storage.foldername(name))[1]::uuid and message.sender_user_id=auth.uid() and message.delivery_status='draft'
));

create function public.create_my_work_inbox_message_draft(p_recipient_user_id uuid,p_body text,p_job_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.app_users%rowtype; recipient public.app_users%rowtype; selected_job public.jobs%rowtype; message_id uuid:=gen_random_uuid();
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_recipient_user_id=actor.user_id then raise exception 'Choose another TenOps user.' using errcode='22023'; end if;
  select * into strict recipient from public.app_users where user_id=p_recipient_user_id and is_active;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'Message is required.' using errcode='22023'; end if;
  if length(btrim(p_body))>10000 then raise exception 'Message is too long.' using errcode='22023'; end if;
  if p_job_id is not null then select * into strict selected_job from public.jobs where id=p_job_id; end if;
  insert into public.my_work_messages(id,sender_user_id,recipient_user_id,body,job_id,delivery_status)
  values(message_id,actor.user_id,recipient.user_id,btrim(p_body),p_job_id,'draft');
  return message_id;
end;$$;

create function public.finalize_my_work_inbox_message(p_message_id uuid,p_expected_attachment_count integer)
returns void language plpgsql security definer set search_path=public as $$
declare message public.my_work_messages%rowtype; actor public.app_users%rowtype; attachment_count integer;
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict message from public.my_work_messages where id=p_message_id and sender_user_id=auth.uid() and delivery_status='draft' for update;
  if p_expected_attachment_count<1 then raise exception 'At least one attachment is required.' using errcode='22023'; end if;
  select count(*) into attachment_count from public.my_work_message_attachments where message_id=message.id;
  if attachment_count<>p_expected_attachment_count then raise exception 'Message attachments are incomplete.' using errcode='22023'; end if;
  update public.my_work_messages set delivery_status='ready' where id=message.id;
  insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
  values(message.recipient_user_id,'inbox-message:'||message.id,'inbox_message',actor.display_name||' sent you a message','Open Inbox to read it.',jsonb_strip_nulls(jsonb_build_object('message_id',message.id,'conversation_user_id',actor.user_id,'job_id',message.job_id,'purpose','open-my-work-inbox')))
  on conflict(user_id,notification_key) do nothing;
end;$$;

create function public.discard_my_work_inbox_message_draft(p_message_id uuid)
returns void language sql security definer set search_path=public as $$
  delete from public.my_work_messages where id=p_message_id and sender_user_id=auth.uid() and delivery_status='draft';
$$;

create or replace function public.list_my_work_inbox_messages()
returns table(id uuid,sender_user_id uuid,sender_name text,recipient_user_id uuid,recipient_name text,body text,job_id uuid,job_number text,job_name text,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select message.id,message.sender_user_id,sender.display_name,message.recipient_user_id,recipient.display_name,message.body,message.job_id,job.job_number,job.name,message.read_at,message.created_at
  from public.my_work_messages message join public.app_users sender on sender.user_id=message.sender_user_id join public.app_users recipient on recipient.user_id=message.recipient_user_id left join public.jobs job on job.id=message.job_id
  where message.delivery_status='ready' and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active) and (message.sender_user_id=auth.uid() or message.recipient_user_id=auth.uid())
  order by message.created_at,message.id;
$$;

alter function public.create_my_work_inbox_message_draft(uuid,text,uuid) owner to postgres;
alter function public.finalize_my_work_inbox_message(uuid,integer) owner to postgres;
alter function public.discard_my_work_inbox_message_draft(uuid) owner to postgres;
revoke all on function public.create_my_work_inbox_message_draft(uuid,text,uuid) from public,anon;
revoke all on function public.finalize_my_work_inbox_message(uuid,integer) from public,anon;
revoke all on function public.discard_my_work_inbox_message_draft(uuid) from public,anon;
grant execute on function public.create_my_work_inbox_message_draft(uuid,text,uuid) to authenticated,service_role;
grant execute on function public.finalize_my_work_inbox_message(uuid,integer) to authenticated,service_role;
grant execute on function public.discard_my_work_inbox_message_draft(uuid) to authenticated,service_role;
