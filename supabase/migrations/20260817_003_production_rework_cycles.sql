-- Whole-job Production Rework lifecycle MVP.
-- Rework is intentionally job-scoped. Structured Color Plate / Item scope is deferred
-- until TenOps has a canonical Production scope model; scope_details is never parsed.

begin;

create table if not exists public.production_rework_cycles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  reason_category text not null check (reason_category in ('quality_qc', 'shipping_handling', 'customer_change', 'other')),
  scope_details text not null check (btrim(scope_details) <> ''),
  intake_date date not null,
  planned_start date,
  planned_end date,
  production_status text not null default 'not_started' check (production_status in ('not_started', 'on_deck', 'in_production', 'on_hold', 'shipped', 'complete', 'cancelled')),
  completed_at timestamptz,
  created_by text,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_rework_cycle_sequence_unique unique (job_id, sequence_number),
  constraint production_rework_schedule_pair check ((planned_start is null) = (planned_end is null)),
  constraint production_rework_schedule_order check (planned_start is null or planned_end >= planned_start),
  constraint production_rework_completion_consistent check ((production_status = 'complete') = (completed_at is not null))
);

comment on table public.production_rework_cycles is
  'Whole-job Rework lifecycles belonging to the canonical commercial Job. scope_details remains unparsed until canonical Production scope entities exist.';

create unique index if not exists production_rework_one_active_per_job_idx
  on public.production_rework_cycles(job_id)
  where production_status not in ('complete', 'cancelled');
create index if not exists production_rework_job_history_idx
  on public.production_rework_cycles(job_id, sequence_number desc);
create index if not exists production_rework_schedule_idx
  on public.production_rework_cycles(planned_start, planned_end)
  where production_status not in ('complete', 'cancelled');

create table if not exists public.production_rework_schedule_batches (
  batch_id uuid primary key,
  request_payload jsonb not null,
  changed_by text not null check (btrim(changed_by) <> ''),
  change_note text,
  result_payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.production_rework_schedule_batches enable row level security;
revoke all on table public.production_rework_schedule_batches from public, anon, authenticated, service_role;

create or replace function public.touch_production_rework_cycle_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

alter function public.touch_production_rework_cycle_updated_at() owner to postgres;

drop trigger if exists production_rework_cycles_touch_updated_at on public.production_rework_cycles;
create trigger production_rework_cycles_touch_updated_at
before update on public.production_rework_cycles
for each row execute function public.touch_production_rework_cycle_updated_at();

alter table public.production_rework_cycles enable row level security;
drop policy if exists "Compatibility read Production Rework" on public.production_rework_cycles;
create policy "Compatibility read Production Rework" on public.production_rework_cycles
  for select to anon, authenticated using (true);
revoke all on table public.production_rework_cycles from public, anon, authenticated;
grant select on table public.production_rework_cycles to anon, authenticated;
grant all on table public.production_rework_cycles to service_role;

create or replace function public.create_production_rework(
  p_job_id uuid,
  p_reason_category text,
  p_scope_details text,
  p_intake_date date,
  p_created_by text default null
) returns public.production_rework_cycles
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  target_job public.jobs%rowtype;
  next_sequence integer;
  created_cycle public.production_rework_cycles%rowtype;
begin
  if p_reason_category not in ('quality_qc', 'shipping_handling', 'customer_change', 'other') then
    raise exception using errcode = 'P0001', message = 'production_rework_validation', detail = '{"message":"Choose a valid Rework reason."}';
  end if;
  if btrim(coalesce(p_scope_details, '')) = '' then
    raise exception using errcode = 'P0001', message = 'production_rework_validation', detail = '{"message":"Rework Scope / Work Required is required."}';
  end if;
  if p_intake_date is null then
    raise exception using errcode = 'P0001', message = 'production_rework_validation', detail = '{"message":"Intake / Return Date is required."}';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text, 0));
  select * into target_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Production Job not found.' using errcode = 'P0002'; end if;
  if target_job.archived_at is not null then raise exception 'Archived Production Jobs cannot start Rework.' using errcode = 'P0001'; end if;
  if target_job.production_status <> 'complete' then
    raise exception 'Only a completed Production Job can start Rework.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.production_rework_cycles where job_id = p_job_id and production_status not in ('complete', 'cancelled')) then
    raise exception 'This Production Job already has an active Rework cycle.' using errcode = '23505';
  end if;

  select coalesce(max(sequence_number), 0) + 1 into next_sequence
  from public.production_rework_cycles where job_id = p_job_id;

  insert into public.production_rework_cycles(job_id, sequence_number, reason_category, scope_details, intake_date, created_by)
  values (p_job_id, next_sequence, p_reason_category, btrim(p_scope_details), p_intake_date, nullif(btrim(coalesce(p_created_by, '')), ''))
  returning * into created_cycle;

  insert into public.job_activity(job_id, event_type, summary, actor_name, metadata)
  values (p_job_id, 'production_rework_created', format('Rework #%s created', next_sequence), nullif(btrim(coalesce(p_created_by, '')), ''),
    jsonb_build_object('rework_cycle_id', created_cycle.id, 'sequence_number', next_sequence, 'reason_category', p_reason_category, 'intake_date', p_intake_date));
  return created_cycle;
end;
$$;

alter function public.create_production_rework(uuid,text,text,date,text) owner to postgres;

create or replace function public.update_production_rework_status(
  p_rework_cycle_id uuid,
  p_production_status text,
  p_expected_updated_at timestamptz,
  p_actor_name text default null
) returns public.production_rework_cycles
language plpgsql security definer set search_path = pg_catalog, public as $$
declare current_cycle public.production_rework_cycles%rowtype; updated_cycle public.production_rework_cycles%rowtype;
begin
  if p_production_status not in ('not_started', 'on_deck', 'in_production', 'on_hold', 'shipped', 'complete', 'cancelled') then raise exception 'Invalid Production status.' using errcode = '22023'; end if;
  select * into current_cycle from public.production_rework_cycles where id = p_rework_cycle_id for update;
  if not found then raise exception 'Rework cycle not found.' using errcode = 'P0002'; end if;
  if current_cycle.production_status in ('complete', 'cancelled') then
    raise exception 'Completed or cancelled Rework history cannot be changed.' using errcode = 'P0001';
  end if;
  if current_cycle.updated_at <> p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'production_rework_conflict', detail = jsonb_build_object('rework_cycle_id', current_cycle.id, 'current_updated_at', current_cycle.updated_at)::text;
  end if;
  update public.production_rework_cycles set
    production_status = p_production_status,
    completed_at = case when p_production_status = 'complete' then coalesce(completed_at, clock_timestamp()) else null end,
    completed_by = case when p_production_status = 'complete' then nullif(btrim(coalesce(p_actor_name, '')), '') else null end
  where id = p_rework_cycle_id returning * into updated_cycle;
  insert into public.job_activity(job_id, event_type, summary, actor_name, metadata)
  values (updated_cycle.job_id, 'production_rework_status_changed', format('Rework #%s status changed to %s', updated_cycle.sequence_number, p_production_status), nullif(btrim(coalesce(p_actor_name, '')), ''), jsonb_build_object('rework_cycle_id', updated_cycle.id, 'old_status', current_cycle.production_status, 'new_status', p_production_status));
  return updated_cycle;
end;
$$;

alter function public.update_production_rework_status(uuid,text,timestamptz,text) owner to postgres;

create or replace function public.save_production_rework_schedule_batch(
  p_proposals jsonb,
  p_changed_by text,
  p_change_note text default null,
  p_batch_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor text := nullif(btrim(p_changed_by), '');
  normalized_note text := nullif(btrim(p_change_note), '');
  request_payload jsonb;
  prior_batch public.production_rework_schedule_batches%rowtype;
  proposal jsonb;
  current_cycle public.production_rework_cycles%rowtype;
  updated_cycle public.production_rework_cycles%rowtype;
  updated_rows jsonb := '[]'::jsonb;
  updated_count integer := 0;
  final_result jsonb;
begin
  if p_batch_id is null or actor is null then
    raise exception 'Rework schedule batch ID and changed-by name are required.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_proposals), '') <> 'array' then
    raise exception 'Production Rework proposals must be an array.' using errcode = '22023';
  end if;

  request_payload := jsonb_build_object('reworks', p_proposals);
  perform pg_advisory_xact_lock(hashtextextended('production-rework:' || p_batch_id::text, 0));
  select * into prior_batch from public.production_rework_schedule_batches where batch_id = p_batch_id;
  if found then
    if prior_batch.request_payload <> request_payload or prior_batch.changed_by <> actor
      or prior_batch.change_note is distinct from normalized_note
    then
      raise exception 'Rework schedule batch ID was already used for another request.' using errcode = 'P0001';
    end if;
    return prior_batch.result_payload || jsonb_build_object('replayed', true);
  end if;

  for proposal in select value from jsonb_array_elements(p_proposals) loop
    select * into current_cycle from public.production_rework_cycles where id = (proposal->>'rework_cycle_id')::uuid for update;
    if not found then raise exception 'Rework cycle not found.' using errcode = 'P0002'; end if;
    if current_cycle.production_status in ('complete', 'cancelled') then
      raise exception 'Completed or cancelled Rework history cannot be rescheduled.' using errcode = 'P0001';
    end if;
    if current_cycle.updated_at <> (proposal->>'original_updated_at')::timestamptz
      or current_cycle.planned_start is distinct from nullif(proposal->>'original_planned_start', '')::date
      or current_cycle.planned_end is distinct from nullif(proposal->>'original_planned_end', '')::date then
      raise exception using errcode = 'P0001', message = 'production_rework_schedule_conflict', detail = jsonb_build_object('rework_cycle_id', current_cycle.id)::text;
    end if;
    if ((nullif(proposal->>'proposed_planned_start', '') is null) <> (nullif(proposal->>'proposed_planned_end', '') is null)) then raise exception 'Both Rework planned dates are required.' using errcode = '22023'; end if;
    update public.production_rework_cycles set
      planned_start = nullif(proposal->>'proposed_planned_start', '')::date,
      planned_end = nullif(proposal->>'proposed_planned_end', '')::date
    where id = current_cycle.id returning * into updated_cycle;
    updated_count := updated_count + 1;
    updated_rows := updated_rows || to_jsonb(updated_cycle);
    insert into public.job_activity(job_id, event_type, summary, actor_name, metadata)
    values (updated_cycle.job_id, 'production_rework_schedule_changed', format('Rework #%s schedule changed', updated_cycle.sequence_number), actor, jsonb_build_object('rework_cycle_id', updated_cycle.id, 'planned_start', updated_cycle.planned_start, 'planned_end', updated_cycle.planned_end, 'change_note', normalized_note, 'batch_id', p_batch_id));
  end loop;
  final_result := jsonb_build_object('batch_id', p_batch_id, 'replayed', false, 'updated_count', updated_count, 'updated_reworks', updated_rows);
  insert into public.production_rework_schedule_batches(batch_id, request_payload, changed_by, change_note, result_payload)
  values (p_batch_id, request_payload, actor, normalized_note, final_result);
  return final_result;
end;
$$;

alter function public.save_production_rework_schedule_batch(jsonb,text,text,uuid) owner to postgres;

create or replace function public.save_production_rework_mixed_schedule_batch(
  p_job_proposals jsonb,
  p_phase_proposals jsonb,
  p_rework_proposals jsonb,
  p_changed_by text,
  p_change_note text default null,
  p_batch_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare canonical_result jsonb; rework_result jsonb;
begin
  if coalesce(jsonb_typeof(p_job_proposals), '') <> 'array'
    or coalesce(jsonb_typeof(p_phase_proposals), '') <> 'array'
    or coalesce(jsonb_typeof(p_rework_proposals), '') <> 'array'
    or (jsonb_array_length(p_job_proposals) = 0 and jsonb_array_length(p_phase_proposals) = 0 and jsonb_array_length(p_rework_proposals) = 0)
  then
    raise exception 'At least one valid Production, Planning, or Rework proposal is required.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_job_proposals) > 0 or jsonb_array_length(p_phase_proposals) > 0 then
    canonical_result := public.save_production_planning_schedule_batch(p_job_proposals, p_phase_proposals, p_changed_by, p_change_note, p_batch_id);
  else
    canonical_result := jsonb_build_object('updated_count', 0, 'updated_jobs', '[]'::jsonb, 'updated_phases', '[]'::jsonb);
  end if;
  rework_result := public.save_production_rework_schedule_batch(p_rework_proposals, p_changed_by, p_change_note, p_batch_id);
  return jsonb_build_object(
    'batch_id', p_batch_id,
    'updated_count', coalesce((canonical_result->>'updated_count')::integer, 0) + coalesce((rework_result->>'updated_count')::integer, 0),
    'updated_jobs', coalesce(canonical_result->'updated_jobs', '[]'::jsonb),
    'updated_phases', coalesce(canonical_result->'updated_phases', '[]'::jsonb),
    'updated_reworks', coalesce(rework_result->'updated_reworks', '[]'::jsonb)
  );
end;
$$;

alter function public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) owner to postgres;

revoke all on function public.create_production_rework(uuid,text,text,date,text) from public;
revoke all on function public.update_production_rework_status(uuid,text,timestamptz,text) from public;
revoke all on function public.save_production_rework_schedule_batch(jsonb,text,text,uuid) from public;
revoke all on function public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) from public;
grant execute on function public.create_production_rework(uuid,text,text,date,text) to anon, authenticated, service_role;
grant execute on function public.update_production_rework_status(uuid,text,timestamptz,text) to anon, authenticated, service_role;
grant execute on function public.save_production_rework_schedule_batch(jsonb,text,text,uuid) to anon, authenticated, service_role;
grant execute on function public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) to anon, authenticated, service_role;

commit;
