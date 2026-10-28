-- Local candidate only. No hosted application authorized.
-- Supersedes separate local per-user daily allocations; preserves the ledger,
-- account burst protection and server-configured monthly reservation budget.
begin;
create or replace function public.tenbot_reserve_usage(p_user uuid,p_monthly_usd numeric) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if p_monthly_usd is null or p_monthly_usd<=0 or p_monthly_usd>100 then raise exception 'Inference budget disabled'; end if;
 if not exists(select 1 from public.app_users where user_id=p_user and is_active) then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(27120000);
 if (select count(*) from public.tenbot_usage where user_id=p_user and created_at>now()-interval '1 minute')>=6 then raise exception 'TenBot rate limit reached'; end if;
 if (select count(*) from public.tenbot_usage where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'TenBot shared daily pool exhausted'; end if;
 if (select coalesce(sum(reserved_usd),0) from public.tenbot_usage where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+0.01>p_monthly_usd then raise exception 'TenBot monthly budget exhausted'; end if;
 insert into public.tenbot_usage(user_id,reserved_usd) values(p_user,0.01) returning id into v_id; return v_id;
end; $$;

-- Aggregate inference reservations only. Never returns account identities,
-- employee questions, feedback, messages or business records.
create function public.tenbot_usage_summary() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 v_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_used bigint; v_reserved numeric;
begin
 if not public.has_app_capability('manageUsers') then raise exception 'Not authorized' using errcode='42501'; end if;
 select count(*) into v_used from public.tenbot_usage where created_at>=v_day;
 select coalesce(sum(reserved_usd),0) into v_reserved from public.tenbot_usage where created_at>=v_month;
 return jsonb_build_object('dayStart',v_day,'dayResetAt',v_day+interval '1 day',
  'sharedDayLimit',20,'sharedDayUsed',v_used,'sharedDayRemaining',greatest(0,20-v_used),
  'perAccountMinuteLimit',6,'monthStart',v_month,'monthReservedUsd',v_reserved,
  'dayCompleted',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='completed'),
  'dayFailed',(select count(*) from public.tenbot_usage where created_at>=v_day and outcome='failed'));
end; $$;
alter function public.tenbot_reserve_usage(uuid,numeric) owner to postgres;
alter function public.tenbot_usage_summary() owner to postgres;
revoke all on function public.tenbot_reserve_usage(uuid,numeric),public.tenbot_usage_summary() from public,anon,authenticated;
grant execute on function public.tenbot_reserve_usage(uuid,numeric) to service_role;
grant execute on function public.tenbot_usage_summary() to authenticated;
commit;
