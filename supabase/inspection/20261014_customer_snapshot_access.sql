-- Read-only metadata; no business rows or user identities.
select jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('jobs','job_activity','production_companies','production_contacts','production_job_contacts')),
 'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('jobs','job_activity','production_companies','production_contacts','production_job_contacts')),
 'grants',(select jsonb_agg(to_jsonb(g) order by table_name,grantee,privilege_type) from information_schema.role_table_grants g where table_schema='public' and table_name in ('jobs','job_activity','production_job_contacts')),
 'jobs_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='jobs')
) as snapshot_access;
