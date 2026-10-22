-- Local candidate only. Product acceptance and separate hosted authorization required.
-- One message/attachment pipeline; existing DMs are not rewritten.
begin;
create table public.my_work_message_groups (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 80),
 creator_user_id uuid not null references public.app_users(user_id), created_at timestamptz not null default clock_timestamp()
);
create table public.my_work_group_members (
 group_id uuid not null references public.my_work_message_groups(id) on delete cascade,
 user_id uuid not null references public.app_users(user_id), joined_at timestamptz not null default clock_timestamp(),
 primary key(group_id,user_id)
);
alter table public.my_work_messages alter column recipient_user_id drop not null;
alter table public.my_work_messages add column group_id uuid references public.my_work_message_groups(id),
 add column reply_to_message_id uuid references public.my_work_messages(id) on delete set null,
 add column is_reply boolean not null default false;
alter table public.my_work_messages add constraint messaging_destination check ((group_id is null) <> (recipient_user_id is null));
alter table public.my_work_messages add constraint messaging_group_sender check(group_id is null or (sender_user_id is not null and sender_kind='user'));
create index messaging_group_page on public.my_work_messages(group_id,created_at desc,id desc) where group_id is not null;
alter table public.my_work_message_deletion_audit alter column original_recipient_user_id drop not null;
alter table public.my_work_message_deletion_audit add column original_group_id uuid;
create index messaging_reply_reference on public.my_work_messages(reply_to_message_id) where reply_to_message_id is not null;
create table public.my_work_group_message_reads (
 message_id uuid not null references public.my_work_messages(id) on delete cascade,
 user_id uuid not null references public.app_users(user_id), read_at timestamptz not null default clock_timestamp(), primary key(message_id,user_id)
);
create function public.is_my_work_group_member(p_group uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.my_work_group_members gm join public.app_users u on u.user_id=gm.user_id
 where gm.group_id=p_group and gm.user_id=p_user and u.is_active);
$$;
-- Arbitrary user membership lookup is internal; public caller can only ask about self.
revoke all on function public.is_my_work_group_member(uuid,uuid) from public,anon,authenticated;
create function public.can_read_my_work_message(p_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.my_work_messages m where m.id=p_id
 and exists(select 1 from public.app_users where user_id=auth.uid() and is_active)
 and case when m.group_id is not null then public.is_my_work_group_member(m.group_id,auth.uid()) and (m.delivery_status='ready' or m.sender_user_id=auth.uid())
 else m.sender_user_id=auth.uid() or (m.recipient_user_id=auth.uid() and m.delivery_status='ready') end);
$$;
revoke all on function public.can_read_my_work_message(uuid) from public,anon;
grant execute on function public.can_read_my_work_message(uuid) to authenticated;
create function public.is_my_work_group_member_self(p_group uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$ select public.is_my_work_group_member(p_group,auth.uid()); $$;
revoke all on function public.is_my_work_group_member_self(uuid) from public,anon;
grant execute on function public.is_my_work_group_member_self(uuid) to authenticated;
alter table public.my_work_message_groups enable row level security;
alter table public.my_work_group_members enable row level security;
alter table public.my_work_group_message_reads enable row level security;
create policy messaging_group_select on public.my_work_message_groups for select to authenticated using(public.is_my_work_group_member_self(id));
create policy messaging_members_select on public.my_work_group_members for select to authenticated using(public.is_my_work_group_member_self(group_id));
create policy messaging_reads_select on public.my_work_group_message_reads for select to authenticated using(user_id=auth.uid() and public.can_read_my_work_message(message_id));
revoke all on public.my_work_message_groups,public.my_work_group_members,public.my_work_group_message_reads from public,anon,authenticated;
grant select on public.my_work_message_groups,public.my_work_group_members,public.my_work_group_message_reads to authenticated;
grant all on public.my_work_message_groups,public.my_work_group_members,public.my_work_group_message_reads to service_role;
drop policy my_work_messages_participant_select on public.my_work_messages;
create policy my_work_messages_participant_select on public.my_work_messages for select to authenticated using(public.can_read_my_work_message(id));
drop policy my_work_message_attachments_participant_select on public.my_work_message_attachments;
create policy my_work_message_attachments_participant_select on public.my_work_message_attachments for select to authenticated using(public.can_read_my_work_message(message_id));
drop policy messaging_preview_participant_select on public.my_work_attachment_previews;
create policy messaging_preview_participant_select on public.my_work_attachment_previews for select to authenticated using(public.can_read_my_work_message(message_id));
drop policy my_work_message_versions_participant_select on public.my_work_message_versions;
create policy my_work_message_versions_participant_select on public.my_work_message_versions for select to authenticated using(public.can_read_my_work_message(message_id));
drop policy my_work_inbox_attachment_object_select on storage.objects;
create policy my_work_inbox_attachment_object_select on storage.objects for select to authenticated using(bucket_id='my-work-inbox-attachments' and exists(
 select 1 from public.my_work_message_attachments a where a.storage_path=name and public.can_read_my_work_message(a.message_id)
 union all select 1 from public.my_work_attachment_previews p where p.storage_path=name and public.can_read_my_work_message(p.message_id)));

create function public.save_my_work_message_group(p_id uuid,p_name text,p_members uuid[])
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare g public.my_work_message_groups; member uuid; audience uuid[];
begin
 perform public.require_app_capability('messaging.write');
 if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'Group name must contain 1–80 characters.'; end if;
 if p_members is null or cardinality(p_members)<2 or cardinality(p_members)>30 or not auth.uid()=any(p_members) then raise exception 'Include yourself and at least one other participant (maximum 30).'; end if;
 if exists(select 1 from unnest(p_members) x where x is null) or (select count(distinct x) from unnest(p_members) x)<>cardinality(p_members) then raise exception 'Invalid participants.'; end if;
 if p_id is not null then
  select * into strict g from public.my_work_message_groups where id=p_id for update;
  if g.creator_user_id<>auth.uid() or not public.is_my_work_group_member(g.id) then raise exception 'Only the group creator can manage this group.' using errcode='42501'; end if;
 end if;
 -- Same recipient visibility as the existing directory. Retaining inactive members is allowed,
 -- but they cannot read; adding an unavailable or hidden user is forbidden.
 foreach member in array p_members loop
  if member<>auth.uid() and not exists(select 1 from public.my_work_group_members where group_id=p_id and user_id=member)
   and not exists(select 1 from public.list_my_work_inbox_recipients() r where r.user_id=member) then raise exception 'Participant unavailable.' using errcode='42501'; end if;
 end loop;
 if p_id is null then insert into public.my_work_message_groups(name,creator_user_id) values(btrim(p_name),auth.uid()) returning * into g;
 else update public.my_work_message_groups set name=btrim(p_name) where id=g.id; end if;
 select array_agg(user_id) into audience from public.my_work_group_members where group_id=g.id;
 delete from public.my_work_group_members where group_id=g.id and not user_id=any(p_members);
 insert into public.my_work_group_members(group_id,user_id) select g.id,x from unnest(p_members) x on conflict do nothing;
 -- Personal events contain IDs only. Removed members also revalidate their UI.
 for member in select unnest(coalesce(audience,'{}'::uuid[])||p_members) loop
  perform realtime.send(jsonb_build_object('group_id',g.id),'overview_changed','my-work-inbox:'||member::text,true);
 end loop;
 return g.id;
end;$$;

-- Enforce destination/reply scope for both current and legacy entry points.
create function public.guard_my_work_message_scope() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare original public.my_work_messages;
begin
 if tg_op='UPDATE' and (new.group_id,new.recipient_user_id,new.sender_user_id) is distinct from (old.group_id,old.recipient_user_id,old.sender_user_id) then raise exception 'Message destination is immutable.'; end if;
 if new.group_id is not null and (tg_op='INSERT' or new.delivery_status is distinct from old.delivery_status or new.body is distinct from old.body) then
  perform 1 from public.my_work_message_groups where id=new.group_id for update;
  if not public.is_my_work_group_member(new.group_id,new.sender_user_id) then raise exception 'Current group membership required.' using errcode='42501'; end if;
 end if;
 if tg_op='INSERT' and new.reply_to_message_id is not null then
  select * into strict original from public.my_work_messages where id=new.reply_to_message_id and delivery_status='ready' for key share;
  if not public.can_read_my_work_message(original.id) or
   (case when new.group_id is not null then original.group_id is distinct from new.group_id
   else original.group_id is not null or not ((original.sender_user_id=new.sender_user_id and original.recipient_user_id=new.recipient_user_id) or (original.sender_user_id=new.recipient_user_id and original.recipient_user_id=new.sender_user_id)) end)
  then raise exception 'Reply original unavailable in this conversation.' using errcode='42501'; end if;
  new.is_reply=true;
 end if;
 return new;
end;$$;
create trigger messaging_scope_guard before insert or update on public.my_work_messages for each row execute function public.guard_my_work_message_scope();

create function public.send_my_work_message_v12(p_peer uuid,p_body text,p_reply uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid; is_group boolean;
begin
 perform public.require_app_capability('messaging.write');
 is_group=exists(select 1 from public.my_work_message_groups where id=p_peer);
 if is_group then
  perform 1 from public.my_work_message_groups where id=p_peer for update;
  if not public.is_my_work_group_member(p_peer) then raise exception 'Group unavailable.' using errcode='42501'; end if;
 else
  if not exists(select 1 from public.list_my_work_inbox_recipients() where user_id=p_peer) then raise exception 'Recipient unavailable.' using errcode='42501'; end if;
 end if;
 if nullif(btrim(p_body),'') is null or length(btrim(p_body))>10000 then raise exception 'Message must contain 1–10000 characters.'; end if;
 insert into public.my_work_messages(sender_user_id,recipient_user_id,group_id,body,reply_to_message_id)
 values(auth.uid(),case when not is_group then p_peer end,case when is_group then p_peer end,btrim(p_body),p_reply) returning id into result;
 -- DM notification contract stays identical, now emitted here rather than by legacy send.
 if not is_group then
 insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
 select p_peer,'inbox-message:'||result,'inbox_message',display_name||' sent you a message','Open Inbox to read it.',jsonb_build_object('message_id',result,'conversation_user_id',auth.uid(),'purpose','open-my-work-inbox') from public.app_users where user_id=auth.uid();
 end if;
 return result;
end;$$;

create function public.deliver_my_work_group_message() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare member uuid; title text;
begin
 if new.group_id is null or new.delivery_status<>'ready' then return null; end if;
 if tg_op='UPDATE' and old.delivery_status='ready' then return null; end if;
 select name into title from public.my_work_message_groups where id=new.group_id;
 insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
 select gm.user_id,'inbox-message:'||new.id,'inbox_message',title||' · New message','Open Inbox to read it.',
 jsonb_build_object('message_id',new.id,'conversation_user_id',new.group_id,'group_id',new.group_id,'purpose','open-my-work-inbox')
 from public.my_work_group_members gm join public.app_users u on u.user_id=gm.user_id and u.is_active
 where gm.group_id=new.group_id and gm.user_id<>new.sender_user_id on conflict(user_id,notification_key) do nothing;
 return null;
end;$$;
create trigger deliver_my_work_group_message after insert or update on public.my_work_messages for each row execute function public.deliver_my_work_group_message();

create function public.mark_my_work_conversation_read_v12(p_peer uuid,p_ids uuid[])
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501'; end if;
 -- Only delivered rows actually observed by this client; no timestamp race with incoming messages.
 insert into public.my_work_group_message_reads(message_id,user_id)
 select m.id,auth.uid() from public.my_work_messages m where m.id=any(p_ids[1:200]) and m.group_id=p_peer and m.delivery_status='ready' and m.sender_user_id<>auth.uid() and public.is_my_work_group_member(p_peer)
 on conflict do nothing;
 update public.my_work_messages set read_at=clock_timestamp() where id=any(p_ids[1:200]) and (sender_user_id=p_peer or (p_peer='00000000-0000-0000-0000-000000000001'::uuid and sender_kind='system' and sender_user_id is null)) and recipient_user_id=auth.uid() and read_at is null;
end;$$;
create function public.list_my_work_message_page_v12(p_peer uuid,p_before_time timestamptz default null,p_before_id uuid default null,p_ids uuid[] default null)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
with page as (
 select m.* from public.my_work_messages m
 where m.delivery_status='ready'
 and exists(select 1 from public.app_users where user_id=auth.uid() and is_active)
 and public.can_read_my_work_message(m.id)
 and (m.group_id=p_peer or (m.group_id is null and ((m.sender_user_id=auth.uid() and m.recipient_user_id=p_peer) or (m.recipient_user_id=auth.uid() and coalesce(m.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid)=p_peer))))
 and (p_ids is null or m.id=any(p_ids[1:40]))
 and (p_before_time is null or (m.created_at,m.id)<(p_before_time,p_before_id))
 order by m.created_at desc,m.id desc limit 40
)
select coalesce(jsonb_agg(row order by created_at,id),'[]') from (
 select m.created_at,m.id,jsonb_build_object(
 'id',m.id,'sender_user_id',coalesce(m.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid),
 'sender_name',coalesce(s.display_name,'TenOps'),'recipient_user_id',m.recipient_user_id,'recipient_name',r.display_name,
 'group_id',m.group_id,'is_reply',m.is_reply,'reply_to_message_id',m.reply_to_message_id,
 'reply', (select jsonb_build_object('id',o.id,'senderName',coalesce(u.display_name,'TenOps'),'body',left(o.body,180),'hasAttachments',exists(select 1 from public.my_work_message_attachments where message_id=o.id)) from public.my_work_messages o left join public.app_users u on u.user_id=o.sender_user_id where o.id=m.reply_to_message_id and public.can_read_my_work_message(o.id) and o.delivery_status='ready'),
 'body',m.body,'job_id',m.job_id,'job_number',j.job_number,'job_name',j.name,'read_at',case when m.group_id is null then m.read_at else (select read_at from public.my_work_group_message_reads where message_id=m.id and user_id=auth.uid()) end,'created_at',m.created_at,'edited_at',m.edited_at,
 'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'message_id',a.message_id,'storage_path',a.storage_path,'original_filename',a.original_filename,
 'content_type',a.content_type,'byte_size',a.byte_size,'created_at',a.created_at,'preview',case when p.ready then jsonb_build_object('path',p.storage_path,'bytes',p.byte_size,'width',p.width,'height',p.height) else null end) order by a.created_at,a.id)
 from public.my_work_message_attachments a left join public.my_work_attachment_previews p on p.attachment_id=a.id where a.message_id=m.id),'[]')) as row
 from page m left join public.app_users s on s.user_id=m.sender_user_id left join public.app_users r on r.user_id=m.recipient_user_id left join public.jobs j on j.id=m.job_id
) rows;
$$;


create function public.list_my_work_conversations_v12() returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
with visible as (
 select m.*,coalesce(m.group_id,case when m.sender_user_id=auth.uid() then m.recipient_user_id else coalesce(m.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid) end) peer,
 case when m.group_id is null then m.recipient_user_id=auth.uid() and m.read_at is null else m.sender_user_id<>auth.uid() and not exists(select 1 from public.my_work_group_message_reads r where r.message_id=m.id and r.user_id=auth.uid()) end unread
 from public.my_work_messages m where m.delivery_status='ready' and public.can_read_my_work_message(m.id)
), ranked as (
 select *,row_number() over(partition by peer order by created_at desc,id desc) rank,count(*) filter(where unread) over(partition by peer) unread_count from visible
), summaries as (
 select m.peer,m.created_at,m.id,jsonb_build_object('userId',m.peer,'name',coalesce(g.name,u.display_name,'TenOps'),'role',case when g.id is not null then 'Group' else coalesce(u.role,'System') end,
 'groupId',g.id,'creatorUserId',g.creator_user_id,'memberIds',case when g.id is not null then (select jsonb_agg(user_id order by user_id) from public.my_work_group_members where group_id=g.id) end,
 'unread',m.unread_count,'latest',jsonb_build_object('id',m.id,'createdAt',m.created_at,'body',case when m.body='' then 'Attachment' else left(m.body,180) end)) item
 from ranked m left join public.app_users u on u.user_id=m.peer left join public.my_work_message_groups g on g.id=m.group_id where rank=1
 union all
 select g.id,g.created_at,g.id,jsonb_build_object('userId',g.id,'name',g.name,'role','Group','groupId',g.id,'creatorUserId',g.creator_user_id,
 'memberIds',(select jsonb_agg(user_id order by user_id) from public.my_work_group_members where group_id=g.id),'unread',0,'latest',jsonb_build_object('id',g.id,'createdAt',g.created_at,'body','No messages yet'))
 from public.my_work_message_groups g where public.is_my_work_group_member(g.id) and not exists(select 1 from visible where group_id=g.id)
)
select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]') from summaries;
$$;
CREATE FUNCTION public.begin_my_work_attachment_transfer_v12(p_id uuid, p_recipient uuid, p_body text, p_job uuid, p_files jsonb, p_reply uuid default null)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare existing public.my_work_messages%rowtype; request jsonb; item jsonb; total bigint; actor public.app_users%rowtype; is_group boolean;
begin
  perform public.require_app_capability('messaging.write');
  is_group=exists(select 1 from public.my_work_message_groups where id=p_recipient);
  if is_group then
   perform 1 from public.my_work_message_groups where id=p_recipient for update;
   if not public.is_my_work_group_member(p_recipient) then raise exception 'Group unavailable.' using errcode='42501'; end if;
  end if;
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_id is null or p_recipient is null or p_recipient=auth.uid() then raise exception 'Choose another recipient.'; end if;
  request=jsonb_build_object('recipient',p_recipient,'body',btrim(p_body),'job',p_job,'files',p_files,'reply',p_reply);
  -- Serializes concurrent calls even before the message row exists.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.my_work_messages where id=p_id for update;
  if found then
    if existing.sender_user_id<>auth.uid() or (jsonb_build_object('reply',null)||existing.upload_request) is distinct from request then raise exception 'Transfer identity does not match.' using errcode='42501'; end if;
    if existing.delivery_status='draft' and existing.upload_state='active' then update public.my_work_messages set upload_touched_at=clock_timestamp() where id=p_id; end if;
    return;
  end if;
  if not is_group and not exists(select 1 from public.app_users where user_id=p_recipient and is_active and (role<>'developer' or actor.role='admin')) then raise exception 'Recipient unavailable.'; end if;
  if p_body is null or length(btrim(p_body))>10000 then raise exception 'Message must contain at most 10000 characters.'; end if;
  if p_job is not null and not exists(select 1 from public.jobs where id=p_job) then raise exception 'Job unavailable.'; end if;
  if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)<1 or p_files is null then raise exception 'Attachments required.'; end if;
  select sum((x->>'size')::bigint) into total from jsonb_array_elements(p_files) x;
  if total is null or total>200000000 then raise exception 'Attachments exceed 200 MB/message.'; end if;
  if exists(select 1 from public.my_work_message_deletion_audit where deleted_message_id=p_id) then raise exception 'This message was permanently deleted.'; end if;
  insert into public.my_work_messages(id,sender_user_id,recipient_user_id,body,job_id,delivery_status,upload_request,upload_state,upload_touched_at,group_id,reply_to_message_id)
  values(p_id,auth.uid(),case when not is_group then p_recipient end,btrim(p_body),p_job,'draft',request,'active',clock_timestamp(),case when is_group then p_recipient end,p_reply);
  for item in select * from jsonb_array_elements(p_files) loop
    if (item->>'size') is null or (item->>'name') is null or (item->>'id') is null or (item->>'contentType') is null then raise exception 'Invalid file manifest.'; end if;
    insert into public.my_work_message_attachments(id,message_id,uploader_user_id,storage_path,original_filename,content_type,byte_size)
    values((item->>'id')::uuid,p_id,auth.uid(),p_id::text||'/'||(item->>'id')::uuid::text||'/file',item->>'name',item->>'contentType',(item->>'size')::bigint);
  end loop;
end;$function$
;

create or replace function public.finalize_my_work_inbox_message(p_message_id uuid,p_expected_attachment_count integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare m public.my_work_messages%rowtype; actor public.app_users%rowtype; n integer; total bigint;
begin
  perform public.require_app_capability('messaging.write');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict m from public.my_work_messages where id=p_message_id and sender_user_id=auth.uid() for update;
  if m.upload_request is null then raise exception 'Refresh Messaging before sending attachments.'; end if;
  select count(*),sum(byte_size) into n,total from public.my_work_message_attachments where message_id=m.id;
  if p_expected_attachment_count is null or p_expected_attachment_count<1 or n<>p_expected_attachment_count or total>200000000 then raise exception 'Attachment manifest incomplete or too large.'; end if;
  if m.delivery_status='ready' then return; end if;
  if m.upload_state is distinct from 'active' then raise exception 'Transfer canceled.'; end if;
  if exists(select 1 from public.my_work_message_attachments a left join storage.objects o on o.bucket_id='my-work-inbox-attachments' and o.name=a.storage_path
    where a.message_id=m.id and (o.id is null or (o.metadata->>'size')::bigint is distinct from a.byte_size)) then raise exception 'Attachment bytes are incomplete.'; end if;
  update public.my_work_messages set delivery_status='ready',upload_state=null where id=m.id;
  if m.group_id is null then
  insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
  values(m.recipient_user_id,'inbox-message:'||m.id,'inbox_message',actor.display_name||' sent you a message','Open Inbox to read it.',jsonb_strip_nulls(jsonb_build_object('message_id',m.id,'conversation_user_id',actor.user_id,'job_id',m.job_id,'purpose','open-my-work-inbox')))
  on conflict(user_id,notification_key) do nothing;
  end if;
end;$$;

create or replace function public.broadcast_my_work_message_v11() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.my_work_messages%rowtype; topic text; kind text; member uuid;
begin
 if tg_op='DELETE' then m=old; else m=new; end if;
 if m.delivery_status<>'ready' or m.sender_user_id is null then return null; end if;
 for member in select user_id from public.my_work_group_members where group_id=m.group_id union select m.sender_user_id where m.group_id is null union select m.recipient_user_id where m.group_id is null loop
  perform realtime.send(jsonb_build_object('id',m.id,'peer',coalesce(m.group_id,case when member=m.sender_user_id then m.recipient_user_id else m.sender_user_id end)),'overview_changed','my-work-inbox:'||member::text,true);
 end loop;
 if m.group_id is not null then return null; end if;
 topic='my-work-typing:'||least(m.sender_user_id::text,m.recipient_user_id::text)||':'||greatest(m.sender_user_id::text,m.recipient_user_id::text);
 kind=case when tg_op='DELETE' then 'delete' when tg_op='INSERT' then 'new' when old.delivery_status='draft' then 'new' else 'update' end;
 perform realtime.send(jsonb_build_object('id',m.id,'kind',kind),'message_changed',topic,true);
 return null;
end;$$;

create policy messaging_personal_broadcast_read on realtime.messages for select to authenticated using(
 extension='broadcast' and realtime.topic()='my-work-inbox:'||auth.uid()::text and exists(select 1 from public.app_users where user_id=auth.uid() and is_active));

do $$declare f record; definition text; changed text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('list_my_work_inbox_messages','list_my_work_message_page_v11','list_my_work_conversations_v11') loop
  definition:=pg_get_functiondef(f.oid);
  changed:=replace(definition,'from public.my_work_messages message','from (select * from public.my_work_messages where group_id is null) message');
  changed:=replace(changed,'from public.my_work_messages m','from (select * from public.my_work_messages where group_id is null) m');
  if changed=definition then raise exception 'Legacy Messaging read prerequisite drift: %',f.proname; end if;
  execute changed;
 end loop;
end$$;

do $$declare f record; definition text; needle text; replacement text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('recover_my_work_attachment_transfer','my_work_attachment_transfer_status','edit_my_work_inbox_message') loop
  definition:=pg_get_functiondef(f.oid); needle:='begin';
  replacement:='begin
  if exists(select 1 from public.my_work_messages where id='||case when f.proname='edit_my_work_inbox_message' then 'p_message_id' else 'p_id' end||' and group_id is not null and not public.is_my_work_group_member(group_id)) then raise exception ''Message unavailable.'' using errcode=''42501''; end if;';
  if f.proname='recover_my_work_attachment_transfer' then definition:=replace(definition,'''entries'',m.upload_request->''files''','''replyTo'',m.upload_request->''reply'',''entries'',m.upload_request->''files'''); end if;
  execute replace(definition,needle,replacement);
 end loop;
end$$;
create or replace function public.guard_tenops_notification_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.app_users where user_id=auth.uid() and read_only) then
   if tg_op='INSERT' and new.notification_type='inbox_message' and exists(
     select 1 from public.my_work_messages m where m.id::text=new.metadata->>'message_id'
       and m.sender_user_id=auth.uid() and (m.recipient_user_id=new.user_id or (m.group_id is not null and public.is_my_work_group_member(m.group_id,new.user_id)))
   ) and public.has_app_capability('messaging.write') then return new; end if;
   if tg_op='UPDATE' and old.user_id=auth.uid() and
     (to_jsonb(old)-'read_at')=(to_jsonb(new)-'read_at') then return new; end if;
   raise exception 'TenOps business write denied.' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;$$;
create or replace function public.web_push_source(p_notification uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare n public.account_notifications; result jsonb; source_id uuid;
begin
 select * into n from public.account_notifications where id=p_notification;
 if not found or not exists(select 1 from public.app_users where user_id=n.user_id and is_active) then return null;end if;
 if n.notification_type='inbox_message' then
   if coalesce(n.metadata->>'message_id','') !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
   source_id:=(n.metadata->>'message_id')::uuid;
   select jsonb_build_object('kind',case when m.group_id is null then 'dm' else 'group' end,'group_name',(select name from public.my_work_message_groups where id=m.group_id),'sender',sender.display_name,'text',m.body,'conversation_user_id',coalesce(m.group_id,m.sender_user_id),'message_id',m.id,
    'attachment_only',exists(select 1 from public.my_work_message_attachments a where a.message_id=m.id) and (nullif(btrim(m.body),'') is null or m.body='[Attachments]')) into result
   from public.my_work_messages m join public.app_users sender on sender.user_id=m.sender_user_id
   where m.id=source_id and (m.recipient_user_id=n.user_id or (m.group_id is not null and m.sender_user_id<>n.user_id and public.is_my_work_group_member(m.group_id,n.user_id))) and m.delivery_status='ready' and (case when m.group_id is null then m.read_at is null else not exists(select 1 from public.my_work_group_message_reads where message_id=m.id and user_id=n.user_id) end)
    and m.sender_user_id<>'00000000-0000-0000-0000-000000000001' and coalesce(to_jsonb(m)->>'sender_kind','user')='user'
    and n.notification_key='inbox-message:'||m.id::text;
 elsif n.notification_type='job_update_mention' then
   if coalesce(n.metadata->>'update_id','') !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
   source_id:=(n.metadata->>'update_id')::uuid;
   select jsonb_build_object('kind','mention','sender',coalesce(author.display_name,u.author_name),'text',u.body,'job',j.job_number,'job_id',j.id,'update_id',u.id) into result
   from public.job_updates u join public.jobs j on j.id=u.job_id left join public.app_users author on author.user_id=u.author_user_id
   where u.id=source_id and n.notification_key='job-update-mention:'||u.id::text
    and exists(select 1 from public.job_update_mentions m where m.job_update_id=u.id and m.user_id=n.user_id)
    and exists(select 1 from public.app_users a join public.app_role_capabilities c on c.role=a.role where a.user_id=n.user_id and a.is_active and c.capability='readOperationalData');
 end if;
 return result;
exception when invalid_text_representation then return null;
end;$$;

create or replace function public.resolve_my_push_notification(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare n public.account_notifications;result jsonb;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501';end if;
 select * into n from public.account_notifications where id=p_id and user_id=auth.uid();if not found then return null;end if;
 if n.notification_type='inbox_message' then
  select jsonb_build_object('kind','dm','conversation_user_id',coalesce(m.group_id,m.sender_user_id)) into result from public.my_work_messages m
   where m.id::text=n.metadata->>'message_id' and (m.recipient_user_id=auth.uid() or (m.group_id is not null and public.is_my_work_group_member(m.group_id))) and m.delivery_status='ready'
    and coalesce(to_jsonb(m)->>'sender_kind','user')='user';
 elsif n.notification_type='job_update_mention' then
  result:=public.web_push_source(p_id);
  if result is not null then result:=jsonb_build_object('kind','mention','job_id',result->>'job_id','update_id',result->>'update_id');end if;
 end if;return result;
end;$$;


-- Receipt changes invalidate the owner's badge on every device, without content.
create function public.broadcast_my_work_group_read() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform realtime.send(jsonb_build_object('id',new.message_id),'overview_changed','my-work-inbox:'||new.user_id::text,true); return null;
end;$$;
revoke all on function public.broadcast_my_work_group_read() from public,anon,authenticated;
create trigger messaging_group_read_changed after insert on public.my_work_group_message_reads for each row execute function public.broadcast_my_work_group_read();

-- Explicit RPC grants; helpers and trigger functions are never caller entry points.
do $$declare f record;
begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
 'save_my_work_message_group','send_my_work_message_v12','mark_my_work_conversation_read_v12','list_my_work_message_page_v12','list_my_work_conversations_v12','begin_my_work_attachment_transfer_v12','guard_my_work_message_scope','deliver_my_work_group_message') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname not in ('guard_my_work_message_scope','deliver_my_work_group_message') then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end$$;
CREATE OR REPLACE FUNCTION public.admin_permanently_delete_my_work_message(p_message_id uuid, p_confirmation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'storage'
AS $function$
declare message public.my_work_messages%rowtype; attachment_total integer;
begin
  perform public.require_app_capability('messaging.write');
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
    deleted_message_id,actor_user_id,original_sender_user_id,original_recipient_user_id,original_group_id,attachment_count
  ) values(message.id,auth.uid(),message.sender_user_id,message.recipient_user_id,message.group_id,attachment_total);
  delete from public.account_notifications
  where notification_key='inbox-message:'||message.id::text or metadata->>'message_id'=message.id::text;
  delete from public.my_work_messages where id=message.id;
end;$function$
;


notify pgrst,'reload schema';
commit;
