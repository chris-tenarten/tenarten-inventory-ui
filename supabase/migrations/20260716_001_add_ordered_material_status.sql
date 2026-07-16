begin;

alter table public.jobs
  drop constraint jobs_material_status_check;

alter table public.jobs
  add constraint jobs_material_status_check check (
    material_status in (
      'unknown',
      'not_ready',
      'ordered',
      'ready'
    )
  );

commit;
