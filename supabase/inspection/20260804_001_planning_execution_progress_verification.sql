begin;

do $$
declare
  job_id uuid;
  verify_phase_id uuid;
  library_id uuid;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='planning_items' and column_name='estimated_hours' and is_nullable='NO' and column_default='1'::text) then raise exception 'VERIFY_PLANNING_ITEM_HOURS_COLUMN'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='planning_phase_library_items' and column_name='estimated_hours' and is_nullable='NO' and column_default='1'::text) then raise exception 'VERIFY_LIBRARY_ITEM_HOURS_COLUMN'; end if;

  insert into public.jobs(name,legacy_source) values('PLANNING_PROGRESS_VERIFY','PLANNING_PROGRESS_VERIFY_20260804') returning id into job_id;
  insert into public.planning_phases(job_id,title) values(job_id,'Verify Phase') returning id into verify_phase_id;
  insert into public.planning_items(phase_id,title) values(verify_phase_id,'Default effort');
  insert into public.planning_items(phase_id,title,estimated_hours) values(verify_phase_id,'Decimal effort',2.75);
  if (select estimated_hours from public.planning_items where phase_id=verify_phase_id and title='Default effort') <> 1 then raise exception 'VERIFY_PLANNING_ITEM_HOURS_DEFAULT'; end if;
  begin insert into public.planning_items(phase_id,title,estimated_hours) values(verify_phase_id,'Invalid effort',0); raise exception 'VERIFY_NON_POSITIVE_ITEM_HOURS_ACCEPTED'; exception when check_violation then null; end;

  insert into public.planning_phase_library(name) values('Progress Verify Library') returning id into library_id;
  insert into public.planning_phase_library_items(library_phase_id,title,estimated_hours) values(library_id,'Reusable decimal effort',1.5);
  begin insert into public.planning_phase_library_items(library_phase_id,title,estimated_hours) values(library_id,'Invalid reusable effort',-1); raise exception 'VERIFY_NON_POSITIVE_LIBRARY_HOURS_ACCEPTED'; exception when check_violation then null; end;
end $$;

rollback;

do $$ begin
  if exists(select 1 from public.jobs where legacy_source='PLANNING_PROGRESS_VERIFY_20260804') then raise exception 'VERIFY_PROGRESS_FIXTURES_ROLLED_BACK'; end if;
end $$;
