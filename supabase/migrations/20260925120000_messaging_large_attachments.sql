-- Forward-only candidate. DO NOT APPLY HOSTED without Chris's release authorization.
-- Decimal MB: 250 MB/file, 500 MB/message. Existing ready rows remain unchanged.
begin;
alter table public.my_work_message_attachments drop constraint my_work_message_attachments_byte_size_check;
alter table public.my_work_message_attachments add constraint my_work_message_attachments_byte_size_check check(byte_size between 0 and 250000000);
alter table public.my_work_messages
  add column upload_request jsonb,
  add column upload_state text check(upload_state in ('active','canceling')),
  add column upload_touched_at timestamptz;
create index my_work_messages_upload_cleanup_idx on public.my_work_messages(upload_touched_at) where delivery_status='draft';
-- Bucket configuration is a separately approved artifact; this migration does not raise it.
-- New clients reserve ALL metadata atomically; old clients fail closed until refreshed.
revoke insert,delete on public.my_work_message_attachments from authenticated;

create function public.begin_my_work_attachment_transfer(p_id uuid,p_recipient uuid,p_body text,p_job uuid,p_files jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
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
  if nullif(btrim(p_body),'') is null or length(btrim(p_body))>10000 then raise exception 'Message must contain 1–10000 characters.'; end if;
  if p_job is not null and not exists(select 1 from public.jobs where id=p_job) then raise exception 'Job unavailable.'; end if;
  if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)<1 or p_files is null then raise exception 'Attachments required.'; end if;
  select sum((x->>'size')::bigint) into total from jsonb_array_elements(p_files) x;
  if total is null or total>500000000 then raise exception 'Attachments exceed 500 MB/message.'; end if;
  if exists(select 1 from public.my_work_message_deletion_audit where deleted_message_id=p_id) then raise exception 'This message was permanently deleted.'; end if;
  insert into public.my_work_messages(id,sender_user_id,recipient_user_id,body,job_id,delivery_status,upload_request,upload_state,upload_touched_at)
  values(p_id,auth.uid(),p_recipient,btrim(p_body),p_job,'draft',request,'active',clock_timestamp());
  for item in select * from jsonb_array_elements(p_files) loop
    if (item->>'size') is null or (item->>'name') is null or (item->>'id') is null or (item->>'contentType') is null then raise exception 'Invalid file manifest.'; end if;
    insert into public.my_work_message_attachments(id,message_id,uploader_user_id,storage_path,original_filename,content_type,byte_size)
    values((item->>'id')::uuid,p_id,auth.uid(),p_id::text||'/'||(item->>'id')::uuid::text||'/file',item->>'name',item->>'contentType',(item->>'size')::bigint);
  end loop;
end;$$;

create function public.my_work_attachment_transfer_status(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare m public.my_work_messages%rowtype; completed jsonb;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Sign in required.' using errcode='42501'; end if;
  select * into strict m from public.my_work_messages where id=p_id and sender_user_id=auth.uid();
  select coalesce(jsonb_agg(a.id),'[]'::jsonb) into completed from public.my_work_message_attachments a
    join storage.objects o on o.bucket_id='my-work-inbox-attachments' and o.name=a.storage_path
    where a.message_id=p_id and (o.metadata->>'size')::bigint=a.byte_size;
  return jsonb_build_object('status',case when m.delivery_status='ready' then 'ready' else coalesce(m.upload_state,'canceling') end,'completed',completed);
end;$$;

-- Reload recovery stores only the operation UUID in sessionStorage; private manifest
-- is retrieved here under the same active sender boundary, never from a browser cache.
create function public.recover_my_work_attachment_transfer(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.my_work_messages%rowtype;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Sign in required.' using errcode='42501'; end if;
  select * into m from public.my_work_messages where id=p_id and sender_user_id=auth.uid() and upload_request is not null;
  if not found then return null; end if;
  return jsonb_build_object('id',m.id,'recipient',m.upload_request->'recipient','body',m.upload_request->'body','job',coalesce(m.upload_request->>'job',''),'entries',m.upload_request->'files');
end;$$;

create function public.heartbeat_my_work_attachment_transfer(p_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.my_work_messages set upload_touched_at=clock_timestamp()
    where id=p_id and sender_user_id=auth.uid() and delivery_status='draft' and upload_state='active'
      and exists(select 1 from public.app_users where user_id=auth.uid() and is_active);
  if not found then raise exception 'Transfer is no longer active.'; end if;
end;$$;

-- Only exactly reserved paths may be uploaded. Read and Admin cleanup policies stay unchanged.
drop policy my_work_inbox_attachment_object_insert on storage.objects;
create policy my_work_inbox_attachment_object_insert on storage.objects for insert to authenticated with check(
  bucket_id='my-work-inbox-attachments' and exists(
    select 1 from public.my_work_message_attachments a join public.my_work_messages m on m.id=a.message_id
    where a.storage_path=name and m.sender_user_id=auth.uid() and m.delivery_status='draft' and m.upload_state='active'
  )
);
-- Storage supplies the actual object size. Locking the parent serializes completion with
-- finalize/cancel/cleanup and prevents a late TUS completion recreating a canceled object.
create function public.guard_my_work_attachment_object()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare a public.my_work_message_attachments%rowtype; m public.my_work_messages%rowtype;
begin
  if new.bucket_id<>'my-work-inbox-attachments' then return new; end if;
  select * into strict a from public.my_work_message_attachments where storage_path=new.name;
  select * into strict m from public.my_work_messages where id=a.message_id for update;
  if m.delivery_status<>'draft' or m.upload_state is distinct from 'active' then raise exception 'Transfer is not active.' using errcode='42501'; end if;
  -- Storage testPermission inserts metadata-free rows inside a transaction it rolls back.
  -- Never trust a metadata-free row as complete: status/finalize require exact actual size.
  if new.metadata->>'size' is null then return new; end if;
  if (new.metadata->>'size')::bigint is distinct from a.byte_size or (new.metadata->>'mimetype') is distinct from 'application/octet-stream' then raise exception 'Stored file does not match its reservation.'; end if;
  return new;
end;$$;
create trigger guard_my_work_attachment_object before insert or update on storage.objects for each row execute function public.guard_my_work_attachment_object();

create or replace function public.finalize_my_work_inbox_message(p_message_id uuid,p_expected_attachment_count integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare m public.my_work_messages%rowtype; actor public.app_users%rowtype; n integer; total bigint;
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict m from public.my_work_messages where id=p_message_id and sender_user_id=auth.uid() for update;
  if m.upload_request is null then raise exception 'Refresh Messaging before sending attachments.'; end if;
  select count(*),sum(byte_size) into n,total from public.my_work_message_attachments where message_id=m.id;
  if p_expected_attachment_count is null or p_expected_attachment_count<1 or n<>p_expected_attachment_count or total>500000000 then raise exception 'Attachment manifest incomplete or too large.'; end if;
  if m.delivery_status='ready' then return; end if;
  if m.upload_state is distinct from 'active' then raise exception 'Transfer canceled.'; end if;
  if exists(select 1 from public.my_work_message_attachments a left join storage.objects o on o.bucket_id='my-work-inbox-attachments' and o.name=a.storage_path
    where a.message_id=m.id and (o.id is null or (o.metadata->>'size')::bigint is distinct from a.byte_size)) then raise exception 'Attachment bytes are incomplete.'; end if;
  update public.my_work_messages set delivery_status='ready',upload_state=null where id=m.id;
  insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
  values(m.recipient_user_id,'inbox-message:'||m.id,'inbox_message',actor.display_name||' sent you a message','Open Inbox to read it.',jsonb_strip_nulls(jsonb_build_object('message_id',m.id,'conversation_user_id',actor.user_id,'job_id',m.job_id,'purpose','open-my-work-inbox')))
  on conflict(user_id,notification_key) do nothing;
end;$$;

create function public.cancel_my_work_attachment_transfer(p_id uuid)
returns setof text language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare m public.my_work_messages%rowtype;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Sign in required.' using errcode='42501'; end if;
  select * into strict m from public.my_work_messages where id=p_id and sender_user_id=auth.uid() for update;
  if m.delivery_status='ready' then raise exception 'Message already sent; reload its status.'; end if;
  update public.my_work_messages set upload_state='canceling' where id=p_id;
  return query select name from storage.objects where bucket_id='my-work-inbox-attachments' and split_part(name,'/',1)=p_id::text;
end;$$;

create or replace function public.discard_my_work_inbox_message_draft(p_message_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare m public.my_work_messages%rowtype;
begin
  select * into m from public.my_work_messages where id=p_message_id and sender_user_id=auth.uid() for update;
  if not found then return; end if;
  if m.delivery_status<>'draft' or m.upload_state is distinct from 'canceling' then raise exception 'Cancel the draft before discarding.'; end if;
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Sign in required.' using errcode='42501'; end if;
  if exists(select 1 from storage.objects where bucket_id='my-work-inbox-attachments' and split_part(name,'/',1)=p_message_id::text) then raise exception 'Storage cleanup must finish first.'; end if;
  delete from public.my_work_messages where id=p_message_id;
end;$$;

-- Service-only cleanup claims, no routine Admin content reading. Seven days of inactivity.
create function public.claim_abandoned_my_work_transfers(p_limit integer default 50)
returns table(message_id uuid,paths text[]) language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare m public.my_work_messages%rowtype;
begin
  for m in select * from public.my_work_messages where delivery_status='draft'
    and coalesce(upload_touched_at,created_at)<clock_timestamp()-interval '7 days'
    order by coalesce(upload_touched_at,created_at) limit least(greatest(p_limit,1),100) for update skip locked loop
    update public.my_work_messages set upload_state='canceling' where id=m.id;
    message_id=m.id;
    select coalesce(array_agg(name),'{}') into paths from storage.objects where bucket_id='my-work-inbox-attachments' and split_part(name,'/',1)=m.id::text;
    return next;
  end loop;
end;$$;
create function public.finish_abandoned_my_work_transfer(p_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
begin
  perform 1 from public.my_work_messages where id=p_id and delivery_status='draft' and upload_state='canceling' for update;
  if not found then return; end if;
  if exists(select 1 from storage.objects where bucket_id='my-work-inbox-attachments' and split_part(name,'/',1)=p_id::text) then raise exception 'Storage cleanup incomplete.'; end if;
  delete from public.my_work_messages where id=p_id;
end;$$;

-- Explicit grants: no new anonymous, public, Admin or service-key browser access.
do $$ declare f text; begin
  foreach f in array array['begin_my_work_attachment_transfer(uuid,uuid,text,uuid,jsonb)','my_work_attachment_transfer_status(uuid)','recover_my_work_attachment_transfer(uuid)','heartbeat_my_work_attachment_transfer(uuid)','cancel_my_work_attachment_transfer(uuid)'] loop
    execute 'revoke all on function public.'||f||' from public,anon,authenticated';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
  foreach f in array array['claim_abandoned_my_work_transfers(integer)','finish_abandoned_my_work_transfer(uuid)','guard_my_work_attachment_object()'] loop
    execute 'revoke all on function public.'||f||' from public,anon,authenticated';
  end loop;
end;$$;
grant execute on function public.claim_abandoned_my_work_transfers(integer),public.finish_abandoned_my_work_transfer(uuid) to service_role;
commit;
