-- Correct Admin Bid cleanup after canonical Samples and Proposals acquire Bid context.
-- Canonical documents remain intact; only their current Bid relationships are detached.
begin;

create or replace function public.admin_permanently_delete_bid(p_bid_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare
  actor_id uuid;
  target public.bids%rowtype;
  expected_confirmation text;
  counts jsonb;
  target_file_ids uuid[];
  proposal_relationship_count bigint:=0;
begin
  perform public.require_app_capability('manageUsers');
  select user_id into strict actor_id from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.bids where id=p_bid_id for update;
  expected_confirmation:=coalesce(nullif(btrim(target.project_name),''),'DELETE');
  if p_confirmation is distinct from expected_confirmation then
    raise exception 'Typed confirmation did not match the Bid Project Name.' using errcode='22023';
  end if;
  if exists (
    select 1 from public.canonical_files file
    join public.bid_file_relationships relationship on relationship.file_id=file.id
    join storage.objects object on object.bucket_id=file.storage_bucket and object.name=file.storage_path
    where relationship.bid_id=p_bid_id and relationship.relationship_state='removal_pending'
  ) then raise exception 'Bid file cleanup must finish before permanent deletion.' using errcode='55000'; end if;

  if to_regclass('public.bid_proposal_relationships') is not null then
    execute 'select count(*) from public.bid_proposal_relationships where bid_id=$1'
      into proposal_relationship_count using p_bid_id;
  end if;
  select jsonb_build_object(
    'updates',(select count(*) from public.bid_updates where bid_id=p_bid_id),
    'activity',(select count(*) from public.bid_activity where bid_id=p_bid_id),
    'file_relationships',(select count(*) from public.bid_file_relationships where bid_id=p_bid_id),
    'unreferenced_files',(select count(*) from public.bid_file_relationships relationship where relationship.bid_id=p_bid_id and not exists(select 1 from public.bid_file_relationships other where other.file_id=relationship.file_id and other.bid_id<>p_bid_id)),
    'samples_detached',(select count(*) from public.samples where bid_id=p_bid_id),
    'proposal_relationships',proposal_relationship_count
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
  update public.samples set bid_id=null where bid_id=p_bid_id;
  if to_regclass('public.bid_proposal_relationships') is not null then
    execute 'delete from public.bid_proposal_relationships where bid_id=$1' using p_bid_id;
  end if;
  delete from public.bids where id=p_bid_id;
  insert into public.canonical_record_deletion_audit(record_type,deleted_record_id,actor_user_id,dependency_counts)
  values('bid',p_bid_id,actor_id,counts);
end $$;

alter function public.admin_permanently_delete_bid(uuid,text) owner to postgres;
revoke all on function public.admin_permanently_delete_bid(uuid,text) from public,anon;
grant execute on function public.admin_permanently_delete_bid(uuid,text) to authenticated,service_role;

comment on function public.admin_permanently_delete_bid(uuid,text) is
  'Admin-only confirmed Bid cleanup; preserves canonical Samples/Proposals while removing their current Bid relationships.';

commit;
