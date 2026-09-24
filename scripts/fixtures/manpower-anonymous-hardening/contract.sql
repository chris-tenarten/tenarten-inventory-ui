-- Portable catalog fingerprint: no OIDs, physical ordering, or business data.
-- __SCOPE__ is replaced only by the fixed literals core / rework by the verifier.
with target_tables as (
 select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname=any(case '__SCOPE__' when 'core' then
 array['manpower_entries','manpower_workers','manpower_tasks','manpower_reporting_groups']
 else array['production_rework_cycles'] end)
), target_functions as (
 select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(case '__SCOPE__' when 'core' then
 array['delete_empty_manpower_reporting_group','set_manpower_updated_at','validate_manpower_product_category','has_app_capability']
 else array['create_production_rework','update_production_rework_status','save_production_rework_schedule_batch','save_production_rework_mixed_schedule_batch','touch_production_rework_cycle_updated_at','save_production_planning_schedule_batch'] end)
)
select jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object(
 'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.policyname),'[]'::jsonb) from pg_policies p where p.schemaname='public' and p.tablename=c.relname),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_array(k.conname,pg_get_constraintdef(k.oid),k.convalidated) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=c.oid),
 'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by ic.relname) from pg_index i join pg_class ic on ic.oid=i.indexrelid where i.indrelid=c.oid),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) order by t.tgname),'[]'::jsonb) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal)
 ) order by c.relname) from target_tables c),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
 'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)
 ) order by p.oid::regprocedure::text) from target_functions p),
 'roles',(select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolbypassrls) order by rolname) from pg_roles where rolname in ('anon','authenticated','service_role')),
 'memberships',(select coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),admin_option,inherit_option,set_option) order by pg_get_userbyid(roleid),pg_get_userbyid(member)),'[]'::jsonb) from pg_auth_members where member in ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))
) as contract
