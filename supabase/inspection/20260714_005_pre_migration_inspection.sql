-- Run in the Supabase SQL editor before applying migration 20260714_005.
-- This script is read-only.

select current_database() as database_name, current_user as inspected_by, now() as inspected_at;

-- Relevant columns, types, defaults, and nullability.
select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jobs', 'pending_receivals', 'inventory_items', 'inventory_transactions')
order by table_name, ordinal_position;

-- Any existing job/reservation-related columns, including legacy IDs.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('pending_receivals', 'inventory_items', 'inventory_transactions')
  and (
    column_name ilike '%job%'
    or column_name ilike '%earmark%'
    or column_name ilike '%reserv%'
  )
order by table_name, ordinal_position;

-- Constraints and foreign-key targets.
select
  constrained.relname as table_name,
  constraint_record.conname as constraint_name,
  constraint_record.contype as constraint_type,
  pg_get_constraintdef(constraint_record.oid, true) as definition,
  referenced.relname as referenced_table
from pg_constraint constraint_record
join pg_class constrained on constrained.oid = constraint_record.conrelid
join pg_namespace constrained_schema on constrained_schema.oid = constrained.relnamespace
left join pg_class referenced on referenced.oid = constraint_record.confrelid
where constrained_schema.nspname = 'public'
  and constrained.relname in ('jobs', 'pending_receivals', 'inventory_items', 'inventory_transactions')
order by constrained.relname, constraint_record.conname;

-- Existing indexes.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('jobs', 'pending_receivals', 'inventory_items', 'inventory_transactions')
order by tablename, indexname;

-- RLS enablement and forced-RLS status.
select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where oid in (
  'public.jobs'::regclass,
  'public.pending_receivals'::regclass,
  'public.inventory_items'::regclass,
  'public.inventory_transactions'::regclass
)
order by relname;

-- RLS policies.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('jobs', 'pending_receivals', 'inventory_items', 'inventory_transactions')
order by tablename, policyname;

-- Existing receipt RPC signature, security mode, grants, and full source.
select
  procedure_record.oid::regprocedure as signature,
  pg_get_function_result(procedure_record.oid) as result_type,
  pg_get_userbyid(procedure_record.proowner) as owner,
  procedure_record.prosecdef as security_definer,
  procedure_record.provolatile as volatility,
  procedure_record.proacl as explicit_acl,
  pg_get_functiondef(procedure_record.oid) as full_definition
from pg_proc procedure_record
join pg_namespace function_schema on function_schema.oid = procedure_record.pronamespace
where function_schema.nspname = 'public'
  and procedure_record.proname in ('receive_pending_receival', 'receive_pending_receival_with_reservation')
order by procedure_record.oid::regprocedure::text;

select
  procedure_record.oid::regprocedure as signature,
  coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
  exploded.privilege_type,
  exploded.is_grantable
from pg_proc procedure_record
join pg_namespace function_schema on function_schema.oid = procedure_record.pronamespace
cross join lateral aclexplode(coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))) exploded
left join pg_roles grantee_role on grantee_role.oid = exploded.grantee
where function_schema.nspname = 'public'
  and procedure_record.proname in ('receive_pending_receival', 'receive_pending_receival_with_reservation')
order by procedure_record.oid::regprocedure::text, grantee, privilege_type;

-- Legacy reservation counts and blank-label anomalies.
select 'pending_receivals' as source,
       count(*) as total_rows,
       count(*) filter (where is_earmarked is true) as legacy_reserved_rows,
       count(*) filter (where is_earmarked is true and nullif(trim(earmarked_job_name), '') is null) as reserved_without_label
from public.pending_receivals
union all
select 'inventory_items', count(*),
       count(*) filter (where earmarked_for_job is true),
       count(*) filter (where earmarked_for_job is true and nullif(trim(earmarked_job), '') is null)
from public.inventory_items
union all
select 'inventory_transactions', count(*),
       count(*) filter (where is_earmarked is true),
       count(*) filter (where is_earmarked is true and nullif(trim(earmarked_job_name), '') is null)
from public.inventory_transactions;

-- Duplicate normalized Production job numbers make automatic linking ambiguous.
select lower(trim(job_number)) as normalized_job_number,
       count(*) as matching_jobs,
       string_agg(coalesce(job_number, '—') || ' — ' || name, ' | ' order by name) as jobs
from public.jobs
where nullif(trim(job_number), '') is not null
group by lower(trim(job_number))
having count(*) > 1
order by normalized_job_number;

-- Every distinct legacy value with its exact normalized job-number match count.
with legacy_labels as (
  select 'pending_receivals' as source, trim(earmarked_job_name) as legacy_label, count(*) as row_count
  from public.pending_receivals
  where is_earmarked is true and nullif(trim(earmarked_job_name), '') is not null
  group by trim(earmarked_job_name)
  union all
  select 'inventory_items', trim(earmarked_job), count(*)
  from public.inventory_items
  where earmarked_for_job is true and nullif(trim(earmarked_job), '') is not null
  group by trim(earmarked_job)
  union all
  select 'inventory_transactions', trim(earmarked_job_name), count(*)
  from public.inventory_transactions
  where is_earmarked is true and nullif(trim(earmarked_job_name), '') is not null
  group by trim(earmarked_job_name)
)
select labels.source, labels.legacy_label, labels.row_count,
       count(jobs.id) as exact_job_number_matches,
       string_agg(coalesce(jobs.job_number, '—') || ' — ' || jobs.name, ' | ' order by jobs.name) as matching_jobs,
       case when count(jobs.id) = 1 then 'canonical backfill'
            when count(jobs.id) = 0 then 'temporary label'
            else 'ambiguous: temporary label' end as migration_result
from legacy_labels labels
left join public.jobs jobs on lower(trim(jobs.job_number)) = lower(labels.legacy_label)
group by labels.source, labels.legacy_label, labels.row_count
order by labels.source, labels.legacy_label;
