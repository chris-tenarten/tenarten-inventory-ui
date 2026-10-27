-- Local candidate only: no hosted application is authorized.
-- Replace pilot dollar-shaped testing credits with shared request and Neuron
-- limits. Keep every historical reservation; unknown usage stays conservative.
begin;
alter table public.tenbot_usage drop constraint tenbot_usage_reserved_usd_check;
alter table public.tenbot_usage add constraint tenbot_usage_reserved_usd_check check(reserved_usd >= 0);
alter table public.tenbot_usage
 add column reserved_neurons numeric not null default 200 check(reserved_neurons > 0),
 add column estimated_neurons numeric check(estimated_neurons >= 0),
 add column model text,
 add column input_tokens bigint check(input_tokens >= 0),
 add column output_tokens bigint check(output_tokens >= 0);
alter table public.tenbot_usage add constraint tenbot_usage_measurement_complete check(
 (estimated_neurons is null and input_tokens is null and output_tokens is null)
 or (estimated_neurons is not null and input_tokens is not null and output_tokens is not null and model is not null));

-- One policy shared by the atomic reservation and administrator summary. This
-- internal policy does not activate a provider or authorize paid inference.
create function public.tenbot_usage_policy() returns jsonb
language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('version',2,'dayRequests',300,'monthRequests',6000,
  'minuteRequests',6,'dayNeurons',8000,'monthNeurons',240000);
$$;
alter function public.tenbot_usage_policy() owner to postgres;
revoke all on function public.tenbot_usage_policy() from public,anon,authenticated,service_role;

create function public.tenbot_reserve_usage(p_user uuid,p_model text,p_reserved_neurons numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_policy jsonb:=public.tenbot_usage_policy();
 v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_model is null or p_model not in ('@cf/meta/llama-3.1-8b-instruct-fp8','@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/qwen/qwen3-30b-a3b-fp8') or p_reserved_neurons is null
  or p_reserved_neurons<=0 or p_reserved_neurons>(v_policy->>'dayNeurons')::numeric then raise exception 'Invalid inference reservation'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=(v_policy->>'minuteRequests')::int then raise exception 'TenBot rate limit reached'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=v_day)>=(v_policy->>'dayRequests')::int then raise exception 'TenBot shared daily pool exhausted'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=v_month)>=(v_policy->>'monthRequests')::int then raise exception 'TenBot shared monthly pool exhausted'; end if;
 if (select coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) from public.tenbot_usage where created_at>=v_day)+p_reserved_neurons>(v_policy->>'dayNeurons')::numeric then raise exception 'TenBot daily inference budget exhausted'; end if;
 if (select coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) from public.tenbot_usage where created_at>=v_month)+p_reserved_neurons>(v_policy->>'monthNeurons')::numeric then raise exception 'TenBot monthly inference budget exhausted'; end if;
 -- The legacy USD column remains historical. New requests use Neurons and
 -- reserve no dollar-shaped testing credit; none of these values are billing.
 insert into public.tenbot_usage(user_id,reserved_usd,reserved_neurons,model)
  values(p_user,0,p_reserved_neurons,p_model) returning id into v_id;
 return v_id;
end; $$;

create function public.tenbot_finish_usage(p_id uuid,p_outcome text,p_model text,p_input_tokens bigint,p_output_tokens bigint,p_estimated_neurons numeric) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_input_rate numeric;v_output_rate numeric;v_expected numeric;
begin
 if p_outcome not in ('completed','failed') or p_outcome is null then raise exception 'Invalid outcome'; end if;
 if (p_input_tokens is null or p_output_tokens is null or p_estimated_neurons is null)
  and (p_input_tokens is not null or p_output_tokens is not null or p_estimated_neurons is not null) then raise exception 'Incomplete inference measurement'; end if;
 if p_input_tokens<0 or p_input_tokens>100000 or p_output_tokens<0 or p_output_tokens>640 or p_estimated_neurons<0 then raise exception 'Invalid inference measurement'; end if;
 if p_estimated_neurons is not null then
  -- Defense against accidental under-accounting: independently reproduce the
  -- model's published token-to-Neuron estimate, never a client-supplied cost.
  select case p_model when '@cf/meta/llama-3.1-8b-instruct-fp8' then 13778 when '@cf/meta/llama-3.3-70b-instruct-fp8-fast' then 26668 when '@cf/qwen/qwen3-30b-a3b-fp8' then 4625 end,
   case p_model when '@cf/meta/llama-3.1-8b-instruct-fp8' then 26128 when '@cf/meta/llama-3.3-70b-instruct-fp8-fast' then 204805 when '@cf/qwen/qwen3-30b-a3b-fp8' then 30475 end into v_input_rate,v_output_rate;
  v_expected:=ceil((p_input_tokens*v_input_rate+p_output_tokens*v_output_rate)/1000)/1000;
  if v_expected is null or p_estimated_neurons is distinct from v_expected then raise exception 'Invalid inference measurement'; end if;
 end if;
 -- Only provider-side token telemetry is passed here. A missing measurement,
 -- including an uncertain timeout, keeps the full original reservation.
 update public.tenbot_usage set outcome=p_outcome,input_tokens=p_input_tokens,
  output_tokens=p_output_tokens,estimated_neurons=p_estimated_neurons
  where id=p_id and outcome='reserved' and model=p_model;
 if not found then raise exception 'Inference reservation unavailable'; end if;
end; $$;

create or replace function public.tenbot_usage_summary() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_policy jsonb:=public.tenbot_usage_policy();
 v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_day_used bigint;v_month_used bigint;v_day_neurons numeric;v_month_neurons numeric;
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 select count(*),coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) into v_day_used,v_day_neurons from public.tenbot_usage where created_at>=v_day;
 select count(*),coalesce(sum(coalesce(estimated_neurons,reserved_neurons)),0) into v_month_used,v_month_neurons from public.tenbot_usage where created_at>=v_month;
 return jsonb_build_object('policyVersion',v_policy->'version','dayStart',v_day,'dayResetAt',v_day+interval '1 day',
  'sharedDayLimit',v_policy->'dayRequests','sharedDayUsed',v_day_used,'sharedDayRemaining',greatest(0,(v_policy->>'dayRequests')::int-v_day_used),
  'sharedMonthLimit',v_policy->'monthRequests','sharedMonthUsed',v_month_used,'sharedMonthRemaining',greatest(0,(v_policy->>'monthRequests')::int-v_month_used),
  'perAccountMinuteLimit',v_policy->'minuteRequests','monthStart',v_month,
  'dayNeuronLimit',v_policy->'dayNeurons','dayAccountedNeurons',v_day_neurons,
  'monthNeuronLimit',v_policy->'monthNeurons','monthAccountedNeurons',v_month_neurons,
  'dayMeasuredInputTokens',(select coalesce(sum(input_tokens),0) from public.tenbot_usage where created_at>=v_day),
  'dayMeasuredOutputTokens',(select coalesce(sum(output_tokens),0) from public.tenbot_usage where created_at>=v_day),
  'dayUnmeasuredAttempts',(select count(*) from public.tenbot_usage where created_at>=v_day and estimated_neurons is null),
  'dayCompleted',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='completed'),
  'dayFailed',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='failed'));
end; $$;
alter function public.tenbot_reserve_usage(uuid,text,numeric) owner to postgres;
alter function public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) owner to postgres;
revoke all on function public.tenbot_reserve_usage(uuid,text,numeric),public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) from public,anon,authenticated;
-- Old RPC definitions remain as history, but cannot bypass the new policy.
revoke all on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_finish_usage(uuid,text) from service_role;
grant execute on function public.tenbot_reserve_usage(uuid,text,numeric),public.tenbot_finish_usage(uuid,text,text,bigint,bigint,numeric) to service_role;
commit;
