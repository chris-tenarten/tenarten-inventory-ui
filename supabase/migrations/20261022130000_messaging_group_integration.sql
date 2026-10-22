-- Forward integration correction. DO NOT APPLY HOSTED without Product approval.
-- TenOps GA already delegates source authority; preserve TenDev pilot allowlists
-- and resolve a group's sender from the message, never from its conversation UUID.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.web_push_pilot_source(p_notification uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare n public.account_notifications;source jsonb;sender uuid;job uuid;
begin
 select * into n from public.account_notifications where id=p_notification;
 if not found or not exists(select 1 from public.web_push_pilot_accounts where user_id=n.user_id) then return false;end if;
 source:=public.web_push_source(p_notification);if source is null then return false;end if;
 if source->>'kind'='dm' then sender:=(source->>'conversation_user_id')::uuid;
 elsif source->>'kind'='group' then
  select sender_user_id into sender from public.my_work_messages
  where id::text=source->>'message_id' and group_id is not null and delivery_status='ready';
 else
  select author_user_id,job_id into sender,job from public.job_updates where id::text=source->>'update_id';
  if not exists(select 1 from public.web_push_pilot_jobs where job_id=job) then return false;end if;
 end if;
 return exists(select 1 from public.web_push_pilot_accounts where user_id=sender);
end;$$;
revoke all on function public.web_push_pilot_source(uuid) from public,anon,authenticated,service_role;
commit;
