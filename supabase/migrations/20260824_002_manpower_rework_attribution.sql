begin;

alter table public.manpower_entries
  add column rework_cycle_id uuid;

alter table public.production_rework_cycles
  add constraint production_rework_cycles_id_job_unique unique (id, job_id);

alter table public.manpower_entries
  add constraint manpower_entries_rework_requires_job_check
    check (rework_cycle_id is null or job_id is not null),
  add constraint manpower_entries_rework_matches_job_fkey
    foreign key (rework_cycle_id, job_id)
    references public.production_rework_cycles(id, job_id)
    on delete restrict;

comment on column public.manpower_entries.rework_cycle_id is
  'Optional Production Rework lifecycle attribution. job_id remains the canonical Job and must match the referenced Rework cycle.';

create index manpower_entries_rework_date_idx
  on public.manpower_entries (rework_cycle_id, work_date desc)
  where rework_cycle_id is not null;

commit;
