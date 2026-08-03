begin;

do $$
begin
  if to_regclass('public.planning_phases') is null
    or to_regclass('public.planning_phase_library') is null
  then
    raise exception 'PLANNING_COLOR_PREDECESSOR_MISSING';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'planning_phases' and column_name in ('timeline_color', 'library_phase_id'))
        or (table_name = 'planning_phase_library' and column_name = 'default_timeline_color'))
  ) or to_regprocedure('public.enforce_planning_phase_limit()') is not null
    or exists (
      select 1 from pg_trigger
      where tgrelid = 'public.planning_phases'::regclass
        and tgname = 'trg_planning_phases_limit'
        and not tgisinternal
    )
  then
    raise exception 'PLANNING_COLOR_TARGET_ALREADY_EXISTS';
  end if;
end $$;

alter table public.planning_phase_library
  add column default_timeline_color text not null default 'steel_blue';

alter table public.planning_phase_library
  add constraint planning_phase_library_timeline_color_check
  check (default_timeline_color in (
    'steel_blue','industrial_teal','muted_violet','ochre_gold',
    'slate','rust','sage','deep_cyan'
  ));

alter table public.planning_phases
  add column timeline_color text,
  add column library_phase_id uuid references public.planning_phase_library(id) on delete set null;

alter table public.planning_phases
  add constraint planning_phase_timeline_color_check
  check (
    (timeline_behavior <> 'overlay' and timeline_color is null)
    or (
      timeline_behavior = 'overlay'
      and (
        timeline_color is null or timeline_color in (
          'steel_blue','industrial_teal','muted_violet','ochre_gold',
          'slate','rust','sage','deep_cyan'
        )
      )
    )
  );

-- Freeze existing Overlay appearance before future library-owned colors are used.
with ranked as (
  select id, row_number() over (partition by job_id order by created_at, id) as color_position
  from public.planning_phases
  where timeline_behavior = 'overlay'
)
update public.planning_phases phase
set timeline_color = case ((ranked.color_position - 1) % 4)
  when 0 then 'steel_blue'
  when 1 then 'industrial_teal'
  when 2 then 'muted_violet'
  else 'ochre_gold'
end
from ranked
where phase.id = ranked.id and phase.timeline_color is null;

create or replace function public.enforce_planning_phase_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  existing_count integer;
begin
  -- Existing non-Pause rows may be edited in place even in a legacy over-limit
  -- job. Inserts, Pause -> non-Pause conversions, and moves to another job can
  -- grow the destination condition and therefore require a capacity check.
  if new.timeline_behavior <> 'pause'
    and (
      tg_op = 'INSERT'
      or old.timeline_behavior = 'pause'
      or old.job_id is distinct from new.job_id
    )
  then
    perform pg_advisory_xact_lock(hashtext('planning-phase-limit:' || new.job_id::text));
    select count(*) into existing_count
    from public.planning_phases phase
    where phase.job_id = new.job_id
      and phase.timeline_behavior <> 'pause'
      and (tg_op = 'INSERT' or phase.id <> new.id);
    if existing_count >= 4 then
      raise exception 'Maximum of four Planning Phases per Production job. Pause intervals do not count toward this limit.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger trg_planning_phases_limit
before insert or update of timeline_behavior, job_id on public.planning_phases
for each row execute function public.enforce_planning_phase_limit();

revoke all on function public.enforce_planning_phase_limit() from public, anon, authenticated, service_role;
alter function public.enforce_planning_phase_limit() owner to postgres;

comment on column public.planning_phases.timeline_color is
  'Frozen curated Timeline color inherited from the Phase Library or assigned to preserve an existing appearance; null uses the ad-hoc fallback palette.';
comment on column public.planning_phases.library_phase_id is
  'Origin definition for presentation provenance only; copied job Phases remain operationally independent.';
comment on column public.planning_phase_library.default_timeline_color is
  'Curated default color inherited by Overlay Phases copied from this definition.';

commit;
