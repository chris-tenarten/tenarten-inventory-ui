-- Controlled TenDev pilot only. Empty allowlists; no enrollment, activation or backfill.
-- Apply A, B and this guard in ONE outer transaction before exposing any configuration.
begin;
create table public.web_push_pilot_accounts (
 user_id uuid primary key references public.app_users(user_id) on delete cascade
);
create table public.web_push_pilot_jobs (
 job_id uuid primary key references public.jobs(id) on delete cascade
);
alter table public.web_push_pilot_accounts enable row level security;
alter table public.web_push_pilot_jobs enable row level security;
revoke all on public.web_push_pilot_accounts,public.web_push_pilot_jobs from public,anon,authenticated,service_role;
-- Production activation requires a later reviewed migration; flags cannot bypass this gate.
alter table public.web_push_environments add constraint web_push_pilot_origin
 check(not registration_enabled or (environment='tendev' and origin='https://tendev.pages.dev'));
alter table public.web_push_transport add constraint web_push_pilot_transport check(not enabled or environment='tendev');
alter table public.web_push_subscriptions add constraint web_push_pilot_environment check(environment='tendev');
create or replace function public.get_my_web_push_configuration()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare config public.web_push_environments;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then
   raise exception 'Active account required.' using errcode='42501'; end if;
 select * into config from public.web_push_environments where origin=public.web_push_request_origin() and registration_enabled;
 if not found or config.environment<>'tendev' or not exists(select 1 from public.web_push_pilot_accounts where user_id=auth.uid()) then return null; end if;
 return jsonb_build_object('environment',config.environment,'public_key',config.public_key,'key_version',config.key_version);
end;$$;
create or replace function public.register_my_web_push_subscription(p_id uuid,p_environment text,p_key_version text,p_subscription jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare config public.web_push_environments; existing public.web_push_subscriptions;
 endpoint_value text; host_value text; key_value text; auth_value text; expiry timestamptz;
begin
 if p_environment<>'tendev' or not exists(select 1 from public.web_push_pilot_accounts where user_id=auth.uid()) then raise exception 'Device registration is not available for this account.' using errcode='42501';end if;
 -- Serialize quota/registration for an owner without granting business-write authority.
 perform 1 from public.app_users where user_id=auth.uid() and is_active for update;
 if not found then raise exception 'Active account required.' using errcode='42501'; end if;
 select * into config from public.web_push_environments
 where environment=p_environment and origin=public.web_push_request_origin() and registration_enabled and key_version=p_key_version;
 if not found then raise exception 'Device registration is not configured.' using errcode='42501'; end if;
 if p_id is null then raise exception 'Invalid device ID.' using errcode='22023'; end if;
 if p_subscription is null or jsonb_typeof(p_subscription)<>'object' or octet_length(p_subscription::text)>4096 then
   raise exception 'Invalid subscription.' using errcode='22023'; end if;
 endpoint_value:=p_subscription->>'endpoint';
 -- HTTPS only, no userinfo, ports, fragments, queries, redirects or arbitrary hosts.
 -- Explicit browser-vendor registry; subdomain boundary required for Apple.
 if endpoint_value is null or length(endpoint_value)>2048 or endpoint_value !~ '^https://[a-z0-9.-]+/[A-Za-z0-9_./~%-]+$'
    or endpoint_value ~ '%(0[0-9a-fA-F]|[12][0-9a-fA-F]|7[fF])' then
   raise exception 'Invalid push endpoint.' using errcode='22023'; end if;
 host_value:=split_part(split_part(endpoint_value,'://',2),'/',1);
 if not (host_value='web.push.apple.com' or host_value ~ '^[a-z0-9-]+([.][a-z0-9-]+)*[.]push[.]apple[.]com$'
   or host_value='fcm.googleapis.com' or host_value='updates.push.services.mozilla.com') then
   raise exception 'Unsupported push endpoint.' using errcode='22023'; end if;
 key_value:=p_subscription->'keys'->>'p256dh'; auth_value:=p_subscription->'keys'->>'auth';
 if key_value is null or key_value !~ '^[A-Za-z0-9_-]{87}$' or auth_value is null or auth_value !~ '^[A-Za-z0-9_-]{22}$'
    or get_byte(decode(translate(key_value,'-_','+/')||'=','base64'),0)<>4 then
   raise exception 'Invalid subscription keys.' using errcode='22023'; end if;
 if p_subscription->>'expirationTime' is not null then
   if (p_subscription->>'expirationTime') !~ '^[0-9]{1,14}$' then raise exception 'Invalid expiration.' using errcode='22023'; end if;
   expiry:=to_timestamp((p_subscription->>'expirationTime')::double precision/1000);
   if expiry<=clock_timestamp() then raise exception 'Subscription expired.' using errcode='22023'; end if;
 end if;
 select * into existing from public.web_push_subscriptions where environment=p_environment
   and endpoint_hash=encode(sha256(convert_to(endpoint_value,'UTF8')),'hex') for update;
 if found then
   -- Endpoint knowledge is never an ownership-transfer capability, even after revocation.
   if existing.user_id<>auth.uid() then raise exception 'Subscription unavailable.' using errcode='42501'; end if;
   if not existing.enabled then raise exception 'Create a fresh browser subscription.' using errcode='22023'; end if;
   if (existing.p256dh,existing.auth,existing.key_version) is distinct from (key_value,auth_value,p_key_version) then
     raise exception 'Create a fresh browser subscription.' using errcode='22023'; end if;
   update public.web_push_subscriptions set last_confirmed_at=clock_timestamp(),expiration_time=expiry where id=existing.id;
   return jsonb_build_object('id',existing.id,'generation',existing.generation);
 end if;
 if (select count(*) from public.web_push_subscriptions where user_id=auth.uid() and enabled)>=8 then
   raise exception 'Device limit reached. Disable an existing device first.' using errcode='22023'; end if;
 insert into public.web_push_subscriptions(id,user_id,environment,endpoint,endpoint_hash,p256dh,auth,key_version,expiration_time)
 values(p_id,auth.uid(),p_environment,endpoint_value,encode(sha256(convert_to(endpoint_value,'UTF8')),'hex'),key_value,auth_value,p_key_version,expiry) returning * into existing;
 return jsonb_build_object('id',existing.id,'generation',existing.generation);
end;$$;
-- Both parties must be explicitly enrolled test accounts. Mention Jobs must also
-- be approved. Request Origin is not treated as source authorization.
create function public.web_push_pilot_source(p_notification uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare n public.account_notifications;source jsonb;sender uuid;job uuid;
begin
 select * into n from public.account_notifications where id=p_notification;
 if not found or not exists(select 1 from public.web_push_pilot_accounts where user_id=n.user_id) then return false;end if;
 source:=public.web_push_source(p_notification);if source is null then return false;end if;
 if source->>'kind'='dm' then sender:=(source->>'conversation_user_id')::uuid;
 else
  select author_user_id,job_id into sender,job from public.job_updates where id::text=source->>'update_id';
  if not exists(select 1 from public.web_push_pilot_jobs where job_id=job) then return false;end if;
 end if;
 return exists(select 1 from public.web_push_pilot_accounts where user_id=sender);
end;$$;
revoke all on function public.web_push_pilot_source(uuid) from public,anon,authenticated,service_role;
create or replace function public.enqueue_web_push_notification()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 -- Return before resolving any source for non-pilot recipients or disabled transport.
 if new.notification_type not in ('inbox_message','job_update_mention') then return new;end if;
 if not exists(select 1 from public.web_push_pilot_accounts where user_id=new.user_id)
  or not exists(select 1 from public.web_push_subscriptions s join public.web_push_transport t using(environment)
   where s.environment='tendev' and s.user_id=new.user_id and s.enabled and t.enabled
    and new.created_at>=t.activated_at and (s.expiration_time is null or s.expiration_time>clock_timestamp())) then return new;end if;
 if not public.web_push_pilot_source(new.id) then return new;end if;
 if exists(select 1 from public.web_push_subscriptions s join public.web_push_transport t using(environment)
   where s.user_id=new.user_id and s.enabled and t.enabled and new.created_at>=t.activated_at and (s.expiration_time is null or s.expiration_time>clock_timestamp())) then
  insert into public.web_push_outbox(notification_id,user_id) values(new.id,new.user_id) on conflict do nothing;
  insert into public.web_push_deliveries(notification_id,subscription_id,generation)
   select new.id,s.id,s.generation from public.web_push_subscriptions s join public.web_push_transport t using(environment)
   where s.user_id=new.user_id and s.enabled and t.enabled and new.created_at>=t.activated_at and (s.expiration_time is null or s.expiration_time>clock_timestamp()) on conflict do nothing;
 end if;
 return new;
end;$$;
create or replace function public.prepare_web_push_delivery(p_id uuid,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.web_push_deliveries;s public.web_push_subscriptions;o public.web_push_outbox;source jsonb;origin_value text;
begin
 select * into d from public.web_push_deliveries where id=p_id and lease_token=p_lease and state='leased' and lease_until>clock_timestamp();if not found then return null;end if;
 select * into s from public.web_push_subscriptions where id=d.subscription_id;
 select * into o from public.web_push_outbox where notification_id=d.notification_id;
 if not s.enabled or s.generation<>d.generation or s.user_id<>o.user_id or (s.expiration_time is not null and s.expiration_time<=clock_timestamp()) or o.expires_at<=clock_timestamp()
  or not exists(select 1 from public.web_push_transport where environment=s.environment and enabled) then return null;end if;
 if s.environment<>'tendev' or not public.web_push_pilot_source(o.notification_id) then return null;end if;
 source:=public.web_push_source(o.notification_id);if source is null then return null;end if;
 select origin into origin_value from public.web_push_environments where environment=s.environment;
 return jsonb_build_object('id',d.id,'notification_id',o.notification_id,'environment',s.environment,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
  'key_version',s.key_version,'previews',s.show_previews,'source',source,'origin',origin_value,'attempts',d.attempts,'expires_at',o.expires_at);
end;$$;
commit;
