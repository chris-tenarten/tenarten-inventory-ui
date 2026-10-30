begin read only;
set local lock_timeout='2s';set local statement_timeout='12s';
select jsonb_build_object(
 'readOnly',current_setting('transaction_read_only'),
 'serverVersion',current_setting('server_version'),
 'executorRoleAbsent',not exists(select 1 from pg_roles where rolname='tenbot_invoice_executor'),
 'coreRoles',(select jsonb_agg(rolname order by rolname) from pg_roles where rolname in('anon','authenticated','service_role','postgres','supabase_storage_admin')),
 'newRelations',(select jsonb_agg(n.nspname||'.'||c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname~'^(invoice_receival_|tenbot_invoice_|tenbot_receival_)'),
 'newRoutines',(select jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname~'^(invoice_receival_|tenbot_invoice_|tenbot_receival_|prepare_invoice_receival_|get_invoice_receival_|approve_invoice_receival_|execute_invoice_receival_|record_invoice_receival_|begin_invoice_receival_|guard_invoice_receival_|tenops_catalog_save)')),
 'prerequisites',(select jsonb_agg(jsonb_build_object('signature',s,'present',to_regprocedure(s) is not null) order by s) from unnest(array['public.require_app_capability(text)','public.has_app_capability(text)','public.save_purchasing_catalog_item(jsonb)','public.save_purchasing_catalog_item_v2(jsonb)','auth.uid()','auth.role()','pg_catalog.gen_random_uuid()','pg_catalog.sha256(bytea)','pg_catalog.trim_scale(numeric)']) s),
 'relations',(select jsonb_agg(jsonb_build_object('name',s,'present',to_regclass(s) is not null) order by s) from unnest(array['public.app_users','public.app_role_capabilities','public.vendor_catalog','public.vendor_catalog_v2','public.vendors','public.jobs','public.pending_receivals','storage.objects','storage.buckets','supabase_migrations.schema_migrations']) s),
 'catalogCategoryCheck',(select jsonb_build_object('validated',convalidated,'definition',pg_get_constraintdef(oid,true)) from pg_constraint where conrelid='public.vendor_catalog_v2'::regclass and conname='vendor_catalog_v2_category_check'),
 'privateOriginalBucketAbsent',not exists(select 1 from storage.buckets where id='invoice-receival-originals'),
 'pendingMigrationVersions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version in('20261029210000','20261030110000','20261030120000','20261030130000','20261030140000','20261030150000','20261030160000','20261030170000','20261030180000','20261030190000'))
) as preflight;
commit;
