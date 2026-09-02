-- Exceptional Admin-only permanent cleanup for disposable Bids and provably safe Production Jobs.
-- Protected Production history is never cascaded by this migration.
begin;

create table public.canonical_record_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('bid','production_job')),
  deleted_record_id uuid not null,
  actor_user_id uuid not null references public.app_users(user_id),
  deleted_at timestamptz not null default clock_timestamp(),
  dependency_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(dependency_counts)='object')
);

create index canonical_record_deletion_audit_record_idx
  on public.canonical_record_deletion_audit(record_type,deleted_record_id,deleted_at desc);
alter table public.canonical_record_deletion_audit enable row level security;
revoke all on public.canonical_record_deletion_audit from public,anon,authenticated;
grant all on public.canonical_record_deletion_audit to service_role;

create function public.prepare_admin_delete_bid(p_bid_id uuid)
returns table(storage_path text)
language plpgsql security definer set search_path=pg_catalog,public,storage as $$
begin
  perform public.require_app_capability('manageUsers');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active Admin access is required.' using errcode='42501'; end if;
  perform 1 from public.bids where id=p_bid_id for update;
  if not found then raise exception 'Bid was not found.' using errcode='P0002'; end if;

  update public.bid_file_relationships relationship
  set relationship_state='removal_pending'
  where relationship.bid_id=p_bid_id
    and not exists (
      select 1 from public.bid_file_relationships other
      where other.file_id=relationship.file_id and other.bid_id<>p_bid_id
    );

  return query
  select file.storage_path
  from public.canonical_files file
  join public.bid_file_relationships relationship on relationship.file_id=file.id
  where relationship.bid_id=p_bid_id and relationship.relationship_state='removal_pending'
  order by file.storage_path;
end $$;

create function public.cancel_admin_delete_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.require_app_capability('manageUsers');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active Admin access is required.' using errcode='42501'; end if;
  update public.bid_file_relationships relationship
  set relationship_state=case when file.lifecycle_state='uploading' then 'uploading' else 'active' end
  from public.canonical_files file
  where relationship.bid_id=p_bid_id and relationship.file_id=file.id
    and relationship.relationship_state='removal_pending';
end $$;

create function public.admin_permanently_delete_bid(p_bid_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare
  actor_id uuid;
  target public.bids%rowtype;
  counts jsonb;
  target_file_ids uuid[];
begin
  perform public.require_app_capability('manageUsers');
  select user_id into strict actor_id from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.bids where id=p_bid_id for update;
  if p_confirmation is distinct from target.customer||' · '||target.project_name then
    raise exception 'Typed confirmation did not match the Bid.' using errcode='22023';
  end if;
  if exists (
    select 1 from public.canonical_files file
    join public.bid_file_relationships relationship on relationship.file_id=file.id
    join storage.objects object on object.bucket_id=file.storage_bucket and object.name=file.storage_path
    where relationship.bid_id=p_bid_id and relationship.relationship_state='removal_pending'
  ) then raise exception 'Bid file cleanup must finish before permanent deletion.' using errcode='55000'; end if;

  select jsonb_build_object(
    'updates',(select count(*) from public.bid_updates where bid_id=p_bid_id),
    'activity',(select count(*) from public.bid_activity where bid_id=p_bid_id),
    'file_relationships',(select count(*) from public.bid_file_relationships where bid_id=p_bid_id),
    'unreferenced_files',(select count(*) from public.bid_file_relationships relationship where relationship.bid_id=p_bid_id and not exists(select 1 from public.bid_file_relationships other where other.file_id=relationship.file_id and other.bid_id<>p_bid_id))
  ) into counts;
  select coalesce(array_agg(file_id),'{}'::uuid[]) into target_file_ids
  from public.bid_file_relationships where bid_id=p_bid_id;

  delete from public.bid_updates where bid_id=p_bid_id;
  delete from public.bid_activity where bid_id=p_bid_id;
  delete from public.bid_file_relationships where bid_id=p_bid_id;
  delete from public.canonical_files file
  where file.id=any(target_file_ids)
    and not exists(select 1 from public.bid_file_relationships relationship where relationship.file_id=file.id)
    and not exists(select 1 from storage.objects object where object.bucket_id=file.storage_bucket and object.name=file.storage_path);
  delete from public.bids where id=p_bid_id;
  insert into public.canonical_record_deletion_audit(record_type,deleted_record_id,actor_user_id,dependency_counts)
  values('bid',p_bid_id,actor_id,counts);
end $$;

create function public.production_job_delete_blockers(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare blockers jsonb:='[]'::jsonb;
begin
  perform 1 from public.jobs where id=p_job_id;
  if not found then raise exception 'Production Job was not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.planning_phases where job_id=p_job_id) then blockers:=blockers||'"Planning records exist"'::jsonb; end if;
  if exists(select 1 from public.manpower_entries where job_id=p_job_id) then blockers:=blockers||'"Production labor exists"'::jsonb; end if;
  if exists(select 1 from public.production_rework_cycles where job_id=p_job_id) then blockers:=blockers||'"Rework history exists"'::jsonb; end if;
  if exists(select 1 from public.purchase_orders where production_job_id=p_job_id) or exists(select 1 from public.chip_purchase_order_line_details where production_job_id=p_job_id) or exists(select 1 from public.pending_receivals where production_job_id=p_job_id) or exists(select 1 from public.receiving_documents where suggested_production_job_id=p_job_id) or exists(select 1 from public.receiving_document_lines where production_job_id=p_job_id) then blockers:=blockers||'"Purchasing or receiving history exists"'::jsonb; end if;
  if exists(select 1 from public.inventory_items where production_job_id=p_job_id) or exists(select 1 from public.inventory_transactions where production_job_id=p_job_id) or exists(select 1 from public.material_usage_reports where job_id=p_job_id) then blockers:=blockers||'"Material or inventory history exists"'::jsonb; end if;
  if exists(select 1 from public.job_document_numbers where job_id=p_job_id) or exists(select 1 from public.job_transmittals where job_id=p_job_id) or exists(select 1 from public.proposals where job_id=p_job_id) then blockers:=blockers||'"Issued or generated document history exists"'::jsonb; end if;
  if exists(select 1 from public.job_updates where job_id=p_job_id) then blockers:=blockers||'"Job Updates exist"'::jsonb; end if;
  if exists(select 1 from public.my_work_messages where job_id=p_job_id) then blockers:=blockers||'"My Work or Inbox records reference this Job"'::jsonb; end if;
  if exists(select 1 from public.project_tasks where job_id=p_job_id) then blockers:=blockers||'"Production task history exists"'::jsonb; end if;
  return blockers;
end $$;

create function public.preflight_admin_delete_production_job(p_job_id uuid)
returns table(eligible boolean,blockers jsonb,confirmation_value text,attachment_count bigint)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare target public.jobs%rowtype; found_blockers jsonb;
begin
  perform public.require_app_capability('manageUsers');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active Admin access is required.' using errcode='42501'; end if;
  select * into strict target from public.jobs where id=p_job_id;
  found_blockers:=public.production_job_delete_blockers(p_job_id);
  return query select jsonb_array_length(found_blockers)=0,found_blockers,coalesce(nullif(btrim(target.job_number),''),target.name),(select count(*) from public.job_attachments where job_id=p_job_id);
end $$;

create function public.prepare_admin_delete_production_job(p_job_id uuid)
returns table(storage_path text)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare found_blockers jsonb;
begin
  perform public.require_app_capability('manageUsers');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active Admin access is required.' using errcode='42501'; end if;
  perform 1 from public.jobs where id=p_job_id for update;
  if not found then raise exception 'Production Job was not found.' using errcode='P0002'; end if;
  found_blockers:=public.production_job_delete_blockers(p_job_id);
  if jsonb_array_length(found_blockers)>0 then raise exception 'Production Job has protected history and cannot be permanently deleted.' using errcode='55000',detail=found_blockers::text; end if;
  return query select attachment.storage_path from public.job_attachments attachment where attachment.job_id=p_job_id order by attachment.storage_path;
end $$;

create function public.admin_permanently_delete_production_job(p_job_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare actor_id uuid; target public.jobs%rowtype; found_blockers jsonb; counts jsonb;
begin
  perform public.require_app_capability('manageUsers');
  select user_id into strict actor_id from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.jobs where id=p_job_id for update;
  found_blockers:=public.production_job_delete_blockers(p_job_id);
  if jsonb_array_length(found_blockers)>0 then raise exception 'Production Job has protected history and cannot be permanently deleted.' using errcode='55000',detail=found_blockers::text; end if;
  if p_confirmation is distinct from coalesce(nullif(btrim(target.job_number),''),target.name) then raise exception 'Typed confirmation did not match the Production Job.' using errcode='22023'; end if;
  if exists(select 1 from public.job_attachments attachment join storage.objects object on object.bucket_id='job-attachments' and object.name=attachment.storage_path where attachment.job_id=p_job_id) then raise exception 'Job attachment cleanup must finish before permanent deletion.' using errcode='55000'; end if;
  counts:=jsonb_build_object(
    'attachments',(select count(*) from public.job_attachments where job_id=p_job_id),
    'activity',(select count(*) from public.job_activity where job_id=p_job_id),
    'update_seen_state',(select count(*) from public.job_update_seen_state where job_id=p_job_id)
  );
  delete from public.job_attachments where job_id=p_job_id;
  delete from public.job_update_seen_state where job_id=p_job_id;
  delete from public.job_activity where job_id=p_job_id;
  delete from public.jobs where id=p_job_id;
  insert into public.canonical_record_deletion_audit(record_type,deleted_record_id,actor_user_id,dependency_counts)
  values('production_job',p_job_id,actor_id,counts);
end $$;

alter function public.prepare_admin_delete_bid(uuid) owner to postgres;
alter function public.cancel_admin_delete_bid(uuid) owner to postgres;
alter function public.admin_permanently_delete_bid(uuid,text) owner to postgres;
alter function public.production_job_delete_blockers(uuid) owner to postgres;
alter function public.preflight_admin_delete_production_job(uuid) owner to postgres;
alter function public.prepare_admin_delete_production_job(uuid) owner to postgres;
alter function public.admin_permanently_delete_production_job(uuid,text) owner to postgres;

revoke all on function public.prepare_admin_delete_bid(uuid),public.cancel_admin_delete_bid(uuid),public.admin_permanently_delete_bid(uuid,text),public.production_job_delete_blockers(uuid),public.preflight_admin_delete_production_job(uuid),public.prepare_admin_delete_production_job(uuid),public.admin_permanently_delete_production_job(uuid,text) from public,anon;
revoke all on function public.production_job_delete_blockers(uuid) from authenticated;
grant execute on function public.prepare_admin_delete_bid(uuid),public.cancel_admin_delete_bid(uuid),public.admin_permanently_delete_bid(uuid,text),public.preflight_admin_delete_production_job(uuid),public.prepare_admin_delete_production_job(uuid),public.admin_permanently_delete_production_job(uuid,text) to authenticated,service_role;
grant execute on function public.production_job_delete_blockers(uuid) to service_role;

comment on table public.canonical_record_deletion_audit is 'Content-free structural evidence of exceptional Admin deletion of a canonical Bid or Production Job.';
commit;
