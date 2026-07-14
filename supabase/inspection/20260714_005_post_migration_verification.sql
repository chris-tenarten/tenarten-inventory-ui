-- Run after applying migrations 20260714_005 and 20260714_006 and before importing data.
-- This script is read-only.

select current_database() as database_name, current_user as inspected_by, now() as inspected_at;

-- New columns and types.
select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('pending_receivals', 'inventory_items', 'inventory_transactions')
  and column_name in ('production_job_id', 'temporary_job_label')
order by table_name, column_name;

-- New foreign keys and mutual-exclusivity constraints.
select constrained.relname as table_name, constraint_record.conname as constraint_name,
       constraint_record.contype as constraint_type,
       pg_get_constraintdef(constraint_record.oid, true) as definition
from pg_constraint constraint_record
join pg_class constrained on constrained.oid = constraint_record.conrelid
join pg_namespace constrained_schema on constrained_schema.oid = constrained.relnamespace
where constrained_schema.nspname = 'public'
  and constrained.relname in ('pending_receivals', 'inventory_items', 'inventory_transactions')
  and (
    constraint_record.conname like '%production_job_id%'
    or constraint_record.conname like '%reservation_identity_check%'
  )
order by constrained.relname, constraint_record.conname;

-- New indexes.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'pending_receivals_production_job_idx',
    'inventory_items_production_job_idx',
    'inventory_transactions_production_job_idx'
  )
order by tablename, indexname;

-- New receipt function definition and effective grants.
select procedure_record.oid::regprocedure as signature,
       pg_get_function_result(procedure_record.oid) as result_type,
       pg_get_userbyid(procedure_record.proowner) as owner,
       procedure_record.prosecdef as security_definer,
       procedure_record.proconfig as configuration,
       procedure_record.proacl as explicit_acl,
       pg_get_functiondef(procedure_record.oid) as full_definition
from pg_proc procedure_record
join pg_namespace function_schema on function_schema.oid = procedure_record.pronamespace
where function_schema.nspname = 'public'
  and procedure_record.proname = 'receive_pending_receival_with_reservation';

select procedure_record.oid::regprocedure as signature,
       coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
       exploded.privilege_type, exploded.is_grantable
from pg_proc procedure_record
join pg_namespace function_schema on function_schema.oid = procedure_record.pronamespace
cross join lateral aclexplode(coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))) exploded
left join pg_roles grantee_role on grantee_role.oid = exploded.grantee
where function_schema.nspname = 'public'
  and procedure_record.proname = 'receive_pending_receival_with_reservation'
order by grantee, privilege_type;

-- Backfill and current reservation distributions.
select 'pending_receivals' as source, count(*) as total_rows,
       count(*) filter (where production_job_id is not null) as canonical_rows,
       count(*) filter (where temporary_job_label is not null) as temporary_rows,
       count(*) filter (where production_job_id is null and temporary_job_label is null) as unrestricted_rows
from public.pending_receivals
union all
select 'inventory_items', count(*),
       count(*) filter (where production_job_id is not null),
       count(*) filter (where temporary_job_label is not null),
       count(*) filter (where production_job_id is null and temporary_job_label is null)
from public.inventory_items
union all
select 'inventory_transactions', count(*),
       count(*) filter (where production_job_id is not null),
       count(*) filter (where temporary_job_label is not null),
       count(*) filter (where production_job_id is null and temporary_job_label is null)
from public.inventory_transactions;

-- Contradictory identities, blank temporary labels, or legacy/new-state disagreement.
select 'pending_receivals' as source, id::text as row_id, production_job_id, temporary_job_label,
       is_earmarked as legacy_reserved, earmarked_job_name as legacy_label
from public.pending_receivals
where (production_job_id is not null and temporary_job_label is not null)
   or (temporary_job_label is not null and nullif(trim(temporary_job_label), '') is null)
   or ((production_job_id is not null or temporary_job_label is not null) and is_earmarked is not true)
   or (is_earmarked is true and production_job_id is null and temporary_job_label is null)
   or (temporary_job_label is not null and nullif(trim(earmarked_job_name), '') is not null
       and lower(trim(temporary_job_label)) <> lower(trim(earmarked_job_name)))
union all
select 'inventory_items', id::text, production_job_id, temporary_job_label,
       earmarked_for_job, earmarked_job
from public.inventory_items
where (production_job_id is not null and temporary_job_label is not null)
   or (temporary_job_label is not null and nullif(trim(temporary_job_label), '') is null)
   or ((production_job_id is not null or temporary_job_label is not null) and earmarked_for_job is not true)
   or (earmarked_for_job is true and production_job_id is null and temporary_job_label is null)
   or (temporary_job_label is not null and nullif(trim(earmarked_job), '') is not null
       and lower(trim(temporary_job_label)) <> lower(trim(earmarked_job)))
union all
select 'inventory_transactions', id::text, production_job_id, temporary_job_label,
       is_earmarked, earmarked_job_name
from public.inventory_transactions
where (production_job_id is not null and temporary_job_label is not null)
   or (temporary_job_label is not null and nullif(trim(temporary_job_label), '') is null)
   or ((production_job_id is not null or temporary_job_label is not null) and is_earmarked is not true)
   or (is_earmarked is true and production_job_id is null and temporary_job_label is null)
   or (temporary_job_label is not null and nullif(trim(earmarked_job_name), '') is not null
       and lower(trim(temporary_job_label)) <> lower(trim(earmarked_job_name)));

-- Orphan checks should return zero rows; FKs should also prevent future orphans.
select 'pending_receivals' as source, receival.id::text as row_id, receival.production_job_id
from public.pending_receivals receival
left join public.jobs job on job.id = receival.production_job_id
where receival.production_job_id is not null and job.id is null
union all
select 'inventory_items', inventory.id::text, inventory.production_job_id
from public.inventory_items inventory
left join public.jobs job on job.id = inventory.production_job_id
where inventory.production_job_id is not null and job.id is null
union all
select 'inventory_transactions', history.id::text, history.production_job_id
from public.inventory_transactions history
left join public.jobs job on job.id = history.production_job_id
where history.production_job_id is not null and job.id is null;

-- Canonical distribution by current job label.
select source, production_job_id, job_number, job_name, row_count
from (
  select 'pending_receivals' as source, receival.production_job_id, job.job_number, job.name as job_name, count(*) as row_count
  from public.pending_receivals receival join public.jobs job on job.id = receival.production_job_id
  group by receival.production_job_id, job.job_number, job.name
  union all
  select 'inventory_items', inventory.production_job_id, job.job_number, job.name, count(*)
  from public.inventory_items inventory join public.jobs job on job.id = inventory.production_job_id
  group by inventory.production_job_id, job.job_number, job.name
  union all
  select 'inventory_transactions', history.production_job_id, job.job_number, job.name, count(*)
  from public.inventory_transactions history join public.jobs job on job.id = history.production_job_id
  group by history.production_job_id, job.job_number, job.name
) distribution
order by source, job_number nulls last, job_name;

-- Temporary-label distribution.
select source, temporary_job_label, row_count
from (
  select 'pending_receivals' as source, temporary_job_label, count(*) as row_count
  from public.pending_receivals where temporary_job_label is not null group by temporary_job_label
  union all
  select 'inventory_items', temporary_job_label, count(*)
  from public.inventory_items where temporary_job_label is not null group by temporary_job_label
  union all
  select 'inventory_transactions', temporary_job_label, count(*)
  from public.inventory_transactions where temporary_job_label is not null group by temporary_job_label
) distribution
order by source, temporary_job_label;
