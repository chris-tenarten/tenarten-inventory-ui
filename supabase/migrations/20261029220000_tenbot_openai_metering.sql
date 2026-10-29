-- Proposed local release-enablement migration. NOT APPLIED; no provider activation.
-- Separate from the canonical Qwen/Neuron meter and all receival-write migrations.
-- All amounts are integer microUSD, rounded UP by the server (1 USD = 1,000,000).
-- Activation requires an explicitly reviewed operator policy UPDATE, valid key
-- lifetime and pricing, and a successful isolated concurrent/JWT/role test gate.
-- Reconcile/freeze the local experimental journal FIRST: 367 settled attempts,
-- $0.53995550 after this candidate's live check => 539956 microUSD imported below.
-- Increase this carryover if the journal has advanced; never reset the $5 pool.
-- Do not leave an independently spending localhost ledger enabled after cutover.
-- Set finite policy expiry and nonzero caps deliberately; an enable flag alone
-- authorizes no spending. Lifetime cap does NOT reset at a month/day boundary.
begin;

create table public.tenbot_openai_policy (
 singleton boolean primary key default true check(singleton),
 version integer not null default 1 check(version>0),
 enabled boolean not null default false,
 expires_at timestamptz not null default now(),
 legacy_accounted_microusd bigint not null default 539956 check(legacy_accounted_microusd>=539956),
 legacy_accounted_day date not null default date '2026-10-29',
 carryover_evidence text not null default 'local-experiment:367-settled:0.53995550:2026-10-29' check(length(carryover_evidence) between 1 and 240),
 total_limit_microusd bigint not null default 0 check(total_limit_microusd between 0 and 1000000000000),
 day_limit_microusd bigint not null default 0 check(day_limit_microusd between 0 and 1000000000000),
 month_limit_microusd bigint not null default 0 check(month_limit_microusd between 0 and 1000000000000),
 user_day_limit_microusd bigint not null default 0 check(user_day_limit_microusd between 0 and 1000000000000),
 request_limit_microusd bigint not null default 0 check(request_limit_microusd between 0 and 1000000000000),
 allowed_models text[] not null default array['gpt-6.1-terra']::text[]
   check(cardinality(allowed_models) between 1 and 2 and allowed_models <@ array['gpt-6.1-terra','gpt-6.1-sol']::text[] and array_position(allowed_models,null) is null),
 request_step_limit integer not null default 16 check(request_step_limit between 1 and 16),
 global_minute_step_limit integer not null default 60 check(global_minute_step_limit between 1 and 10000),
 user_minute_step_limit integer not null default 16 check(user_minute_step_limit between 1 and 1000),
 global_day_request_limit integer not null default 300 check(global_day_request_limit between 1 and 100000),
 user_day_request_limit integer not null default 60 check(user_day_request_limit between 1 and 10000),
 global_open_limit integer not null default 8 check(global_open_limit between 1 and 100),
 user_open_limit integer not null default 2 check(user_open_limit between 1 and 10)
);
insert into public.tenbot_openai_policy(singleton) values(true);
-- Carryover may rise when the final local journal is reconciled, never fall
-- during later operator policy edits. A raised total cap is a separate explicit
-- Product decision; it does not erase already-accounted experimental spend.
create function public.tenbot_openai_preserve_carryover() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.legacy_accounted_microusd<old.legacy_accounted_microusd then raise exception 'Accounted carryover cannot decrease' using errcode='23514'; end if;
 return new;
end; $$;
alter function public.tenbot_openai_preserve_carryover() owner to postgres;
revoke all on function public.tenbot_openai_preserve_carryover() from public,anon,authenticated,service_role;
create trigger tenbot_openai_preserve_carryover before update of legacy_accounted_microusd on public.tenbot_openai_policy
 for each row execute function public.tenbot_openai_preserve_carryover();

create table public.tenbot_openai_usage (
 id uuid primary key,
 user_id uuid not null references public.app_users(user_id),
 request_id uuid not null,
 model text not null check(model in ('gpt-6.1-terra','gpt-6.1-sol')),
 policy_version integer not null,
 created_at timestamptz not null default clock_timestamp(),
 reserved_microusd bigint not null check(reserved_microusd between 1 and 1000000000000),
 actual_microusd bigint check(actual_microusd between 0 and 1000000000000),
 state text not null default 'reserved' check(state in ('reserved','uncertain','measured')),
 settled_at timestamptz,
 constraint tenbot_openai_measurement_complete check((state='measured' and actual_microusd is not null and settled_at is not null) or (state in ('reserved','uncertain') and actual_microusd is null))
);
create index on public.tenbot_openai_usage(created_at);
create index on public.tenbot_openai_usage(user_id,created_at);
create index on public.tenbot_openai_usage(user_id,request_id);
alter table public.tenbot_openai_policy enable row level security;
alter table public.tenbot_openai_usage enable row level security;
-- No RLS policies/direct grants: only the three narrow server RPCs below.
revoke all on public.tenbot_openai_policy,public.tenbot_openai_usage from public,anon,authenticated,service_role;

create function public.tenbot_openai_reserve(p_user uuid,p_request_id uuid,p_id uuid,p_model text,p_reserved_microusd bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare p public.tenbot_openai_policy; v_now timestamptz; v_day timestamptz; v_month timestamptz;
 v_total numeric;v_daily numeric;v_monthly numeric;v_user_daily numeric;v_request numeric;
begin
 -- The policy row is a shared cross-instance lock. All reservations, settlements
 -- and operator policy updates serialize through it, including first use.
 select * into p from public.tenbot_openai_policy where singleton for update;
 v_now:=clock_timestamp();
 v_day:=date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC';
 v_month:=date_trunc('month',v_now at time zone 'UTC') at time zone 'UTC';
 if not found or not p.enabled or p.expires_at<=v_now then raise exception 'OpenAI meter unavailable' using errcode='P0001'; end if;
 if p_user is null or p_request_id is null or p_id is null or p_model is null or not(p_model=any(p.allowed_models))
   or p_reserved_microusd is null or p_reserved_microusd<=0 or p_reserved_microusd>1000000000000 then raise exception 'Invalid inference reservation' using errcode='22023'; end if;
 -- Service role is metering authority, never caller operational authority. Recheck
 -- the exact authenticated owner and current read capability for EVERY step.
 if not exists(select 1 from public.app_users u join public.app_role_capabilities c on c.role=u.role
   where u.user_id=p_user and u.is_active and c.capability='readOperationalData') then raise exception 'Not authorized' using errcode='42501'; end if;
 -- A repeated reserve may follow an unknown network outcome. It cannot authorize
 -- another provider dispatch, even when the original reservation is unresolved.
 if exists(select 1 from public.tenbot_openai_usage where id=p_id) then raise exception 'Inference reservation already exists' using errcode='23505'; end if;
 select coalesce(sum(coalesce(actual_microusd,reserved_microusd)),0),
   coalesce(sum(coalesce(actual_microusd,reserved_microusd)) filter(where created_at>=v_day),0),
   coalesce(sum(coalesce(actual_microusd,reserved_microusd)) filter(where created_at>=v_month),0),
   coalesce(sum(coalesce(actual_microusd,reserved_microusd)) filter(where user_id=p_user and created_at>=v_day),0),
   coalesce(sum(coalesce(actual_microusd,reserved_microusd)) filter(where user_id=p_user and request_id=p_request_id),0)
 into v_total,v_daily,v_monthly,v_user_daily,v_request from public.tenbot_openai_usage;
 v_total:=v_total+p.legacy_accounted_microusd;
 if p.legacy_accounted_day=(v_day at time zone 'UTC')::date then v_daily:=v_daily+p.legacy_accounted_microusd; end if;
 if date_trunc('month',p.legacy_accounted_day::timestamp)=date_trunc('month',v_now at time zone 'UTC') then v_monthly:=v_monthly+p.legacy_accounted_microusd; end if;
 if v_total+p_reserved_microusd>p.total_limit_microusd or v_daily+p_reserved_microusd>p.day_limit_microusd
   or v_monthly+p_reserved_microusd>p.month_limit_microusd or v_user_daily+p_reserved_microusd>p.user_day_limit_microusd
   or v_request+p_reserved_microusd>p.request_limit_microusd then raise exception 'OpenAI budget unavailable' using errcode='P0001'; end if;
 if (select count(*) from public.tenbot_openai_usage where user_id=p_user and request_id=p_request_id)>=p.request_step_limit
   or (select count(*) from public.tenbot_openai_usage where created_at>v_now-interval '1 minute')>=p.global_minute_step_limit
   or (select count(*) from public.tenbot_openai_usage where user_id=p_user and created_at>v_now-interval '1 minute')>=p.user_minute_step_limit
   or (select count(*) from public.tenbot_openai_usage where state in ('reserved','uncertain'))>=p.global_open_limit
   or (select count(*) from public.tenbot_openai_usage where user_id=p_user and state in ('reserved','uncertain'))>=p.user_open_limit then raise exception 'OpenAI request limit reached' using errcode='P0001'; end if;
 if not exists(select 1 from public.tenbot_openai_usage where user_id=p_user and request_id=p_request_id) then
   if (select count(distinct (user_id,request_id)) from public.tenbot_openai_usage where created_at>=v_day)>=p.global_day_request_limit
     or (select count(distinct request_id) from public.tenbot_openai_usage where user_id=p_user and created_at>=v_day)>=p.user_day_request_limit then raise exception 'OpenAI request limit reached' using errcode='P0001'; end if;
 end if;
 insert into public.tenbot_openai_usage(id,user_id,request_id,model,policy_version,reserved_microusd)
   values(p_id,p_user,p_request_id,p_model,p.version,p_reserved_microusd);
 return jsonb_build_object('ok',true,'id',p_id,'requestId',p_request_id,'reservedMicrousd',p_reserved_microusd);
end; $$;

create function public.tenbot_openai_settle(p_user uuid,p_id uuid,p_actual_microusd bigint default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare u public.tenbot_openai_usage;v_overrun boolean;
begin
 perform 1 from public.tenbot_openai_policy where singleton for update;
 if not found then raise exception 'OpenAI meter unavailable'; end if;
 if p_user is null or p_id is null or p_actual_microusd<0 or p_actual_microusd>1000000000000 then raise exception 'Invalid inference measurement' using errcode='22023'; end if;
 select * into u from public.tenbot_openai_usage where id=p_id and user_id=p_user for update;
 if not found then raise exception 'Inference reservation unavailable'; end if;
 -- Settlement remains possible after permission revocation or policy shutdown:
 -- it records an already-dispatched charge and grants no new inference/read.
 if u.state='measured' then
   if p_actual_microusd is not null and p_actual_microusd is distinct from u.actual_microusd then raise exception 'Inference measurement conflict'; end if;
 elsif p_actual_microusd is null then
   update public.tenbot_openai_usage set state='uncertain' where id=p_id;
   u.state:='uncertain';
 else
   update public.tenbot_openai_usage set state='measured',actual_microusd=p_actual_microusd,settled_at=clock_timestamp() where id=p_id;
   u.state:='measured';u.actual_microusd:=p_actual_microusd;
 end if;
 v_overrun:=u.actual_microusd is not null and u.actual_microusd>u.reserved_microusd;
 -- Record a pricing/bound failure rather than hiding its actual charge, then
 -- latch the provider OFF. The adapter must reject this result before next use.
 if v_overrun then update public.tenbot_openai_policy set enabled=false where singleton; end if;
 return jsonb_build_object('ok',true,'id',u.id,'state',u.state,'accountedMicrousd',coalesce(u.actual_microusd,u.reserved_microusd),'overrun',v_overrun);
end; $$;

create function public.tenbot_openai_meter_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.tenbot_openai_policy;v_accounted numeric;
begin
 select * into p from public.tenbot_openai_policy where singleton;
 if not found then return jsonb_build_object('ok',false); end if;
 select coalesce(sum(coalesce(actual_microusd,reserved_microusd)),0)+p.legacy_accounted_microusd into v_accounted from public.tenbot_openai_usage;
 return jsonb_build_object('ok',true,'version',p.version,'enabled',p.enabled,'expiresAt',p.expires_at,'allowedModels',p.allowed_models,
   'legacyAccountedMicrousd',p.legacy_accounted_microusd,'totalLimitMicrousd',p.total_limit_microusd,'accountedMicrousd',v_accounted,
   'remainingMicrousd',greatest(0,p.total_limit_microusd-v_accounted),'uncertainReservations',(select count(*) from public.tenbot_openai_usage where state='uncertain'));
end; $$;
alter function public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint) owner to postgres;
alter function public.tenbot_openai_settle(uuid,uuid,bigint) owner to postgres;
alter function public.tenbot_openai_meter_status() owner to postgres;
revoke all on function public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint),public.tenbot_openai_settle(uuid,uuid,bigint),public.tenbot_openai_meter_status() from public,anon,authenticated;
grant execute on function public.tenbot_openai_reserve(uuid,uuid,uuid,text,bigint),public.tenbot_openai_settle(uuid,uuid,bigint),public.tenbot_openai_meter_status() to service_role;
notify pgrst,'reload schema';
commit;
