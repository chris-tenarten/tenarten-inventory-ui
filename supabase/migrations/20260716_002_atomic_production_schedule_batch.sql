begin;

create table public.production_schedule_batches (
  batch_id uuid primary key,
  request_proposals jsonb not null,
  changed_by text not null,
  change_note text,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint production_schedule_batches_proposals_array check (jsonb_typeof(request_proposals) = 'array'),
  constraint production_schedule_batches_changed_by_not_blank check (length(trim(changed_by)) > 0)
);

comment on table public.production_schedule_batches is
  'Private idempotency ledger for atomic Production schedule batches. Access is only through save_production_schedule_batch.';

alter table public.production_schedule_batches enable row level security;

create or replace function public.save_production_schedule_batch(
  p_proposals jsonb,
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
  proposal jsonb;
  normalized_proposals jsonb := '[]'::jsonb;
  normalized_note text := nullif(trim(p_change_note), '');
  actor text := nullif(trim(p_changed_by), '');
  proposal_index integer := 0;
  proposal_count integer;
  prior_batch public.production_schedule_batches%rowtype;
  conflicts jsonb;
  updated_jobs jsonb := '[]'::jsonb;
  updated_count integer := 0;
  no_op_count integer := 0;
  current_job public.jobs%rowtype;
  updated_job public.jobs%rowtype;
  changed_fields text[];
  final_result jsonb;
  original_start date;
  original_end date;
  proposed_start date;
  proposed_end date;
  original_updated_at timestamptz;
  job_id uuid;
  change_source text;
begin
  if p_batch_id is null then
    raise exception using errcode = 'P0001', message = 'production_schedule_validation',
      detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'batch_id is required')::text;
  end if;
  if actor is null then
    raise exception using errcode = 'P0001', message = 'production_schedule_validation',
      detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'changed_by is required')::text;
  end if;
  if p_proposals is null or jsonb_typeof(p_proposals) <> 'array' or jsonb_array_length(p_proposals) = 0 then
    raise exception using errcode = 'P0001', message = 'production_schedule_validation',
      detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'proposals must be a nonempty JSON array')::text;
  end if;

  for proposal in select value from jsonb_array_elements(p_proposals)
  loop
    proposal_index := proposal_index + 1;
    if jsonb_typeof(proposal) <> 'object' then
      raise exception using errcode = 'P0001', message = 'production_schedule_validation',
        detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'each proposal must be an object', 'proposal_index', proposal_index)::text;
    end if;
    begin
      if nullif(proposal->>'job_id', '') is null or nullif(proposal->>'original_updated_at', '') is null then
        raise invalid_parameter_value;
      end if;
      job_id := (proposal->>'job_id')::uuid;
      original_updated_at := (proposal->>'original_updated_at')::timestamptz;
      original_start := case when proposal->'original_planned_start' = 'null'::jsonb then null else (proposal->>'original_planned_start')::date end;
      original_end := case when proposal->'original_planned_end' = 'null'::jsonb then null else (proposal->>'original_planned_end')::date end;
      proposed_start := case when proposal->'proposed_planned_start' = 'null'::jsonb then null else (proposal->>'proposed_planned_start')::date end;
      proposed_end := case when proposal->'proposed_planned_end' = 'null'::jsonb then null else (proposal->>'proposed_planned_end')::date end;
    exception when others then
      raise exception using errcode = 'P0001', message = 'production_schedule_validation',
        detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'proposal contains an invalid job ID, date, or timestamp', 'proposal_index', proposal_index)::text;
    end;
    if not (proposal ? 'original_planned_start' and proposal ? 'original_planned_end'
      and proposal ? 'proposed_planned_start' and proposal ? 'proposed_planned_end') then
      raise exception using errcode = 'P0001', message = 'production_schedule_validation',
        detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'all baseline and proposed date keys are required', 'proposal_index', proposal_index)::text;
    end if;
    if (proposed_start is null) <> (proposed_end is null) or (proposed_start is not null and proposed_end < proposed_start) then
      raise exception using errcode = 'P0001', message = 'production_schedule_validation',
        detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'proposed dates must both be null or form a valid range', 'proposal_index', proposal_index)::text;
    end if;
    change_source := nullif(trim(proposal->>'change_source'), '');
    if change_source is null or change_source not in ('production_timeline', 'production_table', 'production_inspector') then
      raise exception using errcode = 'P0001', message = 'production_schedule_validation',
        detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'change_source is invalid', 'proposal_index', proposal_index)::text;
    end if;
    normalized_proposals := normalized_proposals || jsonb_build_array(jsonb_build_object(
      'job_id', job_id, 'original_planned_start', original_start, 'original_planned_end', original_end,
      'original_updated_at', original_updated_at, 'proposed_planned_start', proposed_start,
      'proposed_planned_end', proposed_end, 'change_source', change_source
    ));
  end loop;

  select count(*) into proposal_count
  from (select element->>'job_id' from jsonb_array_elements(normalized_proposals) element group by element->>'job_id') unique_jobs;
  if proposal_count <> jsonb_array_length(normalized_proposals) then
    raise exception using errcode = 'P0001', message = 'production_schedule_validation',
      detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'duplicate job IDs are not allowed')::text;
  end if;

  -- Serialize identical batch IDs without exposing the private ledger.
  perform pg_advisory_xact_lock(hashtextextended(p_batch_id::text, 0));
  select * into prior_batch from public.production_schedule_batches where batch_id = p_batch_id;
  if found then
    if prior_batch.request_proposals <> normalized_proposals or prior_batch.changed_by <> actor
      or prior_batch.change_note is distinct from normalized_note then
      raise exception using errcode = 'P0001', message = 'production_schedule_batch_reused',
        detail = jsonb_build_object('code', 'production_schedule_batch_reused', 'message', 'batch_id was already used for a different request')::text;
    end if;
    return prior_batch.result_payload || jsonb_build_object('replayed', true);
  end if;

  perform job.id from public.jobs job
  join (select (element->>'job_id')::uuid job_id from jsonb_array_elements(normalized_proposals) element) requested
    on requested.job_id = job.id
  order by job.id for update of job;

  if (select count(*) from public.jobs job where job.id in (select (element->>'job_id')::uuid from jsonb_array_elements(normalized_proposals) element))
    <> jsonb_array_length(normalized_proposals) then
    raise exception using errcode = 'P0001', message = 'production_schedule_validation',
      detail = jsonb_build_object('code', 'production_schedule_validation', 'message', 'one or more jobs do not exist')::text;
  end if;

  select jsonb_agg(jsonb_build_object(
    'job_id', job.id, 'job_number', job.job_number, 'name', job.name,
    'expected', jsonb_build_object('planned_start', p.original_start, 'planned_end', p.original_end, 'updated_at', p.original_updated_at),
    'current', jsonb_build_object('planned_start', job.planned_start, 'planned_end', job.planned_end, 'updated_at', job.updated_at),
    'proposed', jsonb_build_object('planned_start', p.proposed_start, 'planned_end', p.proposed_end)
  ) order by job.id) into conflicts
  from public.jobs job
  join (
    select (element->>'job_id')::uuid job_id,
      (element->>'original_planned_start')::date original_start, (element->>'original_planned_end')::date original_end,
      (element->>'original_updated_at')::timestamptz original_updated_at,
      (element->>'proposed_planned_start')::date proposed_start, (element->>'proposed_planned_end')::date proposed_end
    from jsonb_array_elements(normalized_proposals) element
  ) p on p.job_id = job.id
  where job.planned_start is distinct from p.original_start or job.planned_end is distinct from p.original_end
    or job.updated_at is distinct from p.original_updated_at;
  if conflicts is not null then
    raise exception using errcode = 'P0001', message = 'production_schedule_conflict',
      detail = jsonb_build_object('code', 'production_schedule_conflict', 'conflicts', conflicts)::text;
  end if;

  select count(*) into no_op_count
  from public.jobs job
  join (
    select (element->>'job_id')::uuid job_id,
      (element->>'proposed_planned_start')::date proposed_start,
      (element->>'proposed_planned_end')::date proposed_end
    from jsonb_array_elements(normalized_proposals) element
  ) p on p.job_id = job.id
  where job.planned_start is not distinct from p.proposed_start
    and job.planned_end is not distinct from p.proposed_end;

  if no_op_count = jsonb_array_length(normalized_proposals) then
    return jsonb_build_object('batch_id', p_batch_id, 'replayed', false,
      'updated_count', 0, 'ignored_no_op_count', no_op_count, 'updated_jobs', '[]'::jsonb);
  end if;

  insert into public.production_schedule_batches (batch_id, request_proposals, changed_by, change_note, result_payload)
  values (p_batch_id, normalized_proposals, actor, normalized_note, '{}'::jsonb);

  for proposal in select value from jsonb_array_elements(normalized_proposals) order by (value->>'job_id')::uuid
  loop
    job_id := (proposal->>'job_id')::uuid;
    select * into current_job from public.jobs where id = job_id;
    proposed_start := (proposal->>'proposed_planned_start')::date;
    proposed_end := (proposal->>'proposed_planned_end')::date;
    if current_job.planned_start is not distinct from proposed_start and current_job.planned_end is not distinct from proposed_end then
      continue;
    end if;
    changed_fields := array_remove(array[
      case when current_job.planned_start is distinct from proposed_start then 'planned_start' end,
      case when current_job.planned_end is distinct from proposed_end then 'planned_end' end
    ], null);
    update public.jobs set planned_start = proposed_start, planned_end = proposed_end where id = job_id returning * into updated_job;
    insert into public.job_activity (job_id, event_type, summary, actor_name, metadata)
    values (job_id, 'production_schedule_changed', 'Production schedule changed: ' || updated_job.name, actor,
      jsonb_build_object('batch_id', p_batch_id, 'change_note', normalized_note, 'change_source', proposal->>'change_source',
        'changed_fields', to_jsonb(changed_fields),
        'old_values', jsonb_build_object('planned_start', current_job.planned_start, 'planned_end', current_job.planned_end),
        'new_values', jsonb_build_object('planned_start', updated_job.planned_start, 'planned_end', updated_job.planned_end)));
    updated_count := updated_count + 1;
    updated_jobs := updated_jobs || jsonb_build_array(
      to_jsonb(updated_job) || jsonb_build_object('changed_fields', changed_fields)
    );
  end loop;

  final_result := jsonb_build_object('batch_id', p_batch_id, 'replayed', false,
    'updated_count', updated_count, 'ignored_no_op_count', no_op_count, 'updated_jobs', updated_jobs);
  update public.production_schedule_batches set result_payload = final_result where batch_id = p_batch_id;
  return final_result;
end;
$function$;

alter function public.save_production_schedule_batch(jsonb, text, text, uuid) owner to postgres;
revoke all on table public.production_schedule_batches from public, anon, authenticated;
revoke all on function public.save_production_schedule_batch(jsonb, text, text, uuid) from public;
grant execute on function public.save_production_schedule_batch(jsonb, text, text, uuid) to anon, authenticated, service_role;

commit;
