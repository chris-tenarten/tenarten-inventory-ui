begin;

create extension if not exists pgcrypto;

create table public.manpower_workers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manpower_workers_name_not_blank check (length(trim(display_name)) > 0)
);

create unique index manpower_workers_display_name_unique_idx
  on public.manpower_workers (lower(display_name));
create index manpower_workers_active_sort_idx
  on public.manpower_workers (is_active desc, sort_order, display_name);

create table public.manpower_tasks (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manpower_tasks_name_not_blank check (length(trim(display_name)) > 0)
);

create unique index manpower_tasks_display_name_unique_idx
  on public.manpower_tasks (lower(display_name));
create index manpower_tasks_active_sort_idx
  on public.manpower_tasks (is_active desc, sort_order, display_name);

create table public.manpower_entries (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  worker_id uuid not null references public.manpower_workers(id),
  task_id uuid not null references public.manpower_tasks(id),
  job_id uuid references public.jobs(id) on delete restrict,
  unlisted_work_label text,
  am_hours numeric(6, 2) not null default 0,
  pm_hours numeric(6, 2) not null default 0,
  notes text,
  entered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manpower_entries_job_or_label_check check (
    (job_id is not null and unlisted_work_label is null)
    or
    (job_id is null and unlisted_work_label is not null and length(trim(unlisted_work_label)) > 0)
  ),
  constraint manpower_entries_am_hours_check check (am_hours >= 0 and am_hours <= 24),
  constraint manpower_entries_pm_hours_check check (pm_hours >= 0 and pm_hours <= 24),
  constraint manpower_entries_daily_hours_check check (am_hours + pm_hours <= 24)
);

comment on table public.manpower_entries is
  'Individual labor rows grouped in the UI by a Production job or an unlisted work label.';
comment on column public.manpower_entries.unlisted_work_label is
  'Free-text work identity used without creating a Production job; may be reconciled later.';
comment on column public.manpower_entries.am_hours is
  'AM labor hours. Total hours are derived as am_hours + pm_hours and are not stored.';

create index manpower_entries_work_date_idx
  on public.manpower_entries (work_date desc);
create index manpower_entries_job_date_idx
  on public.manpower_entries (job_id, work_date desc);
create index manpower_entries_worker_date_idx
  on public.manpower_entries (worker_id, work_date desc);

create or replace function public.set_manpower_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create trigger trg_manpower_workers_updated_at
before update on public.manpower_workers
for each row execute function public.set_manpower_updated_at();

create trigger trg_manpower_tasks_updated_at
before update on public.manpower_tasks
for each row execute function public.set_manpower_updated_at();

create trigger trg_manpower_entries_updated_at
before update on public.manpower_entries
for each row execute function public.set_manpower_updated_at();

-- Isolated seed values confidently named in Project Memory. The complete
-- Monday/Excel option lists still require product-owner confirmation.
insert into public.manpower_workers (display_name, sort_order)
select 'Ramon', 10
where not exists (
  select 1 from public.manpower_workers where lower(display_name) = lower('Ramon')
);

insert into public.manpower_tasks (display_name, sort_order)
select 'Rough Grind on Wizard', 10
where not exists (
  select 1 from public.manpower_tasks where lower(display_name) = lower('Rough Grind on Wizard')
);

alter table public.manpower_workers enable row level security;
alter table public.manpower_tasks enable row level security;
alter table public.manpower_entries enable row level security;

create policy "Allow anon read manpower workers"
  on public.manpower_workers for select to anon using (true);
create policy "Allow anon insert manpower workers"
  on public.manpower_workers for insert to anon with check (true);
create policy "Allow anon update manpower workers"
  on public.manpower_workers for update to anon using (true) with check (true);

create policy "Allow anon read manpower tasks"
  on public.manpower_tasks for select to anon using (true);
create policy "Allow anon insert manpower tasks"
  on public.manpower_tasks for insert to anon with check (true);
create policy "Allow anon update manpower tasks"
  on public.manpower_tasks for update to anon using (true) with check (true);

create policy "Allow anon read manpower entries"
  on public.manpower_entries for select to anon using (true);
create policy "Allow anon insert manpower entries"
  on public.manpower_entries for insert to anon with check (true);
create policy "Allow anon update manpower entries"
  on public.manpower_entries for update to anon using (true) with check (true);

commit;
