begin;

do $$
declare
  test_job uuid := gen_random_uuid();
  overlay_id uuid;
  pause_id uuid;
  planning_only_id uuid;
  result jsonb;
  stale_failed boolean := false;
  stale_job_failed boolean := false;
begin
  if to_regprocedure('public.save_production_planning_schedule_batch(jsonb,jsonb,text,text,uuid)') is null then
    raise exception 'VERIFY_MIXED_RPC_MISSING';
  end if;
  if exists(
    select 1 from pg_proc procedure
    cross join lateral aclexplode(coalesce(procedure.proacl,acldefault('f',procedure.proowner))) acl
    where procedure.oid='public.save_production_planning_schedule_batch(jsonb,jsonb,text,text,uuid)'::regprocedure
      and acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'VERIFY_MIXED_RPC_PUBLIC_EXECUTE';
  end if;
  if not has_function_privilege('anon', 'public.save_production_planning_schedule_batch(jsonb,jsonb,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_production_planning_schedule_batch(jsonb,jsonb,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.save_production_planning_schedule_batch(jsonb,jsonb,text,text,uuid)', 'EXECUTE') then
    raise exception 'VERIFY_MIXED_RPC_PRERBAC_BOUNDARY';
  end if;
  if not exists(
    select 1 from pg_proc p
    join pg_namespace namespace on namespace.oid=p.pronamespace
    where namespace.nspname='public' and p.proname='save_production_planning_schedule_batch'
      and p.prosecdef and p.proowner='postgres'::regrole
      and p.proconfig @> array['search_path=public, pg_temp']
  ) then raise exception 'VERIFY_MIXED_RPC_SECURITY'; end if;
  if exists(
    select 1 from pg_class ledger
    cross join lateral aclexplode(coalesce(ledger.relacl,acldefault('r',ledger.relowner))) acl
    where ledger.oid='public.production_planning_schedule_batches'::regclass
      and acl.grantee=0 and acl.privilege_type='SELECT'
  ) or has_table_privilege('anon','public.production_planning_schedule_batches','SELECT')
    or has_table_privilege('authenticated','public.production_planning_schedule_batches','SELECT')
    or has_table_privilege('service_role','public.production_planning_schedule_batches','SELECT') then
    raise exception 'VERIFY_PRIVATE_MIXED_LEDGER';
  end if;

  insert into public.jobs(id, name, job_number, planned_start, planned_end)
  values(test_job, 'VERIFY mixed schedule rollback fixture', 'VERIFY-MIXED', date '2026-08-03', date '2026-08-28');

  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date,include_in_planning_progress)
  values(test_job,'Overlay','overlay','2026-08-04','2026-08-07',true) returning id into overlay_id;
  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date,include_in_planning_progress,shift_with_production)
  values(test_job,'Pause','pause','2026-08-18','2026-08-19',false,false) returning id into pause_id;
  insert into public.planning_phases(job_id,title,timeline_behavior,include_in_planning_progress)
  values(test_job,'Planning only','planning_only',true) returning id into planning_only_id;

  result := public.save_production_planning_schedule_batch(
    jsonb_build_array(jsonb_build_object(
      'job_id',test_job,'original_planned_start','2026-08-03','original_planned_end','2026-08-28',
      'original_updated_at',(select updated_at from public.jobs where id=test_job),
      'proposed_planned_start','2026-08-22','proposed_planned_end','2026-09-16','change_source','production_timeline')),
    jsonb_build_array(jsonb_build_object(
      'phase_id',overlay_id,'original_start_date','2026-08-04','original_end_date','2026-08-07',
      'original_updated_at',(select updated_at from public.planning_phases where id=overlay_id),
      'proposed_start_date','2026-08-23','proposed_end_date','2026-08-26','change_source','production_reschedule')),
    'Verifier','rollback fixture',gen_random_uuid()
  );
  if result->>'updated_count' <> '2'
    or (select planned_start from public.jobs where id=test_job) <> date '2026-08-22'
    or (select start_date from public.planning_phases where id=overlay_id) <> date '2026-08-23'
    or (select start_date from public.planning_phases where id=pause_id) <> date '2026-08-18' then
    raise exception 'VERIFY_MIXED_ATOMIC_SAVE';
  end if;

  begin
    perform public.save_production_planning_schedule_batch(
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'phase_id',overlay_id,'original_start_date','2026-08-04','original_end_date','2026-08-07',
        'original_updated_at','2000-01-01T00:00:00Z','proposed_start_date','2026-08-24',
        'proposed_end_date','2026-08-27','change_source','planning_timeline')),
      'Verifier',null,gen_random_uuid());
  exception when sqlstate 'P0001' then
    stale_failed := sqlerrm = 'production_planning_schedule_conflict';
  end;
  if not stale_failed then raise exception 'VERIFY_STALE_PHASE_CONFLICT'; end if;
  if (select start_date from public.planning_phases where id=overlay_id) <> date '2026-08-23' then
    raise exception 'VERIFY_CONFLICT_PARTIAL_WRITE';
  end if;

  begin
    perform public.save_production_planning_schedule_batch(
      jsonb_build_array(jsonb_build_object(
        'job_id',test_job,'original_planned_start','2026-08-03','original_planned_end','2026-08-28',
        'original_updated_at','2000-01-01T00:00:00Z','proposed_planned_start','2026-08-24',
        'proposed_planned_end','2026-09-17','change_source','production_timeline')),
      jsonb_build_array(jsonb_build_object(
        'phase_id',overlay_id,'original_start_date','2026-08-23','original_end_date','2026-08-26',
        'original_updated_at',(select updated_at from public.planning_phases where id=overlay_id),
        'proposed_start_date','2026-08-25','proposed_end_date','2026-08-28','change_source','production_reschedule')),
      'Verifier',null,gen_random_uuid());
  exception when sqlstate 'P0001' then
    stale_job_failed := sqlerrm = 'production_schedule_conflict';
  end;
  if not stale_job_failed then raise exception 'VERIFY_STALE_PRODUCTION_CONFLICT'; end if;
  if (select start_date from public.planning_phases where id=overlay_id) <> date '2026-08-23' then
    raise exception 'VERIFY_PRODUCTION_CONFLICT_PARTIAL_WRITE';
  end if;
end $$;

rollback;

do $$ begin
  if exists(select 1 from public.jobs where job_number='VERIFY-MIXED') then
    raise exception 'VERIFY_FIXTURE_PERSISTED';
  end if;
end $$;
