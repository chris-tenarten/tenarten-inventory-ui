begin;

do $$
begin
  if to_regclass('public.whiteboard_cards') is null then raise exception 'PLANNING_REFACTOR_SOURCE_MISSING'; end if;
  if exists(select 1 from public.whiteboard_cards) then raise exception 'PLANNING_REFACTOR_SOURCE_NOT_EMPTY'; end if;
  if to_regclass('public.planning_phases') is not null or to_regclass('public.planning_items') is not null
    or to_regclass('public.planning_phase_library') is not null or to_regclass('public.planning_phase_library_items') is not null
  then raise exception 'PLANNING_REFACTOR_TARGET_EXISTS'; end if;
end $$;

alter table public.whiteboard_cards rename to planning_phases;
alter table public.planning_phases rename column blocked_by_card_id to blocked_by_phase_id;
alter table public.planning_phases add column include_in_planning_progress boolean not null default false;
alter table public.planning_phases drop column progress_behavior;
alter table public.planning_phases drop constraint whiteboard_card_date_range;
alter table public.planning_phases drop constraint whiteboard_card_timeline_dates;
alter table public.planning_phases drop constraint whiteboard_card_not_self_blocked;
alter table public.planning_phases add constraint planning_phase_date_range check (start_date is null or end_date is null or end_date >= start_date);
alter table public.planning_phases add constraint planning_phase_timeline_dates check (timeline_behavior = 'planning_only' or (start_date is not null and end_date is not null));
alter table public.planning_phases add constraint planning_phase_not_self_blocked check (blocked_by_phase_id is null or blocked_by_phase_id <> id);
alter table public.planning_phases drop constraint whiteboard_cards_timeline_behavior_check;
alter table public.planning_phases add constraint planning_phase_timeline_behavior check (timeline_behavior in ('overlay','pause','planning_only'));
alter table public.planning_phases alter column timeline_behavior set default 'planning_only';
alter table public.planning_phases rename constraint whiteboard_cards_pkey to planning_phases_pkey;
alter table public.planning_phases rename constraint whiteboard_cards_job_id_fkey to planning_phases_job_id_fkey;
alter table public.planning_phases rename constraint whiteboard_cards_blocked_by_card_id_fkey to planning_phases_blocked_by_phase_id_fkey;
alter table public.planning_phases rename constraint whiteboard_cards_category_check to planning_phases_category_check;
alter table public.planning_phases rename constraint whiteboard_cards_created_by_check to planning_phases_created_by_check;
alter table public.planning_phases rename constraint whiteboard_cards_description_check to planning_phases_description_check;
alter table public.planning_phases rename constraint whiteboard_cards_owner_check to planning_phases_owner_check;
alter table public.planning_phases rename constraint whiteboard_cards_status_check to planning_phases_status_check;
alter table public.planning_phases rename constraint whiteboard_cards_title_check to planning_phases_title_check;

alter index public.whiteboard_cards_job_idx rename to planning_phases_job_idx;
alter index public.whiteboard_cards_owner_idx rename to planning_phases_owner_idx;
alter index public.whiteboard_cards_category_idx rename to planning_phases_category_idx;
drop index public.whiteboard_cards_timeline_idx;
create index planning_phases_timeline_idx on public.planning_phases(job_id,start_date,end_date) where timeline_behavior <> 'planning_only';
alter trigger trg_whiteboard_cards_updated_at on public.planning_phases rename to trg_planning_phases_updated_at;
alter trigger trg_whiteboard_cards_dependency on public.planning_phases rename to trg_planning_phases_dependency;
alter function public.set_whiteboard_card_updated_at() rename to set_planning_phase_updated_at;
alter function public.validate_whiteboard_card_dependency() rename to validate_planning_phase_dependency;
create or replace function public.validate_planning_phase_dependency()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.blocked_by_phase_id is not null and not exists(
    select 1 from public.planning_phases dependency where dependency.id=new.blocked_by_phase_id and dependency.job_id=new.job_id
  ) then raise exception 'A Planning dependency must belong to the same Production job.' using errcode='23514'; end if;
  return new;
end $$;

drop policy "Allow anon read whiteboard cards" on public.planning_phases;
drop policy "Allow anon insert whiteboard cards" on public.planning_phases;
drop policy "Allow anon update whiteboard cards" on public.planning_phases;
drop policy "Allow anon delete whiteboard cards" on public.planning_phases;
drop policy "Allow authenticated read whiteboard cards" on public.planning_phases;
drop policy "Allow authenticated insert whiteboard cards" on public.planning_phases;
drop policy "Allow authenticated update whiteboard cards" on public.planning_phases;
drop policy "Allow authenticated delete whiteboard cards" on public.planning_phases;

create table public.planning_items (
  id uuid primary key default gen_random_uuid(), phase_id uuid not null references public.planning_phases(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 200), notes text not null default '' check(length(notes)<=12000),
  owner text check(owner is null or length(owner)<=200), is_complete boolean not null default false,
  due_date date, sort_order integer not null default 0 check(sort_order>=0), created_by text check(created_by is null or length(created_by)<=200),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index planning_items_phase_idx on public.planning_items(phase_id,sort_order,created_at);

create table public.planning_phase_library (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200),
  default_description text not null default '' check(length(default_description)<=12000), default_category text not null default 'internal' check(default_category in ('internal','customer','vendor','logistics','blocker','reference')),
  suggested_owner text check(suggested_owner is null or length(suggested_owner)<=200), suggested_duration_days integer check(suggested_duration_days is null or suggested_duration_days between 1 and 3650),
  default_timeline_behavior text not null default 'planning_only' check(default_timeline_behavior in ('overlay','pause','planning_only')),
  default_include_in_planning_progress boolean not null default false, active boolean not null default true, sort_order integer not null default 0 check(sort_order>=0),
  created_by text check(created_by is null or length(created_by)<=200), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index planning_phase_library_order_idx on public.planning_phase_library(active desc,sort_order,name);

create table public.planning_phase_library_items (
  id uuid primary key default gen_random_uuid(), library_phase_id uuid not null references public.planning_phase_library(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 200), notes text not null default '' check(length(notes)<=12000),
  suggested_owner text check(suggested_owner is null or length(suggested_owner)<=200), suggested_due_offset_days integer check(suggested_due_offset_days is null or suggested_due_offset_days between 0 and 3650), sort_order integer not null default 0 check(sort_order>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index planning_phase_library_items_idx on public.planning_phase_library_items(library_phase_id,sort_order,created_at);

create function public.set_planning_record_updated_at() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin new.updated_at=now(); return new; end $$;
create trigger trg_planning_items_updated_at before update on public.planning_items for each row execute function public.set_planning_record_updated_at();
create trigger trg_planning_phase_library_updated_at before update on public.planning_phase_library for each row execute function public.set_planning_record_updated_at();
create trigger trg_planning_phase_library_items_updated_at before update on public.planning_phase_library_items for each row execute function public.set_planning_record_updated_at();

do $$ declare table_name text; role_name text; begin
  foreach table_name in array array['planning_phases','planning_items','planning_phase_library','planning_phase_library_items'] loop
    execute format('alter table public.%I enable row level security',table_name);
    foreach role_name in array array['anon','authenticated'] loop
      execute format('create policy %I on public.%I for select to %I using (true)',format('Allow %s read %s',role_name,replace(table_name,'_',' ')),table_name,role_name);
      execute format('create policy %I on public.%I for insert to %I with check (true)',format('Allow %s insert %s',role_name,replace(table_name,'_',' ')),table_name,role_name);
      execute format('create policy %I on public.%I for update to %I using (true) with check (true)',format('Allow %s update %s',role_name,replace(table_name,'_',' ')),table_name,role_name);
      execute format('create policy %I on public.%I for delete to %I using (true)',format('Allow %s delete %s',role_name,replace(table_name,'_',' ')),table_name,role_name);
    end loop;
    execute format('revoke all privileges on table public.%I from public,anon,authenticated,service_role',table_name);
    execute format('grant select,insert,update,delete on table public.%I to anon,authenticated',table_name);
    execute format('grant all privileges on table public.%I to service_role',table_name);
  end loop;
end $$;

revoke all on function public.set_planning_phase_updated_at() from public,anon,authenticated,service_role;
revoke all on function public.validate_planning_phase_dependency() from public,anon,authenticated,service_role;
revoke all on function public.set_planning_record_updated_at() from public,anon,authenticated,service_role;
comment on table public.planning_phases is 'Job-scoped Planning Phases; Production dates remain canonical.';
comment on table public.planning_items is 'Lightweight actionable or informational items nested within a Planning Phase.';
comment on table public.planning_phase_library is 'Reusable Phase definitions copied into jobs without a live link.';

commit;
