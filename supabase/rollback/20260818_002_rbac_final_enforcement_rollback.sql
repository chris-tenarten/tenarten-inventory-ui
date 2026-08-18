-- EMERGENCY ROLLBACK FOR 20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql
--
-- Restores the repository-defined compatibility authorization state produced by
-- 20260818_001_rbac_identity_infrastructure.sql plus
-- 20260818_003_rbac_compatibility_authenticated_access.sql.
--
-- Run only after _002 committed successfully and enforced-mode validation failed.
-- Keep operator traffic closed and runtime RBAC enforcement flags disabled.

begin;

-- Fail before changing anything unless this database has the complete _002
-- boundary, including all four Rework wrappers and their retained implementations.
do $$
declare
  table_name text;
begin
  if to_regprocedure('public.tenops_authorize_request()') is null
     or to_regprocedure('public.tenops_active_user()') is null
     or to_regprocedure('public.current_app_display_name()') is null then
    raise exception 'RBAC rollback refused: the _002 request boundary is not fully installed.';
  end if;

  if to_regprocedure('public.rbac_legacy_create_production_rework(uuid,text,text,date,text)') is null
     or to_regprocedure('public.rbac_legacy_update_production_rework_status(uuid,text,timestamp with time zone,text)') is null
     or to_regprocedure('public.rbac_legacy_save_production_rework_schedule_batch(jsonb,text,text,uuid)') is null
     or to_regprocedure('public.rbac_legacy_save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid)') is null then
    raise exception 'RBAC rollback refused: an _002 Rework implementation is missing.';
  end if;

  foreach table_name in array array[
    'jobs','job_activity','job_attachments','job_updates','production_rework_cycles',
    'planning_phases','planning_items','planning_phase_library','planning_phase_library_items',
    'manpower_workers','manpower_tasks','manpower_entries','manpower_reporting_groups',
    'inventory_items','inventory_transactions','pending_receivals',
    'material_usage_reports','material_usage_lines','vendors','vendor_contacts',
    'vendor_catalog','vendor_catalog_v2','purchase_orders','purchase_order_lines',
    'chip_purchase_order_line_details','purchase_order_issuances','purchase_order_documents',
    'job_transmittals'
  ] loop
    if to_regclass('public.' || table_name) is not null and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'RBAC authenticated read ' || table_name
    ) then
      raise exception 'RBAC rollback refused: expected _002 read policy is missing for %.', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.jobs'::regclass
      and tgname = 'jobs_rbac_update_guard'
      and not tgisinternal
  ) then
    raise exception 'RBAC rollback refused: the _002 jobs guard is missing.';
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='RBAC read job attachment objects')
     or not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='RBAC upload job attachment objects')
     or not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='RBAC delete job attachment objects') then
    raise exception 'RBAC rollback refused: the _002 Storage policies are incomplete.';
  end if;
end;
$$;

-- Remove the PostgREST trusted-boundary hook before removing its function.
alter role authenticator reset pgrst.db_pre_request;

-- Remove every capability policy created by _002. Policy names are deterministic.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'jobs','job_activity','job_attachments','job_updates','production_rework_cycles',
    'planning_phases','planning_items','planning_phase_library','planning_phase_library_items',
    'manpower_workers','manpower_tasks','manpower_entries','manpower_reporting_groups',
    'inventory_items','inventory_transactions','pending_receivals',
    'material_usage_reports','material_usage_lines','vendors','vendor_contacts',
    'vendor_catalog','vendor_catalog_v2','purchase_orders','purchase_order_lines',
    'chip_purchase_order_line_details','purchase_order_issuances','purchase_order_documents',
    'job_transmittals'
  ] loop
    if to_regclass('public.' || table_name) is null then continue; end if;
    for policy_row in
      select policyname from pg_policies
      where schemaname='public' and tablename=table_name and policyname like 'RBAC %'
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;
  end loop;
end;
$$;

drop trigger jobs_rbac_update_guard on public.jobs;
drop function public.enforce_jobs_update_capability();

-- Restore the authenticated compatibility policies added by _003.
create policy "Compatibility authenticated read jobs" on public.jobs for select to authenticated using (true);
create policy "Compatibility authenticated insert jobs" on public.jobs for insert to authenticated with check (true);
create policy "Compatibility authenticated update jobs" on public.jobs for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated delete jobs" on public.jobs for delete to authenticated using (true);

create policy "Compatibility authenticated read job activity" on public.job_activity for select to authenticated using (true);
create policy "Compatibility authenticated insert job activity" on public.job_activity for insert to authenticated with check (true);
create policy "Compatibility authenticated update job activity" on public.job_activity for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated delete job activity" on public.job_activity for delete to authenticated using (true);

create policy "Compatibility authenticated read job attachments" on public.job_attachments for select to authenticated using (true);
create policy "Compatibility authenticated insert job attachments" on public.job_attachments for insert to authenticated with check (true);
create policy "Compatibility authenticated delete job attachments" on public.job_attachments for delete to authenticated using (true);

create policy "Compatibility authenticated read manpower workers" on public.manpower_workers for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower workers" on public.manpower_workers for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower workers" on public.manpower_workers for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated read manpower tasks" on public.manpower_tasks for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower tasks" on public.manpower_tasks for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower tasks" on public.manpower_tasks for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated read manpower entries" on public.manpower_entries for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower entries" on public.manpower_entries for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower entries" on public.manpower_entries for update to authenticated using (true) with check (true);
create policy "Compatibility authenticated delete manpower entries" on public.manpower_entries for delete to authenticated using (true);
create policy "Compatibility authenticated read manpower reporting groups" on public.manpower_reporting_groups for select to authenticated using (true);
create policy "Compatibility authenticated insert manpower reporting groups" on public.manpower_reporting_groups for insert to authenticated with check (true);
create policy "Compatibility authenticated update manpower reporting groups" on public.manpower_reporting_groups for update to authenticated using (true) with check (true);

-- Restore authenticated policies that predated _003 and were removed by _002.
create policy "Allow authenticated read job updates" on public.job_updates for select to authenticated using (true);
create policy "Allow authenticated insert job updates" on public.job_updates for insert to authenticated with check (true);
create policy "Allow authenticated read material usage reports" on public.material_usage_reports for select to authenticated using (true);
create policy "Allow authenticated read material usage lines" on public.material_usage_lines for select to authenticated using (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['planning_phases','planning_items','planning_phase_library','planning_phase_library_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'Allow authenticated read ' || replace(table_name,'_',' '), table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', 'Allow authenticated insert ' || replace(table_name,'_',' '), table_name);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', 'Allow authenticated update ' || replace(table_name,'_',' '), table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (true)', 'Allow authenticated delete ' || replace(table_name,'_',' '), table_name);
  end loop;
end;
$$;

-- These policies originally served anon and authenticated together. _002's
-- authenticated-policy removal dropped the entire combined policy.
create policy "Compatibility read Production Rework" on public.production_rework_cycles for select to anon, authenticated using (true);
create policy "Purchasing reference read" on public.vendors for select to anon, authenticated using (true);
create policy "Vendor contact read" on public.vendor_contacts for select to anon, authenticated using (true);
create policy "Purchase Order read" on public.purchase_orders for select to anon, authenticated using (true);
create policy "Purchase Order line read" on public.purchase_order_lines for select to anon, authenticated using (true);
create policy "Chip PO detail read" on public.chip_purchase_order_line_details for select to anon, authenticated using (true);
create policy "Purchase Order issuance read" on public.purchase_order_issuances for select to anon, authenticated using (true);
create policy "Purchase Order document read" on public.purchase_order_documents for select to anon, authenticated using (true);

-- _002 was the first repository migration to enable RLS on these legacy direct-
-- access tables. Restore their pre-_002 state after removing its policies.
alter table public.inventory_items disable row level security;
alter table public.inventory_transactions disable row level security;
alter table public.pending_receivals disable row level security;
alter table public.vendor_catalog disable row level security;
alter table public.vendor_catalog_v2 disable row level security;

-- Restore both legacy-anon and authenticated-compatibility Storage policies.
drop policy "RBAC read job attachment objects" on storage.objects;
drop policy "RBAC upload job attachment objects" on storage.objects;
drop policy "RBAC delete job attachment objects" on storage.objects;
create policy "Allow anon read job attachment objects" on storage.objects for select to anon using (bucket_id='job-attachments');
create policy "Allow anon upload job attachment objects" on storage.objects for insert to anon with check (bucket_id='job-attachments');
create policy "Allow anon delete job attachment objects" on storage.objects for delete to anon using (bucket_id='job-attachments');
create policy "Compatibility authenticated read job attachment objects" on storage.objects for select to authenticated using (bucket_id='job-attachments');
create policy "Compatibility authenticated upload job attachment objects" on storage.objects for insert to authenticated with check (bucket_id='job-attachments');
create policy "Compatibility authenticated delete job attachment objects" on storage.objects for delete to authenticated using (bucket_id='job-attachments');

-- Remove the _002 Rework wrappers and restore the original implementations under
-- their canonical signatures. Renaming preserves their bodies, owners, and data.
drop function public.create_production_rework(uuid,text,text,date,text);
drop function public.update_production_rework_status(uuid,text,timestamp with time zone,text);
drop function public.save_production_rework_schedule_batch(jsonb,text,text,uuid);
drop function public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid);
alter function public.rbac_legacy_create_production_rework(uuid,text,text,date,text) rename to create_production_rework;
alter function public.rbac_legacy_update_production_rework_status(uuid,text,timestamp with time zone,text) rename to update_production_rework_status;
alter function public.rbac_legacy_save_production_rework_schedule_batch(jsonb,text,text,uuid) rename to save_production_rework_schedule_batch;
alter function public.rbac_legacy_save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) rename to save_production_rework_mixed_schedule_batch;
revoke all on function public.create_production_rework(uuid,text,text,date,text), public.update_production_rework_status(uuid,text,timestamp with time zone,text), public.save_production_rework_schedule_batch(jsonb,text,text,uuid), public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) from public;
grant execute on function public.create_production_rework(uuid,text,text,date,text), public.update_production_rework_status(uuid,text,timestamp with time zone,text), public.save_production_rework_schedule_batch(jsonb,text,text,uuid), public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) to anon, authenticated, service_role;

-- Restore the compatibility grants changed directly by _002.
grant usage on schema public to anon, authenticated;
grant execute on function public.bootstrap_first_tenops_admin(text) to authenticated;

drop function public.tenops_authorize_request();
drop function public.current_app_display_name();
drop function public.tenops_active_user();

-- Make PostgREST discard the removed hook and refresh its schema cache after commit.
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
