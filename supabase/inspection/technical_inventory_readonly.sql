-- Metadata-only catalog reference. Added 2026-11-02; not a migration.
-- Run through an existing authorized SQL connection for the named environment.
-- No business rows, routine bodies, secret values, DDL or DML are requested.
-- Results cover non-system schemas visible to the metadata reader; platform
-- schemas are included and must be distinguished from application-owned ones.
-- Record project identity, repository/release revision and omissions in the
-- existing task receipt. Do not claim hosted verification from this file alone.

begin transaction isolation level repeatable read read only;

select current_timestamp as captured_at,
       current_database() as database_name,
       current_user as metadata_reader,
       current_setting('server_version') as server_version;

-- Schema/table/view inventory. Views are identified; definitions are not dumped.
select n.nspname as schema_name, c.relname as object_name,
       c.relkind as object_kind, c.relispartition as is_partition,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
order by n.nspname, c.relname;

-- Columns include nullability, identity/generated flags and default expressions.
select n.nspname as schema_name, c.relname as object_name,
       a.attnum as ordinal_position, a.attname as column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null, a.attidentity as identity_kind,
       a.attgenerated as generated_kind,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_or_generation
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and a.attnum > 0 and not a.attisdropped
order by n.nspname, c.relname, a.attnum;

-- PK/unique/check/exclusion/domain constraints and FK relationships.
-- FK definitions include ordered source/target columns and update/delete rules.
select n.nspname as schema_name, c.relname as table_name,
       t.typname as domain_name, con.conname as constraint_name,
       con.contype as constraint_kind,
       rn.nspname as referenced_schema, rc.relname as referenced_table,
       con.condeferrable as deferrable, con.condeferred as initially_deferred,
       con.convalidated as validated,
       pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_namespace n on n.oid = con.connamespace
left join pg_catalog.pg_class c on c.oid = con.conrelid
left join pg_catalog.pg_type t on t.oid = con.contypid
left join pg_catalog.pg_class rc on rc.oid = con.confrelid
left join pg_catalog.pg_namespace rn on rn.oid = rc.relnamespace
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
order by n.nspname, c.relname, t.typname, con.conname;

-- Index definitions retain uniqueness, expressions and partial predicates.
select n.nspname as schema_name, c.relname as table_name,
       x.relname as index_name, i.indisunique as is_unique,
       i.indisvalid as is_valid, pg_catalog.pg_get_indexdef(x.oid) as definition
from pg_catalog.pg_index i
join pg_catalog.pg_class c on c.oid = i.indrelid
join pg_catalog.pg_class x on x.oid = i.indexrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
order by n.nspname, c.relname, x.relname;

-- Enums and ordered labels. Domains also appear in column/constraint results.
select n.nspname as schema_name, t.typname as enum_name,
       e.enumsortorder as label_order, e.enumlabel as label
from pg_catalog.pg_type t
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
join pg_catalog.pg_enum e on e.enumtypid = t.oid
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
order by n.nspname, t.typname, e.enumsortorder;

-- Function/procedure contracts and declared EXECUTE ACLs, not function bodies.
-- Presence here does not establish PostgREST exposure or employee authorization.
select n.nspname as schema_name, p.proname as routine_name,
       p.prokind as routine_kind,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_catalog.pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer,
       pg_catalog.pg_get_userbyid(p.proowner) as owner,
       p.proacl::text as explicit_acl,
       coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))::text
         as acl_with_defaults
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
  and p.prokind in ('f', 'p')
order by n.nspname, p.proname,
         pg_catalog.pg_get_function_identity_arguments(p.oid);

-- Ledger availability only. If present and authorized, separately read version
-- identifiers from supabase_migrations.schema_migrations; do not dump its SQL.
select pg_catalog.to_regclass('supabase_migrations.schema_migrations')
       as migration_ledger_relation;

rollback;
