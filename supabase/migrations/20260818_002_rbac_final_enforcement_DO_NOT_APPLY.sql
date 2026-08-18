-- FINAL RBAC CUTOVER — DO NOT APPLY.
-- Apply only after the owner explicitly authorizes: "Apply RBAC enforcement now."
-- Prerequisites: 20260818_001 and 20260818_003, deployed RBAC-aware Edge Functions,
-- at least one active Admin, and a successful isolated enforced-mode smoke test.

begin;

do $$
begin
  if not exists (select 1 from public.app_users where role = 'admin' and is_active) then
    raise exception 'RBAC cutover requires at least one active Admin.';
  end if;
end;
$$;

create or replace function public.tenops_active_user()
returns boolean language sql stable security definer
set search_path = pg_catalog, public as $$
  select exists(select 1 from public.app_users where user_id = auth.uid() and is_active);
$$;
alter function public.tenops_active_user() owner to postgres;
revoke all on function public.tenops_active_user() from public, anon;
grant execute on function public.tenops_active_user() to authenticated, service_role;

create or replace function public.current_app_display_name()
returns text language sql stable security definer
set search_path = pg_catalog, public as $$
  select display_name from public.app_users where user_id = auth.uid() and is_active;
$$;
alter function public.current_app_display_name() owner to postgres;
revoke all on function public.current_app_display_name() from public, anon;
grant execute on function public.current_app_display_name() to authenticated, service_role;

-- Trusted PostgREST boundary. This runs before every REST/RPC request and blocks
-- direct crafted requests as well as calls made through the normal browser client.
create or replace function public.tenops_authorize_request()
returns void language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  request_role text := claims->>'role';
  request_method text := upper(coalesce(current_setting('request.method', true), ''));
  request_path text := split_part(trim(both '/' from coalesce(current_setting('request.path', true), '')), '?', 1);
  required_capability text;
  second_capability text;
  rpc_name text;
begin
  if request_role = 'service_role' then return; end if;
  if auth.uid() is null or not public.tenops_active_user() then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if request_path like 'rpc/%' then
    rpc_name := substr(request_path, 5);
    case rpc_name
      when 'has_app_capability', 'get_my_app_user' then return;
      when 'admin_set_app_user_access', 'admin_list_app_users', 'report_job_update_identity_backfill' then required_capability := 'manageUsers';
      when 'list_my_job_update_notifications' then required_capability := 'readOperationalData';
      when 'save_production_schedule_batch' then required_capability := 'scheduleProduction';
      when 'save_production_planning_schedule_batch' then required_capability := 'scheduleProduction'; second_capability := 'modifyPlanning';
      when 'create_production_rework', 'update_production_rework_status', 'save_production_rework_schedule_batch' then required_capability := 'manageProductionRework';
      when 'save_production_rework_mixed_schedule_batch' then required_capability := 'manageProductionRework'; second_capability := 'scheduleProduction';
      when 'resolve_job_update' then required_capability := 'resolveJobUpdate';
      when 'edit_job_update' then required_capability := 'editJobUpdate'; second_capability := 'assignJobUpdate';
      when 'save_material_usage_report', 'delete_material_usage_report', 'delete_empty_manpower_reporting_group' then required_capability := 'editProductionJobRoutine';
      when 'reserve_inventory_quantity', 'release_inventory_reservation', 'release_inventory_reservations_bulk' then required_capability := 'modifyPlanning';
      when 'receive_pending_receival_with_reservation' then required_capability := 'receiveInventory';
      when 'undo_pending_receival_receipt' then required_capability := 'adjustInventory';
      when 'save_chip_purchase_order_draft', 'save_chip_purchase_order_draft_v2', 'delete_purchase_order_draft', 'set_purchase_order_document_template' then required_capability := 'createPurchaseOrderDraft';
      when 'issue_purchase_order', 'create_pending_receivals_from_purchase_order' then required_capability := 'issuePurchaseOrder';
      when 'save_vendor_profile', 'save_vendor_contact', 'save_purchasing_catalog_item' then required_capability := 'manageVendorsCatalog';
      when 'issue_job_transmittal' then required_capability := 'issueTransmittal';
      when 'preview_next_job_document_number', 'list_job_transmittals' then required_capability := 'previewOperationalDocuments';
      when 'purge_test_purchase_order' then required_capability := 'manageUsers';
      else raise exception 'RPC is not exposed by the TenOps RBAC boundary.' using errcode = '42501';
    end case;
  elsif request_method in ('GET', 'HEAD') then
    required_capability := 'readOperationalData';
  else
    case request_path
      when 'jobs' then
        if request_method = 'POST' then required_capability := 'createProductionJob';
        elsif request_method = 'DELETE' then required_capability := 'archiveProductionJob';
        else required_capability := 'editProductionJobRoutine'; end if;
      when 'job_activity' then required_capability := 'editProductionJobRoutine';
      when 'job_attachments' then required_capability := case when request_method = 'DELETE' then 'deleteSupportingFiles' else 'uploadSupportingFiles' end;
      when 'job_updates' then required_capability := case when request_method = 'POST' then 'postJobUpdate' else 'editJobUpdate' end;
      when 'planning_phases', 'planning_items' then required_capability := 'modifyPlanning';
      when 'planning_phase_library', 'planning_phase_library_items' then required_capability := 'managePhaseLibrary';
      when 'manpower_workers', 'manpower_tasks', 'manpower_entries', 'manpower_reporting_groups' then required_capability := 'editProductionJobRoutine';
      when 'inventory_items', 'inventory_transactions', 'pending_receivals' then required_capability := 'adjustInventory';
      when 'vendor_catalog', 'vendor_catalog_v2', 'vendors', 'vendor_contacts' then required_capability := 'manageVendorsCatalog';
      else raise exception 'Mutation path is not exposed by the TenOps RBAC boundary.' using errcode = '42501';
    end case;
  end if;

  perform public.require_app_capability(required_capability);
  if second_capability is not null then perform public.require_app_capability(second_capability); end if;
end;
$$;
alter function public.tenops_authorize_request() owner to postgres;
revoke all on function public.tenops_authorize_request() from public;
-- PostgREST invokes db_pre_request after switching into the JWT database role.
-- The function therefore must be executable by those roles; its body is the
-- boundary that rejects anon, inactive, and unauthorized callers.
grant execute on function public.tenops_authorize_request() to anon, authenticated, service_role;

-- RLS is the table-level defense. Remove compatibility policies for authenticated
-- while leaving the RBAC administration tables' purpose-built policies intact.
do $$
declare table_name text; policy_row record;
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
    execute format('alter table public.%I enable row level security', table_name);
    for policy_row in select policyname from pg_policies where schemaname='public' and tablename=table_name and 'authenticated'=any(roles)
    loop execute format('drop policy %I on public.%I', policy_row.policyname, table_name); end loop;
    execute format('create policy %I on public.%I for select to authenticated using (public.has_app_capability(''readOperationalData''))', 'RBAC authenticated read ' || table_name, table_name);
  end loop;
end;
$$;

-- Capability-scoped direct mutations. SECURITY DEFINER workflows remain subject
-- to the pre-request RPC gate; service_role retains its internal execution role.
create policy "RBAC create jobs" on public.jobs for insert to authenticated with check (public.has_app_capability('createProductionJob'));
create policy "RBAC update jobs" on public.jobs for update to authenticated using (
  public.has_app_capability('editProductionJobRoutine') or public.has_app_capability('editProductionJobDetails') or
  public.has_app_capability('scheduleProduction') or public.has_app_capability('archiveProductionJob')
) with check (
  public.has_app_capability('editProductionJobRoutine') or public.has_app_capability('editProductionJobDetails') or
  public.has_app_capability('scheduleProduction') or public.has_app_capability('archiveProductionJob')
);
create policy "RBAC delete jobs" on public.jobs for delete to authenticated using (public.has_app_capability('archiveProductionJob'));

create or replace function public.enforce_jobs_update_capability()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.planned_start is distinct from old.planned_start or new.planned_end is distinct from old.planned_end then
    perform public.require_app_capability('scheduleProduction');
  end if;
  if new.archived_at is distinct from old.archived_at then perform public.require_app_capability('archiveProductionJob'); end if;
  if row(new.name,new.customer,new.job_number,new.estimate_number,new.work_order_number,new.contract_value,new.deposit_date,
    new.color_plate_number,new.sample_submitted_date,new.approval_date,new.resin_po,new.chip_po,new.estimated_man_hours,
    new.estimated_calendar_days,new.requested_delivery_date)
    is distinct from row(old.name,old.customer,old.job_number,old.estimate_number,old.work_order_number,old.contract_value,old.deposit_date,
    old.color_plate_number,old.sample_submitted_date,old.approval_date,old.resin_po,old.chip_po,old.estimated_man_hours,
    old.estimated_calendar_days,old.requested_delivery_date)
  then perform public.require_app_capability('editProductionJobDetails'); end if;
  if row(new.production_status,new.material_status,new.priority,new.progress_percent,new.owner_name,new.remarks)
    is distinct from row(old.production_status,old.material_status,old.priority,old.progress_percent,old.owner_name,old.remarks)
  then perform public.require_app_capability('editProductionJobRoutine'); end if;
  return new;
end;
$$;
alter function public.enforce_jobs_update_capability() owner to postgres;
revoke all on function public.enforce_jobs_update_capability() from public, anon, authenticated;
drop trigger if exists jobs_rbac_update_guard on public.jobs;
create trigger jobs_rbac_update_guard before update on public.jobs for each row execute function public.enforce_jobs_update_capability();

do $$
declare entry record;
begin
  for entry in select * from (values
    ('job_activity','editProductionJobRoutine',null::text,null::text),
    ('job_attachments','uploadSupportingFiles',null::text,'deleteSupportingFiles'),
    ('job_updates','postJobUpdate','editJobUpdate',null::text),
    ('planning_phases','modifyPlanning','modifyPlanning','modifyPlanning'),
    ('planning_items','modifyPlanning','modifyPlanning','modifyPlanning'),
    ('planning_phase_library','managePhaseLibrary','managePhaseLibrary','managePhaseLibrary'),
    ('planning_phase_library_items','managePhaseLibrary','managePhaseLibrary','managePhaseLibrary'),
    ('manpower_workers','editProductionJobRoutine','editProductionJobRoutine',null::text),
    ('manpower_tasks','editProductionJobRoutine','editProductionJobRoutine',null::text),
    ('manpower_entries','editProductionJobRoutine','editProductionJobRoutine','editProductionJobRoutine'),
    ('manpower_reporting_groups','editProductionJobRoutine','editProductionJobRoutine',null::text),
    ('inventory_items','adjustInventory','adjustInventory','adjustInventory'),
    ('inventory_transactions','adjustInventory',null::text,null::text),
    ('pending_receivals','adjustInventory','adjustInventory','adjustInventory'),
    ('vendor_catalog','manageVendorsCatalog','manageVendorsCatalog','manageVendorsCatalog'),
    ('vendor_catalog_v2','manageVendorsCatalog','manageVendorsCatalog','manageVendorsCatalog')
  ) as permissions(table_name, insert_cap, update_cap, delete_cap)
  loop
    if to_regclass('public.' || entry.table_name) is null then continue; end if;
    if entry.insert_cap is not null then execute format('create policy %I on public.%I for insert to authenticated with check (public.has_app_capability(%L))','RBAC insert '||entry.table_name,entry.table_name,entry.insert_cap); end if;
    if entry.update_cap is not null then execute format('create policy %I on public.%I for update to authenticated using (public.has_app_capability(%L)) with check (public.has_app_capability(%L))','RBAC update '||entry.table_name,entry.table_name,entry.update_cap,entry.update_cap); end if;
    if entry.delete_cap is not null then execute format('create policy %I on public.%I for delete to authenticated using (public.has_app_capability(%L))','RBAC delete '||entry.table_name,entry.table_name,entry.delete_cap); end if;
  end loop;
end;
$$;

-- Rework defense-in-depth wrappers retain the deployed implementations and
-- concurrency behavior while deriving actor identity from the authenticated user.
alter function public.create_production_rework(uuid,text,text,date,text) rename to rbac_legacy_create_production_rework;
alter function public.update_production_rework_status(uuid,text,timestamptz,text) rename to rbac_legacy_update_production_rework_status;
alter function public.save_production_rework_schedule_batch(jsonb,text,text,uuid) rename to rbac_legacy_save_production_rework_schedule_batch;
alter function public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) rename to rbac_legacy_save_production_rework_mixed_schedule_batch;
revoke all on function public.rbac_legacy_create_production_rework(uuid,text,text,date,text) from public, anon, authenticated;
revoke all on function public.rbac_legacy_update_production_rework_status(uuid,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.rbac_legacy_save_production_rework_schedule_batch(jsonb,text,text,uuid) from public, anon, authenticated;
revoke all on function public.rbac_legacy_save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) from public, anon, authenticated;

create function public.create_production_rework(p_job_id uuid,p_reason_category text,p_scope_details text,p_intake_date date,p_created_by text default null)
returns public.production_rework_cycles language plpgsql security definer set search_path=pg_catalog,public as $$ begin
  perform public.require_app_capability('manageProductionRework');
  return public.rbac_legacy_create_production_rework(p_job_id,p_reason_category,p_scope_details,p_intake_date,public.current_app_display_name());
end $$;
create function public.update_production_rework_status(p_rework_cycle_id uuid,p_production_status text,p_expected_updated_at timestamptz,p_actor_name text default null)
returns public.production_rework_cycles language plpgsql security definer set search_path=pg_catalog,public as $$ begin
  perform public.require_app_capability('manageProductionRework');
  return public.rbac_legacy_update_production_rework_status(p_rework_cycle_id,p_production_status,p_expected_updated_at,public.current_app_display_name());
end $$;
create function public.save_production_rework_schedule_batch(p_proposals jsonb,p_changed_by text,p_change_note text default null,p_batch_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$ begin
  perform public.require_app_capability('manageProductionRework'); perform public.require_app_capability('scheduleProduction');
  return public.rbac_legacy_save_production_rework_schedule_batch(p_proposals,public.current_app_display_name(),p_change_note,p_batch_id);
end $$;
create function public.save_production_rework_mixed_schedule_batch(p_job_proposals jsonb,p_phase_proposals jsonb,p_rework_proposals jsonb,p_changed_by text,p_change_note text default null,p_batch_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$ begin
  perform public.require_app_capability('manageProductionRework'); perform public.require_app_capability('scheduleProduction');
  if jsonb_array_length(p_phase_proposals)>0 then perform public.require_app_capability('modifyPlanning'); end if;
  return public.rbac_legacy_save_production_rework_mixed_schedule_batch(p_job_proposals,p_phase_proposals,p_rework_proposals,public.current_app_display_name(),p_change_note,p_batch_id);
end $$;
alter function public.create_production_rework(uuid,text,text,date,text) owner to postgres;
alter function public.update_production_rework_status(uuid,text,timestamptz,text) owner to postgres;
alter function public.save_production_rework_schedule_batch(jsonb,text,text,uuid) owner to postgres;
alter function public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) owner to postgres;
revoke all on function public.create_production_rework(uuid,text,text,date,text), public.update_production_rework_status(uuid,text,timestamptz,text), public.save_production_rework_schedule_batch(jsonb,text,text,uuid), public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) from public, anon;
grant execute on function public.create_production_rework(uuid,text,text,date,text), public.update_production_rework_status(uuid,text,timestamptz,text), public.save_production_rework_schedule_batch(jsonb,text,text,uuid), public.save_production_rework_mixed_schedule_batch(jsonb,jsonb,jsonb,text,text,uuid) to authenticated, service_role;

-- Storage API has its own authorization boundary and does not use PostgREST's
-- pre-request hook.
drop policy if exists "Allow anon read job attachment objects" on storage.objects;
drop policy if exists "Allow anon upload job attachment objects" on storage.objects;
drop policy if exists "Allow anon delete job attachment objects" on storage.objects;
drop policy if exists "Compatibility authenticated read job attachment objects" on storage.objects;
drop policy if exists "Compatibility authenticated upload job attachment objects" on storage.objects;
drop policy if exists "Compatibility authenticated delete job attachment objects" on storage.objects;
create policy "RBAC read job attachment objects" on storage.objects for select to authenticated
  using (bucket_id='job-attachments' and public.has_app_capability('readOperationalData'));
create policy "RBAC upload job attachment objects" on storage.objects for insert to authenticated
  with check (bucket_id='job-attachments' and public.has_app_capability('uploadSupportingFiles'));
create policy "RBAC delete job attachment objects" on storage.objects for delete to authenticated
  using (bucket_id='job-attachments' and public.has_app_capability('deleteSupportingFiles'));

-- Disable one-time bootstrap and all legacy anonymous operational authority.
revoke execute on function public.bootstrap_first_tenops_admin(text) from authenticated;
revoke usage on schema public from anon;
grant usage on schema public to authenticated;
alter role authenticator set pgrst.db_pre_request = 'public.tenops_authorize_request';
notify pgrst, 'reload config';

commit;
