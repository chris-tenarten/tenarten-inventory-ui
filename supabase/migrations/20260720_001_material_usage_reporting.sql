begin;

create extension if not exists pgcrypto;

-- Material Usage was initially deployed outside the checked-in migration
-- history. This migration is deliberately reconciling: it creates the
-- objects for fresh environments and fills in the application contract for
-- environments where the tables already exist.

create table if not exists public.material_usage_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete restrict,
  unlisted_job_name text,
  job_number_snapshot text,
  job_name_snapshot text,
  report_date date not null,
  work_order text,
  terrazzo_type text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_usage_reports
  add column if not exists job_id uuid references public.jobs(id) on delete restrict,
  add column if not exists unlisted_job_name text,
  add column if not exists job_number_snapshot text,
  add column if not exists job_name_snapshot text,
  add column if not exists report_date date,
  add column if not exists work_order text,
  add column if not exists terrazzo_type text,
  add column if not exists notes text,
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $block$
begin
  if exists (
    select 1
    from public.material_usage_reports
    where report_date is null
  ) then
    raise exception 'Material Usage reconciliation stopped: material_usage_reports contains a null report_date.';
  end if;

  if exists (
    select 1
    from public.material_usage_reports
    where not (
      (job_id is not null and nullif(trim(unlisted_job_name), '') is null)
      or
      (job_id is null and nullif(trim(unlisted_job_name), '') is not null)
    )
  ) then
    raise exception 'Material Usage reconciliation stopped: every report must have exactly one canonical job or temporary label.';
  end if;
end;
$block$;

alter table public.material_usage_reports
  alter column report_date set not null;

do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.material_usage_reports'::regclass
      and conname = 'material_usage_reports_job_or_label_check'
  ) then
    alter table public.material_usage_reports
      add constraint material_usage_reports_job_or_label_check check (
        (job_id is not null and nullif(trim(unlisted_job_name), '') is null)
        or
        (job_id is null and nullif(trim(unlisted_job_name), '') is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.material_usage_reports'::regclass
      and conname = 'material_usage_reports_job_id_fkey'
  ) then
    alter table public.material_usage_reports
      add constraint material_usage_reports_job_id_fkey
      foreign key (job_id) references public.jobs(id) on delete restrict;
  end if;
end;
$block$;

create table if not exists public.material_usage_lines (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.material_usage_reports(id) on delete cascade,
  sort_order integer not null default 0,
  material_type text,
  manufacturer text,
  material_name text,
  quantity numeric(14, 3),
  unit text,
  plate text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_usage_lines_sort_order_check check (sort_order >= 0),
  constraint material_usage_lines_quantity_check check (quantity is null or quantity >= 0)
);

alter table public.material_usage_lines
  add column if not exists report_id uuid references public.material_usage_reports(id) on delete cascade,
  add column if not exists sort_order integer not null default 0,
  add column if not exists material_type text,
  add column if not exists manufacturer text,
  add column if not exists material_name text,
  add column if not exists quantity numeric(14, 3),
  add column if not exists unit text,
  add column if not exists plate text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $block$
begin
  if exists (
    select 1
    from public.material_usage_lines
    where report_id is null
       or sort_order < 0
       or quantity < 0
  ) then
    raise exception 'Material Usage reconciliation stopped: material_usage_lines contains an invalid report, sort order, or quantity.';
  end if;
end;
$block$;

alter table public.material_usage_lines
  alter column report_id set not null;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.material_usage_lines'::regclass
      and conname = 'material_usage_lines_sort_order_check'
  ) then
    alter table public.material_usage_lines
      add constraint material_usage_lines_sort_order_check check (sort_order >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.material_usage_lines'::regclass
      and conname = 'material_usage_lines_quantity_check'
  ) then
    alter table public.material_usage_lines
      add constraint material_usage_lines_quantity_check check (quantity is null or quantity >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.material_usage_lines'::regclass
      and conname = 'material_usage_lines_report_id_fkey'
  ) then
    alter table public.material_usage_lines
      add constraint material_usage_lines_report_id_fkey
      foreign key (report_id) references public.material_usage_reports(id) on delete cascade;
  end if;
end;
$block$;

create index if not exists material_usage_reports_date_updated_idx
  on public.material_usage_reports (report_date desc, updated_at desc);
create index if not exists material_usage_reports_job_date_idx
  on public.material_usage_reports (job_id, report_date desc);
create index if not exists material_usage_lines_report_sort_idx
  on public.material_usage_lines (report_id, sort_order);

create or replace function public.set_material_usage_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_material_usage_reports_updated_at on public.material_usage_reports;
create trigger trg_material_usage_reports_updated_at
before update on public.material_usage_reports
for each row execute function public.set_material_usage_updated_at();

drop trigger if exists trg_material_usage_lines_updated_at on public.material_usage_lines;
create trigger trg_material_usage_lines_updated_at
before update on public.material_usage_lines
for each row execute function public.set_material_usage_updated_at();

create or replace function public.save_material_usage_report(
  p_report jsonb,
  p_lines jsonb,
  p_editor text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor text := nullif(trim(p_editor), '');
  v_report_id uuid;
  canonical_job_id uuid;
  temporary_label text := nullif(trim(p_report->>'unlisted_job_name'), '');
  report_day date;
  job_row public.jobs%rowtype;
  existing_report public.material_usage_reports%rowtype;
  job_association_changed boolean := false;
  apply_canonical_defaults boolean := false;
  snapshot_job_number text;
  snapshot_job_name text;
  snapshot_work_order text;
  shared_color_plate text;
  candidate_color_plate text;
  line jsonb;
  line_index integer := 0;
  line_quantity numeric;
begin
  if actor is null then
    raise exception 'Editor name is required.' using errcode = '22023';
  end if;

  if p_report is null or jsonb_typeof(p_report) <> 'object' then
    raise exception 'Report must be a JSON object.' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Lines must be a JSON array.' using errcode = '22023';
  end if;

  begin
    v_report_id := nullif(p_report->>'id', '')::uuid;
    canonical_job_id := nullif(p_report->>'job_id', '')::uuid;
    report_day := nullif(p_report->>'report_date', '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'Report contains an invalid ID or report date.' using errcode = '22023';
  end;

  if report_day is null then
    raise exception 'Report date is required.' using errcode = '22023';
  end if;

  if (canonical_job_id is null) = (temporary_label is null) then
    raise exception 'Select exactly one Production job or temporary job label.' using errcode = '22023';
  end if;

  if canonical_job_id is not null then
    select * into job_row
    from public.jobs
    where id = canonical_job_id;

    if not found then
      raise exception 'The selected Production job no longer exists.' using errcode = '23503';
    end if;
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(line) <> 'object' then
      raise exception 'Each material line must be a JSON object.' using errcode = '22023';
    end if;

    if lower(trim(line->>'material_type')) = 'chip blend' then
      candidate_color_plate := nullif(trim(line->>'plate'), '');

      if candidate_color_plate is not null then
        if shared_color_plate is null then
          shared_color_plate := candidate_color_plate;
        elsif lower(shared_color_plate) <> lower(candidate_color_plate) then
          raise exception 'All Chip Blend lines must use one Color Plate #.' using errcode = '22023';
        end if;
      end if;
    end if;
  end loop;

  if v_report_id is not null then
    select * into existing_report
    from public.material_usage_reports
    where id = v_report_id
    for update;

    if not found then
      raise exception 'Material Usage report not found.' using errcode = 'P0002';
    end if;

    job_association_changed := existing_report.job_id is distinct from canonical_job_id;
  end if;

  apply_canonical_defaults := v_report_id is null or job_association_changed;

  if canonical_job_id is null then
    snapshot_job_number := null;
    snapshot_job_name := null;
  elsif apply_canonical_defaults then
    snapshot_job_number := job_row.job_number;
    snapshot_job_name := job_row.name;
  else
    snapshot_job_number := coalesce(
      nullif(trim(p_report->>'job_number_snapshot'), ''),
      existing_report.job_number_snapshot
    );
    snapshot_job_name := coalesce(
      nullif(trim(p_report->>'job_name_snapshot'), ''),
      existing_report.job_name_snapshot
    );
  end if;

  snapshot_work_order := case
    when canonical_job_id is not null and job_association_changed
      then job_row.work_order_number
    else nullif(trim(p_report->>'work_order'), '')
  end;

  if canonical_job_id is not null
     and apply_canonical_defaults
     and shared_color_plate is null then
    shared_color_plate := nullif(trim(job_row.color_plate_number), '');
  end if;

  if v_report_id is null then
    insert into public.material_usage_reports (
      job_id, unlisted_job_name, job_number_snapshot, job_name_snapshot,
      report_date, work_order, terrazzo_type, notes, created_by, updated_by
    ) values (
      canonical_job_id, temporary_label, snapshot_job_number, snapshot_job_name,
      report_day, snapshot_work_order,
      nullif(trim(p_report->>'terrazzo_type'), ''),
      nullif(trim(p_report->>'notes'), ''), actor, actor
    )
    returning id into v_report_id;
  else
    update public.material_usage_reports
    set job_id = canonical_job_id,
        unlisted_job_name = temporary_label,
        job_number_snapshot = snapshot_job_number,
        job_name_snapshot = snapshot_job_name,
        report_date = report_day,
        work_order = snapshot_work_order,
        terrazzo_type = nullif(trim(p_report->>'terrazzo_type'), ''),
        notes = nullif(trim(p_report->>'notes'), ''),
        updated_by = actor
    where id = v_report_id;

    delete from public.material_usage_lines
    where material_usage_lines.report_id = v_report_id;
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(line) <> 'object' then
      raise exception 'Each material line must be a JSON object.' using errcode = '22023';
    end if;

    begin
      line_quantity := nullif(line->>'quantity', '')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Material line % has an invalid quantity.', line_index + 1 using errcode = '22023';
    end;

    if line_quantity < 0 then
      raise exception 'Material line % quantity cannot be negative.', line_index + 1 using errcode = '22023';
    end if;

    insert into public.material_usage_lines (
      report_id, sort_order, material_type, manufacturer, material_name,
      quantity, unit, plate, notes
    ) values (
      v_report_id, line_index,
      nullif(trim(line->>'material_type'), ''),
      nullif(trim(line->>'manufacturer'), ''),
      nullif(trim(line->>'material_name'), ''),
      line_quantity,
      nullif(trim(line->>'unit'), ''),
      case
        when lower(trim(line->>'material_type')) = 'chip blend'
          then shared_color_plate
        else null
      end,
      nullif(trim(line->>'notes'), '')
    );

    line_index := line_index + 1;
  end loop;

  return v_report_id;
end;
$function$;

create or replace function public.delete_material_usage_report(
  p_report_id uuid,
  p_editor text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_report_id is null then
    raise exception 'Report ID is required.' using errcode = '22023';
  end if;

  if nullif(trim(p_editor), '') is null then
    raise exception 'Editor name is required.' using errcode = '22023';
  end if;

  delete from public.material_usage_reports
  where id = p_report_id;

  if not found then
    raise exception 'Material Usage report not found.' using errcode = 'P0002';
  end if;
end;
$function$;

alter table public.material_usage_reports enable row level security;
alter table public.material_usage_lines enable row level security;

drop policy if exists "Allow anon read material usage reports" on public.material_usage_reports;
drop policy if exists "Allow authenticated read material usage reports" on public.material_usage_reports;
drop policy if exists "Allow anon read material usage lines" on public.material_usage_lines;
drop policy if exists "Allow authenticated read material usage lines" on public.material_usage_lines;

create policy "Allow anon read material usage reports"
  on public.material_usage_reports for select to anon using (true);
create policy "Allow authenticated read material usage reports"
  on public.material_usage_reports for select to authenticated using (true);
create policy "Allow anon read material usage lines"
  on public.material_usage_lines for select to anon using (true);
create policy "Allow authenticated read material usage lines"
  on public.material_usage_lines for select to authenticated using (true);

alter function public.set_material_usage_updated_at() owner to postgres;
alter function public.save_material_usage_report(jsonb, jsonb, text) owner to postgres;
alter function public.delete_material_usage_report(uuid, text) owner to postgres;

revoke all on table public.material_usage_reports from public, anon, authenticated;
revoke all on table public.material_usage_lines from public, anon, authenticated;
grant select on table public.material_usage_reports to anon, authenticated, service_role;
grant select on table public.material_usage_lines to anon, authenticated, service_role;

revoke all on function public.save_material_usage_report(jsonb, jsonb, text) from public;
revoke all on function public.delete_material_usage_report(uuid, text) from public;
grant execute on function public.save_material_usage_report(jsonb, jsonb, text) to anon, authenticated, service_role;
grant execute on function public.delete_material_usage_report(uuid, text) to anon, authenticated, service_role;

comment on table public.material_usage_reports is
  'Job-centered Material Usage report headers. Job snapshots preserve the display identity recorded at save time.';
comment on table public.material_usage_lines is
  'Ordered material-consumption lines belonging to one Material Usage report.';
comment on column public.material_usage_lines.plate is
  'Legacy-compatible Color Plate #. The save RPC stores it only for Chip Blend material lines.';

commit;
