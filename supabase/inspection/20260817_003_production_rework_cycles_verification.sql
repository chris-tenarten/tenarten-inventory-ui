begin;

do $$
declare
  fixture_job uuid;
  original_start date := date '2097-01-02';
  original_end date := date '2097-01-10';
  first_cycle public.production_rework_cycles;
  second_cycle public.production_rework_cycles;
  ordinary_job public.jobs;
  scheduled jsonb;
  replayed jsonb;
  mixed_result jsonb;
  schedule_batch uuid := '00000000-0000-4000-9000-000000000317';
  mixed_batch uuid := '00000000-0000-4000-9000-000000000318';
begin
  insert into public.jobs(name, job_number, production_status, planned_start, planned_end, material_status, priority, progress_percent)
  values ('REWORK VERIFIER — ROLLBACK', 'REWORK-VERIFY-2097', 'complete', original_start, original_end, 'unknown', 'normal', 100)
  returning id into fixture_job;

  insert into public.jobs(name, job_number, production_status, planned_start, planned_end, material_status, priority, progress_percent)
  values ('REWORK MIXED ORDINARY — ROLLBACK', 'REWORK-MIXED-2097', 'not_started', date '2097-03-01', date '2097-03-05', 'unknown', 'normal', 0)
  returning * into ordinary_job;

  first_cycle := public.create_production_rework(fixture_job, 'quality_qc', 'Verifier-only returned work.', date '2097-01-12', 'Verifier');
  if first_cycle.sequence_number <> 1 or first_cycle.job_id <> fixture_job then raise exception 'First Rework allocation assertion failed.'; end if;
  if first_cycle.planned_start is not null or first_cycle.production_status <> 'not_started' then raise exception 'New Rework lifecycle defaults assertion failed.'; end if;

  begin
    perform public.create_production_rework(fixture_job, 'other', 'Must be rejected.', date '2097-01-13', 'Verifier');
    raise exception 'One-active-Rework assertion failed.';
  exception when unique_violation then null; end;

  scheduled := public.save_production_rework_schedule_batch(jsonb_build_array(jsonb_build_object(
    'rework_cycle_id', first_cycle.id,
    'original_planned_start', null,
    'original_planned_end', null,
    'original_updated_at', first_cycle.updated_at,
    'proposed_planned_start', '2097-01-15',
    'proposed_planned_end', '2097-01-20',
    'change_source', 'production_timeline'
  )), 'Verifier', null, schedule_batch);
  if (scheduled->>'updated_count')::integer <> 1 then raise exception 'Rework schedule save assertion failed.'; end if;
  replayed := public.save_production_rework_schedule_batch(jsonb_build_array(jsonb_build_object(
    'rework_cycle_id', first_cycle.id,
    'original_planned_start', null,
    'original_planned_end', null,
    'original_updated_at', first_cycle.updated_at,
    'proposed_planned_start', '2097-01-15',
    'proposed_planned_end', '2097-01-20',
    'change_source', 'production_timeline'
  )), 'Verifier', null, schedule_batch);
  if coalesce((replayed->>'replayed')::boolean, false) is not true then raise exception 'Rework schedule idempotent replay assertion failed.'; end if;
  if (select count(*) from public.job_activity where job_id = fixture_job and event_type = 'production_rework_schedule_changed') <> 1 then
    raise exception 'Rework schedule replay duplicated activity.';
  end if;
  if exists (select 1 from public.jobs where id = fixture_job and (planned_start <> original_start or planned_end <> original_end or production_status <> 'complete')) then
    raise exception 'Canonical Production lifecycle was modified by Rework.';
  end if;

  select * into first_cycle from public.production_rework_cycles where id = first_cycle.id;
  mixed_result := public.save_production_rework_mixed_schedule_batch(
    jsonb_build_array(jsonb_build_object(
      'job_id', ordinary_job.id,
      'original_planned_start', ordinary_job.planned_start,
      'original_planned_end', ordinary_job.planned_end,
      'original_updated_at', ordinary_job.updated_at,
      'proposed_planned_start', '2097-03-02',
      'proposed_planned_end', '2097-03-06',
      'change_source', 'production_timeline'
    )),
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'rework_cycle_id', first_cycle.id,
      'original_planned_start', first_cycle.planned_start,
      'original_planned_end', first_cycle.planned_end,
      'original_updated_at', first_cycle.updated_at,
      'proposed_planned_start', '2097-01-16',
      'proposed_planned_end', '2097-01-21',
      'change_source', 'production_timeline'
    )),
    'Verifier', null, mixed_batch
  );
  if (mixed_result->>'updated_count')::integer <> 2 then raise exception 'Mixed Production/Rework schedule count assertion failed.'; end if;
  if not exists (select 1 from public.jobs where id = ordinary_job.id and planned_start = date '2097-03-02' and planned_end = date '2097-03-06') then
    raise exception 'Mixed scheduling did not update the ordinary Production Job.';
  end if;
  if exists (select 1 from public.jobs where id = fixture_job and (planned_start <> original_start or planned_end <> original_end or production_status <> 'complete')) then
    raise exception 'Mixed scheduling routed Rework dates into the canonical Job.';
  end if;
  if not exists (select 1 from public.production_rework_cycles where id = first_cycle.id and planned_start = date '2097-01-16' and planned_end = date '2097-01-21') then
    raise exception 'Mixed scheduling did not update the Rework lifecycle.';
  end if;

  select * into first_cycle from public.production_rework_cycles where id = first_cycle.id;
  first_cycle := public.update_production_rework_status(first_cycle.id, 'complete', first_cycle.updated_at, 'Verifier');
  if first_cycle.completed_at is null then raise exception 'Rework completion assertion failed.'; end if;

  second_cycle := public.create_production_rework(fixture_job, 'shipping_handling', 'Second verifier-only cycle.', date '2097-02-01', 'Verifier');
  if second_cycle.sequence_number <> 2 then raise exception 'Concurrency-safe sequence progression assertion failed.'; end if;
  if (select count(*) from public.jobs where id = fixture_job) <> 1 then raise exception 'Rework created a duplicate commercial Job.'; end if;
  if (select count(*) from public.production_rework_cycles where job_id = fixture_job) <> 2 then raise exception 'Rework history assertion failed.'; end if;
end;
$$;

rollback;

do $$
begin
  if exists (select 1 from public.jobs where job_number = 'REWORK-VERIFY-2097') then
    raise exception 'Rework verification fixture job remained after rollback.';
  end if;
  if exists (select 1 from public.jobs where job_number = 'REWORK-MIXED-2097') then
    raise exception 'Rework mixed-schedule fixture job remained after rollback.';
  end if;
  if exists (select 1 from public.production_rework_cycles cycle join public.jobs job on job.id = cycle.job_id where job.job_number = 'REWORK-VERIFY-2097') then
    raise exception 'Rework verification fixture cycle remained after rollback.';
  end if;
  if exists (select 1 from public.production_rework_schedule_batches where batch_id in ('00000000-0000-4000-9000-000000000317', '00000000-0000-4000-9000-000000000318')) then
    raise exception 'Rework verification batch-ledger fixture remained after rollback.';
  end if;
end;
$$;

select 'Production Rework verification passed; fixtures rolled back.' as result;
