-- Disabled-first development allowance. Applying this migration is a separate
-- approved action; it does not fund or activate any inference provider.
-- Reuse the atomic hosted ledger. No journal reset, deletion, or guessed refund.
begin;

alter table public.tenbot_openai_policy
 add column legacy_unresolved_microusd bigint not null default 0
 check(legacy_unresolved_microusd between 0 and legacy_accounted_microusd);

-- One ordinary allowance: at most $5 per UTC calendar month, shared by all
-- employees/models using this ledger. Lowering it remains possible. Unknown
-- charges are held across month boundaries until a supported measurement.
update public.tenbot_openai_policy
 set enabled=false, version=version+1, month_limit_microusd=5000000,
 request_limit_microusd=case when request_limit_microusd=0 then 250000
   else least(request_limit_microusd,250000) end;
alter table public.tenbot_openai_policy
 add constraint tenbot_openai_monthly_allowance_ceiling
 check(month_limit_microusd<=5000000);

-- Keep historical imported spend and unresolved imports intact. A later
-- reconciliation of an imported unknown needs its own reviewed evidence/change;
-- ordinary policy edits must never silently make a held charge disappear.
create or replace function public.tenbot_openai_preserve_carryover() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.legacy_accounted_microusd<old.legacy_accounted_microusd
   or new.legacy_unresolved_microusd<old.legacy_unresolved_microusd then
   raise exception 'Accounted carryover cannot decrease' using errcode='23514';
 end if;
 return new;
end; $$;
drop trigger tenbot_openai_preserve_carryover on public.tenbot_openai_policy;
create trigger tenbot_openai_preserve_carryover
 before update of legacy_accounted_microusd,legacy_unresolved_microusd
 on public.tenbot_openai_policy for each row
 execute function public.tenbot_openai_preserve_carryover();

create or replace function public.tenbot_openai_reserve(
 p_user uuid,p_request_id uuid,p_id uuid,p_model text,p_reserved_microusd bigint
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='2s' as $$
declare p public.tenbot_openai_policy;v_now timestamptz;v_month timestamptz;
 v_monthly numeric;v_request numeric;
begin
 -- Reserve, settle and policy changes still serialize across every instance.
 select * into p from public.tenbot_openai_policy where singleton for update;
 v_now:=clock_timestamp();
 v_month:=date_trunc('month',v_now at time zone 'UTC') at time zone 'UTC';
 if not found or not p.enabled or p.expires_at<=v_now then
   raise exception 'OpenAI meter unavailable' using errcode='P0001';
 end if;
 if p_user is null or p_request_id is null or p_id is null or p_model is null
   or not(p_model=any(p.allowed_models)) or p_reserved_microusd is null
   or p_reserved_microusd<=0 or p_reserved_microusd>1000000000000 then
   raise exception 'Invalid inference reservation' using errcode='22023';
 end if;
 if not exists(select 1 from public.app_users u
   join public.app_role_capabilities c on c.role=u.role
   where u.user_id=p_user and u.is_active and c.capability='readOperationalData') then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 if exists(select 1 from public.tenbot_openai_usage where id=p_id) then
   raise exception 'Inference reservation already exists' using errcode='23505';
 end if;
 select coalesce(sum(coalesce(actual_microusd,reserved_microusd))
     filter(where created_at>=v_month or state in ('reserved','uncertain')),0),
   coalesce(sum(coalesce(actual_microusd,reserved_microusd))
     filter(where user_id=p_user and request_id=p_request_id),0)
 into v_monthly,v_request from public.tenbot_openai_usage;
 -- Imported unknowns are part of (not additional to) imported cumulative spend.
 v_monthly:=v_monthly+p.legacy_unresolved_microusd;
 if date_trunc('month',p.legacy_accounted_day::timestamp)=
   date_trunc('month',v_now at time zone 'UTC') then
   v_monthly:=v_monthly+p.legacy_accounted_microusd-p.legacy_unresolved_microusd;
 end if;
 if v_monthly+p_reserved_microusd>p.month_limit_microusd
   or v_request+p_reserved_microusd>p.request_limit_microusd then
   raise exception 'OpenAI budget unavailable' using errcode='P0001';
 end if;
 if (select count(*) from public.tenbot_openai_usage
     where user_id=p_user and request_id=p_request_id)>=p.request_step_limit
   or (select count(*) from public.tenbot_openai_usage
     where created_at>v_now-interval '1 minute')>=p.global_minute_step_limit
   or (select count(*) from public.tenbot_openai_usage
     where user_id=p_user and created_at>v_now-interval '1 minute')>=p.user_minute_step_limit then
   raise exception 'OpenAI request limit reached' using errcode='P0001';
 end if;
 insert into public.tenbot_openai_usage(id,user_id,request_id,model,policy_version,reserved_microusd)
   values(p_id,p_user,p_request_id,p_model,p.version,p_reserved_microusd);
 return jsonb_build_object('ok',true,'id',p_id,'requestId',p_request_id,
   'reservedMicrousd',p_reserved_microusd);
end; $$;

create or replace function public.tenbot_openai_meter_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.tenbot_openai_policy;v_accounted numeric;v_monthly numeric;
 v_held numeric;v_month timestamptz;
begin
 select * into p from public.tenbot_openai_policy where singleton;
 if not found then return jsonb_build_object('ok',false); end if;
 v_month:=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 select coalesce(sum(coalesce(actual_microusd,reserved_microusd)),0)+p.legacy_accounted_microusd,
   coalesce(sum(coalesce(actual_microusd,reserved_microusd))
     filter(where created_at>=v_month or state in ('reserved','uncertain')),0),
   coalesce(sum(reserved_microusd) filter(where state in ('reserved','uncertain')),0)
 into v_accounted,v_monthly,v_held from public.tenbot_openai_usage;
 v_monthly:=v_monthly+p.legacy_unresolved_microusd;
 v_held:=v_held+p.legacy_unresolved_microusd;
 if date_trunc('month',p.legacy_accounted_day::timestamp)=
   date_trunc('month',v_month at time zone 'UTC') then
   v_monthly:=v_monthly+p.legacy_accounted_microusd-p.legacy_unresolved_microusd;
 end if;
 return jsonb_build_object('ok',true,'version',p.version,'enabled',p.enabled,
   'expiresAt',p.expires_at,'allowedModels',p.allowed_models,
   'allowanceMode','monthly','monthStartsAt',v_month,
   'monthLimitMicrousd',p.month_limit_microusd,'monthAccountedMicrousd',v_monthly,
   'heldMicrousd',v_held,'legacyUnresolvedMicrousd',p.legacy_unresolved_microusd,
   'legacyAccountedMicrousd',p.legacy_accounted_microusd,
   'totalLimitMicrousd',p.total_limit_microusd,'accountedMicrousd',v_accounted,
   'remainingMicrousd',greatest(0,p.month_limit_microusd-v_monthly),
   'uncertainReservations',(select count(*) from public.tenbot_openai_usage where state='uncertain'));
end; $$;

-- Existing service-only grants, RLS, settlement/overrun latch and owner checks
-- remain. Legacy total/day/user-day/open/daily-request limit columns remain for
-- historical inspection, but are not gates in the ordinary monthly allowance.
comment on column public.tenbot_openai_policy.month_limit_microusd is
 'Ordinary shared USD allowance per UTC calendar month; hard maximum $5. Unknown charges carry forward.';
comment on column public.tenbot_openai_policy.legacy_unresolved_microusd is
 'Evidenced unresolved portion included in legacy_accounted_microusd; charged every month. No automatic journal import/refund.';
notify pgrst,'reload schema';
commit;
