-- Dormant funding for ONE further, fixed TenDev/chris_dev invoice attempt.
-- Does not arm a window, grant a permission, enroll a user, enable a write,
-- change ordinary OpenAI policy, or reset any historical/uncertain accounting.
-- Arming this private row requires a separately approved postgres operator
-- action. The existing authenticated Admin grant RPC remains the only grant
-- activation path. Window, grant, source and request bindings cannot be reused.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $preflight$ begin
 if to_regclass('public.tenbot_openai_policy') is null
  or to_regclass('public.tenbot_openai_usage') is null
  or to_regclass('public.invoice_receival_sources') is null
  or to_regprocedure('public.get_tenbot_chris_dev_canary_control_status()') is null
  or (select md5(prosrc) from pg_proc where oid='public.activate_tenbot_chris_dev_canary_grant(timestamptz,text)'::regprocedure)
    is distinct from 'c2d6f546fad823a7a4ffdf8dd6cc9b1f'
  or (select md5(prosrc) from pg_proc where oid='public.revoke_tenbot_chris_dev_canary_grant(uuid,text)'::regprocedure)
    is distinct from '07f4bc465c8db61d4df67cc0896a8f96' then
  raise exception 'Exact accepted metering, original and canary authorization contracts required.';
 end if;
end $preflight$;

create table public.tenbot_chris_dev_canary_funding(
 singleton boolean primary key default true check(singleton),
 id uuid not null unique default '20261031-0100-4000-8000-000000000001',
 enabled boolean not null default false,
 starts_at timestamptz,
 expires_at timestamptz,
 budget_microusd bigint not null default 250000 check(budget_microusd=250000),
 bound_grant_id uuid unique references public.tenbot_chris_dev_canary_grants(id),
 bound_source_id uuid references public.invoice_receival_sources(id),
 bound_request_id uuid,
 check((starts_at is null and expires_at is null and not enabled)
  or (starts_at is not null and expires_at is not null and isfinite(starts_at) and isfinite(expires_at)
   and expires_at>starts_at and expires_at<=starts_at+interval '15 minutes')),
 check((bound_source_id is null)=(bound_request_id is null)),
 check(bound_grant_id is not null or bound_source_id is null)
);
insert into public.tenbot_chris_dev_canary_funding(singleton) values(true);

-- Every canary charge remains in the SAME cumulative usage table. This mapping
-- attributes its separate finite allowance; it is not a replacement ledger.
create table public.tenbot_chris_dev_canary_usage(
 usage_id uuid primary key references public.tenbot_openai_usage(id),
 funding_id uuid not null references public.tenbot_chris_dev_canary_funding(id),
 grant_id uuid not null references public.tenbot_chris_dev_canary_grants(id),
 source_id uuid not null references public.invoice_receival_sources(id),
 request_id uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.tenbot_chris_dev_canary_funding enable row level security;
alter table public.tenbot_chris_dev_canary_usage enable row level security;
revoke all on public.tenbot_chris_dev_canary_funding,public.tenbot_chris_dev_canary_usage
 from public,anon,authenticated,service_role,tenbot_invoice_executor;

create function public.tenbot_canary_funding_immutable() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if tg_op='DELETE' then raise exception 'Canary funding evidence is immutable.' using errcode='23514';end if;
 if new.singleton is distinct from old.singleton or new.id is distinct from old.id
  or new.budget_microusd is distinct from old.budget_microusd
  or (old.starts_at is not null and (new.starts_at is distinct from old.starts_at or new.expires_at is distinct from old.expires_at))
  or (old.bound_grant_id is not null and new.bound_grant_id is distinct from old.bound_grant_id)
  or (old.bound_source_id is not null and (new.bound_source_id is distinct from old.bound_source_id or new.bound_request_id is distinct from old.bound_request_id))
  or (old.bound_grant_id is not null and not old.enabled and new.enabled) then
  raise exception 'The finite canary funding window cannot be reset or reused.' using errcode='23514';
 end if;
 if old.starts_at is null and new.starts_at is not null
  and (new.expires_at<=clock_timestamp() or new.starts_at<clock_timestamp()-interval '5 seconds') then
  raise exception 'A fresh finite canary funding window is required.' using errcode='23514';
 end if;
 if old.bound_grant_id is null and new.bound_grant_id is not null and not exists(
  select 1 from public.tenbot_chris_dev_canary_grants g where g.id=new.bound_grant_id
   and g.owner_user_id='3785f6b9-742e-452f-af6c-31613a983633' and g.revoked_at is null
   and new.enabled and g.starts_at>=new.starts_at and g.expires_at<=new.expires_at
   and g.expires_at>clock_timestamp()) then
  raise exception 'Exact active canary grant required for funding binding.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger tenbot_canary_funding_immutable before update or delete on public.tenbot_chris_dev_canary_funding
 for each row execute function public.tenbot_canary_funding_immutable();
create trigger tenbot_canary_usage_immutable before update or delete on public.tenbot_chris_dev_canary_usage
 for each row execute function public.tenbot_invoice_immutable();

-- AFTER INSERT can bind the real persisted grant FK atomically; failure rolls
-- back the canonical activation, permission epoch and audit together. Revocation
-- UPDATE remains untouched, and never depends on available inference funding.
create function public.tenbot_bind_canary_funding_grant() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.tenbot_chris_dev_canary_funding; now_at timestamptz;
begin
 select * into f from public.tenbot_chris_dev_canary_funding where singleton for update;
 now_at:=clock_timestamp();
 if not found or not f.enabled or f.starts_at is null or f.starts_at>now_at or f.expires_at<=now_at
  or f.bound_grant_id is not null or new.starts_at<f.starts_at or new.expires_at>f.expires_at then
  raise exception 'An unused, active finite canary funding window is required.' using errcode='42501';
 end if;
 update public.tenbot_chris_dev_canary_funding set bound_grant_id=new.id where singleton;
 return new;
end $$;
create trigger tenbot_bind_canary_funding_grant after insert on public.tenbot_chris_dev_canary_grants
 for each row execute function public.tenbot_bind_canary_funding_grant();

create function public.tenbot_openai_canary_reserve(
 p_user uuid,p_request_id uuid,p_id uuid,p_model text,p_reserved_microusd bigint,
 p_origin text,p_source_id uuid,p_grant_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public
set lock_timeout='2s' set statement_timeout='10s' as $$
declare p public.tenbot_openai_policy; f public.tenbot_chris_dev_canary_funding;
 g public.tenbot_chris_dev_canary_grants; actor public.app_users; s public.invoice_receival_sources;
 now_at timestamptz; day_at timestamptz; accounted numeric; request_cost numeric; user_daily numeric;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server canary metering required.' using errcode='42501';end if;
 if p_user is distinct from '3785f6b9-742e-452f-af6c-31613a983633'::uuid
  or p_origin is distinct from 'https://tendev.pages.dev' or p_model is distinct from 'gpt-6.1-terra'
  or p_request_id is null or p_id is null or p_source_id is null or p_grant_id is null
  or p_reserved_microusd is null or p_reserved_microusd not between 1 and 250000 then
  raise exception 'Invalid fixed-canary inference scope.' using errcode='42501';
 end if;
 -- Activation/revocation lock this actor first. Keep that order, then the shared
 -- ordinary policy lock before the funding lock; all accounting is serialized.
 select * into actor from public.app_users where user_id=p_user for share;
 lock table public.app_role_capabilities in share mode;
 if actor.user_id is null or actor.role<>'developer' or not actor.is_active or actor.read_only
  or exists(select 1 from public.app_role_capabilities where role='developer' and capability='adjustInventory')
  or not public.tenbot_canary_user_has_capability(p_user,'readOperationalData')
  or not public.tenbot_canary_user_has_capability(p_user,'writeBusinessData') then
  raise exception 'Current exact-canary identity required.' using errcode='42501';
 end if;
 select * into p from public.tenbot_openai_policy where singleton for update;
 if not found then raise exception 'Shared inference accounting unavailable.' using errcode='P0001';end if;
 select * into f from public.tenbot_chris_dev_canary_funding where singleton for update;
 now_at:=clock_timestamp();day_at:=date_trunc('day',now_at at time zone 'UTC') at time zone 'UTC';
 if not found or not f.enabled or f.starts_at is null or f.starts_at>now_at or f.expires_at<=now_at
  or f.bound_grant_id is distinct from p_grant_id
  or (f.bound_source_id is not null and (f.bound_source_id is distinct from p_source_id or f.bound_request_id is distinct from p_request_id)) then
  raise exception 'Canary funding unavailable for this attempt.' using errcode='P0001';
 end if;
 select * into g from public.tenbot_chris_dev_canary_grants where id=p_grant_id for share;
 if not found or g.owner_user_id<>p_user or g.revoked_at is not null or g.starts_at>now_at or g.expires_at<=now_at
  or g.starts_at<f.starts_at or g.expires_at>f.expires_at or g.executed_draft_id is not null
  or (public.tenbot_active_chris_dev_canary_grant(p_user)).id is distinct from p_grant_id then
  raise exception 'Active exact-canary permission required.' using errcode='42501';
 end if;
 select * into s from public.invoice_receival_sources where id=p_source_id and owner_user_id=p_user for share;
 if not found or s.lifecycle_state not in('uploading','ready') or s.expires_at<=now_at
  or s.sha256<>'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'
  or s.content_type<>'application/pdf' or s.byte_size<>2877
  or not exists(select 1 from storage.objects o where o.bucket_id='invoice-receival-originals' and o.name=s.storage_path
   and o.metadata->>'size'='2877' and o.metadata->>'mimetype'='application/pdf') then
  raise exception 'Verified fixed-canary private original required.' using errcode='42501';
 end if;
 -- DB metadata does not attest actual object bytes: the server must download and
 -- SHA256-verify the original before this service-only reservation/dispatch.
 if not exists(select 1 from public.vendor_catalog c where c.id::text='ba6a3690-0886-4f72-9f86-581bcc1f3b44'
  and public.tenbot_invoice_vendor_key(c.vendor)=public.tenbot_invoice_vendor_key('T&M Supply')
  and public.tenbot_invoice_text_key(c.item_name)='alaska white' and public.tenbot_invoice_text_key(c.size)='#0'
  and c.unit='50lb bag' and c.category='marble' and c.material_class='turkish_aggregate') then
  raise exception 'Approved canary catalog target unavailable.' using errcode='42501';
 end if;
 if exists(select 1 from public.tenbot_openai_usage where id=p_id) then
  raise exception 'Inference reservation already exists' using errcode='23505';
 end if;
 select coalesce(sum(coalesce(u.actual_microusd,u.reserved_microusd)),0) into accounted
  from public.tenbot_chris_dev_canary_usage m join public.tenbot_openai_usage u on u.id=m.usage_id where m.funding_id=f.id;
 select coalesce(sum(coalesce(actual_microusd,reserved_microusd)) filter(where request_id=p_request_id),0),
  coalesce(sum(coalesce(actual_microusd,reserved_microusd)) filter(where created_at>=day_at),0)
  into request_cost,user_daily from public.tenbot_openai_usage where user_id=p_user;
 -- The separate Product allowance does not renew ordinary total/month/day
 -- funding. Retain its current per-employee/per-request safety caps and count
 -- ALL existing same-user usage, including old reserved/uncertain outcomes.
 if accounted+p_reserved_microusd>f.budget_microusd
  or request_cost+p_reserved_microusd>least(250000,p.request_limit_microusd)
  or user_daily+p_reserved_microusd>least(250000,p.user_day_limit_microusd) then
  raise exception 'Canary inference budget unavailable.' using errcode='P0001';
 end if;
 if (select count(*) from public.tenbot_openai_usage where user_id=p_user and request_id=p_request_id)>=p.request_step_limit
  or (select count(*) from public.tenbot_openai_usage where created_at>now_at-interval '1 minute')>=p.global_minute_step_limit
  or (select count(*) from public.tenbot_openai_usage where user_id=p_user and created_at>now_at-interval '1 minute')>=p.user_minute_step_limit
  or (select count(*) from public.tenbot_openai_usage where state in('reserved','uncertain'))>=p.global_open_limit
  or (select count(*) from public.tenbot_openai_usage where user_id=p_user and state in('reserved','uncertain'))>=p.user_open_limit then
  raise exception 'OpenAI request limit reached' using errcode='P0001';
 end if;
 if not exists(select 1 from public.tenbot_openai_usage where user_id=p_user and request_id=p_request_id) and (
  (select count(distinct(user_id,request_id)) from public.tenbot_openai_usage where created_at>=day_at)>=p.global_day_request_limit
  or (select count(distinct request_id) from public.tenbot_openai_usage where user_id=p_user and created_at>=day_at)>=p.user_day_request_limit) then
  raise exception 'OpenAI request limit reached' using errcode='P0001';
 end if;
 -- Re-read time after any row-lock wait or catalog/accounting work. A finite
 -- window must not become a stale timestamp authorizing a late reservation.
 if clock_timestamp()>=least(f.expires_at,g.expires_at,s.expires_at) then
  raise exception 'Canary funding unavailable for this attempt.' using errcode='P0001';
 end if;
 if f.bound_source_id is null then update public.tenbot_chris_dev_canary_funding
  set bound_source_id=p_source_id,bound_request_id=p_request_id where singleton;end if;
 insert into public.tenbot_openai_usage(id,user_id,request_id,model,policy_version,reserved_microusd)
  values(p_id,p_user,p_request_id,p_model,p.version,p_reserved_microusd);
 insert into public.tenbot_chris_dev_canary_usage(usage_id,funding_id,grant_id,source_id,request_id)
  values(p_id,f.id,p_grant_id,p_source_id,p_request_id);
 return jsonb_build_object('ok',true,'id',p_id,'requestId',p_request_id,'reservedMicrousd',p_reserved_microusd);
end $$;

create function public.tenbot_openai_canary_settle(p_user uuid,p_id uuid,p_actual_microusd bigint default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' set statement_timeout='10s' as $$
declare u public.tenbot_openai_usage; overrun boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server canary metering required.' using errcode='42501';end if;
 if p_user is distinct from '3785f6b9-742e-452f-af6c-31613a983633'::uuid or p_id is null
  or p_actual_microusd<0 or p_actual_microusd>1000000000000 then
  raise exception 'Invalid inference measurement' using errcode='22023';
 end if;
 perform 1 from public.tenbot_openai_policy where singleton for update;
 if not found then raise exception 'Shared inference accounting unavailable.';end if;
 perform 1 from public.tenbot_chris_dev_canary_funding where singleton for update;
 select usage.* into u from public.tenbot_openai_usage usage
  join public.tenbot_chris_dev_canary_usage m on m.usage_id=usage.id
  where usage.id=p_id and usage.user_id=p_user for update of usage;
 if not found then raise exception 'Canary inference reservation unavailable.';end if;
 -- Settlement is accounting, not new authority. Accept it after disable,
 -- revocation and expiry; unknown outcomes retain their FULL reservation.
 if u.state='measured' then
  if p_actual_microusd is not null and p_actual_microusd is distinct from u.actual_microusd then raise exception 'Inference measurement conflict';end if;
 elsif p_actual_microusd is null then
  update public.tenbot_openai_usage set state='uncertain' where id=p_id;u.state:='uncertain';
 else
  update public.tenbot_openai_usage set state='measured',actual_microusd=p_actual_microusd,settled_at=clock_timestamp() where id=p_id;
  u.state:='measured';u.actual_microusd:=p_actual_microusd;
 end if;
 overrun:=u.actual_microusd is not null and u.actual_microusd>u.reserved_microusd;
 if overrun then update public.tenbot_chris_dev_canary_funding set enabled=false where singleton;end if;
 return jsonb_build_object('ok',true,'id',u.id,'state',u.state,'accountedMicrousd',coalesce(u.actual_microusd,u.reserved_microusd),'overrun',overrun);
end $$;

create function public.get_tenbot_chris_dev_canary_funding_status() returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public set lock_timeout='2s' set statement_timeout='10s' as $$
declare actor public.app_users; f public.tenbot_chris_dev_canary_funding; accounted numeric; now_at timestamptz:=clock_timestamp(); active boolean;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then
  raise exception 'Authenticated canary funding status required.' using errcode='42501';end if;
 select * into actor from public.app_users where user_id=auth.uid();
 if actor.user_id is null or not actor.is_active or not (
  actor.role='admin' and not actor.read_only and public.has_app_capability('manageRolesPermissions')
  or actor.user_id='3785f6b9-742e-452f-af6c-31613a983633' and public.has_app_capability('readOperationalData')) then
  raise exception 'This fixed canary funding status is unavailable.' using errcode='42501';end if;
 select * into f from public.tenbot_chris_dev_canary_funding where singleton;
 if not found then raise exception 'Canary funding unavailable.';end if;
 select coalesce(sum(coalesce(u.actual_microusd,u.reserved_microusd)),0) into accounted
  from public.tenbot_chris_dev_canary_usage m join public.tenbot_openai_usage u on u.id=m.usage_id where m.funding_id=f.id;
 -- Exhausting reservation capacity does not revoke an already-authorized
 -- deterministic review/approval/execution. New spending is guarded by reserve.
 active:=coalesce(f.enabled and f.starts_at<=now_at and f.expires_at>now_at
  and f.bound_grant_id=(public.tenbot_active_chris_dev_canary_grant('3785f6b9-742e-452f-af6c-31613a983633')).id
  and public.tenbot_canary_user_has_capability('3785f6b9-742e-452f-af6c-31613a983633','readOperationalData')
  and public.tenbot_canary_user_has_capability('3785f6b9-742e-452f-af6c-31613a983633','writeBusinessData'),false);
 return jsonb_build_object('schemaVersion','tenbot-canary-funding.v1','serverNow',now_at,'enabled',f.enabled,
  'startsAt',f.starts_at,'expiresAt',f.expires_at,'fundingId',f.id,'grantId',f.bound_grant_id,
  'budgetMicrousd',f.budget_microusd,'accountedMicrousd',accounted,'remainingMicrousd',greatest(0,f.budget_microusd-accounted),'active',active);
end $$;

alter function public.tenbot_canary_funding_immutable() owner to postgres;
alter function public.tenbot_bind_canary_funding_grant() owner to postgres;
alter function public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid) owner to postgres;
alter function public.tenbot_openai_canary_settle(uuid,uuid,bigint) owner to postgres;
alter function public.get_tenbot_chris_dev_canary_funding_status() owner to postgres;
revoke all on function public.tenbot_canary_funding_immutable(),public.tenbot_bind_canary_funding_grant(),
 public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid),public.tenbot_openai_canary_settle(uuid,uuid,bigint),
 public.get_tenbot_chris_dev_canary_funding_status() from public,anon,authenticated,service_role,tenbot_invoice_executor;
grant execute on function public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid),
 public.tenbot_openai_canary_settle(uuid,uuid,bigint) to service_role;
grant execute on function public.get_tenbot_chris_dev_canary_funding_status() to authenticated;
comment on table public.tenbot_chris_dev_canary_funding is
 'Private one-attempt $0.25 TenDev/chris_dev funding; dormant by default, finite <=15m window, immutable bindings, no ordinary-policy renewal.';
comment on function public.tenbot_openai_canary_reserve(uuid,uuid,uuid,text,bigint,text,uuid,uuid) is
 'Service-only reservation AFTER actual original download/hash verification. Fixed identity/origin/document/catalog/grant; shared cumulative ledger plus separate finite allowance.';
notify pgrst,'reload schema';
commit;
