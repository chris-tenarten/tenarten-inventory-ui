-- Give active Admins a narrow deletion path for any unissued Sample Draft.
-- Creator-only Draft deletion and the issued-Sample lifecycle remain unchanged.
begin;

create function public.admin_permanently_delete_sample_draft(p_sample_id uuid,p_confirmation text)
returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  target public.samples%rowtype;
  material_count bigint;
  version_count bigint;
begin
  if not exists(select 1 from public.app_users where user_id=auth.uid() and is_active and role='admin') then
    raise exception 'Only an active Admin may permanently delete another user''s Sample Draft.' using errcode='42501';
  end if;
  if p_confirmation is distinct from 'PERMANENTLY_DELETE_SAMPLE_DRAFT_AS_ADMIN' then
    raise exception 'Admin Sample Draft deletion confirmation is invalid.' using errcode='22023';
  end if;
  select * into target from public.samples where id=p_sample_id for update;
  if not found then raise exception 'Sample was not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.sample_issued_documents where sample_id=p_sample_id) then
    raise exception 'Issued Samples require the Admin issued-deletion lifecycle.' using errcode='55000';
  end if;
  select count(*) into material_count from public.sample_blend_rows where sample_id=p_sample_id;
  select count(*) into version_count from public.sample_working_versions where sample_id=p_sample_id;
  perform set_config('tenops.sample_parent_delete',p_sample_id::text,true);
  delete from public.sample_working_versions where sample_id=p_sample_id;
  delete from public.samples where id=p_sample_id;
  return jsonb_build_object('sample_id',p_sample_id,'material_rows_deleted',material_count,'working_versions_deleted',version_count);
end $$;

alter function public.admin_permanently_delete_sample_draft(uuid,text) owner to postgres;
revoke all on function public.admin_permanently_delete_sample_draft(uuid,text) from public,anon;
grant execute on function public.admin_permanently_delete_sample_draft(uuid,text) to authenticated;
comment on function public.admin_permanently_delete_sample_draft(uuid,text) is 'Active-Admin deletion of any unissued Sample Draft and its Sample-owned working state.';

commit;
