begin;

-- ============================================================
-- TENOPS PRODUCTION MVP — JOBS FOUNDATION
-- Creates the core job and job activity tables used by the
-- production Gantt and job detail screens.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Jobs
-- ------------------------------------------------------------

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  name text not null,
  customer text,
  job_number text,
  estimate_number text,
  work_order_number text,

  -- Commercial
  contract_value numeric(12, 2),
  deposit_date date,

  -- Pre-production / approvals
  color_plate_number text,
  sample_submitted_date date,
  approval_date date,

  -- Procurement placeholders retained from the Monday workflow
  resin_po text,
  chip_po text,

  -- Planning
  estimated_man_hours numeric(10, 2),
  estimated_calendar_days integer,
  requested_delivery_date date,
  planned_start date,
  planned_end date,

  -- Current operational state
  production_status text not null default 'not_started',
  material_status text not null default 'unknown',
  priority text not null default 'normal',
  progress_percent integer not null default 0,

  -- Ownership / context
  owner_name text,
  remarks text,

  -- Legacy migration traceability
  monday_item_id text,
  monday_board_id text,
  legacy_source text,

  -- Lifecycle
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_production_status_check check (
    production_status in (
      'not_started',
      'on_deck',
      'in_production',
      'on_hold',
      'shipped',
      'complete',
      'cancelled'
    )
  ),

  constraint jobs_material_status_check check (
    material_status in (
      'unknown',
      'not_ready',
      'ready'
    )
  ),

  constraint jobs_priority_check check (
    priority in (
      'low',
      'normal',
      'high',
      'urgent'
    )
  ),

  constraint jobs_progress_percent_check check (
    progress_percent between 0 and 100
  ),

  constraint jobs_estimated_calendar_days_check check (
    estimated_calendar_days is null
    or estimated_calendar_days >= 0
  ),

  constraint jobs_estimated_man_hours_check check (
    estimated_man_hours is null
    or estimated_man_hours >= 0
  ),

  constraint jobs_contract_value_check check (
    contract_value is null
    or contract_value >= 0
  ),

  constraint jobs_planned_date_order_check check (
    planned_start is null
    or planned_end is null
    or planned_end >= planned_start
  )
);

comment on table public.jobs is
  'Central TenOps job record. Supplies the production Gantt and job detail screens.';

comment on column public.jobs.resin_po is
  'MVP text field preserving the legacy Monday Resin / PO workflow.';

comment on column public.jobs.chip_po is
  'MVP text field preserving the legacy Monday Chip / PO workflow.';

comment on column public.jobs.material_status is
  'Temporary broad readiness field. Later derived from job material requirement records.';

-- Helpful indexes for Gantt, filtering, search, and future Monday migration.
create index if not exists jobs_planned_start_idx
  on public.jobs (planned_start);

create index if not exists jobs_planned_end_idx
  on public.jobs (planned_end);

create index if not exists jobs_production_status_idx
  on public.jobs (production_status);

create index if not exists jobs_material_status_idx
  on public.jobs (material_status);

create index if not exists jobs_requested_delivery_date_idx
  on public.jobs (requested_delivery_date);

create index if not exists jobs_archived_at_idx
  on public.jobs (archived_at);

create unique index if not exists jobs_monday_item_id_unique_idx
  on public.jobs (monday_item_id)
  where monday_item_id is not null;

-- ------------------------------------------------------------
-- 2. Updated-at trigger
-- ------------------------------------------------------------

create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_jobs_updated_at on public.jobs;

create trigger trg_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_jobs_updated_at();

-- ------------------------------------------------------------
-- 3. Job activity
-- ------------------------------------------------------------

create table if not exists public.job_activity (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null,
  summary text not null,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint job_activity_event_type_not_blank check (
    length(trim(event_type)) > 0
  ),

  constraint job_activity_summary_not_blank check (
    length(trim(summary)) > 0
  )
);

comment on table public.job_activity is
  'Readable operational timeline for job creation, schedule, status, and later production events.';

create index if not exists job_activity_job_occurred_idx
  on public.job_activity (job_id, occurred_at desc);

create index if not exists job_activity_event_type_idx
  on public.job_activity (event_type);

-- ------------------------------------------------------------
-- 4. Row-level security
--
-- This deliberately matches the current internal MVP access
-- model. Replace these permissive anon policies when real auth
-- and roles are introduced.
-- ------------------------------------------------------------

alter table public.jobs enable row level security;
alter table public.job_activity enable row level security;

drop policy if exists "Allow anon read jobs" on public.jobs;
drop policy if exists "Allow anon insert jobs" on public.jobs;
drop policy if exists "Allow anon update jobs" on public.jobs;
drop policy if exists "Allow anon delete jobs" on public.jobs;

create policy "Allow anon read jobs"
  on public.jobs
  for select
  to anon
  using (true);

create policy "Allow anon insert jobs"
  on public.jobs
  for insert
  to anon
  with check (true);

create policy "Allow anon update jobs"
  on public.jobs
  for update
  to anon
  using (true)
  with check (true);

create policy "Allow anon delete jobs"
  on public.jobs
  for delete
  to anon
  using (true);

drop policy if exists "Allow anon read job activity" on public.job_activity;
drop policy if exists "Allow anon insert job activity" on public.job_activity;
drop policy if exists "Allow anon update job activity" on public.job_activity;
drop policy if exists "Allow anon delete job activity" on public.job_activity;

create policy "Allow anon read job activity"
  on public.job_activity
  for select
  to anon
  using (true);

create policy "Allow anon insert job activity"
  on public.job_activity
  for insert
  to anon
  with check (true);

create policy "Allow anon update job activity"
  on public.job_activity
  for update
  to anon
  using (true)
  with check (true);

create policy "Allow anon delete job activity"
  on public.job_activity
  for delete
  to anon
  using (true);

-- ------------------------------------------------------------
-- 5. Final verification
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.jobs') is null then
    raise exception 'Migration failed: public.jobs was not created.';
  end if;

  if to_regclass('public.job_activity') is null then
    raise exception 'Migration failed: public.job_activity was not created.';
  end if;
end;
$$;

commit;
