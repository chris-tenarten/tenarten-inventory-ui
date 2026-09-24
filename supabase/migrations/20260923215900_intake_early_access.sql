-- Temporary Intake early access. Local only; separate hosted authorization required.
-- No business rows or document snapshots are modified. Existing policies stay in place;
-- restrictive policies add an AND boundary, including against future permissive policies.
begin;
do $$begin
 if exists(select 1 from public.app_role_capabilities where capability='accessIntake') then
   raise exception 'Intake capability already exists; review installed authorization before proceeding';
 end if;
end$$;
insert into public.app_role_capabilities(role,capability) values
 ('admin','accessIntake'),('developer','accessIntake');
create policy intake_early_access on public.bids as restrictive for all to authenticated using (public.has_app_capability('accessIntake')) with check (public.has_app_capability('accessIntake'));
create policy intake_early_access on public.bid_activity as restrictive for all to authenticated using (public.has_app_capability('accessIntake')) with check (public.has_app_capability('accessIntake'));
create policy intake_early_access on public.bid_updates as restrictive for all to authenticated using (public.has_app_capability('accessIntake')) with check (public.has_app_capability('accessIntake'));
create policy intake_early_access on public.bid_file_relationships as restrictive for all to authenticated using (public.has_app_capability('accessIntake')) with check (public.has_app_capability('accessIntake'));
create policy intake_early_access on public.bid_proposal_relationships as restrictive for all to authenticated using (public.has_app_capability('accessIntake')) with check (public.has_app_capability('accessIntake'));
create policy intake_file_early_access on public.canonical_files as restrictive for all to authenticated
using (storage_bucket <> 'bid-files' or public.has_app_capability('accessIntake'))
with check (storage_bucket <> 'bid-files' or public.has_app_capability('accessIntake'));
create policy intake_file_early_access on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'bid-files' or public.has_app_capability('accessIntake'))
with check (bucket_id <> 'bid-files' or public.has_app_capability('accessIntake'));

-- Patch only known installed function definitions. Fail closed on drift. CREATE OR
-- REPLACE retains ownership/grants and each function's security/search_path attributes.
do $guard$
declare definition text;
begin
 select pg_get_functiondef('list_bid_owners()'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '858e46dd90640cb4f7aedb82bf1d9ecd' then
   raise exception 'Intake gate: installed list_bid_owners differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.list_bid_owners()
 RETURNS TABLE(user_id uuid, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select u.user_id,u.display_name
  from public.app_users u
  where public.has_app_capability('accessIntake') and u.is_active
  order by u.display_name,u.user_id
$function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('list_bids()'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'b162513178b1e13c50b5b37759e24d7d' then
   raise exception 'Intake gate: installed list_bids differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.list_bids()
 RETURNS TABLE(id uuid, customer text, project_name text, creator_user_id uuid, creator_name text, owner_user_id uuid, owner_name text, status text, deposit_received_date date, contact_name text, contact_email text, contact_phone text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    b.id,
    b.customer,
    b.project_name,
    b.creator_user_id,
    creator.display_name,
    b.owner_user_id,
    owner_user.display_name,
    b.status,
    b.deposit_received_date,
    b.contact_name,
    b.contact_email,
    b.contact_phone,
    b.notes,
    b.created_at,
    b.updated_at
  from public.bids b
  join public.app_users creator on creator.user_id=b.creator_user_id
  join public.app_users owner_user on owner_user.user_id=b.owner_user_id
  where public.has_app_capability('accessIntake')
  order by b.updated_at desc,b.id
$function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('list_bid_activity(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'e89a1baabfe699fad115f9cfdc3c0177' then
   raise exception 'Intake gate: installed list_bid_activity differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.list_bid_activity(p_bid_id uuid)
 RETURNS TABLE(id uuid, activity_type text, actor_user_id uuid, actor_name text, occurred_at timestamp with time zone, details jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select a.id,a.activity_type,a.actor_user_id,u.display_name,a.occurred_at,a.details
  from public.bid_activity a join public.app_users u on u.user_id=a.actor_user_id
  where public.has_app_capability('accessIntake') and a.bid_id=p_bid_id
  order by a.occurred_at desc,a.id desc
$function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('list_bid_updates(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '0c1f81f0ac17c8f73aa4c9daddde3e6d' then
   raise exception 'Intake gate: installed list_bid_updates differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.list_bid_updates(p_bid_id uuid)
 RETURNS TABLE(id uuid, bid_id uuid, author_user_id uuid, author_name text, body text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select u.id,u.bid_id,u.author_user_id,a.display_name,u.body,u.created_at
  from public.bid_updates u
  join public.app_users a on a.user_id=u.author_user_id
  where public.has_app_capability('accessIntake') and u.bid_id=p_bid_id
  order by u.created_at desc,u.id desc
$function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('list_bid_files(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'c4f3bf7d22df6ffcfdade643e7c0c00e' then
   raise exception 'Intake gate: installed list_bid_files differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.list_bid_files(p_bid_id uuid)
 RETURNS TABLE(id uuid, bid_id uuid, uploader_user_id uuid, uploader_name text, storage_path text, original_filename text, content_type text, byte_size bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select file.id,relationship.bid_id,file.uploader_user_id,uploader.display_name,file.storage_path,file.original_filename,file.content_type,file.byte_size,file.created_at
  from public.canonical_files file
  join public.bid_file_relationships relationship on relationship.file_id=file.id
  join public.app_users uploader on uploader.user_id=file.uploader_user_id
  where public.has_app_capability('accessIntake') and relationship.bid_id=p_bid_id
    and file.lifecycle_state='ready' and relationship.relationship_state='active'
  order by file.created_at desc,file.id desc
$function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('create_bid(text,text)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '42aeef0a252dc52c6e6d844d485877f3' then
   raise exception 'Intake gate: installed create_bid differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.create_bid(p_customer text, p_project_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid();
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if nullif(btrim(p_customer),'') is null then raise exception 'Customer is required.' using errcode='22023'; end if;
  if nullif(btrim(p_project_name),'') is null then raise exception 'Project Name is required.' using errcode='22023'; end if;
  insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id)
  values(created_id,btrim(p_customer),btrim(p_project_name),actor.user_id,actor.user_id);
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details)
  values(created_id,'created',actor.user_id,jsonb_build_object('customer',btrim(p_customer),'project_name',btrim(p_project_name),'owner_user_id',actor.user_id,'status','active'));
  return created_id;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('update_bid(uuid,text,text,uuid,text,date,text,text,text,text)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '7205a6aa7fd771f6fb2fbf57ef2e708b' then
   raise exception 'Intake gate: installed update_bid differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.update_bid(p_bid_id uuid, p_customer text, p_project_name text, p_owner_user_id uuid, p_status text, p_deposit_received_date date, p_contact_name text, p_contact_email text, p_contact_phone text, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  actor public.app_users%rowtype;
  current_bid public.bids%rowtype;
  next_owner public.app_users%rowtype;
  recorded_at timestamptz:=clock_timestamp();
  next_contact_name text:=nullif(btrim(p_contact_name),'');
  next_contact_email text:=nullif(btrim(p_contact_email),'');
  next_contact_phone text:=nullif(btrim(p_contact_phone),'');
  next_notes text:=nullif(btrim(p_notes),'');
  changed_contact_fields text[]:=array[]::text[];
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict current_bid from public.bids where id=p_bid_id for update;
  if nullif(btrim(p_customer),'') is null then raise exception 'Customer is required.' using errcode='22023'; end if;
  if nullif(btrim(p_project_name),'') is null then raise exception 'Project Name is required.' using errcode='22023'; end if;
  if p_status not in ('active','won','lost') then raise exception 'Unsupported Bid status.' using errcode='22023'; end if;
  if length(next_contact_name)>200 then raise exception 'Contact Name is too long.' using errcode='22023'; end if;
  if length(next_contact_email)>320 then raise exception 'Contact Email is too long.' using errcode='22023'; end if;
  if length(next_contact_phone)>80 then raise exception 'Contact Phone is too long.' using errcode='22023'; end if;
  if length(next_notes)>10000 then raise exception 'Notes are too long.' using errcode='22023'; end if;
  select * into strict next_owner from public.app_users where user_id=p_owner_user_id and is_active;

  if row(current_bid.customer,current_bid.project_name) is distinct from row(btrim(p_customer),btrim(p_project_name)) then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'details_updated',actor.user_id,recorded_at,jsonb_build_object('from',jsonb_build_object('customer',current_bid.customer,'project_name',current_bid.project_name),'to',jsonb_build_object('customer',btrim(p_customer),'project_name',btrim(p_project_name))));
  end if;
  if current_bid.owner_user_id is distinct from next_owner.user_id then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'owner_changed',actor.user_id,recorded_at,jsonb_build_object('from_owner_user_id',current_bid.owner_user_id,'to_owner_user_id',next_owner.user_id));
  end if;
  if current_bid.status is distinct from p_status then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'status_changed',actor.user_id,recorded_at,jsonb_build_object('from_status',current_bid.status,'to_status',p_status));
  end if;
  if current_bid.deposit_received_date is distinct from p_deposit_received_date then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'deposit_received_changed',actor.user_id,recorded_at,jsonb_strip_nulls(jsonb_build_object('from_business_date',current_bid.deposit_received_date,'to_business_date',p_deposit_received_date)));
  end if;
  if current_bid.contact_name is distinct from next_contact_name then changed_contact_fields:=array_append(changed_contact_fields,'name'); end if;
  if current_bid.contact_email is distinct from next_contact_email then changed_contact_fields:=array_append(changed_contact_fields,'email'); end if;
  if current_bid.contact_phone is distinct from next_contact_phone then changed_contact_fields:=array_append(changed_contact_fields,'phone'); end if;
  if cardinality(changed_contact_fields)>0 then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'contact_changed',actor.user_id,recorded_at,jsonb_build_object('fields',to_jsonb(changed_contact_fields)));
  end if;
  if current_bid.notes is distinct from next_notes then
    insert into public.bid_activity(bid_id,activity_type,actor_user_id,occurred_at,details)
    values(p_bid_id,'notes_changed',actor.user_id,recorded_at,jsonb_build_object('changed',true));
  end if;
  update public.bids set
    customer=btrim(p_customer),
    project_name=btrim(p_project_name),
    owner_user_id=next_owner.user_id,
    status=p_status,
    deposit_received_date=p_deposit_received_date,
    contact_name=next_contact_name,
    contact_email=next_contact_email,
    contact_phone=next_contact_phone,
    notes=next_notes
  where id=p_bid_id;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('create_bid_update(uuid,text)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'e3e66db478c3bf80e64678e5e571c8e4' then
   raise exception 'Intake gate: installed create_bid_update differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.create_bid_update(p_bid_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); normalized_body text:=btrim(p_body);
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid was not found.' using errcode='P0002'; end if;
  if normalized_body='' then raise exception 'Update is required.' using errcode='22023'; end if;
  if length(normalized_body)>5000 then raise exception 'Update is too long.' using errcode='22023'; end if;
  insert into public.bid_updates(id,bid_id,author_user_id,body)
  values(created_id,p_bid_id,actor.user_id,normalized_body);
  return created_id;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('begin_bid_file_upload(uuid,text,text,bigint)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '9ab15f57b63370b04a9357389549370b' then
   raise exception 'Intake gate: installed begin_bid_file_upload differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.begin_bid_file_upload(p_bid_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint)
 RETURNS TABLE(file_id uuid, storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); created_path text;
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid was not found.' using errcode='P0002'; end if;
  if nullif(btrim(p_original_filename),'') is null or length(btrim(p_original_filename))>500 then raise exception 'A valid file name is required.' using errcode='22023'; end if;
  if length(coalesce(p_content_type,'application/octet-stream'))>255 then raise exception 'File type is too long.' using errcode='22023'; end if;
  if p_byte_size<0 or p_byte_size>26214400 then raise exception 'File exceeds the 25 MB limit.' using errcode='22023'; end if;
  created_path:=p_bid_id::text||'/'||created_id::text;
  insert into public.canonical_files(id,uploader_user_id,storage_path,original_filename,content_type,byte_size)
  values(created_id,actor.user_id,created_path,btrim(p_original_filename),coalesce(nullif(btrim(p_content_type),''),'application/octet-stream'),p_byte_size);
  insert into public.bid_file_relationships(bid_id,file_id) values(p_bid_id,created_id);
  return query select created_id,created_path;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('abort_bid_file_upload(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'c37b2b5ee7dde5b367e29fe962639fd5' then
   raise exception 'Intake gate: installed abort_bid_file_upload differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.abort_bid_file_upload(p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype;
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.canonical_files where id=p_file_id and lifecycle_state='uploading' and uploader_user_id=actor.user_id for update;
  if exists(select 1 from storage.objects object where object.bucket_id=target.storage_bucket and object.name=target.storage_path) then
    raise exception 'Uploaded bytes must be removed before aborting file metadata.' using errcode='55000';
  end if;
  delete from public.bid_file_relationships where file_id=target.id and relationship_state='uploading';
  delete from public.canonical_files where id=target.id;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('finalize_bid_file_upload(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '15fe58e438a5b5d7adae86c99c6e2558' then
   raise exception 'Intake gate: installed finalize_bid_file_upload differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.finalize_bid_file_upload(p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype; target_bid_id uuid; object_size bigint;
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.canonical_files where id=p_file_id and lifecycle_state='uploading' and uploader_user_id=actor.user_id for update;
  select bid_id into strict target_bid_id from public.bid_file_relationships where file_id=target.id and relationship_state='uploading' for update;
  select nullif(object.metadata->>'size','')::bigint into strict object_size from storage.objects object where object.bucket_id=target.storage_bucket and object.name=target.storage_path;
  if object_size is distinct from target.byte_size then raise exception 'Uploaded byte size does not match file metadata.' using errcode='22000'; end if;
  update public.canonical_files set lifecycle_state='ready' where id=target.id;
  update public.bid_file_relationships set relationship_state='active' where bid_id=target_bid_id and file_id=target.id;
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details)
  values(target_bid_id,'file_added',actor.user_id,jsonb_build_object('file_id',target.id));
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('prepare_bid_file_removal(uuid,uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'dae16d440bd982c998706db5f1b4c048' then
   raise exception 'Intake gate: installed prepare_bid_file_removal differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.prepare_bid_file_removal(p_bid_id uuid, p_file_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target_path text;
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select file.storage_path into strict target_path
  from public.canonical_files file join public.bid_file_relationships relationship on relationship.file_id=file.id
  where file.id=p_file_id and relationship.bid_id=p_bid_id and file.lifecycle_state='ready' and relationship.relationship_state='active' for update of relationship;
  update public.bid_file_relationships set relationship_state='removal_pending' where bid_id=p_bid_id and file_id=p_file_id;
  return target_path;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('cancel_bid_file_removal(uuid,uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'b94c76e019977664caa05b9adf323a9d' then
   raise exception 'Intake gate: installed cancel_bid_file_removal differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.cancel_bid_file_removal(p_bid_id uuid, p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.require_app_capability('accessIntake');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active user is required.' using errcode='42501'; end if;
  update public.bid_file_relationships set relationship_state='active'
  where bid_id=p_bid_id and file_id=p_file_id and relationship_state='removal_pending';
  if not found then raise exception 'Pending Bid File removal was not found.' using errcode='P0002'; end if;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('finalize_bid_file_removal(uuid,uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'eae1746aac49deedc9ae41d105664a90' then
   raise exception 'Intake gate: installed finalize_bid_file_removal differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.finalize_bid_file_removal(p_bid_id uuid, p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype;
begin
  perform public.require_app_capability('accessIntake');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select file.* into target
  from public.canonical_files file join public.bid_file_relationships relationship on relationship.file_id=file.id
  where file.id=p_file_id and relationship.bid_id=p_bid_id and relationship.relationship_state='removal_pending' for update of relationship,file;
  if not found then
    if not exists(select 1 from public.bid_file_relationships where bid_id=p_bid_id and file_id=p_file_id)
      and not exists(select 1 from public.canonical_files where id=p_file_id) then return; end if;
    raise exception 'Pending Bid File removal was not found.' using errcode='P0002';
  end if;
  if exists(select 1 from storage.objects object where object.bucket_id=target.storage_bucket and object.name=target.storage_path) then
    raise exception 'File bytes must be removed before finalizing the Bid relationship removal.' using errcode='55000';
  end if;
  delete from public.bid_file_relationships where bid_id=p_bid_id and file_id=p_file_id;
  delete from public.canonical_files file where file.id=p_file_id and not exists(select 1 from public.bid_file_relationships relationship where relationship.file_id=file.id);
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details)
  values(p_bid_id,'file_removed',actor.user_id,jsonb_build_object('file_id',p_file_id));
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('create_bid_proposal(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'ff6edbb3a0be33152955659f52ea5e75' then
   raise exception 'Intake gate: installed create_bid_proposal differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.create_bid_proposal(p_bid_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  target_bid public.bids%rowtype;
  created_id uuid;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  perform public.require_app_capability('accessIntake');
  select * into strict target_bid from public.bids where id=p_bid_id;
  created_id:=public.create_proposal();
  update public.proposals
     set customer_name=target_bid.customer,
         project_name=target_bid.project_name
   where id=created_id and status='draft';
  insert into public.bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id)
  values(p_bid_id,created_id,auth.uid());
  return created_id;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('link_proposal_to_bid(uuid,uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '539e67f4b1074080f9febbc9d4e4c36f' then
   raise exception 'Intake gate: installed link_proposal_to_bid differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.link_proposal_to_bid(p_bid_id uuid, p_proposal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  target public.proposals%rowtype;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  perform public.require_app_capability('accessIntake');
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid not found.' using errcode='P0002'; end if;
  select * into strict target from public.proposals where id=p_proposal_id;
  if target.job_id is not null then
    raise exception 'Only a standalone Proposal can be linked to a Bid.' using errcode='22023';
  end if;
  if exists(select 1 from public.bid_proposal_relationships where proposal_id=p_proposal_id) then
    raise exception 'This Proposal is already linked to a Bid.' using errcode='23505';
  end if;
  insert into public.bid_proposal_relationships(bid_id,proposal_id,linked_by_user_id)
  values(p_bid_id,p_proposal_id,auth.uid());
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('link_sample_to_bid(uuid,uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '5b180ae9c23b9b7c412fcf8760d9d360' then
   raise exception 'Intake gate: installed link_sample_to_bid differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.link_sample_to_bid(p_bid_id uuid, p_sample_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare current_bid_id uuid;
begin
  perform public.require_app_capability('accessIntake');
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid not found.' using errcode='P0002'; end if;
  select bid_id into current_bid_id from public.samples where id=p_sample_id for update;
  if not found then raise exception 'Sample not found.' using errcode='P0002'; end if;
  if current_bid_id is not null and current_bid_id<>p_bid_id then
    raise exception 'This Sample is already linked to another Bid.' using errcode='23505';
  end if;
  update public.samples set bid_id=p_bid_id where id=p_sample_id and bid_id is null;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('create_sample(uuid,uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> '41e36141987c6206b64dfc610cb0315b' then
   raise exception 'Intake gate: installed create_sample differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.create_sample(p_bid_id uuid DEFAULT NULL::uuid, p_job_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); linked_bid public.bids%rowtype; linked_job public.jobs%rowtype; defaults public.sample_formulation_defaults%rowtype; profile public.sample_formulation_profiles%rowtype; profile_json jsonb;
begin
 perform public.require_app_capability('readOperationalData'); select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
 if p_bid_id is not null then perform public.require_app_capability('accessIntake'); select * into strict linked_bid from public.bids where id=p_bid_id; end if; if p_job_id is not null then select * into strict linked_job from public.jobs where id=p_job_id; end if;
 select * into strict defaults from public.sample_formulation_defaults order by version desc limit 1; select * into strict profile from public.sample_formulation_profiles where is_default and is_active;
 profile_json:=jsonb_build_object('id',profile.id,'version',profile.version,'name',profile.display_name,'dryPoolOzPerCft',profile.dry_pool_oz_per_cft::text,'defaultChipDensityLbCft',profile.default_chip_density_lb_cft::text,'defaultFillerOzPerCft',profile.default_filler_oz_per_cft::text,'resinFlOzPerCft',profile.resin_fl_oz_per_cft::text,'resinParts',profile.resin_parts::text,'hardenerParts',profile.hardener_parts::text,'evidence',profile.evidence);
 insert into public.samples(id,bid_id,job_id,requested_by,project_name,prepared_by,customer_name,formulation_state,created_by_user_id) values(created_id,p_bid_id,p_job_id,'',coalesce(linked_bid.project_name,linked_job.name,''),actor.display_name,coalesce(linked_bid.customer,linked_job.customer,''),public.normalize_sample_formulation(jsonb_build_object('basis','weight_per_sf','weightUnit','lb','finishedPlateWidth',defaults.finished_plate_width,'finishedPlateLength',defaults.finished_plate_length,'finishedPlateQuantity',defaults.finished_plate_quantity,'thicknessIn',defaults.thickness_in,'length',defaults.pour_length,'width',defaults.pour_width,'dimensionUnit',defaults.dimension_unit,'materialDensity',profile.default_chip_density_lb_cft,'weightPerSf','','weightPerSfProvenance','calculated','chipDensityProvenance','profile_default','resinParts',profile.resin_parts,'hardenerParts',profile.hardener_parts,'ratioProvenance','default','ratioDefaultSource',profile.display_name,'supplierRatioDefaults',defaults.supplier_ratio_defaults,'defaultVersion',defaults.version,'calculationVersion','sample-formulation-v4-density-profile','profile',profile_json,'profileProvenance','default','fillerProvenance','profile_default','resinProvenance','profile_default','adjustment',null)),actor.user_id);
 insert into public.sample_blend_rows(sample_id,display_order,color,quantity,unit,component_role,calculation_basis,quantity_provenance) values(created_id,0,'',null,'oz','aggregate','target_total','calculated'),(created_id,1,'Filler',null,'oz','filler',null,'calculated'),(created_id,2,'Resin',null,'fl oz','resin',null,'calculated'),(created_id,3,'Hardener',null,'fl oz','hardener',null,'calculated'); return created_id;
end $function$
$replacement$;
end $guard$;

do $guard$
declare definition text;
begin
 select pg_get_functiondef('list_samples(uuid)'::regprocedure) into definition;
 if md5(regexp_replace(definition, '\s', '', 'g')) <> 'a1f0c80ea86d4928f98d2716f8b6d32d' then
   raise exception 'Intake gate: installed list_samples differs from reviewed Production definition';
 end if;
 execute $replacement$CREATE OR REPLACE FUNCTION public.list_samples(p_bid_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sample jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select to_jsonb(s)||jsonb_build_object(
    'creator_name',creator.display_name,
    'job_number',j.job_number,
    'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=s.id),
    'working_versions',(select coalesce(jsonb_agg(to_jsonb(version_data)||jsonb_build_object('saved_by_name',saver.display_name) order by version_data.version_number desc),'[]'::jsonb) from public.sample_working_versions version_data join public.app_users saver on saver.user_id=version_data.saved_by_user_id where version_data.sample_id=s.id),
    'issued_documents',(select coalesce(jsonb_agg(to_jsonb(document) order by document.issue_number desc),'[]'::jsonb) from public.sample_issued_documents document where document.sample_id=s.id)
  )
  from public.samples s join public.app_users creator on creator.user_id=s.created_by_user_id left join public.jobs j on j.id=s.job_id
  where public.has_app_capability('readOperationalData') and (p_bid_id is null or public.has_app_capability('accessIntake')) and (p_bid_id is null or s.bid_id=p_bid_id)
  order by s.updated_at desc,s.id
$function$
$replacement$;
end $guard$;

comment on policy intake_early_access on public.bids is 'Temporary accessIntake capability boundary. Widen through an approved role-capability migration and matching client role bundle.';
commit;
