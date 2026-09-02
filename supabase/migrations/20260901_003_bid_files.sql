-- PP-001 follow-up: canonical private working files related to Pre-Production Bids.
-- This migration does not create Production relationships or copy file bytes.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'bid-files','bid-files',false,26214400,
  array[
    'image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',
    'application/pdf','application/octet-stream','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.canonical_files(
  id uuid primary key default gen_random_uuid(),
  uploader_user_id uuid not null references public.app_users(user_id),
  storage_bucket text not null default 'bid-files' check(storage_bucket='bid-files'),
  storage_path text not null unique,
  original_filename text not null check(length(btrim(original_filename)) between 1 and 500),
  content_type text not null default 'application/octet-stream' check(length(content_type)<=255),
  byte_size bigint not null check(byte_size between 0 and 26214400),
  lifecycle_state text not null default 'uploading' check(lifecycle_state in ('uploading','ready')),
  created_at timestamptz not null default clock_timestamp()
);

create table public.bid_file_relationships(
  bid_id uuid not null references public.bids(id) on delete restrict,
  file_id uuid not null references public.canonical_files(id) on delete restrict,
  relationship_state text not null default 'uploading' check(relationship_state in ('uploading','active','removal_pending')),
  created_at timestamptz not null default clock_timestamp(),
  primary key(bid_id,file_id)
);

create index bid_file_relationships_file_idx on public.bid_file_relationships(file_id,bid_id);
alter table public.canonical_files enable row level security;
alter table public.bid_file_relationships enable row level security;
revoke all on public.canonical_files,public.bid_file_relationships from public,anon,authenticated;
grant select on public.canonical_files,public.bid_file_relationships to authenticated;
grant all on public.canonical_files,public.bid_file_relationships to service_role;

create policy canonical_files_operational_select on public.canonical_files for select to authenticated using(
  public.has_app_capability('readOperationalData')
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
);
create policy bid_file_relationships_operational_select on public.bid_file_relationships for select to authenticated using(
  public.has_app_capability('readOperationalData')
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
);

alter table public.bid_activity drop constraint bid_activity_activity_type_check;
alter table public.bid_activity add constraint bid_activity_activity_type_check check(activity_type in(
  'created','details_updated','owner_changed','status_changed','deposit_received_changed',
  'contact_changed','notes_changed','file_added','file_removed'
));

create policy bid_file_object_select on storage.objects for select to authenticated using(
  bucket_id='bid-files'
  and public.has_app_capability('readOperationalData')
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.canonical_files file
    join public.bid_file_relationships relationship on relationship.file_id=file.id
    where file.storage_path=name and file.lifecycle_state='ready' and relationship.relationship_state in('active','removal_pending')
  )
);

create policy bid_file_object_insert on storage.objects for insert to authenticated with check(
  bucket_id='bid-files'
  and public.has_app_capability('readOperationalData')
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.canonical_files file
    join public.bid_file_relationships relationship on relationship.file_id=file.id
    where file.storage_path=name and file.lifecycle_state='uploading'
      and relationship.relationship_state='uploading' and file.uploader_user_id=auth.uid()
  )
);

create policy bid_file_object_delete on storage.objects for delete to authenticated using(
  bucket_id='bid-files'
  and public.has_app_capability('readOperationalData')
  and exists(select 1 from public.app_users actor where actor.user_id=auth.uid() and actor.is_active)
  and exists(
    select 1 from public.canonical_files file
    join public.bid_file_relationships relationship on relationship.file_id=file.id
    where file.storage_path=name and (
      (file.lifecycle_state='uploading' and relationship.relationship_state='uploading' and file.uploader_user_id=auth.uid())
      or relationship.relationship_state='removal_pending'
    )
  )
);

create function public.list_bid_files(p_bid_id uuid)
returns table(id uuid,bid_id uuid,uploader_user_id uuid,uploader_name text,storage_path text,original_filename text,content_type text,byte_size bigint,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select file.id,relationship.bid_id,file.uploader_user_id,uploader.display_name,file.storage_path,file.original_filename,file.content_type,file.byte_size,file.created_at
  from public.canonical_files file
  join public.bid_file_relationships relationship on relationship.file_id=file.id
  join public.app_users uploader on uploader.user_id=file.uploader_user_id
  where public.has_app_capability('readOperationalData') and relationship.bid_id=p_bid_id
    and file.lifecycle_state='ready' and relationship.relationship_state='active'
  order by file.created_at desc,file.id desc
$$;

create function public.begin_bid_file_upload(p_bid_id uuid,p_original_filename text,p_content_type text,p_byte_size bigint)
returns table(file_id uuid,storage_path text)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); created_path text;
begin
  perform public.require_app_capability('readOperationalData');
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
end $$;

create function public.abort_bid_file_upload(p_file_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.canonical_files where id=p_file_id and lifecycle_state='uploading' and uploader_user_id=actor.user_id for update;
  if exists(select 1 from storage.objects object where object.bucket_id=target.storage_bucket and object.name=target.storage_path) then
    raise exception 'Uploaded bytes must be removed before aborting file metadata.' using errcode='55000';
  end if;
  delete from public.bid_file_relationships where file_id=target.id and relationship_state='uploading';
  delete from public.canonical_files where id=target.id;
end $$;

create function public.finalize_bid_file_upload(p_file_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype; target_bid_id uuid; object_size bigint;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.canonical_files where id=p_file_id and lifecycle_state='uploading' and uploader_user_id=actor.user_id for update;
  select bid_id into strict target_bid_id from public.bid_file_relationships where file_id=target.id and relationship_state='uploading' for update;
  select nullif(object.metadata->>'size','')::bigint into strict object_size from storage.objects object where object.bucket_id=target.storage_bucket and object.name=target.storage_path;
  if object_size is distinct from target.byte_size then raise exception 'Uploaded byte size does not match file metadata.' using errcode='22000'; end if;
  update public.canonical_files set lifecycle_state='ready' where id=target.id;
  update public.bid_file_relationships set relationship_state='active' where bid_id=target_bid_id and file_id=target.id;
  insert into public.bid_activity(bid_id,activity_type,actor_user_id,details)
  values(target_bid_id,'file_added',actor.user_id,jsonb_build_object('file_id',target.id));
end $$;

create function public.prepare_bid_file_removal(p_bid_id uuid,p_file_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target_path text;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select file.storage_path into strict target_path
  from public.canonical_files file join public.bid_file_relationships relationship on relationship.file_id=file.id
  where file.id=p_file_id and relationship.bid_id=p_bid_id and file.lifecycle_state='ready' and relationship.relationship_state='active' for update of relationship;
  update public.bid_file_relationships set relationship_state='removal_pending' where bid_id=p_bid_id and file_id=p_file_id;
  return target_path;
end $$;

create function public.cancel_bid_file_removal(p_bid_id uuid,p_file_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.require_app_capability('readOperationalData');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active user is required.' using errcode='42501'; end if;
  update public.bid_file_relationships set relationship_state='active'
  where bid_id=p_bid_id and file_id=p_file_id and relationship_state='removal_pending';
  if not found then raise exception 'Pending Bid File removal was not found.' using errcode='P0002'; end if;
end $$;

create function public.finalize_bid_file_removal(p_bid_id uuid,p_file_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.canonical_files%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
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
end $$;

alter function public.list_bid_files(uuid) owner to postgres;
alter function public.begin_bid_file_upload(uuid,text,text,bigint) owner to postgres;
alter function public.abort_bid_file_upload(uuid) owner to postgres;
alter function public.finalize_bid_file_upload(uuid) owner to postgres;
alter function public.prepare_bid_file_removal(uuid,uuid) owner to postgres;
alter function public.cancel_bid_file_removal(uuid,uuid) owner to postgres;
alter function public.finalize_bid_file_removal(uuid,uuid) owner to postgres;
revoke all on function public.list_bid_files(uuid) from public,anon;
revoke all on function public.begin_bid_file_upload(uuid,text,text,bigint) from public,anon;
revoke all on function public.abort_bid_file_upload(uuid) from public,anon;
revoke all on function public.finalize_bid_file_upload(uuid) from public,anon;
revoke all on function public.prepare_bid_file_removal(uuid,uuid) from public,anon;
revoke all on function public.cancel_bid_file_removal(uuid,uuid) from public,anon;
revoke all on function public.finalize_bid_file_removal(uuid,uuid) from public,anon;
grant execute on function public.list_bid_files(uuid) to authenticated,service_role;
grant execute on function public.begin_bid_file_upload(uuid,text,text,bigint) to authenticated,service_role;
grant execute on function public.abort_bid_file_upload(uuid) to authenticated,service_role;
grant execute on function public.finalize_bid_file_upload(uuid) to authenticated,service_role;
grant execute on function public.prepare_bid_file_removal(uuid,uuid) to authenticated,service_role;
grant execute on function public.cancel_bid_file_removal(uuid,uuid) to authenticated,service_role;
grant execute on function public.finalize_bid_file_removal(uuid,uuid) to authenticated,service_role;

comment on table public.canonical_files is 'Canonical private file metadata. Domain relationships reference the same file ID and Storage bytes without copying.';
comment on table public.bid_file_relationships is 'Historical relationship between a canonical Bid and an ordinary working file.';
commit;
