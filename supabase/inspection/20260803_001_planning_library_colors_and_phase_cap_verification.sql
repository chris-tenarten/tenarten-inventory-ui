begin;

do $$
declare
  test_job uuid := gen_random_uuid();
  destination_job uuid := gen_random_uuid();
  legacy_job uuid := gen_random_uuid();
  library_id uuid;
  copied_phase_id uuid;
  pause_id uuid;
  movable_phase_id uuid;
  phase_count integer;
  function_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='planning_phases' and column_name='timeline_color'
  ) then raise exception 'VERIFY_TIMELINE_COLOR_MISSING'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='planning_phases' and column_name='library_phase_id'
  ) then raise exception 'VERIFY_LIBRARY_ORIGIN_MISSING'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='planning_phase_library' and column_name='default_timeline_color'
  ) then raise exception 'VERIFY_LIBRARY_COLOR_MISSING'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.planning_phases'::regclass
      and conname = 'planning_phase_timeline_color_check'
      and pg_get_constraintdef(oid) like all (array[
        '%steel_blue%', '%industrial_teal%', '%muted_violet%', '%ochre_gold%',
        '%slate%', '%rust%', '%sage%', '%deep_cyan%'
      ])
  ) then raise exception 'VERIFY_PHASE_COLOR_PALETTE_CONSTRAINT'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.planning_phase_library'::regclass
      and conname = 'planning_phase_library_timeline_color_check'
  ) then raise exception 'VERIFY_LIBRARY_COLOR_PALETTE_CONSTRAINT'; end if;

  -- Durable fixtures required by later assertions must be created outside
  -- expected-failure subtransactions, because caught errors roll back every
  -- statement executed inside their nested block.
  insert into public.jobs(id,name) values
    (test_job,'Planning color verification 20260803'),
    (destination_job,'Planning destination verification 20260803'),
    (legacy_job,'Planning legacy verification 20260803');

  begin
    insert into public.planning_phases(job_id,title,timeline_behavior,timeline_color)
    values(test_job,'Invalid Planning-only color','planning_only','steel_blue');
    raise exception 'VERIFY_PLANNING_ONLY_COLOR_ACCEPTED';
  exception when check_violation then null;
  end;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.planning_phases'::regclass
      and tgname = 'trg_planning_phases_limit'
      and not tgisinternal and tgenabled = 'O'
  ) then raise exception 'VERIFY_PHASE_LIMIT_TRIGGER'; end if;

  select pg_get_functiondef('public.enforce_planning_phase_limit()'::regprocedure)
  into function_definition;
  if function_definition not like '%pg_advisory_xact_lock%'
    or lower(function_definition) not like '%old.job_id is distinct from new.job_id%'
    or function_definition not like '%SET search_path TO ''public'', ''pg_temp''%'
  then raise exception 'VERIFY_PHASE_LIMIT_FUNCTION_DEFINITION'; end if;
  if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
      where procedure.oid = 'public.enforce_planning_phase_limit()'::regprocedure
        and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ) or has_function_privilege('anon', 'public.enforce_planning_phase_limit()', 'execute')
    or has_function_privilege('authenticated', 'public.enforce_planning_phase_limit()', 'execute')
    or has_function_privilege('service_role', 'public.enforce_planning_phase_limit()', 'execute')
  then raise exception 'VERIFY_PHASE_LIMIT_FUNCTION_PRIVILEGES'; end if;
  if (select rolname from pg_roles where oid = (
    select proowner from pg_proc where oid = 'public.enforce_planning_phase_limit()'::regprocedure
  )) <> 'postgres' then raise exception 'VERIFY_PHASE_LIMIT_FUNCTION_OWNER'; end if;

  if not (select relrowsecurity from pg_class where oid = 'public.planning_phases'::regclass)
  then raise exception 'VERIFY_PLANNING_PHASES_RLS'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'planning_phases') <> 8
  then raise exception 'VERIFY_PLANNING_PHASES_POLICY_COUNT'; end if;
  if not has_table_privilege('anon', 'public.planning_phases', 'select,insert,update,delete')
    or not has_table_privilege('authenticated', 'public.planning_phases', 'select,insert,update,delete')
    or exists (
      select 1
      from pg_class relation
      cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
      where relation.oid = 'public.planning_phases'::regclass and acl.grantee = 0
    )
  then raise exception 'VERIFY_PLANNING_PHASES_GRANTS'; end if;

  insert into public.planning_phase_library(name,default_timeline_behavior,default_timeline_color)
  values('Verification definition 20260803','overlay','industrial_teal') returning id into library_id;

  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date,timeline_color,library_phase_id)
  values
    (test_job,'Overlay 1','overlay',current_date,current_date,'industrial_teal',library_id),
    (test_job,'Planning only 1','planning_only',null,null,null,null),
    (test_job,'Overlay 2','overlay',current_date,current_date,'steel_blue',null),
    (test_job,'Planning only 2','planning_only',null,null,null,null);

  select id into copied_phase_id from public.planning_phases
  where job_id = test_job and library_phase_id = library_id;
  update public.planning_phase_library
  set default_timeline_color = 'rust', active = false
  where id = library_id;
  if (select timeline_color from public.planning_phases where id = copied_phase_id) <> 'industrial_teal'
  then raise exception 'VERIFY_LIBRARY_EDIT_MUTATED_COPY'; end if;
  delete from public.planning_phase_library where id = library_id;
  if not exists (
    select 1 from public.planning_phases
    where id = copied_phase_id and timeline_color = 'industrial_teal' and library_phase_id is null
  ) then raise exception 'VERIFY_LIBRARY_DELETE_MUTATED_COPY'; end if;

  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date)
  values(test_job,'Pause 1','pause',current_date,current_date) returning id into pause_id;
  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date)
  values(test_job,'Pause 2','pause',current_date,current_date);

  select count(*) into phase_count from public.planning_phases
  where job_id=test_job and timeline_behavior <> 'pause';
  if phase_count <> 4 then raise exception 'VERIFY_NON_PAUSE_COUNT'; end if;

  begin
    insert into public.planning_phases(job_id,title,timeline_behavior)
    values(test_job,'Fifth Planning Phase','planning_only');
    raise exception 'VERIFY_FIFTH_PHASE_ACCEPTED';
  exception when check_violation then null;
  end;

  begin
    update public.planning_phases set timeline_behavior='planning_only',start_date=null,end_date=null where id=pause_id;
    raise exception 'VERIFY_PAUSE_CONVERSION_ACCEPTED';
  exception when check_violation then null;
  end;

  delete from public.planning_phases
  where id=(select id from public.planning_phases where job_id=test_job and timeline_behavior <> 'pause' limit 1);
  update public.planning_phases set timeline_behavior='planning_only',start_date=null,end_date=null where id=pause_id;

  if not exists (
    select 1 from public.planning_phases
    where id=pause_id and timeline_behavior='planning_only'
  ) then raise exception 'VERIFY_FREED_SLOT_REJECTED'; end if;

  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date)
  values
    (destination_job,'Destination 1','overlay',current_date,current_date),
    (destination_job,'Destination 2','overlay',current_date,current_date),
    (destination_job,'Destination 3','planning_only',null,null),
    (destination_job,'Destination 4','planning_only',null,null);
  insert into public.planning_phases(job_id,title,timeline_behavior,start_date,end_date)
  values(test_job,'Movable Pause','pause',current_date,current_date) returning id into movable_phase_id;
  begin
    update public.planning_phases
    set job_id = destination_job, timeline_behavior = 'overlay'
    where id = movable_phase_id;
    raise exception 'VERIFY_MOVE_TO_FULL_JOB_ACCEPTED';
  exception when check_violation then null;
  end;

  alter table public.planning_phases disable trigger trg_planning_phases_limit;
  insert into public.planning_phases(job_id,title,timeline_behavior)
  select legacy_job, 'Legacy over-limit ' || value, 'planning_only'
  from generate_series(1, 5) value;
  alter table public.planning_phases enable trigger trg_planning_phases_limit;
  update public.planning_phases
  set description = 'Legacy rows remain editable'
  where job_id = legacy_job and title = 'Legacy over-limit 1';
  begin
    insert into public.planning_phases(job_id,title,timeline_behavior)
    values(legacy_job,'Legacy over-limit growth','planning_only');
    raise exception 'VERIFY_LEGACY_OVER_LIMIT_GROWTH_ACCEPTED';
  exception when check_violation then null;
  end;
  update public.planning_phases
  set timeline_behavior = 'pause', start_date = current_date, end_date = current_date
  where job_id = legacy_job and title = 'Legacy over-limit 5';
  if (select count(*) from public.planning_phases where job_id = legacy_job and timeline_behavior <> 'pause') <> 4
  then raise exception 'VERIFY_LEGACY_SLOT_NOT_FREED'; end if;
end $$;

rollback;

do $$
begin
  if exists (
    select 1 from public.jobs
    where name in (
      'Planning color verification 20260803',
      'Planning destination verification 20260803',
      'Planning legacy verification 20260803'
    )
  ) or exists (
    select 1 from public.planning_phase_library
    where name = 'Verification definition 20260803'
  ) then
    raise exception 'VERIFY_FIXTURE_RESIDUE';
  end if;
end $$;
