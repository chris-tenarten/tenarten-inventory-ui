-- READ ONLY: aggregate metadata and contact-key leakage count; no business-row payloads.
select jsonb_build_object(
 'snapshot_access',(select jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('jobs','job_activity','production_companies','production_contacts','production_job_contacts')),
 'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('jobs','job_activity','production_companies','production_contacts','production_job_contacts')),
 'grants',(select jsonb_agg(to_jsonb(g) order by table_name,grantee,privilege_type) from information_schema.role_table_grants g where table_schema='public' and table_name in ('jobs','job_activity','production_job_contacts')),
 'jobs_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='jobs')
) as snapshot_access),
 'candidate_rpc_collisions',(select jsonb_agg(jsonb_build_object('name',p.proname,'identity',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) as candidate_rpc_collisions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('archive_production_customer','can_manage_production_contacts','detach_project_contact_on_customer_change','get_production_contact','get_production_customer','guard_project_archived_customer','guard_project_contact_snapshot','import_approved_historical_customers_20261014','list_production_company_contacts','save_production_contact','save_production_customer','save_production_project','search_production_contacts','search_production_customers')),
 'migration_ledger_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position) from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations'),
 'protected_activity_key_rows',(select count(*) from public.job_activity where metadata::text ~ 'customer_contact_snapshot|customer_contact_id|customer_company_id')
) as combined_release;
