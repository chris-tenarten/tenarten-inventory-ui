begin;

alter table public.planning_items
  add column estimated_hours numeric(10,2) not null default 1,
  add constraint planning_items_estimated_hours_positive check (estimated_hours > 0);

alter table public.planning_phase_library_items
  add column estimated_hours numeric(10,2) not null default 1,
  add constraint planning_phase_library_items_estimated_hours_positive check (estimated_hours > 0);

comment on column public.planning_items.estimated_hours is
  'Estimated Planning effort for weighted Phase and overall Planning progress; unrelated to Production labor estimates.';
comment on column public.planning_phase_library_items.estimated_hours is
  'Default Planning effort copied into a job-scoped Planning Item.';

commit;
