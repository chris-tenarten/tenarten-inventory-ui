-- Read-only pre/post release gate. Run while Manpower writes are paused at cutover.
-- Hashes exclude ONLY the additive category column from historical labor rows.
-- JSONB canonical text, UTC, SHA-256 per row; concatenate row hashes in UUID order.
begin isolation level repeatable read read only;
set local timezone = 'UTC';
with protected_rows as (
  select 'manpower_entries'::text as relation, id::text as id, to_jsonb(t)-'product_category_id' as payload from public.manpower_entries t
  union all select 'manpower_tasks',id::text,to_jsonb(t) from public.manpower_tasks t
  union all select 'manpower_workers',id::text,to_jsonb(t) from public.manpower_workers t
  union all select 'manpower_reporting_groups',id::text,to_jsonb(t) from public.manpower_reporting_groups t
  union all select 'jobs',id::text,to_jsonb(t) from public.jobs t
  union all select 'production_rework_cycles',id::text,to_jsonb(t) from public.production_rework_cycles t
), row_hashes as (
  select relation,id,encode(sha256(convert_to(payload::text,'UTF8')),'hex') as sha256 from protected_rows
), relation_hashes as (
  select relation,count(*) as rows,encode(sha256(convert_to(string_agg(sha256,'' order by id),'UTF8')),'hex') as sha256
  from row_hashes group by relation
), reporting as (
  select job_id, task_id, rework_cycle_id, reporting_group_id, count(*) as entries,
    sum(am_hours) as am_hours, sum(pm_hours) as pm_hours, sum(am_hours+pm_hours) as total_hours
  from public.manpower_entries group by job_id,task_id,rework_cycle_id,reporting_group_id
)
select jsonb_build_object(
  'observed_at',transaction_timestamp(),
  'server_version',current_setting('server_version'),
  'digest_format','postgres-jsonb-UTC-sha256-row-hashes-ordered-by-id-v1; entries exclude product_category_id only',
  'counts', (select jsonb_build_object('entries',count(*),'hours',sum(am_hours+pm_hours),'linked_entries',count(*) filter(where job_id is not null),'linked_hours',sum(am_hours+pm_hours) filter(where job_id is not null),'unlinked_entries',count(*) filter(where job_id is null),'unlinked_hours',sum(am_hours+pm_hours) filter(where job_id is null),'rework_entries',count(*) filter(where rework_cycle_id is not null),'rework_hours',sum(am_hours+pm_hours) filter(where rework_cycle_id is not null),'jobs',count(distinct job_id),'min_date',min(work_date),'max_date',max(work_date),'classified_entries',count(*) filter(where to_jsonb(e)->>'product_category_id' is not null)) from public.manpower_entries e),
  'protected_relations',(select jsonb_agg(to_jsonb(t) order by relation) from relation_hashes t),
  'integrity_sha256',(select encode(sha256(convert_to(string_agg(relation||':'||rows::text||':'||sha256,E'\n' order by relation),'UTF8')),'hex') from relation_hashes),
  'reporting_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by job_id,task_id,rework_cycle_id,reporting_group_id)::text,'[]'),'UTF8')),'hex') from reporting r),
  'historical_entry_manifest',(select jsonb_agg(jsonb_build_object('id',id,'sha256',sha256) order by id) from row_hashes where relation='manpower_entries'),
  'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',udt_schema||'.'||udt_name,'nullable',is_nullable,'default',column_default,'precision',numeric_precision,'scale',numeric_scale) order by table_name,ordinal_position) from information_schema.columns where table_schema='public' and table_name in ('manpower_entries','manpower_tasks','manpower_workers','manpower_reporting_groups','manpower_product_categories','app_users','app_role_capabilities')),
  'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) order by conrelid::regclass::text,conname) from pg_constraint where conrelid in ('public.manpower_entries'::regclass,'public.manpower_tasks'::regclass,'public.manpower_workers'::regclass,'public.manpower_reporting_groups'::regclass,'public.app_users'::regclass,'public.app_role_capabilities'::regclass,to_regclass('public.manpower_product_categories'),'public.production_rework_cycles'::regclass)),
  'indexes',(select jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) order by tablename,indexname) from pg_indexes where schemaname='public' and tablename like 'manpower_%'),
  'rls',(select jsonb_agg(jsonb_build_object('table',relname,'enabled',relrowsecurity,'forced',relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname in ('manpower_entries','manpower_tasks','manpower_workers','manpower_reporting_groups','manpower_product_categories','app_users','app_role_capabilities','manpower_product_categories')),
  'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and (tablename like 'manpower_%' or tablename in ('app_users','app_role_capabilities'))),
  'grants',(select jsonb_agg(jsonb_build_object('table',table_name,'role',grantee,'privilege',privilege_type) order by table_name,grantee,privilege_type) from information_schema.role_table_grants where table_schema='public' and (table_name like 'manpower_%' or table_name in ('app_users','app_role_capabilities')) and grantee in ('anon','authenticated','service_role')),
  'functions',(select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',pg_get_userbyid(p.proowner)) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('has_app_capability','require_app_capability','set_manpower_updated_at','delete_empty_manpower_reporting_group','audit_manpower_product_category','validate_manpower_product_category')) or (n.nspname='auth' and p.proname='uid')),
  'triggers',(select jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) order by tgname) from pg_trigger where tgrelid in ('public.manpower_entries'::regclass,'public.manpower_tasks'::regclass,'public.manpower_workers'::regclass,'public.manpower_reporting_groups'::regclass,'public.app_role_capabilities'::regclass,to_regclass('public.manpower_product_categories')) and not tgisinternal),
  'ddl_event_triggers',(select jsonb_agg(jsonb_build_object('name',evtname,'enabled',evtenabled,'definition',pg_get_functiondef(evtfoid)) order by evtname) from pg_event_trigger),
  'role_caps',(select jsonb_agg(to_jsonb(c) order by role,capability) from public.app_role_capabilities c where capability in ('readOperationalData','manageManpowerProductCategories')),
  'actor_status',(select jsonb_build_object('marcos_is_active_lead',exists(select 1 from public.app_users where display_name='Marcos Alvarado' and role='lead' and is_active),'active_leads',(select count(*) from public.app_users where role='lead' and is_active),'active_admins',(select count(*) from public.app_users where role='admin' and is_active))),
  'request_hook',(select jsonb_agg(jsonb_build_object('role',r.rolname,'config',cfg)) from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig) cfg where cfg like 'pgrst.db_pre_request%'),
  'category_table',to_regclass('public.manpower_product_categories')::text,
  'new_capability_rows',(select count(*) from public.app_role_capabilities where capability='manageManpowerProductCategories')
) as gate;
rollback;
