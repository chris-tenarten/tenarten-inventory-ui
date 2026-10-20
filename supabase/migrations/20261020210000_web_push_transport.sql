-- Stage B candidate. Hosted application/activation requires separate approval.
begin;
alter table public.web_push_subscriptions add column show_previews boolean not null default true;
create function public.set_my_web_push_previews(p_id uuid,p_generation bigint,p_enabled boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) or p_enabled is null then raise exception 'Active account required.' using errcode='42501'; end if;
 update public.web_push_subscriptions set show_previews=p_enabled where id=p_id and user_id=auth.uid() and generation=p_generation and enabled;
 return found;
end;$$;
create or replace function public.get_my_web_push_subscription(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501'; end if;
 select jsonb_build_object('enabled',s.enabled and (s.expiration_time is null or s.expiration_time>clock_timestamp()),'generation',s.generation,'show_previews',s.show_previews,'delivery_enabled',exists(select 1 from public.web_push_transport t where t.environment=s.environment and t.enabled))
 into result from public.web_push_subscriptions s join public.web_push_environments e using(environment)
 where s.id=p_id and s.user_id=auth.uid() and e.origin=public.web_push_request_origin();return result;
end;$$;
create table public.web_push_transport(
 environment text primary key references public.web_push_environments(environment),
 enabled boolean not null default false,
 activated_at timestamptz,
 check(not enabled or activated_at is not null)
);
create table public.web_push_outbox(
 notification_id uuid primary key references public.account_notifications(id) on delete cascade,
 user_id uuid not null references public.app_users(user_id),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '1 hour'
);
create table public.web_push_deliveries(
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.web_push_outbox(notification_id) on delete cascade,
 subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
 generation bigint not null,
 state text not null default 'pending' check(state in ('pending','leased','retry','submitted','skipped','expired','failed')),
 attempts integer not null default 0 check(attempts between 0 and 6),
 next_attempt_at timestamptz not null default clock_timestamp(),
 lease_token uuid,lease_until timestamptz,
 outcome text check(outcome in ('accepted','unavailable','expired','invalid_subscription','provider_auth','provider_rejected','retryable','exhausted','invalid_endpoint')),
 finished_at timestamptz,
 unique(notification_id,subscription_id,generation)
);
create index web_push_due on public.web_push_deliveries(next_attempt_at) where state in ('pending','retry','leased');
create table public.web_push_runs(
 id uuid primary key default gen_random_uuid(),environment text not null references public.web_push_environments(environment),
 expires_at bigint not null,created_at timestamptz not null default clock_timestamp(),consumed_at timestamptz
);
do $$declare t text;begin foreach t in array array['web_push_transport','web_push_outbox','web_push_deliveries','web_push_runs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
end loop;end$$;

-- Private source authority. Mirrors current active-participant DM and operational-read
-- Job Update access; requires canonical mention membership and existing source.
create function public.web_push_source(p_notification uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare n public.account_notifications; result jsonb; source_id uuid;
begin
 select * into n from public.account_notifications where id=p_notification;
 if not found or not exists(select 1 from public.app_users where user_id=n.user_id and is_active) then return null;end if;
 if n.notification_type='inbox_message' then
   if coalesce(n.metadata->>'message_id','') !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
   source_id:=(n.metadata->>'message_id')::uuid;
   select jsonb_build_object('kind','dm','sender',sender.display_name,'text',m.body,'conversation_user_id',m.sender_user_id,'message_id',m.id,
    'attachment_only',exists(select 1 from public.my_work_message_attachments a where a.message_id=m.id) and (nullif(btrim(m.body),'') is null or m.body='[Attachments]')) into result
   from public.my_work_messages m join public.app_users sender on sender.user_id=m.sender_user_id
   where m.id=source_id and m.recipient_user_id=n.user_id and m.delivery_status='ready' and m.read_at is null
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

create function public.enqueue_web_push_notification()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.notification_type not in ('inbox_message','job_update_mention') or public.web_push_source(new.id) is null then return new;end if;
 if exists(select 1 from public.web_push_subscriptions s join public.web_push_transport t using(environment)
   where s.user_id=new.user_id and s.enabled and t.enabled and new.created_at>=t.activated_at and (s.expiration_time is null or s.expiration_time>clock_timestamp())) then
  insert into public.web_push_outbox(notification_id,user_id) values(new.id,new.user_id) on conflict do nothing;
  insert into public.web_push_deliveries(notification_id,subscription_id,generation)
   select new.id,s.id,s.generation from public.web_push_subscriptions s join public.web_push_transport t using(environment)
   where s.user_id=new.user_id and s.enabled and t.enabled and new.created_at>=t.activated_at and (s.expiration_time is null or s.expiration_time>clock_timestamp()) on conflict do nothing;
 end if;
 return new;
end;$$;
create trigger enqueue_web_push_notification after insert on public.account_notifications for each row execute function public.enqueue_web_push_notification();

-- Owner-authenticated destination lookup. Read DM destinations even if already read,
-- but never return prior-account source data. No arbitrary metadata destinations.
create function public.resolve_my_push_notification(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare n public.account_notifications;result jsonb;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501';end if;
 select * into n from public.account_notifications where id=p_id and user_id=auth.uid();if not found then return null;end if;
 if n.notification_type='inbox_message' then
  select jsonb_build_object('kind','dm','conversation_user_id',m.sender_user_id) into result from public.my_work_messages m
   where m.id::text=n.metadata->>'message_id' and m.recipient_user_id=auth.uid() and m.delivery_status='ready'
    and coalesce(to_jsonb(m)->>'sender_kind','user')='user';
 elsif n.notification_type='job_update_mention' then
  result:=public.web_push_source(p_id);
  if result is not null then result:=jsonb_build_object('kind','mention','job_id',result->>'job_id','update_id',result->>'update_id');end if;
 end if;return result;
end;$$;

create function public.consume_web_push_run(p_id uuid,p_environment text,p_exp bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.web_push_runs set consumed_at=clock_timestamp() where id=p_id and environment=p_environment and expires_at=p_exp
 and consumed_at is null and p_exp>=extract(epoch from clock_timestamp()) and p_exp<=extract(epoch from clock_timestamp())+120;
 return found;
end;$$;
create function public.claim_web_push_deliveries(p_environment text,p_limit integer default 10)
returns table(id uuid,lease_token uuid) language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.web_push_transport where environment=p_environment and enabled) then return;end if;
 update public.web_push_deliveries d set state='expired',outcome='expired',finished_at=clock_timestamp() from public.web_push_outbox o
 where o.notification_id=d.notification_id and o.expires_at<=clock_timestamp() and d.state in ('pending','retry','leased');
 update public.web_push_deliveries d set state='failed',outcome='exhausted',finished_at=clock_timestamp()
 where attempts>=6 and state in ('pending','retry','leased') and (lease_until is null or lease_until<clock_timestamp());
 return query with due as (
  select d.id from public.web_push_deliveries d join public.web_push_subscriptions s on s.id=d.subscription_id
  where s.environment=p_environment and d.state in ('pending','retry','leased') and d.next_attempt_at<=clock_timestamp()
   and (d.lease_until is null or d.lease_until<clock_timestamp()) and d.attempts<6
  order by d.next_attempt_at,d.id for update of d skip locked limit greatest(1,least(p_limit,20))
 ) update public.web_push_deliveries d set state='leased',attempts=d.attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
 from due where d.id=due.id returning d.id,d.lease_token;
end;$$;
create function public.prepare_web_push_delivery(p_id uuid,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.web_push_deliveries;s public.web_push_subscriptions;o public.web_push_outbox;source jsonb;origin_value text;
begin
 select * into d from public.web_push_deliveries where id=p_id and lease_token=p_lease and state='leased' and lease_until>clock_timestamp();if not found then return null;end if;
 select * into s from public.web_push_subscriptions where id=d.subscription_id;
 select * into o from public.web_push_outbox where notification_id=d.notification_id;
 if not s.enabled or s.generation<>d.generation or s.user_id<>o.user_id or (s.expiration_time is not null and s.expiration_time<=clock_timestamp()) or o.expires_at<=clock_timestamp()
  or not exists(select 1 from public.web_push_transport where environment=s.environment and enabled) then return null;end if;
 source:=public.web_push_source(o.notification_id);if source is null then return null;end if;
 select origin into origin_value from public.web_push_environments where environment=s.environment;
 return jsonb_build_object('id',d.id,'notification_id',o.notification_id,'environment',s.environment,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
  'key_version',s.key_version,'previews',s.show_previews,'source',source,'origin',origin_value,'attempts',d.attempts,'expires_at',o.expires_at);
end;$$;
create function public.finish_web_push_delivery(p_id uuid,p_lease uuid,p_outcome text,p_delay integer default 30)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.web_push_deliveries;
begin
 select * into d from public.web_push_deliveries where id=p_id and lease_token=p_lease and state='leased' and lease_until>clock_timestamp() for update;if not found then return false;end if;
 if p_outcome not in ('accepted','unavailable','invalid_subscription','provider_auth','provider_rejected','retryable','invalid_endpoint') then raise exception 'Invalid outcome';end if;
 if p_outcome='invalid_subscription' then
  update public.web_push_subscriptions set enabled=false,revoked_at=clock_timestamp(),generation=generation+1 where id=d.subscription_id and generation=d.generation and enabled;
 end if;
 update public.web_push_deliveries set
  state=case when p_outcome='accepted' then 'submitted' when p_outcome='unavailable' then 'skipped' when p_outcome='retryable' and attempts<6 then 'retry' else 'failed' end,
  outcome=case when p_outcome='retryable' and attempts>=6 then 'exhausted' else p_outcome end,
  next_attempt_at=clock_timestamp()+make_interval(secs=>greatest(1,least(p_delay,900))),lease_until=null,
  finished_at=case when p_outcome='retryable' and attempts<6 then null else clock_timestamp() end where id=p_id;
 return true;
end;$$;
-- Transport retention runs during periodic maintenance; no content or endpoint logs.
create function public.prune_web_push_transport()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 delete from public.web_push_deliveries where finished_at<clock_timestamp()-interval '30 days';
 delete from public.web_push_outbox o where o.created_at<clock_timestamp()-interval '30 days' and not exists(select 1 from public.web_push_deliveries d where d.notification_id=o.notification_id);
 delete from public.web_push_runs where created_at<clock_timestamp()-interval '30 days';
end;$$;
revoke all on function public.set_my_web_push_previews(uuid,bigint,boolean),public.resolve_my_push_notification(uuid) from public,anon,service_role;
grant execute on function public.set_my_web_push_previews(uuid,bigint,boolean),public.resolve_my_push_notification(uuid) to authenticated;
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('web_push_source','enqueue_web_push_notification','consume_web_push_run','claim_web_push_deliveries','prepare_web_push_delivery','finish_web_push_delivery','prune_web_push_transport') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.signature::text not like 'web_push_source%' and f.signature::text not like 'enqueue_%' then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end$$;
commit;
