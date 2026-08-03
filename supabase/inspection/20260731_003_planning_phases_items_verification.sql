begin;

do $$
declare
  job_one uuid; job_two uuid; phase_one uuid; phase_two uuid; item_one uuid; item_two uuid;
  library_phase uuid; library_item uuid; before_update timestamptz;
  role_name text; privilege_name text; table_name text;
begin
  if to_regclass('public.whiteboard_cards') is not null then raise exception 'VERIFY_LEGACY_TABLE_REMAINS'; end if;
  if to_regclass('public.planning_steps') is not null or to_regclass('public.planning_phase_library_steps') is not null then raise exception 'VERIFY_STEP_TABLE_REMAINS'; end if;

  insert into public.jobs(name,legacy_source) values('PLANNING_VERIFY_JOB_1','PLANNING_VERIFY_20260731') returning id into job_one;
  insert into public.jobs(name,legacy_source) values('PLANNING_VERIFY_JOB_2','PLANNING_VERIFY_20260731') returning id into job_two;
  insert into public.planning_phases(job_id,title,timeline_behavior,include_in_planning_progress,created_by) values(job_one,'Undated','planning_only',true,repeat('C',200)) returning id into phase_one;
  insert into public.planning_phases(job_id,title,status,start_date,end_date,timeline_behavior) values(job_one,'Overlay','in_progress',current_date,current_date+2,'overlay') returning id into phase_two;
  insert into public.planning_phases(job_id,title,start_date,end_date,timeline_behavior) values(job_one,'Pause',current_date,current_date+1,'pause');
  begin insert into public.planning_phases(job_id,title,start_date,end_date,timeline_behavior) values(job_one,'Bad',current_date,current_date-1,'overlay'); raise exception 'VERIFY_BAD_DATE_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.planning_phases(job_id,title,timeline_behavior) values(job_one,'Missing dates','overlay'); raise exception 'VERIFY_MISSING_DATES_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.planning_phases(job_id,title,status) values(job_one,'Bad status','invalid'); raise exception 'VERIFY_BAD_PHASE_STATUS_ACCEPTED'; exception when check_violation then null; end;
  begin update public.planning_phases set blocked_by_phase_id=phase_one where id=phase_one; raise exception 'VERIFY_SELF_DEPENDENCY_ACCEPTED'; exception when check_violation then null; end;
  begin update public.planning_phases set job_id=job_two,blocked_by_phase_id=phase_one where id=phase_two; raise exception 'VERIFY_CROSS_JOB_DEPENDENCY_ACCEPTED'; exception when check_violation then null; end;
  update public.planning_phases set blocked_by_phase_id=phase_one where id=phase_two;
  delete from public.planning_phases where id=phase_one;
  if (select blocked_by_phase_id from public.planning_phases where id=phase_two) is not null then raise exception 'VERIFY_DEPENDENCY_SET_NULL'; end if;

  insert into public.planning_items(phase_id,title,is_complete,sort_order) values(phase_two,'Item one',true,0) returning id into item_one;
  insert into public.planning_items(phase_id,title,owner,due_date,is_complete,sort_order,updated_at) values(phase_two,'Item two',null,null,false,1,now()-interval '1 day') returning id into item_two;
  begin insert into public.planning_items(phase_id,title,sort_order) values(phase_two,'Bad sort',-1); raise exception 'VERIFY_BAD_ITEM_SORT_ACCEPTED'; exception when check_violation then null; end;
  delete from public.planning_items where id=item_one;
  if not exists(select 1 from public.planning_items where id=item_two) then raise exception 'VERIFY_ITEM_SIBLING_DELETED'; end if;

  insert into public.planning_phase_library(name,active,sort_order,default_include_in_planning_progress) values('Shipping',false,2,true) returning id into library_phase;
  insert into public.planning_phase_library_items(library_phase_id,title,suggested_due_offset_days,sort_order) values(library_phase,'Confirm freight',2,0) returning id into library_item;
  insert into public.planning_phases(job_id,title,include_in_planning_progress) select job_one,name,default_include_in_planning_progress from public.planning_phase_library where id=library_phase returning id into phase_one;
  insert into public.planning_items(phase_id,title,notes,owner,is_complete,sort_order) select phase_one,title,notes,suggested_owner,false,sort_order from public.planning_phase_library_items where library_phase_id=library_phase;
  update public.planning_phase_library set name='Changed' where id=library_phase;
  if (select title from public.planning_phases where id=phase_one) <> 'Shipping' then raise exception 'VERIFY_LIBRARY_LIVE_LINK'; end if;
  delete from public.planning_phase_library where id=library_phase;
  if not exists(select 1 from public.planning_phases where id=phase_one) then raise exception 'VERIFY_LIBRARY_DELETE_AFFECTED_COPY'; end if;
  if exists(select 1 from public.planning_phase_library_items where id=library_item) then raise exception 'VERIFY_LIBRARY_ITEM_CASCADE'; end if;

  select updated_at into before_update from public.planning_items where id=item_two;
  update public.planning_items set notes='changed' where id=item_two;
  if (select updated_at from public.planning_items where id=item_two) <= before_update then raise exception 'VERIFY_UPDATED_AT'; end if;

  foreach table_name in array array['planning_phases','planning_items','planning_phase_library','planning_phase_library_items'] loop
    if not (select relrowsecurity from pg_class where oid=format('public.%I',table_name)::regclass) then raise exception 'VERIFY_RLS:%',table_name; end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=table_name) <> 8 then raise exception 'VERIFY_POLICY_COUNT:%',table_name; end if;
    if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl where c.oid=format('public.%I',table_name)::regclass and acl.grantee=0) then raise exception 'VERIFY_PUBLIC_PRIVILEGE:%',table_name; end if;
    foreach role_name in array array['anon','authenticated'] loop
      foreach privilege_name in array array['select','insert','update','delete'] loop if not has_table_privilege(role_name,format('public.%I',table_name),privilege_name) then raise exception 'VERIFY_BROWSER_MISSING:%:%:%',table_name,role_name,privilege_name; end if; end loop;
      foreach privilege_name in array array['truncate','references','trigger','maintain'] loop if has_table_privilege(role_name,format('public.%I',table_name),privilege_name) then raise exception 'VERIFY_BROWSER_EXCESS:%:%:%',table_name,role_name,privilege_name; end if; end loop;
    end loop;
    foreach privilege_name in array array['select','insert','update','delete','truncate','references','trigger','maintain'] loop if not has_table_privilege('service_role',format('public.%I',table_name),privilege_name) then raise exception 'VERIFY_SERVICE_MISSING:%:%',table_name,privilege_name; end if; end loop;
  end loop;

  if exists(
    select 1 from pg_proc procedure
    cross join lateral aclexplode(coalesce(procedure.proacl,acldefault('f',procedure.proowner))) acl
    where procedure.pronamespace='public'::regnamespace
      and procedure.proname in('set_planning_phase_updated_at','validate_planning_phase_dependency','set_planning_record_updated_at')
      and acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) then raise exception 'VERIFY_TRIGGER_FUNCTION_PUBLIC_EXECUTE'; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(role_name,'public.set_planning_phase_updated_at()','execute') or has_function_privilege(role_name,'public.validate_planning_phase_dependency()','execute') or has_function_privilege(role_name,'public.set_planning_record_updated_at()','execute') then raise exception 'VERIFY_TRIGGER_FUNCTION_EXECUTE:%',role_name; end if;
  end loop;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in('set_planning_phase_updated_at','validate_planning_phase_dependency','set_planning_record_updated_at') and not coalesce(proconfig,'{}') @> array['search_path=public, pg_temp']) then raise exception 'VERIFY_TRIGGER_FUNCTION_SEARCH_PATH'; end if;

  delete from public.planning_phases where id=phase_two;
  if exists(select 1 from public.planning_items where id=item_two) then raise exception 'VERIFY_PHASE_ITEM_CASCADE'; end if;
  delete from public.jobs where id=job_one;
  if exists(select 1 from public.planning_phases where job_id=job_one) then raise exception 'VERIFY_JOB_CASCADE'; end if;
  delete from public.jobs where id=job_two;
end $$;

rollback;

do $$ begin
  if exists(select 1 from public.jobs where legacy_source='PLANNING_VERIFY_20260731') then raise exception 'VERIFY_ROLLBACK_JOBS'; end if;
end $$;
