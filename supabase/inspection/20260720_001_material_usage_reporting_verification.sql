begin;

do $block$
declare
  fixture_job_id uuid := gen_random_uuid();
  replacement_job_id uuid := gen_random_uuid();
  fixture_report_id uuid;
  saved_report_id uuid;
begin
  if to_regclass('public.material_usage_reports') is null
     or to_regclass('public.material_usage_lines') is null then
    raise exception 'Material Usage tables are missing.';
  end if;

  if to_regprocedure('public.save_material_usage_report(jsonb,jsonb,text)') is null
     or to_regprocedure('public.delete_material_usage_report(uuid,text)') is null then
    raise exception 'Material Usage RPC contract is missing.';
  end if;

  insert into public.jobs (
    id, name, job_number, work_order_number, color_plate_number
  ) values
    (
      fixture_job_id, 'Material Usage verification fixture', 'VERIFY-MU',
      'VERIFY-CANONICAL-WO', 'VERIFY-CANONICAL-PLATE'
    ),
    (
      replacement_job_id, 'Replacement verification fixture', 'VERIFY-NEW',
      'VERIFY-NEW-WO', 'VERIFY-NEW-PLATE'
    );

  saved_report_id := public.save_material_usage_report(
    jsonb_build_object(
      'job_id', fixture_job_id,
      'job_number_snapshot', 'IGNORED-NEW-SNAPSHOT',
      'job_name_snapshot', 'Ignored new snapshot',
      'report_date', current_date,
      'work_order', 'VERIFY-EDITED-WO',
      'terrazzo_type', 'Verification'
    ),
    jsonb_build_array(
      jsonb_build_object('material_type', 'Resin', 'plate', 'MUST-NOT-PERSIST'),
      jsonb_build_object('material_type', 'Chip Blend', 'material_name', 'Chip Blend A', 'quantity', 1.25, 'unit', 'bags', 'plate', 'VERIFY-PLATE'),
      jsonb_build_object('material_type', 'Chip Blend', 'material_name', 'Chip Blend B', 'plate', 'verify-plate')
    ),
    'Migration verification'
  );

  fixture_report_id := saved_report_id;

  if not exists (
    select 1
    from public.material_usage_reports report
    where report.id = saved_report_id
      and report.job_id = fixture_job_id
      and report.job_number_snapshot = 'VERIFY-MU'
      and report.job_name_snapshot = 'Material Usage verification fixture'
      and report.work_order = 'VERIFY-EDITED-WO'
      and not exists (
        select 1 from public.material_usage_lines
        where report_id = report.id
          and lower(material_type) <> 'chip blend'
          and plate is not null
      )
      and (
        select count(distinct lower(plate))
        from public.material_usage_lines
        where report_id = report.id and lower(material_type) = 'chip blend'
      ) = 1
  ) then
    raise exception 'Material Usage save verification failed.';
  end if;

  update public.jobs
  set job_number = 'VERIFY-MU-CHANGED',
      name = 'Changed Production name',
      work_order_number = 'VERIFY-WO-CHANGED',
      color_plate_number = 'VERIFY-PLATE-CHANGED'
  where id = fixture_job_id;

  saved_report_id := public.save_material_usage_report(
    jsonb_build_object(
      'id', saved_report_id,
      'job_id', fixture_job_id,
      'job_number_snapshot', 'VERIFY-MU',
      'job_name_snapshot', 'Material Usage verification fixture',
      'report_date', current_date,
      'work_order', 'VERIFY-EDITED-WO'
    ),
    jsonb_build_array(
      jsonb_build_object('material_type', 'Chip Blend', 'plate', 'VERIFY-PLATE')
    ),
    'Migration verification'
  );

  if not exists (
    select 1 from public.material_usage_reports
    where id = saved_report_id
      and job_number_snapshot = 'VERIFY-MU'
      and job_name_snapshot = 'Material Usage verification fixture'
      and work_order = 'VERIFY-EDITED-WO'
  ) then
    raise exception 'Material Usage historical snapshot preservation failed.';
  end if;

  saved_report_id := public.save_material_usage_report(
    jsonb_build_object(
      'id', saved_report_id,
      'job_id', replacement_job_id,
      'job_number_snapshot', 'IGNORED-REASSIGNMENT',
      'job_name_snapshot', 'Ignored reassignment',
      'report_date', current_date,
      'work_order', 'IGNORED-REASSIGNMENT-WO'
    ),
    jsonb_build_array(
      jsonb_build_object('material_type', 'Chip Blend', 'material_name', 'Chip Blend A'),
      jsonb_build_object('material_type', 'Chip Blend', 'material_name', 'Chip Blend B')
    ),
    'Migration verification'
  );

  if not exists (
    select 1 from public.material_usage_reports
    where id = saved_report_id
      and job_id = replacement_job_id
      and job_number_snapshot = 'VERIFY-NEW'
      and job_name_snapshot = 'Replacement verification fixture'
      and work_order = 'VERIFY-NEW-WO'
  ) or exists (
    select 1 from public.material_usage_lines
    where report_id = saved_report_id
      and lower(material_type) = 'chip blend'
      and plate is distinct from 'VERIFY-NEW-PLATE'
  ) then
    raise exception 'Material Usage canonical reassignment defaults failed.';
  end if;

  saved_report_id := public.save_material_usage_report(
    jsonb_build_object(
      'id', saved_report_id,
      'unlisted_job_name', 'Temporary verification work',
      'report_date', current_date,
      'notes', 'Updated verification report'
    ),
    '[]'::jsonb,
    'Migration verification'
  );

  if saved_report_id <> fixture_report_id
     or not exists (
       select 1
       from public.material_usage_reports
       where id = saved_report_id
         and job_id is null
         and unlisted_job_name = 'Temporary verification work'
         and job_number_snapshot is null
     )
     or exists (
       select 1 from public.material_usage_lines where report_id = saved_report_id
     ) then
    raise exception 'Material Usage update verification failed.';
  end if;

  perform public.delete_material_usage_report(saved_report_id, 'Migration verification');

  if exists (select 1 from public.material_usage_reports where id = saved_report_id) then
    raise exception 'Material Usage delete verification failed.';
  end if;
end;
$block$;

rollback;
