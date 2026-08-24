begin;

do $$
declare
  fixture_job uuid;
  other_job uuid;
  fixture_worker uuid;
  fixture_task uuid;
  fixture_cycle uuid;
begin
  insert into public.jobs(name, production_status, material_status, priority, progress_percent)
  values ('MANPOWER REWORK VERIFY — ROLLBACK', 'complete', 'unknown', 'normal', 100)
  returning id into fixture_job;

  insert into public.jobs(name, production_status, material_status, priority, progress_percent)
  values ('MANPOWER REWORK OTHER — ROLLBACK', 'complete', 'unknown', 'normal', 100)
  returning id into other_job;

  insert into public.manpower_workers(display_name, sort_order)
  values ('Manpower Rework Verifier Worker', 9999)
  returning id into fixture_worker;

  insert into public.manpower_tasks(display_name, sort_order)
  values ('Manpower Rework Verifier Task', 9999)
  returning id into fixture_task;

  insert into public.production_rework_cycles(job_id, sequence_number, reason_category, scope_details, intake_date)
  values (fixture_job, 1, 'other', 'Verifier-only scope.', date '2097-08-24')
  returning id into fixture_cycle;

  insert into public.manpower_entries(work_date, worker_id, task_id, job_id, rework_cycle_id, am_hours, pm_hours)
  values (date '2097-08-24', fixture_worker, fixture_task, fixture_job, fixture_cycle, 1, 0);

  insert into public.manpower_entries(work_date, worker_id, task_id, job_id, am_hours, pm_hours)
  values (date '2097-08-24', fixture_worker, fixture_task, fixture_job, 1, 0);

  insert into public.manpower_entries(work_date, worker_id, task_id, unlisted_work_label, am_hours, pm_hours)
  values (date '2097-08-24', fixture_worker, fixture_task, 'Temporary verifier work', 1, 0);

  begin
    insert into public.manpower_entries(work_date, worker_id, task_id, job_id, rework_cycle_id, am_hours, pm_hours)
    values (date '2097-08-24', fixture_worker, fixture_task, other_job, fixture_cycle, 1, 0);
    raise exception 'Mismatched Job/Rework pair was accepted.';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.manpower_entries(work_date, worker_id, task_id, rework_cycle_id, unlisted_work_label, am_hours, pm_hours)
    values (date '2097-08-24', fixture_worker, fixture_task, fixture_cycle, 'Invalid temporary Rework', 1, 0);
    raise exception 'Temporary/Rework pair was accepted.';
  exception when check_violation then null;
  end;

  begin
    delete from public.production_rework_cycles where id = fixture_cycle;
    raise exception 'Referenced Rework history was deleted.';
  exception when foreign_key_violation then null;
  end;
end;
$$;

rollback;
