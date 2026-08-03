begin;

do $$
declare
  job_one uuid;
  job_two uuid;
  undated_card uuid;
  overlay_card uuid;
  pause_card uuid;
  dependency_target uuid;
  dependency_child uuid;
  retained_target uuid;
  deleted_child uuid;
  previous_updated_at timestamptz;
  marker text := 'WHITEBOARD_VERIFY_20260731';
begin
  if exists (select 1 from public.jobs where name like marker || '%') then
    raise exception 'VERIFY_WHITEBOARD_DIRTY_FIXTURES';
  end if;

  insert into public.jobs(name, legacy_source) values(marker || '_JOB_ONE', marker) returning id into job_one;
  insert into public.jobs(name, legacy_source) values(marker || '_JOB_TWO', marker) returning id into job_two;

  insert into public.whiteboard_cards(job_id,title,category,status,timeline_behavior,progress_behavior,created_by,updated_at)
  values(job_one,marker || '_UNDATED','internal','open','whiteboard_only','included',repeat('C',200),now()-interval '1 minute') returning id into undated_card;
  insert into public.whiteboard_cards(job_id,title,owner,category,status,start_date,end_date,timeline_behavior,progress_behavior)
  values(job_one,marker || '_OVERLAY',repeat('O',200),'customer','planned',current_date,current_date + 1,'overlay','none') returning id into overlay_card;
  insert into public.whiteboard_cards(job_id,title,category,status,start_date,end_date,timeline_behavior,progress_behavior)
  values(job_one,marker || '_PAUSE','blocker','waiting',current_date + 2,current_date + 3,'pause','included') returning id into pause_card;
  insert into public.whiteboard_cards(job_id,title,category,status,timeline_behavior)
  values(job_one,marker || '_TARGET','reference','done','whiteboard_only') returning id into dependency_target;
  insert into public.whiteboard_cards(job_id,title,category,status,timeline_behavior,blocked_by_card_id)
  values(job_one,marker || '_DEPENDENT','logistics','open','whiteboard_only',dependency_target) returning id into dependency_child;

  if (select count(*) from public.whiteboard_cards where id in (undated_card, overlay_card, pause_card, dependency_target, dependency_child)) <> 5 then
    raise exception 'VERIFY_WHITEBOARD_VALID_INSERTS';
  end if;
  if (select count(*) from public.whiteboard_cards where job_id=job_one and progress_behavior='included') <> 2 then
    raise exception 'VERIFY_WHITEBOARD_PROGRESS_FIXTURES';
  end if;

  begin insert into public.whiteboard_cards(job_id,title,start_date,end_date,timeline_behavior) values(job_one,marker || '_BAD_ORDER',current_date,current_date-1,'overlay'); raise exception 'VERIFY_BAD_DATE_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,end_date,timeline_behavior) values(job_one,marker || '_OVERLAY_NO_START',current_date,'overlay'); raise exception 'VERIFY_OVERLAY_NO_START_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,start_date,timeline_behavior) values(job_one,marker || '_OVERLAY_NO_END',current_date,'overlay'); raise exception 'VERIFY_OVERLAY_NO_END_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,end_date,timeline_behavior) values(job_one,marker || '_PAUSE_NO_START',current_date,'pause'); raise exception 'VERIFY_PAUSE_NO_START_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,start_date,timeline_behavior) values(job_one,marker || '_PAUSE_NO_END',current_date,'pause'); raise exception 'VERIFY_PAUSE_NO_END_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,category) values(job_one,marker || '_BAD_CATEGORY','invalid'); raise exception 'VERIFY_BAD_CATEGORY_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,status) values(job_one,marker || '_BAD_STATUS','invalid'); raise exception 'VERIFY_BAD_STATUS_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,timeline_behavior) values(job_one,marker || '_BAD_TIMELINE','invalid'); raise exception 'VERIFY_BAD_TIMELINE_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,progress_behavior) values(job_one,marker || '_BAD_PROGRESS','invalid'); raise exception 'VERIFY_BAD_PROGRESS_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,owner) values(job_one,marker || '_LONG_OWNER',repeat('O',201)); raise exception 'VERIFY_LONG_OWNER_ACCEPTED'; exception when check_violation then null; end;
  begin insert into public.whiteboard_cards(job_id,title,created_by) values(job_one,marker || '_LONG_CREATOR',repeat('C',201)); raise exception 'VERIFY_LONG_CREATOR_ACCEPTED'; exception when check_violation then null; end;
  begin update public.whiteboard_cards set blocked_by_card_id=dependency_child where id=dependency_child; raise exception 'VERIFY_SELF_DEPENDENCY_ACCEPTED'; exception when check_violation then null; end;
  begin update public.whiteboard_cards set blocked_by_card_id=dependency_target, job_id=job_two where id=dependency_child; raise exception 'VERIFY_CROSS_JOB_DEPENDENCY_ACCEPTED'; exception when check_violation then null; end;

  delete from public.whiteboard_cards where id=dependency_target;
  if (select blocked_by_card_id from public.whiteboard_cards where id=dependency_child) is not null then raise exception 'VERIFY_DEPENDENCY_SET_NULL'; end if;
  insert into public.whiteboard_cards(job_id,title,timeline_behavior) values(job_one,marker || '_RETAINED_TARGET','whiteboard_only') returning id into retained_target;
  insert into public.whiteboard_cards(job_id,title,timeline_behavior,blocked_by_card_id) values(job_one,marker || '_DELETE_CHILD','whiteboard_only',retained_target) returning id into deleted_child;
  delete from public.whiteboard_cards where id=deleted_child;
  if not exists(select 1 from public.whiteboard_cards where id=retained_target) then raise exception 'VERIFY_TARGET_DELETED_WITH_CHILD'; end if;

  select updated_at into previous_updated_at from public.whiteboard_cards where id=undated_card;
  update public.whiteboard_cards set description='timestamp verification' where id=undated_card;
  if (select updated_at from public.whiteboard_cards where id=undated_card) <= previous_updated_at then raise exception 'VERIFY_UPDATED_AT_NOT_ADVANCED'; end if;

  delete from public.jobs where id=job_two;
  insert into public.whiteboard_cards(job_id,title,timeline_behavior) values(job_one,marker || '_CASCADE','whiteboard_only') returning id into dependency_target;
  delete from public.jobs where id=job_one;
  if exists(select 1 from public.whiteboard_cards where id=dependency_target) then raise exception 'VERIFY_JOB_CASCADE'; end if;
end $$;

do $$
declare
  expected_policies text[] := array[
    'Allow anon read whiteboard cards','Allow anon insert whiteboard cards','Allow anon update whiteboard cards','Allow anon delete whiteboard cards',
    'Allow authenticated read whiteboard cards','Allow authenticated insert whiteboard cards','Allow authenticated update whiteboard cards','Allow authenticated delete whiteboard cards'
  ];
  privilege text;
  role_name text;
begin
  if not (select relrowsecurity from pg_class where oid='public.whiteboard_cards'::regclass) then raise exception 'VERIFY_RLS_DISABLED'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='whiteboard_cards') <> 8 then raise exception 'VERIFY_POLICY_COUNT'; end if;
  if exists(select 1 from unnest(expected_policies) expected where not exists(select 1 from pg_policies where schemaname='public' and tablename='whiteboard_cards' and policyname=expected)) then raise exception 'VERIFY_POLICY_NAMES'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if (select count(*) from pg_policies where schemaname='public' and tablename='whiteboard_cards' and roles @> array[role_name::name] and cmd=privilege) <> 1 then raise exception 'VERIFY_POLICY_SHAPE:%:%',role_name,privilege; end if;
    end loop;
  end loop;

  foreach privilege in array array['select','insert','update','delete','truncate','references','trigger','maintain'] loop
    if exists (
      select 1 from pg_class relation
      cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
      where relation.oid='public.whiteboard_cards'::regclass
        and acl.grantee=0
        and lower(acl.privilege_type)=privilege
    ) then raise exception 'VERIFY_PUBLIC_TABLE_PRIVILEGE:%',privilege; end if;
  end loop;
  foreach role_name in array array['anon','authenticated'] loop
    foreach privilege in array array['select','insert','update','delete'] loop
      if not has_table_privilege(role_name,'public.whiteboard_cards',privilege) then raise exception 'VERIFY_BROWSER_TABLE_PRIVILEGE:%:%',role_name,privilege; end if;
    end loop;
    foreach privilege in array array['truncate','references','trigger','maintain'] loop
      if has_table_privilege(role_name,'public.whiteboard_cards',privilege) then raise exception 'VERIFY_BROWSER_EXCESS_PRIVILEGE:%:%',role_name,privilege; end if;
    end loop;
  end loop;
  foreach privilege in array array['select','insert','update','delete','truncate','references','trigger','maintain'] loop
    if not has_table_privilege('service_role','public.whiteboard_cards',privilege) then raise exception 'VERIFY_SERVICE_TABLE_PRIVILEGE:%',privilege; end if;
  end loop;

  if exists (
    select 1 from pg_proc procedure
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
    where procedure.oid in ('public.set_whiteboard_card_updated_at()'::regprocedure,'public.validate_whiteboard_card_dependency()'::regprocedure)
      and acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) then raise exception 'VERIFY_PUBLIC_TRIGGER_EXECUTE'; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(role_name,'public.set_whiteboard_card_updated_at()','execute') then raise exception 'VERIFY_TRIGGER_EXECUTE:%:updated_at',role_name; end if;
    if has_function_privilege(role_name,'public.validate_whiteboard_card_dependency()','execute') then raise exception 'VERIFY_TRIGGER_EXECUTE:%:dependency',role_name; end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='set_whiteboard_card_updated_at') <> 1 then raise exception 'VERIFY_UPDATED_AT_OVERLOADS'; end if;
  if (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='validate_whiteboard_card_dependency') <> 1 then raise exception 'VERIFY_DEPENDENCY_OVERLOADS'; end if;
  if not exists(select 1 from pg_proc where oid='public.set_whiteboard_card_updated_at()'::regprocedure and proconfig @> array['search_path=public, pg_temp']) then raise exception 'VERIFY_UPDATED_AT_SEARCH_PATH'; end if;
  if not exists(select 1 from pg_proc where oid='public.validate_whiteboard_card_dependency()'::regprocedure and proconfig @> array['search_path=public, pg_temp']) then raise exception 'VERIFY_DEPENDENCY_SEARCH_PATH'; end if;
end $$;

rollback;

do $$
begin
  if exists(select 1 from public.jobs where legacy_source='WHITEBOARD_VERIFY_20260731') then raise exception 'VERIFY_ROLLBACK_JOBS'; end if;
  if exists(select 1 from public.whiteboard_cards where title like 'WHITEBOARD_VERIFY_20260731%') then raise exception 'VERIFY_ROLLBACK_CARDS'; end if;
end $$;
