-- Messaging V1.1: bounded private previews, authoritative pages/events, retire new Job links.
-- Forward-only; no historical data rewrite, bucket/global configuration or backfill.
begin;

do $$ begin if (select md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_permanently_delete_my_work_message') is distinct from '8e633e7fe03d8ace978ceb212e950b75' then raise exception 'Messaging V1.1 prerequisite drift: admin_permanently_delete_my_work_message'; end if; end $$;

do $$ begin if (select md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='begin_my_work_attachment_transfer') is distinct from 'e6741fef882947197781fc93c8e73508' then raise exception 'Messaging V1.1 prerequisite drift: begin_my_work_attachment_transfer'; end if; end $$;

do $$ begin if (select md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_my_work_attachment_object') is distinct from '1ec05c7ca2574432c87032cbe89b22bf' then raise exception 'Messaging V1.1 prerequisite drift: guard_my_work_attachment_object'; end if; end $$;

do $$ begin if (select md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='prepare_admin_delete_my_work_message') is distinct from 'ad131c33a40bccf601909467af970086' then raise exception 'Messaging V1.1 prerequisite drift: prepare_admin_delete_my_work_message'; end if; end $$;


create function public.guard_my_work_message_job_retirement() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.job_id is not null and (tg_op='INSERT' or new.job_id is distinct from old.job_id) then
    raise exception 'New private Messaging Job links are retired. Use Job Updates or My Work shared tasks.' using errcode='22023';
  end if;
  return new;
end;$$;
revoke all on function public.guard_my_work_message_job_retirement() from public,anon,authenticated;
create trigger guard_my_work_message_job_retirement before insert or update of job_id on public.my_work_messages
for each row execute function public.guard_my_work_message_job_retirement();

do $$ begin
 if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.my_work_messages'::regclass and conname='my_work_messages_body_check')
 is distinct from 'CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 10000)))' then
 raise exception 'Messaging body constraint prerequisite drift.'; end if;
end $$;
alter table public.my_work_messages drop constraint my_work_messages_body_check;
alter table public.my_work_messages add constraint my_work_messages_body_check
check (length(btrim(body))<=10000 and (length(btrim(body))>=1 or upload_request is not null));

create table public.my_work_attachment_previews (
  attachment_id uuid primary key references public.my_work_message_attachments(id) on delete cascade,
  message_id uuid not null references public.my_work_messages(id) on delete cascade,
  storage_path text not null unique,
  byte_size integer not null check(byte_size between 1 and 196608),
  width integer not null check(width between 1 and 1280),
  height integer not null check(height between 1 and 1280),
  ready boolean not null default false,
  constraint messaging_preview_identity check(storage_path=message_id::text||'/'||attachment_id::text||'/preview.jpg')
);
create index my_work_attachment_previews_message_idx on public.my_work_attachment_previews(message_id);
alter table public.my_work_attachment_previews enable row level security;
create policy messaging_preview_participant_select on public.my_work_attachment_previews for select to authenticated using(
  exists(select 1 from public.my_work_messages m where m.id=message_id and
    (m.sender_user_id=auth.uid() or (m.recipient_user_id=auth.uid() and m.delivery_status='ready')))
);
revoke all on public.my_work_attachment_previews from public,anon,authenticated;
grant select on public.my_work_attachment_previews to authenticated;
grant all on public.my_work_attachment_previews to service_role;

create function public.reserve_my_work_attachment_preview(p_attachment uuid,p_bytes integer,p_width integer,p_height integer)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.my_work_message_attachments%rowtype; m public.my_work_messages%rowtype; p public.my_work_attachment_previews%rowtype;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501'; end if;
  select * into strict a from public.my_work_message_attachments where id=p_attachment;
  select * into strict m from public.my_work_messages where id=a.message_id for update;
  if m.sender_user_id is distinct from auth.uid() or m.delivery_status<>'draft' or m.upload_state is distinct from 'active' then raise exception 'Active sender draft required.' using errcode='42501'; end if;
  if a.byte_size<1 or a.byte_size>20000000 or a.content_type not in ('image/png','image/jpeg','image/gif','image/webp') then raise exception 'No supported preview.'; end if;
  insert into public.my_work_attachment_previews(attachment_id,message_id,storage_path,byte_size,width,height)
  values(a.id,m.id,m.id::text||'/'||a.id::text||'/preview.jpg',p_bytes,p_width,p_height)
  on conflict(attachment_id) do nothing;
  select * into strict p from public.my_work_attachment_previews where attachment_id=a.id;
  if (p.byte_size,p.width,p.height) is distinct from (p_bytes,p_width,p_height) then raise exception 'Preview reservation differs.'; end if;
  return p.storage_path;
end;$$;
revoke all on function public.reserve_my_work_attachment_preview(uuid,integer,integer,integer) from public,anon;
grant execute on function public.reserve_my_work_attachment_preview(uuid,integer,integer,integer) to authenticated;

drop policy my_work_inbox_attachment_object_insert on storage.objects;
create policy my_work_inbox_attachment_object_insert on storage.objects for insert to authenticated with check(
  bucket_id='my-work-inbox-attachments' and (
    exists(select 1 from public.my_work_message_attachments a join public.my_work_messages m on m.id=a.message_id
      where a.storage_path=name and m.sender_user_id=auth.uid() and m.delivery_status='draft' and m.upload_state='active')
    or exists(select 1 from public.my_work_attachment_previews p join public.my_work_messages m on m.id=p.message_id
      where p.storage_path=name and m.sender_user_id=auth.uid() and m.delivery_status='draft' and m.upload_state='active')
  )
);

CREATE OR REPLACE FUNCTION public.admin_permanently_delete_my_work_message(p_message_id uuid, p_confirmation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'storage'
AS $function$
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
    select 1 from storage.objects object where object.bucket_id='my-work-inbox-attachments' and split_part(object.name,'/',1)=message.id::text
  ) then raise exception 'Message attachment cleanup must complete before permanent deletion.' using errcode='23503'; end if;
  insert into public.my_work_message_deletion_audit(
    deleted_message_id,actor_user_id,original_sender_user_id,original_recipient_user_id,attachment_count
  ) values(message.id,auth.uid(),message.sender_user_id,message.recipient_user_id,attachment_total);
  delete from public.account_notifications
  where notification_key='inbox-message:'||message.id::text or metadata->>'message_id'=message.id::text;
  delete from public.my_work_messages where id=message.id;
end;$function$
;

CREATE OR REPLACE FUNCTION public.begin_my_work_attachment_transfer(p_id uuid, p_recipient uuid, p_body text, p_job uuid, p_files jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare existing public.my_work_messages%rowtype; request jsonb; item jsonb; total bigint; actor public.app_users%rowtype;
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_id is null or p_recipient is null or p_recipient=auth.uid() then raise exception 'Choose another recipient.'; end if;
  request=jsonb_build_object('recipient',p_recipient,'body',btrim(p_body),'job',p_job,'files',p_files);
  -- Serializes concurrent calls even before the message row exists.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.my_work_messages where id=p_id for update;
  if found then
    if existing.sender_user_id<>auth.uid() or existing.upload_request is distinct from request then raise exception 'Transfer identity does not match.' using errcode='42501'; end if;
    if existing.delivery_status='draft' and existing.upload_state='active' then update public.my_work_messages set upload_touched_at=clock_timestamp() where id=p_id; end if;
    return;
  end if;
  if not exists(select 1 from public.app_users where user_id=p_recipient and is_active and (role<>'developer' or actor.role='admin')) then raise exception 'Recipient unavailable.'; end if;
  if p_body is null or length(btrim(p_body))>10000 then raise exception 'Message must contain at most 10000 characters.'; end if;
  if p_job is not null and not exists(select 1 from public.jobs where id=p_job) then raise exception 'Job unavailable.'; end if;
  if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)<1 or p_files is null then raise exception 'Attachments required.'; end if;
  select sum((x->>'size')::bigint) into total from jsonb_array_elements(p_files) x;
  if total is null or total>200000000 then raise exception 'Attachments exceed 200 MB/message.'; end if;
  if exists(select 1 from public.my_work_message_deletion_audit where deleted_message_id=p_id) then raise exception 'This message was permanently deleted.'; end if;
  insert into public.my_work_messages(id,sender_user_id,recipient_user_id,body,job_id,delivery_status,upload_request,upload_state,upload_touched_at)
  values(p_id,auth.uid(),p_recipient,btrim(p_body),p_job,'draft',request,'active',clock_timestamp());
  for item in select * from jsonb_array_elements(p_files) loop
    if (item->>'size') is null or (item->>'name') is null or (item->>'id') is null or (item->>'contentType') is null then raise exception 'Invalid file manifest.'; end if;
    insert into public.my_work_message_attachments(id,message_id,uploader_user_id,storage_path,original_filename,content_type,byte_size)
    values((item->>'id')::uuid,p_id,auth.uid(),p_id::text||'/'||(item->>'id')::uuid::text||'/file',item->>'name',item->>'contentType',(item->>'size')::bigint);
  end loop;
end;$function$
;

CREATE OR REPLACE FUNCTION public.guard_my_work_attachment_object()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'storage'
AS $function$
declare p public.my_work_attachment_previews%rowtype; a public.my_work_message_attachments%rowtype; m public.my_work_messages%rowtype;
begin
  if new.bucket_id<>'my-work-inbox-attachments' then return new; end if;
  select * into p from public.my_work_attachment_previews where storage_path=new.name;
  if found then
    select * into strict m from public.my_work_messages where id=p.message_id for update;
    if m.delivery_status<>'draft' or m.upload_state is distinct from 'active' then raise exception 'Transfer is not active.' using errcode='42501'; end if;
    if new.metadata->>'size' is null then return new; end if;
    if (new.metadata->>'size')::bigint is distinct from p.byte_size or (new.metadata->>'mimetype') is distinct from 'application/octet-stream' then raise exception 'Preview does not match its reservation.'; end if;
    update public.my_work_attachment_previews set ready=true where attachment_id=p.attachment_id;
    return new;
  end if;
  select * into strict a from public.my_work_message_attachments where storage_path=new.name;
  select * into strict m from public.my_work_messages where id=a.message_id for update;
  if m.delivery_status<>'draft' or m.upload_state is distinct from 'active' then raise exception 'Transfer is not active.' using errcode='42501'; end if;
  -- Storage testPermission inserts metadata-free rows inside a transaction it rolls back.
  -- Never trust a metadata-free row as complete: status/finalize require exact actual size.
  if new.metadata->>'size' is null then return new; end if;
  if (new.metadata->>'size')::bigint is distinct from a.byte_size or (new.metadata->>'mimetype') is distinct from 'application/octet-stream' then raise exception 'Stored file does not match its reservation.'; end if;
  return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.prepare_admin_delete_my_work_message(p_message_id uuid)
 RETURNS TABLE(storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'storage'
AS $function$
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
    where attachment.message_id=message.id
    union all select preview.storage_path from public.my_work_attachment_previews preview where preview.message_id=message.id;
end;$function$
;

-- Stable keyset, bounded payload. ID reconciliation uses the same authoritative row shape.
create function public.list_my_work_message_page_v11(p_peer uuid,p_before_time timestamptz default null,p_before_id uuid default null,p_ids uuid[] default null)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
with page as (
 select m.* from public.my_work_messages m
 where m.delivery_status='ready'
 and exists(select 1 from public.app_users where user_id=auth.uid() and is_active)
 and ((m.sender_user_id=auth.uid() and m.recipient_user_id=p_peer) or
      (m.recipient_user_id=auth.uid() and coalesce(m.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid)=p_peer))
 and (p_ids is null or m.id=any(p_ids[1:40]))
 and (p_before_time is null or (m.created_at,m.id)<(p_before_time,p_before_id))
 order by m.created_at desc,m.id desc limit 40
)
select coalesce(jsonb_agg(row order by created_at,id),'[]') from (
 select m.created_at,m.id,jsonb_build_object(
 'id',m.id,'sender_user_id',coalesce(m.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid),
 'sender_name',coalesce(s.display_name,'TenOps'),'recipient_user_id',m.recipient_user_id,'recipient_name',r.display_name,
 'body',m.body,'job_id',m.job_id,'job_number',j.job_number,'job_name',j.name,'read_at',m.read_at,'created_at',m.created_at,'edited_at',m.edited_at,
 'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'message_id',a.message_id,'storage_path',a.storage_path,'original_filename',a.original_filename,
 'content_type',a.content_type,'byte_size',a.byte_size,'created_at',a.created_at,'preview',case when p.ready then jsonb_build_object('path',p.storage_path,'bytes',p.byte_size,'width',p.width,'height',p.height) else null end) order by a.created_at,a.id)
 from public.my_work_message_attachments a left join public.my_work_attachment_previews p on p.attachment_id=a.id where a.message_id=m.id),'[]')) as row
 from page m left join public.app_users s on s.user_id=m.sender_user_id join public.app_users r on r.user_id=m.recipient_user_id left join public.jobs j on j.id=m.job_id
) rows;
$$;

create function public.list_my_work_conversations_v11()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
with visible as (
 select m.*,case when m.sender_user_id=auth.uid() then m.recipient_user_id else coalesce(m.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid) end peer
 from public.my_work_messages m where m.delivery_status='ready'
 and exists(select 1 from public.app_users where user_id=auth.uid() and is_active)
 and (m.sender_user_id=auth.uid() or m.recipient_user_id=auth.uid())
), ranked as (
 select *,row_number() over(partition by peer order by created_at desc,id desc) rank,
 count(*) filter(where recipient_user_id=auth.uid() and read_at is null) over(partition by peer) unread from visible
)
select coalesce(jsonb_agg(jsonb_build_object('userId',m.peer,'name',coalesce(u.display_name,'TenOps'),'role',coalesce(u.role,'System'),
 'unread',m.unread,'latest',jsonb_build_object('id',m.id,'createdAt',m.created_at,'body',left(m.body,180))) order by m.created_at desc,m.id desc),'[]')
from ranked m left join public.app_users u on u.user_id=m.peer where m.rank=1;
$$;
revoke all on function public.list_my_work_message_page_v11(uuid,timestamptz,uuid,uuid[]) from public,anon;
revoke all on function public.list_my_work_conversations_v11() from public,anon;
grant execute on function public.list_my_work_message_page_v11(uuid,timestamptz,uuid,uuid[]) to authenticated;
grant execute on function public.list_my_work_conversations_v11() to authenticated;

-- IDs only, on the existing participant-authorized private typing topic. Never bytes/content.
create function public.broadcast_my_work_message_v11() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.my_work_messages%rowtype; topic text; kind text;
begin
 if tg_op='DELETE' then m=old; else m=new; end if;
 if m.delivery_status<>'ready' or m.sender_user_id is null then return null; end if;
 topic='my-work-typing:'||least(m.sender_user_id::text,m.recipient_user_id::text)||':'||greatest(m.sender_user_id::text,m.recipient_user_id::text);
 kind=case when tg_op='DELETE' then 'delete' when tg_op='INSERT' then 'new' when old.delivery_status='draft' then 'new' else 'update' end;
 perform realtime.send(jsonb_build_object('id',m.id,'kind',kind),'message_changed',topic,true);
 return null;
end;$$;
revoke all on function public.broadcast_my_work_message_v11() from public,anon,authenticated;
create trigger broadcast_my_work_message_v11 after insert or update or delete on public.my_work_messages
for each row execute function public.broadcast_my_work_message_v11();
commit;
