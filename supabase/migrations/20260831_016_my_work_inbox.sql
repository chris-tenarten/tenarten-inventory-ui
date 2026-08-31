-- Additive private direct messaging for My Work. Existing tasks and notifications remain unchanged.

create table public.my_work_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.app_users(user_id),
  recipient_user_id uuid not null references public.app_users(user_id),
  body text not null check (length(btrim(body)) between 1 and 10000),
  job_id uuid references public.jobs(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint my_work_messages_distinct_participants check (sender_user_id <> recipient_user_id)
);

create index my_work_messages_sender_created_idx on public.my_work_messages(sender_user_id,created_at desc,id);
create index my_work_messages_recipient_created_idx on public.my_work_messages(recipient_user_id,created_at desc,id);
create index my_work_messages_recipient_unread_idx on public.my_work_messages(recipient_user_id,created_at desc) where read_at is null;

alter table public.my_work_messages enable row level security;
create policy my_work_messages_participant_select on public.my_work_messages
for select to authenticated using (
  exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and (sender_user_id=auth.uid() or recipient_user_id=auth.uid())
);

revoke all on public.my_work_messages from public,anon,authenticated;
grant select on public.my_work_messages to authenticated;
grant all on public.my_work_messages to service_role;

create function public.list_my_work_inbox_recipients()
returns table(user_id uuid,display_name text,role text)
language sql stable security definer set search_path=public as $$
  select candidate.user_id,candidate.display_name,candidate.role
  from public.app_users candidate
  where candidate.is_active and candidate.user_id<>auth.uid()
    and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  order by lower(candidate.display_name),candidate.user_id;
$$;

create function public.list_my_work_inbox_messages()
returns table(
  id uuid, sender_user_id uuid, sender_name text, recipient_user_id uuid, recipient_name text,
  body text, job_id uuid, job_number text, job_name text, read_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path=public as $$
  select message.id,message.sender_user_id,sender.display_name,message.recipient_user_id,recipient.display_name,
    message.body,message.job_id,job.job_number,job.name,message.read_at,message.created_at
  from public.my_work_messages message
  join public.app_users sender on sender.user_id=message.sender_user_id
  join public.app_users recipient on recipient.user_id=message.recipient_user_id
  left join public.jobs job on job.id=message.job_id
  where exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
    and (message.sender_user_id=auth.uid() or message.recipient_user_id=auth.uid())
  order by message.created_at,message.id;
$$;

create function public.send_my_work_inbox_message(p_recipient_user_id uuid,p_body text,p_job_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.app_users%rowtype; recipient public.app_users%rowtype; selected_job public.jobs%rowtype; message_id uuid:=gen_random_uuid();
begin
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_recipient_user_id=actor.user_id then raise exception 'Choose another TenOps user.' using errcode='22023'; end if;
  select * into strict recipient from public.app_users where user_id=p_recipient_user_id and is_active;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'Message is required.' using errcode='22023'; end if;
  if length(btrim(p_body))>10000 then raise exception 'Message is too long.' using errcode='22023'; end if;
  if p_job_id is not null then select * into strict selected_job from public.jobs where id=p_job_id; end if;
  insert into public.my_work_messages(id,sender_user_id,recipient_user_id,body,job_id)
  values(message_id,actor.user_id,recipient.user_id,btrim(p_body),p_job_id);
  insert into public.account_notifications(user_id,notification_key,notification_type,title,body,metadata)
  values(recipient.user_id,'inbox-message:'||message_id,'inbox_message',actor.display_name||' sent you a message','Open Inbox to read it.',
    jsonb_strip_nulls(jsonb_build_object('message_id',message_id,'conversation_user_id',actor.user_id,'job_id',p_job_id,'purpose','open-my-work-inbox')));
  return message_id;
end;$$;

create function public.mark_my_work_inbox_conversation_read(p_other_user_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active TenOps access is required.' using errcode='42501'; end if;
  update public.my_work_messages set read_at=clock_timestamp()
  where sender_user_id=p_other_user_id and recipient_user_id=auth.uid() and read_at is null;
  get diagnostics changed=row_count;
  return changed;
end;$$;

alter function public.list_my_work_inbox_messages() owner to postgres;
alter function public.list_my_work_inbox_recipients() owner to postgres;
alter function public.send_my_work_inbox_message(uuid,text,uuid) owner to postgres;
alter function public.mark_my_work_inbox_conversation_read(uuid) owner to postgres;
revoke all on function public.list_my_work_inbox_messages() from public,anon;
revoke all on function public.list_my_work_inbox_recipients() from public,anon;
revoke all on function public.send_my_work_inbox_message(uuid,text,uuid) from public,anon;
revoke all on function public.mark_my_work_inbox_conversation_read(uuid) from public,anon;
grant execute on function public.list_my_work_inbox_messages() to authenticated,service_role;
grant execute on function public.list_my_work_inbox_recipients() to authenticated,service_role;
grant execute on function public.send_my_work_inbox_message(uuid,text,uuid) to authenticated,service_role;
grant execute on function public.mark_my_work_inbox_conversation_read(uuid) to authenticated,service_role;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='my_work_messages') then
    alter publication supabase_realtime add table public.my_work_messages;
  end if;
end $$;

comment on table public.my_work_messages is 'Participant-private direct Inbox messages. No administrative content bypass.';
