begin transaction isolation level repeatable read read only;
select 'tables' as kind,jsonb_agg(jsonb_build_object(
 'relation',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'anon_privileges',(select jsonb_object_agg(p,has_table_privilege('anon',c.oid,p)) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p),
 'anon_column_privileges',(select coalesce(jsonb_agg(jsonb_build_object('column',a.attname,'privilege',p)),'[]') from pg_attribute a cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and has_column_privilege('anon',c.oid,a.attnum,p)),
 'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
 'service_select',has_table_privilege('service_role',c.oid,'SELECT'),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'qual',qual,'check',with_check) order by policyname),'[]') from pg_policies where schemaname='public' and tablename=c.relname)
) order by c.relname) as evidence from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('manpower_entries','manpower_workers','manpower_tasks','manpower_reporting_groups','production_rework_cycles')
union all
select 'functions',jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'security_definer',p.prosecdef,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('delete_empty_manpower_reporting_group','create_production_rework','update_production_rework_status','save_production_rework_schedule_batch','save_production_rework_mixed_schedule_batch')
union all
select 'roles',jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'bypass_rls',rolbypassrls) order by rolname) from pg_roles where rolname in ('anon','authenticated','service_role')
union all
select 'ledger',coalesce(jsonb_agg(version order by version),'[]') from supabase_migrations.schema_migrations where version in ('20260924210000','20260924210100');
commit;
