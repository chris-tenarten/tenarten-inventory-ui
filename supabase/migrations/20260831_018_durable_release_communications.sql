-- Durable, idempotent TenOps-authored release announcements and Inbox onboarding.
-- Existing notification/message rows and read state are preserved.
begin;

create table public.tenops_release_communications (
  communication_key text primary key check (communication_key ~ '^[a-z0-9][a-z0-9_]{2,99}$'),
  channel text not null check (channel in ('account_notification','system_inbox')),
  title text not null check (btrim(title) <> ''),
  body text not null check (btrim(body) <> ''),
  destination text,
  deliver_to_future_users boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  constraint tenops_release_destination_shape check (destination is null or destination ~ '^/[a-z0-9/_?=&.-]*$')
);

revoke all on public.tenops_release_communications from public,anon,authenticated;
grant select on public.tenops_release_communications to service_role;

insert into public.tenops_release_communications(
  communication_key,channel,title,body,destination,deliver_to_future_users
) values
  (
    'my_work_v1_announcement','account_notification','My Work has been updated',
    'My Work now includes Today, task attachments, improved Shared Tasks, grouping, mobile improvements, and other workspace refinements.',
    '/my-work',false
  ),
  (
    'inbox_onboarding_v1','system_inbox','Welcome to Inbox',
    E'Welcome to Inbox.\n\nInbox is for direct communication with another TenOps user. Use Shared Tasks when you need someone to take action. Use @mentions to draw attention to an existing Job Update or other TenOps context.\n\nMessages are private between participants, and you can optionally link a Job when a conversation relates to one.',
    '/my-work?inbox=1',true
  );

alter table public.my_work_messages alter column sender_user_id drop not null;
alter table public.my_work_messages
  add column sender_kind text not null default 'user' check (sender_kind in ('user','system')),
  add column system_sender_key text,
  add column system_message_key text,
  add constraint my_work_messages_sender_identity check (
    (sender_kind='user' and sender_user_id is not null and system_sender_key is null and system_message_key is null)
    or
    (sender_kind='system' and sender_user_id is null and system_sender_key='tenops' and nullif(btrim(system_message_key),'') is not null)
  );

create unique index my_work_messages_system_delivery_unique
  on public.my_work_messages(recipient_user_id,system_message_key)
  where system_message_key is not null;

create or replace function public.list_my_work_inbox_messages()
returns table(
  id uuid, sender_user_id uuid, sender_name text, recipient_user_id uuid, recipient_name text,
  body text, job_id uuid, job_number text, job_name text, read_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path=public as $$
  select message.id,
    coalesce(message.sender_user_id,'00000000-0000-0000-0000-000000000001'::uuid),
    case when message.sender_kind='system' then 'TenOps' else sender.display_name end,
    message.recipient_user_id,recipient.display_name,message.body,message.job_id,job.job_number,job.name,message.read_at,message.created_at
  from public.my_work_messages message
  left join public.app_users sender on sender.user_id=message.sender_user_id
  join public.app_users recipient on recipient.user_id=message.recipient_user_id
  left join public.jobs job on job.id=message.job_id
  where message.delivery_status='ready'
    and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
    and (message.sender_user_id=auth.uid() or message.recipient_user_id=auth.uid())
  order by message.created_at,message.id;
$$;

create or replace function public.mark_my_work_inbox_conversation_read(p_other_user_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then
    raise exception 'Active TenOps access is required.' using errcode='42501';
  end if;
  if p_other_user_id='00000000-0000-0000-0000-000000000001'::uuid then
    update public.my_work_messages set read_at=clock_timestamp()
    where sender_kind='system' and recipient_user_id=auth.uid() and read_at is null;
  else
    update public.my_work_messages set read_at=clock_timestamp()
    where sender_kind='user' and sender_user_id=p_other_user_id and recipient_user_id=auth.uid() and read_at is null;
  end if;
  get diagnostics changed=row_count;
  return changed;
end;$$;

create function public.deliver_tenops_release_communication_to_user(p_communication_key text,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare communication public.tenops_release_communications%rowtype; inserted_id uuid; message_id uuid;
begin
  select * into strict communication from public.tenops_release_communications
  where communication_key=p_communication_key and is_active;
  if not exists(select 1 from public.app_users where user_id=p_user_id and is_active) then return false; end if;

  if communication.channel='account_notification' then
    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(p_user_id,'system-announcement:'||communication.communication_key,'feature_announcement',communication.title,communication.body,
      jsonb_strip_nulls(jsonb_build_object('announcement_key',communication.communication_key,'destination',communication.destination,'purpose','open-destination')))
    on conflict(user_id,notification_key) do nothing returning id into inserted_id;
  else
    insert into public.my_work_messages(sender_user_id,recipient_user_id,body,read_at,delivery_status,sender_kind,system_sender_key,system_message_key)
    values(null,p_user_id,communication.body,null,'ready','system','tenops',communication.communication_key)
    on conflict(recipient_user_id,system_message_key) where system_message_key is not null do nothing returning id into inserted_id;

    message_id:=inserted_id;
    if message_id is null then
      select id into message_id from public.my_work_messages
      where recipient_user_id=p_user_id and system_message_key=communication.communication_key;
    end if;

    insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
    values(p_user_id,'inbox-system-message:'||communication.communication_key,'inbox_message','TenOps sent you a message','Open Inbox to read it.',
      jsonb_build_object('message_id',message_id,'conversation_user_id','00000000-0000-0000-0000-000000000001','purpose','open-my-work-inbox'))
    on conflict(user_id,notification_key) do nothing;
  end if;
  return inserted_id is not null;
end;$$;

create function public.deliver_tenops_release_communication(p_communication_key text)
returns table(communication_key text,eligible integer,delivered integer,already_present integer,ineligible integer)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare recipient record; delivered_count integer:=0; eligible_count integer; ineligible_count integer;
begin
  if not exists(select 1 from public.tenops_release_communications where tenops_release_communications.communication_key=p_communication_key and is_active) then
    raise exception 'Unknown or inactive TenOps release communication.' using errcode='22023';
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

create function public.deliver_current_tenops_onboarding_for_app_user()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare communication record;
begin
  if new.is_active and (tg_op='INSERT' or not old.is_active) then
    for communication in select communication_key from public.tenops_release_communications where is_active and deliver_to_future_users loop
      perform public.deliver_tenops_release_communication_to_user(communication.communication_key,new.user_id);
    end loop;
  end if;
  return new;
end;$$;

drop trigger if exists app_users_deliver_current_tenops_onboarding on public.app_users;
create trigger app_users_deliver_current_tenops_onboarding
after insert or update of is_active on public.app_users
for each row execute function public.deliver_current_tenops_onboarding_for_app_user();

alter function public.list_my_work_inbox_messages() owner to postgres;
alter function public.mark_my_work_inbox_conversation_read(uuid) owner to postgres;
alter function public.deliver_tenops_release_communication_to_user(text,uuid) owner to postgres;
alter function public.deliver_tenops_release_communication(text) owner to postgres;
alter function public.deliver_current_tenops_onboarding_for_app_user() owner to postgres;
revoke all on function public.deliver_tenops_release_communication_to_user(text,uuid) from public,anon,authenticated;
revoke all on function public.deliver_tenops_release_communication(text) from public,anon,authenticated;
revoke all on function public.deliver_current_tenops_onboarding_for_app_user() from public,anon,authenticated;
grant execute on function public.deliver_tenops_release_communication(text) to service_role;

comment on table public.tenops_release_communications is 'Server-owned durable release communication registry. Delivery is explicit except for definitions marked for future-user onboarding.';
comment on column public.my_work_messages.system_message_key is 'Stable idempotency key for trusted TenOps-authored Inbox messages; null for user messages.';

commit;
