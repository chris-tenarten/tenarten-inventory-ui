-- LOCAL CANDIDATE ONLY: trusted rich release announcements; no policies/grants widened.
begin;
alter table public.tenops_release_communications
  add column recipient_user_ids uuid[],
  add column attachment_manifest jsonb,
  add column attachment_uploader_user_id uuid references public.app_users(user_id),
  add constraint tenops_rich_release_shape check (
    (recipient_user_ids is null and attachment_manifest is null and attachment_uploader_user_id is null)
    or (recipient_user_ids is not null and cardinality(recipient_user_ids)>0
        and attachment_manifest is not null and jsonb_typeof(attachment_manifest)='array'
        and jsonb_array_length(attachment_manifest) between 1 and 5
        and attachment_uploader_user_id is not null and channel='system_inbox' and not deliver_to_future_users)
  );
do $$ begin if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.deliver_tenops_release_communication_to_user(text,uuid)'::regprocedure) is distinct from '03878730216436300b326b5119ec2b1b' then raise exception 'Release publisher prerequisite drift: deliver_tenops_release_communication_to_user'; end if; end $$;
do $$ begin if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.deliver_tenops_release_communication(text)'::regprocedure) is distinct from '468ecfc4f13911755aaf08789b10b773' then raise exception 'Release publisher prerequisite drift: deliver_tenops_release_communication'; end if; end $$;

create function public.prepare_tenops_rich_release_communication(
 p_key text,p_title text,p_body text,p_recipients uuid[],p_files jsonb,p_uploader uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.tenops_release_communications%rowtype; m public.my_work_messages%rowtype;
 recipient uuid; file jsonb; a uuid; n integer; result jsonb:='[]'; files jsonb; request jsonb;
begin
 if p_recipients is null or cardinality(p_recipients)<1 or cardinality(p_recipients)>100
 or cardinality(p_recipients)<>(select count(distinct id) from unnest(p_recipients) id)
 or exists(select 1 from unnest(p_recipients) id left join public.app_users u on u.user_id=id where u.user_id is null or not u.is_active)
 then raise exception 'Unique active recipient identities required.' using errcode='22023'; end if;
 if not exists(select 1 from public.app_users where user_id=p_uploader and is_active and role='admin')
 then raise exception 'Active Admin uploader audit identity required.' using errcode='42501'; end if;
 if p_files is null or jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 5
 then raise exception 'One to five image attachments required.'; end if;
 for file in select value from jsonb_array_elements(p_files) loop
  if not(file ?& array['name','size','width','height','sha256']) or jsonb_typeof(file->'name')<>'string'
   or exists(select 1 from jsonb_each(file) pair where pair.key=any(array['name','size','width','height','sha256']) and pair.value='null'::jsonb)
   or length(file->>'name') not between 1 and 500 or (file->>'size')::integer not between 1 and 196608
   or (file->>'width')::integer not between 1 and 1280 or (file->>'height')::integer not between 1 and 1280
   or (file->>'sha256')!~'^[0-9a-f]{64}$' then raise exception 'Invalid bounded JPEG manifest.'; end if;
 end loop;
 insert into public.tenops_release_communications(communication_key,channel,title,body,deliver_to_future_users,recipient_user_ids,attachment_manifest,attachment_uploader_user_id)
 values(p_key,'system_inbox',p_title,p_body,false,p_recipients,p_files,p_uploader) on conflict do nothing;
 select * into strict c from public.tenops_release_communications where communication_key=p_key for update;
 if (c.title,c.body,c.recipient_user_ids,c.attachment_manifest,c.attachment_uploader_user_id,c.channel,c.deliver_to_future_users,c.is_active)
 is distinct from (p_title,p_body,p_recipients,p_files,p_uploader,'system_inbox'::text,false,true)
 then raise exception 'Existing announcement differs; refusing overwrite.'; end if;
 request:=jsonb_build_object('rich_release',p_key,'manifest',p_files,'verified',false);
 foreach recipient in array p_recipients loop
  insert into public.my_work_messages(sender_user_id,recipient_user_id,body,delivery_status,sender_kind,system_sender_key,system_message_key,upload_request,upload_state,upload_touched_at)
  values(null,recipient,p_title||E'\n\n'||p_body,'draft','system','tenops',p_key,request,'active',clock_timestamp())
  on conflict(recipient_user_id,system_message_key) where system_message_key is not null do nothing;
  select * into strict m from public.my_work_messages where recipient_user_id=recipient and system_message_key=p_key for update;
  if m.sender_kind<>'system' or m.system_sender_key<>'tenops' or m.sender_user_id is not null
   or m.body is distinct from p_title||E'\n\n'||p_body or m.upload_request->'manifest' is distinct from p_files
   or (m.delivery_status='draft' and m.upload_state is distinct from 'active')
  then raise exception 'Existing system message differs or requires draft cleanup.'; end if;
  if m.delivery_status='draft' then
   update public.my_work_messages set upload_touched_at=clock_timestamp() where id=m.id;
   if not exists(select 1 from public.my_work_message_attachments where message_id=m.id) then
    n:=0;
    for file in select value from jsonb_array_elements(p_files) loop
     n:=n+1;a:=gen_random_uuid();
     insert into public.my_work_message_attachments(id,message_id,uploader_user_id,storage_path,original_filename,content_type,byte_size,created_at)
     values(a,m.id,p_uploader,m.id::text||'/'||a::text||'/file',file->>'name','image/jpeg',(file->>'size')::integer,m.created_at+n*interval '1 microsecond');
     insert into public.my_work_attachment_previews(attachment_id,message_id,storage_path,byte_size,width,height)
     values(a,m.id,m.id::text||'/'||a::text||'/preview.jpg',(file->>'size')::integer,(file->>'width')::integer,(file->>'height')::integer);
    end loop;
   end if;
  end if;
  select jsonb_agg(jsonb_build_object('id',a.id,'path',a.storage_path,'previewPath',p.storage_path,'name',a.original_filename,'size',a.byte_size) order by a.created_at,a.id)
   into files from public.my_work_message_attachments a join public.my_work_attachment_previews p on p.attachment_id=a.id where a.message_id=m.id;
  if jsonb_array_length(files) is distinct from jsonb_array_length(p_files) then raise exception 'Attachment reservation differs.'; end if;
  result:=result||jsonb_build_array(jsonb_build_object('recipient',recipient,'messageId',m.id,'status',m.delivery_status,'files',files));
 end loop;
 return result;
end;$$;
create or replace function public.deliver_tenops_release_communication_to_user(p_communication_key text,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare communication public.tenops_release_communications%rowtype; inserted_id uuid; v_message_id uuid;
begin
  select * into strict communication from public.tenops_release_communications
  where communication_key=p_communication_key and is_active;
  if not exists(select 1 from public.app_users where user_id=p_user_id and is_active) then return false; end if;

  if communication.attachment_manifest is not null then
    if not(p_user_id=any(communication.recipient_user_ids)) then return false; end if;
    select id into strict v_message_id from public.my_work_messages where recipient_user_id=p_user_id and system_message_key=p_communication_key for update;
    if exists(select 1 from public.my_work_messages where id=v_message_id and delivery_status='draft') then
      if not exists(select 1 from public.my_work_messages where id=v_message_id and upload_state='active' and upload_request->>'verified'='true')
      then raise exception 'Complete verified walkthrough required before publication.'; end if;
      if (select count(*) from public.my_work_message_attachments where my_work_message_attachments.message_id=v_message_id)<>jsonb_array_length(communication.attachment_manifest)
      or exists(select 1 from public.my_work_message_attachments a
       left join public.my_work_attachment_previews p on p.attachment_id=a.id
       left join storage.objects o on o.bucket_id='my-work-inbox-attachments' and o.name=a.storage_path
       left join storage.objects po on po.bucket_id='my-work-inbox-attachments' and po.name=p.storage_path
       where a.message_id=v_message_id and (p.ready is distinct from true or o.id is null or po.id is null
        or (o.metadata->>'size')::bigint is distinct from a.byte_size or o.metadata->>'mimetype' is distinct from 'application/octet-stream'
        or (po.metadata->>'size')::bigint is distinct from p.byte_size or po.metadata->>'mimetype' is distinct from 'application/octet-stream'))
      then raise exception 'Complete stored walkthrough required before publication.'; end if;
      update public.my_work_messages set delivery_status='ready',upload_state=null where id=v_message_id;
      inserted_id:=v_message_id;
    end if;
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(p_user_id,'inbox-system-message:'||communication.communication_key,'inbox_message','TenOps sent you a message','Open Inbox to read it.',
     jsonb_build_object('message_id',v_message_id,'conversation_user_id','00000000-0000-0000-0000-000000000001','purpose','open-my-work-inbox'))
    on conflict(user_id,notification_key) do nothing;
    return inserted_id is not null;
  end if;
  if communication.channel='account_notification' then
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(p_user_id,'system-announcement:'||communication.communication_key,'feature_announcement',communication.title,communication.body,
      jsonb_strip_nulls(jsonb_build_object('announcement_key',communication.communication_key,'destination',communication.destination,'purpose','open-destination')))
    on conflict(user_id,notification_key) do nothing returning id into inserted_id;
  else
    insert into public.my_work_messages(sender_user_id,recipient_user_id,body,read_at,delivery_status,sender_kind,system_sender_key,system_message_key)
    values(null,p_user_id,communication.body,null,'ready','system','tenops',communication.communication_key)
    on conflict(recipient_user_id,system_message_key) where system_message_key is not null do nothing returning id into inserted_id;

    v_message_id:=inserted_id;
    if v_message_id is null then
      select id into v_message_id from public.my_work_messages
      where recipient_user_id=p_user_id and system_message_key=communication.communication_key;
    end if;

    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(p_user_id,'inbox-system-message:'||communication.communication_key,'inbox_message','TenOps sent you a message','Open Inbox to read it.',
      jsonb_build_object('message_id',v_message_id,'conversation_user_id','00000000-0000-0000-0000-000000000001','purpose','open-my-work-inbox'))
    on conflict(user_id,notification_key) do nothing;
  end if;
  return inserted_id is not null;
end;$$;
create or replace function public.deliver_tenops_release_communication(p_communication_key text)
returns table(communication_key text,eligible integer,delivered integer,already_present integer,ineligible integer)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare recipient record; delivered_count integer:=0; eligible_count integer; ineligible_count integer;
begin
  if not exists(select 1 from public.tenops_release_communications where tenops_release_communications.communication_key=p_communication_key and is_active) then
    raise exception 'Unknown or inactive TenOps release communication.' using errcode='22023';
  end if;
  if exists(select 1 from public.tenops_release_communications c where c.communication_key=p_communication_key and c.attachment_manifest is not null) then
    select count(*) filter(where u.is_active),count(*) filter(where not coalesce(u.is_active,false)) into eligible_count,ineligible_count
    from public.tenops_release_communications c cross join unnest(c.recipient_user_ids) id left join public.app_users u on u.user_id=id where c.communication_key=p_communication_key;
    for recipient in select unnest(c.recipient_user_ids) as user_id from public.tenops_release_communications c where c.communication_key=p_communication_key loop
      if public.deliver_tenops_release_communication_to_user(p_communication_key,recipient.user_id) then delivered_count:=delivered_count+1; end if;
    end loop;
    return query select p_communication_key,eligible_count,delivered_count,eligible_count-delivered_count,ineligible_count;
    return;
  end if;
  select count(*) filter(where is_active),count(*) filter(where not is_active)
    into eligible_count,ineligible_count from public.app_users;
  for recipient in select user_id from public.app_users where is_active order by user_id loop
    if public.deliver_tenops_release_communication_to_user(p_communication_key,recipient.user_id) then
      delivered_count:=delivered_count+1;
    end if;
  end loop;
  return query select p_communication_key,eligible_count,delivered_count,eligible_count-delivered_count,ineligible_count;
end;$$;

-- The trusted uploader attests hashes only AFTER downloading/verifying both private objects.
-- Browser roles cannot call this or mutate system drafts. Hash verification stays server-side.
create function public.complete_tenops_rich_release_message(p_key text,p_recipient uuid,p_verified_sha256 jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.tenops_release_communications%rowtype; m public.my_work_messages%rowtype; expected jsonb;
begin
 select * into strict c from public.tenops_release_communications where communication_key=p_key and is_active and attachment_manifest is not null for update;
 if not(p_recipient=any(c.recipient_user_ids)) or not exists(select 1 from public.app_users where user_id=p_recipient and is_active)
 then raise exception 'Recipient is not an active approved audience member.' using errcode='42501'; end if;
 select jsonb_agg(value->'sha256' order by ord) into expected from jsonb_array_elements(c.attachment_manifest) with ordinality f(value,ord);
 if p_verified_sha256 is distinct from expected then raise exception 'Verified screenshot hashes differ.'; end if;
 select * into strict m from public.my_work_messages where recipient_user_id=p_recipient and system_message_key=p_key for update;
 if m.delivery_status='draft' then
  if m.upload_state is distinct from 'active' then raise exception 'Draft requires cleanup before retry.'; end if;
  update public.my_work_messages set upload_request=jsonb_set(upload_request,'{verified}','true'),upload_touched_at=clock_timestamp() where id=m.id;
 end if;
 return public.deliver_tenops_release_communication_to_user(p_key,p_recipient);
end;$$;
revoke all on function public.prepare_tenops_rich_release_communication(text,text,text,uuid[],jsonb,uuid) from public,anon,authenticated;
revoke all on function public.complete_tenops_rich_release_message(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_tenops_rich_release_communication(text,text,text,uuid[],jsonb,uuid) to service_role;
grant execute on function public.complete_tenops_rich_release_message(text,uuid,jsonb) to service_role;
-- Preserve established trusted-only publisher boundary, including explicit default grants.
revoke all on function public.deliver_tenops_release_communication(text) from public,anon,authenticated;
revoke all on function public.deliver_tenops_release_communication_to_user(text,uuid) from public,anon,authenticated;
grant execute on function public.deliver_tenops_release_communication(text) to service_role;
commit;
