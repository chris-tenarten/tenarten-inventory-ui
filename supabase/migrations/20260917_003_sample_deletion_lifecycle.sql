-- Correct Sample parent-deletion semantics without weakening immutable child records.
begin;

create or replace function public.sample_working_version_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if tg_op='DELETE'
     and current_user='postgres'
     and current_setting('tenops.sample_parent_delete',true)=old.sample_id::text then
    return old;
  end if;
  raise exception 'Saved Sample working versions are immutable.' using errcode='55000';
end $$;

create or replace function public.permanently_delete_sample_draft(p_sample_id uuid,p_confirmation text)
returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  target public.samples%rowtype;
  material_count bigint;
  version_count bigint;
begin
  perform public.require_app_capability('readOperationalData');
  if p_confirmation is distinct from 'PERMANENTLY_DELETE_SAMPLE_DRAFT' then
    raise exception 'Sample Draft deletion confirmation is invalid.' using errcode='22023';
  end if;
  select * into target from public.samples where id=p_sample_id for update;
  if not found then raise exception 'Sample was not found.' using errcode='P0002'; end if;
  if target.created_by_user_id is distinct from auth.uid() then
    raise exception 'Only the Sample creator may delete this unissued Draft.' using errcode='42501';
  end if;
  if exists(select 1 from public.sample_issued_documents where sample_id=p_sample_id) then
    raise exception 'Issued Samples cannot be permanently deleted by ordinary users.' using errcode='55000';
  end if;
  select count(*) into material_count from public.sample_blend_rows where sample_id=p_sample_id;
  select count(*) into version_count from public.sample_working_versions where sample_id=p_sample_id;
  perform set_config('tenops.sample_parent_delete',p_sample_id::text,true);
  delete from public.sample_working_versions where sample_id=p_sample_id;
  delete from public.samples where id=p_sample_id;
  return jsonb_build_object('sample_id',p_sample_id,'material_rows_deleted',material_count,'working_versions_deleted',version_count);
end $$;

create function public.prepare_admin_delete_sample(p_sample_id uuid)
returns table(storage_bucket text,storage_path text)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Only an active Admin may permanently delete an issued Sample.' using errcode='42501';
  end if;
  if not exists(select 1 from public.samples where id=p_sample_id) then raise exception 'Sample was not found.' using errcode='P0002'; end if;
  if not exists(select 1 from public.sample_issued_documents where sample_id=p_sample_id) then
    raise exception 'Use Delete Draft for an unissued Sample.' using errcode='55000';
  end if;
  return query select coalesce(nullif(document.storage_bucket,''),'sample-documents'),document.storage_path
    from public.sample_issued_documents document
    where document.sample_id=p_sample_id and nullif(document.storage_path,'') is not null;
end $$;

create function public.admin_permanently_delete_sample(p_sample_id uuid,p_confirmation text)
returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare target public.samples%rowtype; document_count bigint; version_count bigint; material_count bigint;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Only an active Admin may permanently delete an issued Sample.' using errcode='42501';
  end if;
  if p_confirmation is distinct from 'PERMANENTLY_DELETE_ISSUED_SAMPLE' then
    raise exception 'Issued Sample deletion confirmation is invalid.' using errcode='22023';
  end if;
  select * into target from public.samples where id=p_sample_id for update;
  if not found then raise exception 'Sample was not found.' using errcode='P0002'; end if;
  if not exists(select 1 from public.sample_issued_documents where sample_id=p_sample_id) then
    raise exception 'Use Delete Draft for an unissued Sample.' using errcode='55000';
  end if;
  if exists(select 1 from public.sample_issued_documents where sample_id=p_sample_id and nullif(storage_path,'') is not null) then
    raise exception 'Stored Sample PDFs must be removed before deleting issued history.' using errcode='55000';
  end if;
  select count(*) into document_count from public.sample_issued_documents where sample_id=p_sample_id;
  select count(*) into version_count from public.sample_working_versions where sample_id=p_sample_id;
  select count(*) into material_count from public.sample_blend_rows where sample_id=p_sample_id;
  perform set_config('tenops.sample_parent_delete',p_sample_id::text,true);
  delete from public.sample_working_versions where sample_id=p_sample_id;
  delete from public.sample_issued_documents where sample_id=p_sample_id;
  delete from public.samples where id=p_sample_id;
  return jsonb_build_object('sample_id',p_sample_id,'issued_documents_deleted',document_count,'working_versions_deleted',version_count,'material_rows_deleted',material_count);
end $$;

alter function public.permanently_delete_sample_draft(uuid,text) owner to postgres;
alter function public.prepare_admin_delete_sample(uuid) owner to postgres;
alter function public.admin_permanently_delete_sample(uuid,text) owner to postgres;
revoke all on function public.permanently_delete_sample_draft(uuid,text),public.prepare_admin_delete_sample(uuid),public.admin_permanently_delete_sample(uuid,text) from public,anon;
grant execute on function public.permanently_delete_sample_draft(uuid,text) to authenticated,service_role;
grant execute on function public.prepare_admin_delete_sample(uuid),public.admin_permanently_delete_sample(uuid,text) to authenticated;

comment on function public.permanently_delete_sample_draft(uuid,text) is 'Creator deletion of an unissued Sample and all Sample-owned non-issued children.';
comment on function public.admin_permanently_delete_sample(uuid,text) is 'Exceptional active-Admin deletion of an issued Sample after owned Storage objects are removed.';
commit;
