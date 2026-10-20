-- Stage A candidate only. Prepare/review separately; DO NOT APPLY without authorization.
-- No seed configuration, notification trigger, delivery worker, schedule or outbound request.
begin;
create table public.web_push_environments (
  environment text primary key check (environment ~ '^[a-z][a-z0-9_-]{0,31}$'),
  origin text not null unique check (origin ~ '^https://[a-z0-9.-]+$'),
  public_key text not null check (public_key ~ '^[A-Za-z0-9_-]{87}$'),
  key_version text not null check (key_version ~ '^[A-Za-z0-9_-]{1,40}$'),
  registration_enabled boolean not null default false
);
alter table public.web_push_environments enable row level security;
revoke all on public.web_push_environments from public,anon,authenticated,service_role;

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  environment text not null references public.web_push_environments(environment),
  endpoint text not null check (length(endpoint) between 20 and 2048),
  endpoint_hash text not null check (endpoint_hash ~ '^[a-f0-9]{64}$'),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  key_version text not null,
  expiration_time timestamptz,
  enabled boolean not null default true,
  generation bigint not null default 1 check (generation > 0),
  created_at timestamptz not null default clock_timestamp(),
  last_confirmed_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  unique(environment,endpoint_hash),
  check (enabled = (revoked_at is null))
);
create index web_push_owner_idx on public.web_push_subscriptions(user_id,environment) where enabled;
alter table public.web_push_subscriptions enable row level security;
-- No direct table reads, including to owners; RPCs return safe summaries only.
revoke all on public.web_push_subscriptions from public,anon,authenticated,service_role;
create policy web_push_owner_boundary on public.web_push_subscriptions
  for select to authenticated using (user_id=auth.uid());

create function public.web_push_request_origin()
returns text language sql stable set search_path=pg_catalog as $$
 select coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'origin','');
$$;
revoke all on function public.web_push_request_origin() from public,anon,authenticated,service_role;

create function public.get_my_web_push_configuration()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare config public.web_push_environments;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then
   raise exception 'Active account required.' using errcode='42501'; end if;
 select * into config from public.web_push_environments where origin=public.web_push_request_origin() and registration_enabled;
 if not found then return null; end if;
 return jsonb_build_object('environment',config.environment,'public_key',config.public_key,'key_version',config.key_version);
end;$$;

create function public.register_my_web_push_subscription(p_id uuid,p_environment text,p_key_version text,p_subscription jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare config public.web_push_environments; existing public.web_push_subscriptions;
 endpoint_value text; host_value text; key_value text; auth_value text; expiry timestamptz;
begin
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

create function public.get_my_web_push_subscription(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active) then raise exception 'Active account required.' using errcode='42501'; end if;
 select jsonb_build_object('enabled',s.enabled and (s.expiration_time is null or s.expiration_time>clock_timestamp()),'generation',s.generation)
 into result from public.web_push_subscriptions s join public.web_push_environments e using(environment)
 where s.id=p_id and s.user_id=auth.uid() and e.origin=public.web_push_request_origin();
 return result;
end;$$;

create function public.revoke_my_web_push_subscription(p_id uuid,p_generation bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 -- A still-authenticated owner may revoke even after app deactivation/config disable.
 if auth.uid() is null then raise exception 'Authentication required.' using errcode='42501'; end if;
 update public.web_push_subscriptions set enabled=false,revoked_at=clock_timestamp(),generation=generation+1
 where id=p_id and user_id=auth.uid() and generation=p_generation and enabled;
 -- Missing/foreign IDs are indistinguishable; only report an owned still-active generation as pending.
 return not exists(select 1 from public.web_push_subscriptions where id=p_id and user_id=auth.uid() and enabled);
end;$$;

revoke all on function public.get_my_web_push_configuration() from public,anon,service_role;
revoke all on function public.register_my_web_push_subscription(uuid,text,text,jsonb) from public,anon,service_role;
revoke all on function public.get_my_web_push_subscription(uuid) from public,anon,service_role;
revoke all on function public.revoke_my_web_push_subscription(uuid,bigint) from public,anon,service_role;
grant execute on function public.get_my_web_push_configuration() to authenticated;
grant execute on function public.register_my_web_push_subscription(uuid,text,text,jsonb) to authenticated;
grant execute on function public.get_my_web_push_subscription(uuid) to authenticated;
grant execute on function public.revoke_my_web_push_subscription(uuid,bigint) to authenticated;
commit;
