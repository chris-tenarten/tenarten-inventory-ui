begin;

create table public.production_planning_schedule_batches (
  batch_id uuid primary key,
  request_payload jsonb not null,
  changed_by text not null check (length(trim(changed_by)) > 0),
  change_note text,
  result_payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.production_planning_schedule_batches enable row level security;
revoke all on table public.production_planning_schedule_batches from public, anon, authenticated, service_role;

create or replace function public.save_production_planning_schedule_batch(
  p_job_proposals jsonb,
  p_phase_proposals jsonb,
  p_changed_by text,
  p_change_note text,
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor text := nullif(trim(p_changed_by), '');
  normalized_note text := nullif(trim(p_change_note), '');
  normalized_phases jsonb := '[]'::jsonb;
  request_payload jsonb;
  prior_batch public.production_planning_schedule_batches%rowtype;
  proposal jsonb;
  proposal_index integer := 0;
  phase_id uuid;
  original_start date;
  original_end date;
  proposed_start date;
  proposed_end date;
  original_updated_at timestamptz;
  change_source text;
  conflicts jsonb;
  phase_result jsonb := '[]'::jsonb;
  job_result jsonb;
  current_phase public.planning_phases%rowtype;
  updated_phase public.planning_phases%rowtype;
  final_result jsonb;
begin
  if p_batch_id is null or actor is null then
    raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
      detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'batch_id and changed_by are required')::text;
  end if;
  if coalesce(jsonb_typeof(p_job_proposals), '') <> 'array'
    or coalesce(jsonb_typeof(p_phase_proposals), '') <> 'array'
    or (jsonb_array_length(p_job_proposals) = 0 and jsonb_array_length(p_phase_proposals) = 0)
  then
    raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
      detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'at least one job or Phase proposal is required')::text;
  end if;

  for proposal in select value from jsonb_array_elements(p_phase_proposals)
  loop
    proposal_index := proposal_index + 1;
    begin
      phase_id := (proposal->>'phase_id')::uuid;
      original_start := (proposal->>'original_start_date')::date;
      original_end := (proposal->>'original_end_date')::date;
      proposed_start := (proposal->>'proposed_start_date')::date;
      proposed_end := (proposal->>'proposed_end_date')::date;
      original_updated_at := (proposal->>'original_updated_at')::timestamptz;
    exception when others then
      raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
        detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'Phase proposal contains an invalid ID, date, or timestamp', 'proposal_index', proposal_index)::text;
    end;
    if proposed_end < proposed_start then
      raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
        detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'Phase dates must form a valid inclusive interval', 'proposal_index', proposal_index)::text;
    end if;
    change_source := nullif(trim(proposal->>'change_source'), '');
    if change_source not in ('planning_timeline', 'production_reschedule') then
      raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
        detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'Phase change_source is invalid', 'proposal_index', proposal_index)::text;
    end if;
    normalized_phases := normalized_phases || jsonb_build_array(jsonb_build_object(
      'phase_id', phase_id, 'original_start_date', original_start, 'original_end_date', original_end,
      'original_updated_at', original_updated_at, 'proposed_start_date', proposed_start,
      'proposed_end_date', proposed_end, 'change_source', change_source
    ));
  end loop;

  if (select count(*) from (select element->>'phase_id' from jsonb_array_elements(normalized_phases) element group by 1) unique_phases)
    <> jsonb_array_length(normalized_phases)
  then
    raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
      detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'duplicate Phase IDs are not allowed')::text;
  end if;

  request_payload := jsonb_build_object('jobs', p_job_proposals, 'phases', normalized_phases);
  perform pg_advisory_xact_lock(hashtextextended('production-planning:' || p_batch_id::text, 0));
  select * into prior_batch from public.production_planning_schedule_batches where batch_id = p_batch_id;
  if found then
    if prior_batch.request_payload <> request_payload or prior_batch.changed_by <> actor
      or prior_batch.change_note is distinct from normalized_note
    then
      raise exception using errcode = 'P0001', message = 'production_planning_schedule_batch_reused',
        detail = jsonb_build_object('code', 'production_planning_schedule_batch_reused', 'message', 'batch_id was already used for another request')::text;
    end if;
    return prior_batch.result_payload || jsonb_build_object('replayed', true);
  end if;

  perform phase.id
  from public.planning_phases phase
  join (select (element->>'phase_id')::uuid phase_id from jsonb_array_elements(normalized_phases) element) requested
    on requested.phase_id = phase.id
  order by phase.id for update of phase;

  if (select count(*) from public.planning_phases phase where phase.id in
    (select (element->>'phase_id')::uuid from jsonb_array_elements(normalized_phases) element))
    <> jsonb_array_length(normalized_phases)
  then
    raise exception using errcode = 'P0001', message = 'production_planning_schedule_validation',
      detail = jsonb_build_object('code', 'production_planning_schedule_validation', 'message', 'one or more Planning Phases do not exist')::text;
  end if;

  select jsonb_agg(jsonb_build_object(
    'phase_id', phase.id, 'job_id', phase.job_id, 'title', phase.title,
    'expected', jsonb_build_object('start_date', expected.original_start, 'end_date', expected.original_end, 'updated_at', expected.original_updated_at),
    'current', jsonb_build_object('start_date', phase.start_date, 'end_date', phase.end_date, 'updated_at', phase.updated_at),
    'proposed', jsonb_build_object('start_date', expected.proposed_start, 'end_date', expected.proposed_end)
  ) order by phase.id) into conflicts
  from public.planning_phases phase
  join (
    select (element->>'phase_id')::uuid phase_id,
      (element->>'original_start_date')::date original_start,
      (element->>'original_end_date')::date original_end,
      (element->>'original_updated_at')::timestamptz original_updated_at,
      (element->>'proposed_start_date')::date proposed_start,
      (element->>'proposed_end_date')::date proposed_end
    from jsonb_array_elements(normalized_phases) element
  ) expected on expected.phase_id = phase.id
  where phase.start_date is distinct from expected.original_start
    or phase.end_date is distinct from expected.original_end
    or phase.updated_at is distinct from expected.original_updated_at;
  if conflicts is not null then
    raise exception using errcode = 'P0001', message = 'production_planning_schedule_conflict',
      detail = jsonb_build_object('code', 'production_planning_schedule_conflict', 'conflicts', conflicts)::text;
  end if;

  if jsonb_array_length(p_job_proposals) > 0 then
    job_result := public.save_production_schedule_batch(p_job_proposals, actor, normalized_note, p_batch_id);
  else
    job_result := jsonb_build_object('batch_id', p_batch_id, 'replayed', false, 'updated_count', 0, 'ignored_no_op_count', 0, 'updated_jobs', '[]'::jsonb);
  end if;

  for proposal in select value from jsonb_array_elements(normalized_phases) order by (value->>'phase_id')::uuid
  loop
    phase_id := (proposal->>'phase_id')::uuid;
    select * into current_phase from public.planning_phases where id = phase_id;
    proposed_start := (proposal->>'proposed_start_date')::date;
    proposed_end := (proposal->>'proposed_end_date')::date;
    if current_phase.start_date is not distinct from proposed_start and current_phase.end_date is not distinct from proposed_end then
      continue;
    end if;
    update public.planning_phases
    set start_date = proposed_start, end_date = proposed_end
    where id = phase_id returning * into updated_phase;
    insert into public.job_activity(job_id, event_type, summary, actor_name, metadata)
    values(updated_phase.job_id, 'planning_phase_schedule_changed', 'Planning Phase schedule changed: ' || updated_phase.title, actor,
      jsonb_build_object('batch_id', p_batch_id, 'change_note', normalized_note, 'change_source', proposal->>'change_source',
        'phase_id', updated_phase.id,
        'old_values', jsonb_build_object('start_date', current_phase.start_date, 'end_date', current_phase.end_date),
        'new_values', jsonb_build_object('start_date', updated_phase.start_date, 'end_date', updated_phase.end_date)));
    phase_result := phase_result || jsonb_build_array(to_jsonb(updated_phase));
  end loop;

  final_result := jsonb_build_object(
    'batch_id', p_batch_id, 'replayed', false,
    'updated_count', coalesce((job_result->>'updated_count')::integer, 0) + jsonb_array_length(phase_result),
    'updated_jobs', coalesce(job_result->'updated_jobs', '[]'::jsonb),
    'updated_phases', phase_result
  );
  insert into public.production_planning_schedule_batches(batch_id, request_payload, changed_by, change_note, result_payload)
  values(p_batch_id, request_payload, actor, normalized_note, final_result);
  return final_result;
end;
$function$;

alter function public.save_production_planning_schedule_batch(jsonb, jsonb, text, text, uuid) owner to postgres;
revoke all on function public.save_production_planning_schedule_batch(jsonb, jsonb, text, text, uuid) from public;
grant execute on function public.save_production_planning_schedule_batch(jsonb, jsonb, text, text, uuid) to anon, authenticated, service_role;

comment on function public.save_production_planning_schedule_batch(jsonb, jsonb, text, text, uuid) is
  'Atomically validates and saves staged Production and Planning date changes with optimistic concurrency.';

commit;
