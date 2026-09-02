-- PP-003: canonical Sample / Color Plate records and immutable issued Sample Work Orders.
-- Samples are independently valid without a Bid or Production Job.
begin;

create table public.samples (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid references public.bids(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  requested_by text not null default '' check(length(requested_by)<=200),
  requested_date date not null default current_date,
  project_name text not null default '' check(length(project_name)<=300),
  prepared_by text not null default '' check(length(prepared_by)<=200),
  customer_name text not null default '' check(length(customer_name)<=200),
  color_plate_number text check(color_plate_number is null or length(color_plate_number)<=80),
  finish_requested text not null default '' check(length(finish_requested)<=300),
  sample_size text not null default '' check(length(sample_size)<=100),
  sample_quantity text not null default '' check(length(sample_quantity)<=100),
  notes text not null default '' check(length(notes)<=20000),
  filler text not null default '' check(length(filler)<=300),
  sealer text not null default '' check(length(sealer)<=300),
  resin_supplier text not null default '' check(length(resin_supplier)<=300),
  resin_color_number text not null default '' check(length(resin_color_number)<=300),
  more_notes text not null default '' check(length(more_notes)<=20000),
  approved_date date,
  created_by_user_id uuid not null references public.app_users(user_id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index samples_bid_updated_idx on public.samples(bid_id,updated_at desc) where bid_id is not null;
create index samples_job_updated_idx on public.samples(job_id,updated_at desc) where job_id is not null;

create table public.sample_blend_rows (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  display_order integer not null check(display_order>=0),
  percentage numeric(8,3) check(percentage is null or percentage between 0 and 100),
  color text not null default '' check(length(color)<=300),
  size text not null default '' check(length(size)<=120),
  material_type text not null default '' check(length(material_type)<=200),
  quantity numeric(14,4) check(quantity is null or quantity>=0),
  unit text not null default '' check(length(unit)<=80),
  vendor text not null default '' check(length(vendor)<=300),
  catalog_source text check(catalog_source is null or catalog_source in('standard','specialty')),
  catalog_item_id text,
  catalog_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(catalog_snapshot)='object'),
  unique(sample_id,display_order),
  check((catalog_source is null and catalog_item_id is null) or (catalog_source is not null and nullif(btrim(catalog_item_id),'') is not null))
);

create table public.sample_issued_documents (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete restrict,
  issue_number integer not null check(issue_number>0),
  issued_snapshot jsonb not null check(jsonb_typeof(issued_snapshot)='object'),
  issued_by_user_id uuid not null references public.app_users(user_id),
  issued_at timestamptz not null default clock_timestamp(),
  storage_bucket text not null default 'sample-documents' check(storage_bucket='sample-documents'),
  storage_path text not null default '',
  snapshot_hash text not null default '',
  document_version text not null default 'sample-work-order-pdf-v1',
  generation_status text not null default 'pending' check(generation_status in('pending','generating','generated','failed')),
  generated_at timestamptz,
  last_error text,
  unique(sample_id,issue_number)
);

create function public.sample_issued_document_snapshot_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if row(new.sample_id,new.issue_number,new.issued_snapshot,new.issued_by_user_id,new.issued_at)
    is distinct from row(old.sample_id,old.issue_number,old.issued_snapshot,old.issued_by_user_id,old.issued_at)
  then raise exception 'Issued Sample Form snapshots are immutable.' using errcode='55000'; end if;
  return new;
end $$;
create trigger sample_issued_document_snapshot_immutable before update on public.sample_issued_documents for each row execute function public.sample_issued_document_snapshot_immutable();

create trigger samples_touch_updated_at before update on public.samples for each row execute function public.tenops_touch_updated_at();
alter table public.samples enable row level security;
alter table public.sample_blend_rows enable row level security;
alter table public.sample_issued_documents enable row level security;
revoke all on public.samples,public.sample_blend_rows,public.sample_issued_documents from public,anon,authenticated;
grant select on public.samples,public.sample_blend_rows,public.sample_issued_documents to authenticated;
grant all on public.samples,public.sample_blend_rows,public.sample_issued_documents to service_role;
create policy samples_operational_select on public.samples for select to authenticated using(public.has_app_capability('readOperationalData'));
create policy sample_blend_rows_operational_select on public.sample_blend_rows for select to authenticated using(public.has_app_capability('readOperationalData'));
create policy sample_issued_documents_operational_select on public.sample_issued_documents for select to authenticated using(public.has_app_capability('readOperationalData'));

create function public.list_samples(p_bid_id uuid default null)
returns table(sample jsonb) language sql stable security definer set search_path=pg_catalog,public as $$
  select to_jsonb(s)||jsonb_build_object(
    'creator_name',creator.display_name,
    'job_number',j.job_number,
    'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=s.id),
    'issued_documents',(select coalesce(jsonb_agg(to_jsonb(document) order by document.issue_number desc),'[]'::jsonb) from public.sample_issued_documents document where document.sample_id=s.id)
  )
  from public.samples s
  join public.app_users creator on creator.user_id=s.created_by_user_id
  left join public.jobs j on j.id=s.job_id
  where public.has_app_capability('readOperationalData') and (p_bid_id is null or s.bid_id=p_bid_id)
  order by s.updated_at desc,s.id
$$;

create function public.create_sample(p_bid_id uuid default null,p_job_id uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); linked_bid public.bids%rowtype; linked_job public.jobs%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  if p_bid_id is not null then select * into strict linked_bid from public.bids where id=p_bid_id; end if;
  if p_job_id is not null then select * into strict linked_job from public.jobs where id=p_job_id; end if;
  insert into public.samples(id,bid_id,job_id,requested_by,project_name,prepared_by,customer_name,created_by_user_id)
  values(created_id,p_bid_id,p_job_id,'',coalesce(linked_bid.project_name,linked_job.name,''),actor.display_name,coalesce(linked_bid.customer,linked_job.customer,''),actor.user_id);
  insert into public.sample_blend_rows(sample_id,display_order) values(created_id,0);
  return created_id;
end $$;

create function public.save_sample_draft(p_sample jsonb,p_rows jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_id uuid:=(p_sample->>'id')::uuid; color_plate text:=nullif(upper(btrim(coalesce(p_sample->>'color_plate_number',''))),'');
begin
  perform public.require_app_capability('readOperationalData');
  perform 1 from public.app_users where user_id=auth.uid() and is_active;
  if not found then raise exception 'Active operational access is required.' using errcode='42501'; end if;
  if not exists(select 1 from public.samples where id=target_id for update) then raise exception 'Sample not found.' using errcode='P0002'; end if;
  if color_plate is not null and color_plate !~ '^T[0-9]{2}-[0-9]{3}[A-Z]$' then raise exception 'New Color Plate numbers must use TYY-NNNL format, for example T26-123A.' using errcode='22023'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 then raise exception 'Invalid Chip Blend rows.' using errcode='22023'; end if;
  if nullif(p_sample->>'bid_id','') is not null and not exists(select 1 from public.bids where id=(p_sample->>'bid_id')::uuid) then raise exception 'Bid not found.' using errcode='P0002'; end if;
  if nullif(p_sample->>'job_id','') is not null and not exists(select 1 from public.jobs where id=(p_sample->>'job_id')::uuid) then raise exception 'Production Job not found.' using errcode='P0002'; end if;
  update public.samples set
    bid_id=nullif(p_sample->>'bid_id','')::uuid,job_id=nullif(p_sample->>'job_id','')::uuid,
    requested_by=left(coalesce(p_sample->>'requested_by',''),200),requested_date=coalesce(nullif(p_sample->>'requested_date','')::date,current_date),
    project_name=left(coalesce(p_sample->>'project_name',''),300),prepared_by=left(coalesce(p_sample->>'prepared_by',''),200),customer_name=left(coalesce(p_sample->>'customer_name',''),200),
    color_plate_number=color_plate,finish_requested=left(coalesce(p_sample->>'finish_requested',''),300),sample_size=left(coalesce(p_sample->>'sample_size',''),100),sample_quantity=left(coalesce(p_sample->>'sample_quantity',''),100),
    notes=left(coalesce(p_sample->>'notes',''),20000),filler=left(coalesce(p_sample->>'filler',''),300),sealer=left(coalesce(p_sample->>'sealer',''),300),resin_supplier=left(coalesce(p_sample->>'resin_supplier',''),300),resin_color_number=left(coalesce(p_sample->>'resin_color_number',''),300),more_notes=left(coalesce(p_sample->>'more_notes',''),20000),approved_date=nullif(p_sample->>'approved_date','')::date
  where id=target_id;
  delete from public.sample_blend_rows where sample_id=target_id;
  insert into public.sample_blend_rows(sample_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot)
  select target_id,ordinality-1,nullif(row_data->>'percentage','')::numeric,left(coalesce(row_data->>'color',''),300),left(coalesce(row_data->>'size',''),120),left(coalesce(row_data->>'material_type',''),200),nullif(row_data->>'quantity','')::numeric,left(coalesce(row_data->>'unit',''),80),left(coalesce(row_data->>'vendor',''),300),nullif(row_data->>'catalog_source',''),nullif(row_data->>'catalog_item_id',''),coalesce(row_data->'catalog_snapshot','{}'::jsonb)
  from jsonb_array_elements(p_rows) with ordinality as rows(row_data,ordinality);
end $$;

create function public.duplicate_sample(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; created_id uuid:=gen_random_uuid(); source public.samples%rowtype;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict source from public.samples where id=p_sample_id;
  insert into public.samples(id,bid_id,job_id,requested_by,requested_date,project_name,prepared_by,customer_name,color_plate_number,finish_requested,sample_size,sample_quantity,notes,filler,sealer,resin_supplier,resin_color_number,more_notes,approved_date,created_by_user_id)
  values(created_id,source.bid_id,source.job_id,source.requested_by,current_date,source.project_name,actor.display_name,source.customer_name,null,source.finish_requested,source.sample_size,source.sample_quantity,source.notes,source.filler,source.sealer,source.resin_supplier,source.resin_color_number,source.more_notes,null,actor.user_id);
  insert into public.sample_blend_rows(sample_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot)
  select created_id,display_order,percentage,color,size,material_type,quantity,unit,vendor,catalog_source,catalog_item_id,catalog_snapshot from public.sample_blend_rows where sample_id=p_sample_id order by display_order;
  return created_id;
end $$;

create function public.issue_sample_form(p_sample_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_users%rowtype; target public.samples%rowtype; issued_id uuid:=gen_random_uuid(); next_issue integer; snapshot jsonb;
begin
  perform public.require_app_capability('readOperationalData');
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict target from public.samples where id=p_sample_id for update;
  if btrim(target.project_name)='' or btrim(target.customer_name)='' or btrim(target.prepared_by)='' then raise exception 'Project, Customer, and Prepared By are required to issue a Sample Form.' using errcode='22023'; end if;
  select coalesce(max(issue_number),0)+1 into next_issue from public.sample_issued_documents where sample_id=p_sample_id;
  snapshot:=to_jsonb(target)||jsonb_build_object(
    'job_number',(select job_number from public.jobs where id=target.job_id),
    'blend_rows',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.display_order),'[]'::jsonb) from public.sample_blend_rows row_data where row_data.sample_id=target.id),
    'issue_number',next_issue,'issued_at',clock_timestamp(),'issued_by_name',actor.display_name
  );
  insert into public.sample_issued_documents(id,sample_id,issue_number,issued_snapshot,issued_by_user_id) values(issued_id,p_sample_id,next_issue,snapshot,actor.user_id);
  return issued_id;
end $$;

alter function public.list_samples(uuid) owner to postgres;
alter function public.create_sample(uuid,uuid) owner to postgres;
alter function public.save_sample_draft(jsonb,jsonb) owner to postgres;
alter function public.duplicate_sample(uuid) owner to postgres;
alter function public.issue_sample_form(uuid) owner to postgres;
revoke all on function public.list_samples(uuid),public.create_sample(uuid,uuid),public.save_sample_draft(jsonb,jsonb),public.duplicate_sample(uuid),public.issue_sample_form(uuid) from public,anon;
grant execute on function public.list_samples(uuid),public.create_sample(uuid,uuid),public.save_sample_draft(jsonb,jsonb),public.duplicate_sample(uuid),public.issue_sample_form(uuid) to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sample-documents','sample-documents',false,52428800,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy sample_document_storage_read on storage.objects for select to authenticated using(bucket_id='sample-documents' and public.has_app_capability('readOperationalData'));
create policy sample_document_storage_service on storage.objects for all to service_role using(bucket_id='sample-documents') with check(bucket_id='sample-documents');

comment on table public.samples is 'Canonical suffix-neutral Sample / Color Plate formulation records; Bid and Production Job context are optional.';
comment on table public.sample_issued_documents is 'Immutable issued Sample Work Order snapshots and generated PDF identity; later Sample edits never rewrite these snapshots.';
commit;
