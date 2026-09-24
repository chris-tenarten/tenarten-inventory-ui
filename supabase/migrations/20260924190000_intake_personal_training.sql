-- Prepared locally only. Requires the reviewed Intake view-access migration.
-- Personal TEST authority is data-driven; labels never grant access.
begin;
create table public.intake_training_grants (
 user_id uuid primary key references public.app_users(user_id),
 capability text not null default 'managePersonalIntakeTest' check(capability='managePersonalIntakeTest'),
 granted_at timestamptz not null default clock_timestamp()
);
create table public.intake_training_workflows (
 owner_user_id uuid primary key references public.app_users(user_id),
 bid_id uuid not null unique references public.bids(id) on delete restrict,
 job_id uuid unique references public.jobs(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.intake_training_grants enable row level security;
alter table public.intake_training_workflows enable row level security;
revoke all on public.intake_training_grants,public.intake_training_workflows from public,anon,authenticated;
grant select on public.intake_training_workflows to authenticated;
create policy training_read on public.intake_training_workflows for select to authenticated using(public.has_app_capability('viewIntake'));
-- Resolve the reviewed existing identities once, never in application predicates.
do $$declare n text; uid uuid;begin
 foreach n in array array['Patrick Soldow','Giovanni Coppola','Anthony Iorio'] loop
  if (select count(*) from public.app_users where display_name=n and is_active)<>1 then raise exception 'Training identity must resolve uniquely: %',n;end if;
  select user_id into strict uid from public.app_users where display_name=n and is_active;
  insert into public.intake_training_grants(user_id) values(uid);
 end loop;
end$$;
create function public.has_intake_training_access() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.intake_training_grants g join public.app_users u on u.user_id=g.user_id where u.user_id=auth.uid() and u.is_active)
$$;
create function public.owns_intake_training_bid(p_bid_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.has_intake_training_access() and exists(select 1 from public.intake_training_workflows where bid_id=p_bid_id and owner_user_id=auth.uid())
$$;
create function public.require_bid_management(p_bid_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not (public.has_app_capability('accessIntake') or public.owns_intake_training_bid(p_bid_id)) then raise exception 'Intake management denied.' using errcode='42501';end if;
 -- Serialize lifecycle operations against reset/conversion.
 perform 1 from public.bids where id=p_bid_id for update;
 if not found then raise exception 'Bid not found.' using errcode='P0002';end if;
end$$;
create function public.require_bid_file_management(p_file_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare bid uuid;begin
 select bid_id into strict bid from public.bid_file_relationships where file_id=p_file_id;
 perform public.require_bid_management(bid);
end$$;
create function public.create_personal_test_bid() returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare created uuid:=gen_random_uuid();actor public.app_users%rowtype;begin
 if not public.has_intake_training_access() then raise exception 'Personal Intake training is not enabled.' using errcode='42501';end if;
 select * into strict actor from public.app_users where user_id=auth.uid() and is_active for update;
 if exists(select 1 from public.intake_training_workflows where owner_user_id=actor.user_id) then raise exception 'Open or reset your existing TEST Bid first.' using errcode='23505';end if;
 insert into public.bids(id,customer,project_name,creator_user_id,owner_user_id) values(created,'TEST — Fictional Customer','TEST — '||actor.display_name||' training',actor.user_id,actor.user_id);
 insert into public.intake_training_workflows(owner_user_id,bid_id) values(actor.user_id,created);
 insert into public.bid_activity(bid_id,activity_type,actor_user_id,details) values(created,'created',actor.user_id,jsonb_build_object('personal_training',true));
 return created;
end$$;
create function public.protect_training_bid_identity() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare owner_id uuid;begin
 select owner_user_id into owner_id from public.intake_training_workflows where bid_id=old.id;
 if found then
  if new.id<>old.id or new.creator_user_id<>old.creator_user_id or new.owner_user_id<>owner_id then raise exception 'Personal TEST identity/owner cannot change.' using errcode='42501';end if;
  if new.project_name not like 'TEST — %' then new.project_name:='TEST — '||new.project_name;end if;
 end if;return new;
end$$;
create trigger protect_training_bid_identity before update on public.bids for each row execute function public.protect_training_bid_identity();

-- Direct deletion must use dependency-aware RPCs, never permissive legacy policies.
revoke delete on public.jobs from anon,authenticated;
revoke select,insert,update on public.jobs from anon;
-- Preserve existing authenticated normal-Job INSERT/UPDATE grants and policies.
-- Ordinary Production authority also applies to TEST Jobs. Training authority is
-- an additional scoped path in conversion/reset RPCs, never a replacement for it.
create function public.guard_production_training_update() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare w public.intake_training_workflows%rowtype;begin
 select * into w from public.intake_training_workflows where job_id=old.id;
 -- Normal Jobs retain their exact existing update authorization and behavior.
 if not found then return new;end if;
 if auth.role()='service_role' then return new;end if;
 -- Labels do not grant authority; keep the protected TEST identity conspicuous.
 if new.id<>old.id or new.job_number is distinct from old.job_number then raise exception 'TEST Job identity is immutable.' using errcode='42501';end if;
 if new.name not like 'TEST — %' then new.name:='TEST — '||new.name;end if;
 return new;
end$$;
create trigger guard_production_training_update before update on public.jobs for each row execute function public.guard_production_training_update();

-- Storage retains the existing upload/removal lifecycle policies. Only the narrow
-- restrictive write condition grows to recognize an exclusively owned TEST file.
create function public.can_manage_intake_storage(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.has_app_capability('accessIntake') or exists(
 select 1 from public.canonical_files f join public.bid_file_relationships r on r.file_id=f.id
 where f.storage_bucket='bid-files' and f.storage_path=p_path and public.owns_intake_training_bid(r.bid_id)
 and not exists(select 1 from public.bid_file_relationships other where other.file_id=f.id and other.bid_id<>r.bid_id))
$$;
alter policy intake_manage_insert on storage.objects with check(bucket_id<>'bid-files' or public.can_manage_intake_storage(name));
alter policy intake_manage_update on storage.objects using(bucket_id<>'bid-files' or public.can_manage_intake_storage(name)) with check(bucket_id<>'bid-files' or public.can_manage_intake_storage(name));
alter policy intake_manage_delete on storage.objects using(bucket_id<>'bid-files' or public.can_manage_intake_storage(name));

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('abort_bid_file_upload(uuid)'::regprocedure),'\s','','g'))<>'e21da3d69ce4d3cb3fc2f665c2521965' then raise exception 'Training migration function drift: abort_bid_file_upload';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.abort_bid_file_upload(p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype;
begin
  perform public.require_bid_file_management(p_file_id);
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.canonical_files where id=p_file_id and lifecycle_state='uploading' and uploader_user_id=actor.user_id for update;
  if exists(select 1 from storage.objects object where object.bucket_id=target.storage_bucket and object.name=target.storage_path) then
    raise exception 'Uploaded bytes must be removed before aborting file metadata.' using errcode='55000';
  end if;
  delete from public.bid_file_relationships where file_id=target.id and relationship_state='uploading';
  delete from public.canonical_files where id=target.id;
end $function$
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('begin_bid_file_upload(uuid,text,text,bigint)'::regprocedure),'\s','','g'))<>'e3dc27276000bcff06e145937ad5f7f1' then raise exception 'Training migration function drift: begin_bid_file_upload';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.begin_bid_file_upload(p_bid_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint)
 RETURNS TABLE(file_id uuid, storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); created_path text;
begin
  perform public.require_bid_management(p_bid_id);
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
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('cancel_bid_file_removal(uuid,uuid)'::regprocedure),'\s','','g'))<>'d13b5ddcb53ed9f2c1b33e0e516e8e1f' then raise exception 'Training migration function drift: cancel_bid_file_removal';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.cancel_bid_file_removal(p_bid_id uuid, p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.require_bid_management(p_bid_id);
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active user is required.' using errcode='42501'; end if;
  update public.bid_file_relationships set relationship_state='active'
  where bid_id=p_bid_id and file_id=p_file_id and relationship_state='removal_pending';
  if not found then raise exception 'Pending Bid File removal was not found.' using errcode='P0002'; end if;
end $function$
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('convert_bid_to_production(uuid,timestamp with time zone,text,date,date,text)'::regprocedure),'\s','','g'))<>'7b934cd23b0f3f676509bd5a7a3fa6d6' then raise exception 'Training migration function drift: convert_bid_to_production';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.convert_bid_to_production(p_bid_id uuid, p_expected_updated_at timestamp with time zone, p_window_choice text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_job_number text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare b public.bids%rowtype; actor public.app_users%rowtype; j public.jobs%rowtype;
  next_start date; next_end date;
begin
  perform public.require_bid_management(p_bid_id);
  if not public.owns_intake_training_bid(p_bid_id) then perform public.require_app_capability('createProductionJob');end if;
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict b from public.bids where id=p_bid_id for update;
  -- Serializing on the Bid makes retry after an uncertain response return the same Job.
  if b.production_job_id is not null then return b.production_job_id; end if;
  if b.updated_at is distinct from p_expected_updated_at then raise exception 'This Bid changed. Refresh before converting it.' using errcode='40001'; end if;
  if exists(select 1 from public.bid_file_relationships where bid_id=b.id and relationship_state='removal_pending') then raise exception 'Finish or cancel Bid file cleanup before conversion.' using errcode='55000'; end if;
  if b.status <> 'won' or b.deposit_received_date is null then raise exception 'Conversion requires Won and a recorded Deposit Received Date.' using errcode='22023'; end if;
  if p_window_choice='carry' then
    next_start:=b.projected_production_start; next_end:=b.projected_production_end;
    if next_start is null then raise exception 'No projected window is available to carry forward.' using errcode='22023'; end if;
  elsif p_window_choice='new' then
    next_start:=p_start; next_end:=p_end;
    if next_start is null or next_end is null then raise exception 'Both new Production dates are required.' using errcode='22023'; end if;
  elsif p_window_choice='unscheduled' then
    if p_start is not null or p_end is not null then raise exception 'Unscheduled conversion cannot include Production dates.' using errcode='22023'; end if;
  else raise exception 'Choose Carry Forward, Set New Dates, or Plan in Production Later.' using errcode='22023'; end if;
  if next_end < next_start then raise exception 'Production end must not precede start.' using errcode='22023'; end if;
  if next_start is not null and not public.owns_intake_training_bid(p_bid_id) then perform public.require_app_capability('scheduleProduction'); end if;
  if exists(select 1 from public.intake_training_workflows where bid_id=p_bid_id) and nullif(btrim(p_job_number),'') is not null then raise exception 'TEST Job identifiers are assigned separately; leave the Job number blank.' using errcode='22023';end if;

  -- No number allocation, fake Job identity, document rewriting or implicit phase creation.
  insert into public.jobs(name,customer,job_number,deposit_date)
    values(b.project_name,b.customer,case when exists(select 1 from public.intake_training_workflows where bid_id=p_bid_id) then 'TEST-'||p_bid_id::text else nullif(btrim(p_job_number),'') end,b.deposit_received_date) returning * into j;
  update public.intake_training_workflows set job_id=j.id where bid_id=p_bid_id;
  insert into public.job_activity(job_id,event_type,summary,actor_name,metadata)
    values(j.id,'job_created','Job created from Intake Bid',actor.display_name,jsonb_build_object('source_bid_id',b.id));
  if next_start is not null then
    perform public.save_production_schedule_batch(jsonb_build_array(jsonb_build_object(
      'job_id',j.id,'original_planned_start',null,'original_planned_end',null,'original_updated_at',j.updated_at,
      'proposed_planned_start',next_start,'proposed_planned_end',next_end,'change_source','production_inspector'
    )),actor.display_name,'Initial schedule explicitly confirmed during Intake conversion',gen_random_uuid());
  end if;
  update public.bids set production_job_id=j.id,converted_by_user_id=actor.user_id,converted_at=clock_timestamp() where id=b.id;
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details) values(b.id,'converted_to_job',actor.user_id,
    jsonb_build_object('job_id',j.id,'window_choice',p_window_choice,'projected_start',b.projected_production_start,
      'projected_end',b.projected_production_end,'production_start',next_start,'production_end',next_end));
  return j.id;
end $function$
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('create_bid_update(uuid,text)'::regprocedure),'\s','','g'))<>'227a4d902c26cf7fd077061fe87142f9' then raise exception 'Training migration function drift: create_bid_update';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.create_bid_update(p_bid_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); normalized_body text:=btrim(p_body);
begin
  perform public.require_bid_management(p_bid_id);
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  perform 1 from public.bids where id=p_bid_id;
  if not found then raise exception 'Bid was not found.' using errcode='P0002'; end if;
  if normalized_body='' then raise exception 'Update is required.' using errcode='22023'; end if;
  if length(normalized_body)>5000 then raise exception 'Update is too long.' using errcode='22023'; end if;
  insert into public.bid_updates(id,bid_id,author_user_id,body)
  values(created_id,p_bid_id,actor.user_id,normalized_body);
  return created_id;
end $function$
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('finalize_bid_file_removal(uuid,uuid)'::regprocedure),'\s','','g'))<>'14bee6ab085279230483a3aba985c60b' then raise exception 'Training migration function drift: finalize_bid_file_removal';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.finalize_bid_file_removal(p_bid_id uuid, p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype;
begin
  perform public.require_bid_management(p_bid_id);
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
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('finalize_bid_file_upload(uuid)'::regprocedure),'\s','','g'))<>'b246a5641c7d4915fb62f0db17b48113' then raise exception 'Training migration function drift: finalize_bid_file_upload';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.finalize_bid_file_upload(p_file_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype; target_bid_id uuid; object_size bigint;
begin
  perform public.require_bid_file_management(p_file_id);
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
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('prepare_bid_file_removal(uuid,uuid)'::regprocedure),'\s','','g'))<>'46859e3232c10dd89507a90482562981' then raise exception 'Training migration function drift: prepare_bid_file_removal';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.prepare_bid_file_removal(p_bid_id uuid, p_file_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare actor public.app_users%rowtype; target_path text;
begin
  perform public.require_bid_management(p_bid_id);
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select file.storage_path into strict target_path
  from public.canonical_files file join public.bid_file_relationships relationship on relationship.file_id=file.id
  where file.id=p_file_id and relationship.bid_id=p_bid_id and file.lifecycle_state='ready' and relationship.relationship_state='active' for update of relationship;
  update public.bid_file_relationships set relationship_state='removal_pending' where bid_id=p_bid_id and file_id=p_file_id;
  return target_path;
end $function$
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('set_bid_projected_window(uuid,date,date,timestamp with time zone)'::regprocedure),'\s','','g'))<>'47e36a007bc8c3273121b20091da176b' then raise exception 'Training migration function drift: set_bid_projected_window';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.set_bid_projected_window(p_bid_id uuid, p_start date, p_end date, p_expected_updated_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare b public.bids%rowtype; actor uuid := auth.uid();
begin
  perform public.require_bid_management(p_bid_id);
  select * into strict b from public.bids where id=p_bid_id for update;
  if b.production_job_id is not null then raise exception 'Production scheduling is authoritative for this converted Bid.' using errcode='22023'; end if;
  if b.updated_at is distinct from p_expected_updated_at then raise exception 'This Bid changed. Refresh before changing its projected window.' using errcode='40001'; end if;
  if (p_start is null) <> (p_end is null) or p_end < p_start then raise exception 'Set both projected dates, with start on or before end, or clear both.' using errcode='22023'; end if;
  if row(b.projected_production_start,b.projected_production_end) is not distinct from row(p_start,p_end) then return; end if;
  update public.bids set projected_production_start=p_start,projected_production_end=p_end,
    projected_window_updated_by=actor,projected_window_updated_at=clock_timestamp() where id=p_bid_id;
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details) values(p_bid_id,'projected_window_changed',actor,
    jsonb_build_object('from_start',b.projected_production_start,'from_end',b.projected_production_end,'to_start',p_start,'to_end',p_end));
end $function$
;

-- Preserve installed signature, ownership and grants; refuse unreviewed function drift.
do $guard$begin if md5(regexp_replace(pg_get_functiondef('update_bid(uuid,text,text,uuid,text,date,text,text,text,text)'::regprocedure),'\s','','g'))<>'cf17a1070719bb2df7943c175d271410' then raise exception 'Training migration function drift: update_bid';end if;end$guard$;
CREATE OR REPLACE FUNCTION public.update_bid(p_bid_id uuid, p_customer text, p_project_name text, p_owner_user_id uuid, p_status text, p_deposit_received_date date, p_contact_name text, p_contact_email text, p_contact_phone text, p_notes text)
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
  perform public.require_bid_management(p_bid_id);
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
;

-- Block even future foreign-key dependencies by default, including CASCADE/SET NULL.
-- Only explicitly reviewed training-owned history may be removed.
create function public.assert_personal_test_cleanup(p_bid_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare w public.intake_training_workflows%rowtype;c record;occupied boolean;begin
 perform 1 from public.bids where id=p_bid_id for update;
 select * into strict w from public.intake_training_workflows where bid_id=p_bid_id for update;
 if not(public.has_app_capability('manageUsers') or public.owns_intake_training_bid(p_bid_id)) then raise exception 'Personal TEST cleanup denied.' using errcode='42501';end if;
 if exists(select 1 from public.samples where bid_id=p_bid_id) or exists(select 1 from public.bid_proposal_relationships where bid_id=p_bid_id) then raise exception 'TEST Bid has operational dependencies; Admin review required.' using errcode='55000';end if;
 if exists(select 1 from public.bid_file_relationships r join public.bid_file_relationships other on other.file_id=r.file_id and other.bid_id<>r.bid_id where r.bid_id=p_bid_id) then raise exception 'Shared files require Admin review.' using errcode='55000';end if;
 for c in select con.conrelid::regclass as rel,a.attname from pg_constraint con join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
  where con.contype='f' and con.confrelid='public.bids'::regclass and con.conrelid not in ('public.intake_training_workflows'::regclass,'public.bid_updates'::regclass,'public.bid_activity'::regclass,'public.bid_file_relationships'::regclass)
 loop
  execute format('select exists(select 1 from %s where %I=$1)',c.rel,c.attname) into occupied using p_bid_id;
  if occupied then raise exception 'TEST Bid has dependencies in %; Admin review required.',c.rel using errcode='55000';end if;
 end loop;
 if w.job_id is null then return;end if;
 perform 1 from public.jobs where id=w.job_id for update;
 if not exists(select 1 from public.bids where id=w.bid_id and production_job_id=w.job_id and converted_by_user_id is not null) then raise exception 'TEST conversion lineage is inconsistent.' using errcode='55000';end if;
 for c in select con.conrelid::regclass as rel, a.attname from pg_constraint con join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
  where con.contype='f' and con.confrelid='public.jobs'::regclass and con.conrelid not in ('public.intake_training_workflows'::regclass,'public.bids'::regclass,'public.job_activity'::regclass)
 loop
  execute format('select exists(select 1 from %s where %I=$1)',c.rel,c.attname) into occupied using w.job_id;
  if occupied then raise exception 'TEST Job has dependencies in %; Admin review required.',c.rel using errcode='55000';end if;
 end loop;
 if exists(select 1 from public.job_activity where job_id=w.job_id and not coalesce((
  (event_type='job_created' and metadata->>'source_bid_id'=p_bid_id::text)
  or (event_type='production_schedule_changed' and metadata->>'change_note'='Initial schedule explicitly confirmed during Intake conversion')
 ),false)) then raise exception 'TEST Job has additional activity; Admin review required.' using errcode='55000';end if;
 if exists(select 1 from public.production_schedule_batches s where s.request_proposals::text like '%'||w.job_id::text||'%' and (jsonb_array_length(s.request_proposals)<>1 or s.change_note is distinct from 'Initial schedule explicitly confirmed during Intake conversion')) then raise exception 'TEST Job has subsequent/shared schedule history; Admin review required.' using errcode='55000';end if;
end$$;
create function public.reset_personal_test_workflow(p_bid_id uuid,p_target text,p_confirmation text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare w public.intake_training_workflows%rowtype;begin
 perform public.assert_personal_test_cleanup(p_bid_id);
 select * into strict w from public.intake_training_workflows where bid_id=p_bid_id for update;
 if p_confirmation is distinct from 'DELETE TEST' then raise exception 'Type DELETE TEST to confirm.' using errcode='22023';end if;
 if p_target='job' then
  if w.job_id is null then raise exception 'No converted TEST Job exists.' using errcode='22023';end if;
  delete from public.production_schedule_batches where request_proposals::text like '%'||w.job_id::text||'%';
  delete from public.job_activity where job_id=w.job_id;
  update public.bids set production_job_id=null,converted_by_user_id=null,converted_at=null where id=p_bid_id;
  update public.intake_training_workflows set job_id=null where bid_id=p_bid_id;
  delete from public.jobs where id=w.job_id;
  insert into public.canonical_record_deletion_audit(record_type,deleted_record_id,actor_user_id,dependency_counts) values('production_job',w.job_id,auth.uid(),jsonb_build_object('personal_training_bid',p_bid_id));
 elsif p_target='bid' then
  if w.job_id is not null then raise exception 'Delete the converted TEST Job first.' using errcode='55000';end if;
  if exists(select 1 from public.bid_file_relationships where bid_id=p_bid_id) then raise exception 'Remove TEST attachments through Files before resetting this Bid.' using errcode='55000';end if;
  delete from public.bid_updates where bid_id=p_bid_id;
  delete from public.bid_activity where bid_id=p_bid_id;
  delete from public.intake_training_workflows where bid_id=p_bid_id;
  delete from public.bids where id=p_bid_id;
  insert into public.canonical_record_deletion_audit(record_type,deleted_record_id,actor_user_id,dependency_counts) values('bid',p_bid_id,auth.uid(),jsonb_build_object('personal_training',true));
 else raise exception 'Unsupported TEST cleanup target.' using errcode='22023';end if;
end$$;
-- Every new function has explicit exposure; no anonymous or PUBLIC execution.
do $$declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname=any(array['has_intake_training_access','owns_intake_training_bid','require_bid_management','require_bid_file_management','create_personal_test_bid','protect_training_bid_identity','guard_production_training_update','can_manage_intake_storage','assert_personal_test_cleanup','reset_personal_test_workflow']) loop
  execute format('alter function %s owner to postgres',f);
  execute format('revoke all on function %s from public,anon,authenticated',f);
 end loop;
end$$;
grant execute on function public.has_intake_training_access(),public.owns_intake_training_bid(uuid),public.can_manage_intake_storage(text),public.create_personal_test_bid(),public.assert_personal_test_cleanup(uuid),public.reset_personal_test_workflow(uuid,text,text) to authenticated;
grant all on public.intake_training_grants,public.intake_training_workflows to service_role;
commit;
