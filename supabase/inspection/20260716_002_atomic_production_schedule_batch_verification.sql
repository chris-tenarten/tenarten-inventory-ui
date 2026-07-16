-- Run only after migration 20260716_002 in a non-production SQL Editor session.
-- Every fixture and assertion is enclosed in this transaction and rolled back.
begin;

do $verification$
declare
  job_a public.jobs%rowtype;
  job_b public.jobs%rowtype;
  result jsonb;
  batch uuid := gen_random_uuid();
  activity_count integer;
  before_a timestamptz;
begin
  insert into public.jobs (name, job_number, planned_start, planned_end)
  values ('RPC authoritative fixture A', 'RPC-A', date '2099-01-01', date '2099-01-03') returning * into job_a;
  insert into public.jobs (name, job_number, planned_start, planned_end)
  values ('RPC authoritative fixture B', 'RPC-B', date '2099-02-01', date '2099-02-03') returning * into job_b;

  result := public.save_production_schedule_batch(jsonb_build_array(
    jsonb_build_object('job_id', job_a.id, 'original_planned_start', job_a.planned_start, 'original_planned_end', job_a.planned_end, 'original_updated_at', job_a.updated_at, 'proposed_planned_start', '2099-01-02', 'proposed_planned_end', '2099-01-04', 'change_source', 'production_timeline', 'name', 'client spoof'),
    jsonb_build_object('job_id', job_b.id, 'original_planned_start', job_b.planned_start, 'original_planned_end', job_b.planned_end, 'original_updated_at', job_b.updated_at, 'proposed_planned_start', '2099-02-02', 'proposed_planned_end', '2099-02-04', 'change_source', 'production_table')
  ), 'Verification Actor', 'Atomic test', batch);
  if (result->>'updated_count')::integer <> 2 then raise exception 'Expected two updated jobs'; end if;
  select count(*) into activity_count from public.job_activity where metadata->>'batch_id' = batch::text;
  if activity_count <> 2 then raise exception 'Expected two activity rows'; end if;
  if exists (select 1 from public.job_activity where metadata->>'batch_id' = batch::text and summary like '%client spoof%') then raise exception 'Client name leaked into summary'; end if;
  result := public.save_production_schedule_batch((select request_proposals from public.production_schedule_batches where batch_id = batch), 'Verification Actor', 'Atomic test', batch);
  if result->>'replayed' <> 'true' then raise exception 'Expected idempotent replay'; end if;
  select count(*) into activity_count from public.job_activity where metadata->>'batch_id' = batch::text;
  if activity_count <> 2 then raise exception 'Replay duplicated activity'; end if;

  select updated_at into before_a from public.jobs where id = job_a.id;
  begin
    perform public.save_production_schedule_batch(jsonb_build_array(
      jsonb_build_object('job_id', job_a.id, 'original_planned_start', '2099-01-02', 'original_planned_end', '2099-01-04', 'original_updated_at', before_a, 'proposed_planned_start', '2099-01-05', 'proposed_planned_end', '2099-01-06', 'change_source', 'production_timeline'),
      jsonb_build_object('job_id', job_b.id, 'original_planned_start', '2099-01-01', 'original_planned_end', '2099-01-01', 'original_updated_at', job_b.updated_at, 'proposed_planned_start', '2099-02-05', 'proposed_planned_end', '2099-02-06', 'change_source', 'production_timeline')
    ), 'Verification Actor', null, gen_random_uuid());
    raise exception 'Expected conflict';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'production_schedule_conflict' then raise; end if;
  end;
  if (select planned_start from public.jobs where id = job_a.id) <> date '2099-01-02' then raise exception 'Conflict did not roll back job A'; end if;

  result := public.save_production_schedule_batch(jsonb_build_array(
    jsonb_build_object('job_id', job_a.id, 'original_planned_start', '2099-01-02', 'original_planned_end', '2099-01-04', 'original_updated_at', before_a, 'proposed_planned_start', '2099-01-02', 'proposed_planned_end', '2099-01-04', 'change_source', 'production_inspector')
  ), 'Verification Actor', null, gen_random_uuid());
  if (result->>'updated_count')::integer <> 0 or (result->>'ignored_no_op_count')::integer <> 1 then raise exception 'No-op handling failed'; end if;
  if exists (select 1 from public.production_schedule_batches where batch_id = (result->>'batch_id')::uuid) then raise exception 'No-op created a ledger write'; end if;

  begin
    perform public.save_production_schedule_batch(jsonb_build_array(
      jsonb_build_object('job_id', job_a.id, 'original_planned_start', '2099-01-02', 'original_planned_end', '2099-01-04', 'original_updated_at', before_a, 'proposed_planned_start', '2099-01-02', 'proposed_planned_end', '2099-01-04', 'change_source', 'production_timeline'),
      jsonb_build_object('job_id', job_a.id, 'original_planned_start', '2099-01-02', 'original_planned_end', '2099-01-04', 'original_updated_at', before_a, 'proposed_planned_start', '2099-01-03', 'proposed_planned_end', '2099-01-05', 'change_source', 'production_timeline')
    ), 'Verification Actor', null, gen_random_uuid());
    raise exception 'Expected duplicate rejection';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'production_schedule_validation' then raise; end if;
  end;

  begin
    perform public.save_production_schedule_batch(jsonb_build_array(
      jsonb_build_object('job_id', job_a.id, 'original_planned_start', '2099-01-02', 'original_planned_end', '2099-01-04', 'original_updated_at', before_a, 'proposed_planned_start', '2099-01-10', 'proposed_planned_end', '2099-01-09', 'change_source', 'production_timeline')
    ), 'Verification Actor', null, gen_random_uuid());
    raise exception 'Expected invalid range rejection';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'production_schedule_validation' then raise; end if;
  end;
end;
$verification$;

rollback;
