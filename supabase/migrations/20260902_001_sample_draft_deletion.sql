-- Allow operational users to permanently delete only never-issued Sample drafts.
begin;

create function public.permanently_delete_sample_draft(p_sample_id uuid,p_confirmation text)
returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  target public.samples%rowtype;
  material_count bigint;
begin
  perform public.require_app_capability('readOperationalData');
  if p_confirmation is distinct from 'PERMANENTLY_DELETE_SAMPLE_DRAFT' then
    raise exception 'Sample Draft deletion confirmation is invalid.' using errcode='22023';
  end if;

  select * into target from public.samples where id=p_sample_id for update;
  if not found then raise exception 'Sample was not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.sample_issued_documents where sample_id=p_sample_id) then
    raise exception 'Issued Samples cannot be permanently deleted.' using errcode='55000';
  end if;

  select count(*) into material_count from public.sample_blend_rows where sample_id=p_sample_id;
  delete from public.samples where id=p_sample_id;
  return jsonb_build_object('sample_id',p_sample_id,'material_rows_deleted',material_count);
end $$;

alter function public.permanently_delete_sample_draft(uuid,text) owner to postgres;
revoke all on function public.permanently_delete_sample_draft(uuid,text) from public,anon;
grant execute on function public.permanently_delete_sample_draft(uuid,text) to authenticated,service_role;

comment on function public.permanently_delete_sample_draft(uuid,text) is
  'Permanently deletes a never-issued Sample draft and its Sample-owned cascading rows; issued history blocks deletion.';

commit;
