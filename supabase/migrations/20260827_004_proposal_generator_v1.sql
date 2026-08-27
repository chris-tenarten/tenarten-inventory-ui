-- Structured, Job-associated Proposal Generator V1.
begin;

create table public.proposal_access_users (
  user_id uuid primary key references public.app_users(user_id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by_user_id uuid references public.app_users(user_id)
);

insert into public.proposal_access_users(user_id)
select user_id from public.app_users
where is_active and split_part(lower(regexp_replace(btrim(display_name),'\s+',' ','g')),' ',1) in ('anthony','gio','giovanni')
on conflict do nothing;

create or replace function public.has_proposal_access()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.app_users u where u.user_id=auth.uid() and u.is_active and u.role='admin')
    or exists(select 1 from public.proposal_access_users g join public.app_users u on u.user_id=g.user_id where g.user_id=auth.uid() and u.is_active);
$$;
alter function public.has_proposal_access() owner to postgres;
revoke all on function public.has_proposal_access() from public,anon;
grant execute on function public.has_proposal_access() to authenticated,service_role;

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  lineage_id uuid not null,
  prior_proposal_id uuid references public.proposals(id) on delete restrict,
  estimate_base text not null check(btrim(estimate_base)<>''),
  version_major integer not null default 1 check(version_major>=0),
  version_minor integer not null default 0 check(version_minor>=0),
  estimate_number text not null unique,
  status text not null default 'draft' check(status in ('draft','issued')),
  proposal_date date not null default current_date,
  customer_name text not null default '', customer_address text not null default '', customer_contact text not null default '',
  project_name text not null default '', project_number text not null default '', project_location text not null default '',
  side_mark text not null default '', sales_rep text not null default '', terms text not null default '50% Dep / Net 30',
  valid_days integer not null default 30 check(valid_days between 1 and 365), requested_delivery text not null default '',
  fob text not null default 'Carrollton, TX', notes text not null default '', disclaimer_snapshot text not null default '',
  formula_snapshot text not null default '', proposal_field_sources jsonb not null default '{}'::jsonb, tax_enabled boolean not null default false, tax_rate numeric(8,5) not null default 0,
  subtotal numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  issued_snapshot jsonb, issued_at timestamptz, issued_by_user_id uuid references public.app_users(user_id),
  created_by_user_id uuid not null references public.app_users(user_id), created_by_name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(lineage_id,version_major,version_minor)
);

create table public.proposal_lines (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade,
  line_type text not null default 'product' check(line_type in ('product','charge','informational','included')),
  item_number text not null default '', description text not null default '', ref text not null default '', color_plate text not null default '',
  quantity numeric(14,4), unit text not null default '', length text not null default '', width text not null default '', height_thickness text not null default '',
  cft text not null default '', lf text not null default '', estimated_weight text not null default '', rate numeric(14,2), total numeric(14,2) not null default 0,
  source_metadata jsonb not null default '{}'::jsonb, display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.proposal_documents (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.proposals(id) on delete cascade,
  job_attachment_id uuid not null references public.job_attachments(id) on delete restrict,
  document_role text not null default 'shop_drawing' check(document_role='shop_drawing'), extraction_snapshot jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null default auth.uid() references public.app_users(user_id), created_at timestamptz not null default now(), unique(proposal_id,job_attachment_id)
);

create table public.proposal_pdf_documents (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null unique references public.proposals(id) on delete restrict,
  storage_bucket text not null default 'proposal-documents', storage_path text not null default '', snapshot_hash text not null default '',
  document_version text not null default 'proposal-pdf-v1', status text not null default 'pending' check(status in ('pending','generating','generated','failed')),
  generated_at timestamptz, last_error text, attempt_count integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create trigger proposals_touch_updated_at before update on public.proposals for each row execute function public.tenops_touch_updated_at();
create trigger proposal_lines_touch_updated_at before update on public.proposal_lines for each row execute function public.tenops_touch_updated_at();
create trigger proposal_pdf_documents_touch_updated_at before update on public.proposal_pdf_documents for each row execute function public.tenops_touch_updated_at();

create or replace function public.proposal_issued_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
  if old.status='issued' then raise exception 'Issued Proposals are immutable. Create a revision.' using errcode='55000'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger proposal_issued_immutable before update or delete on public.proposals for each row execute function public.proposal_issued_immutable();
create or replace function public.proposal_line_issued_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
  if exists(select 1 from public.proposals p where p.id=old.proposal_id and p.status='issued') then
    raise exception 'Issued Proposal lines are immutable. Create a revision.' using errcode='55000';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger proposal_line_issued_immutable before update or delete on public.proposal_lines for each row execute function public.proposal_line_issued_immutable();

alter table public.proposal_access_users enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_lines enable row level security;
alter table public.proposal_documents enable row level security;
alter table public.proposal_pdf_documents enable row level security;
create policy proposal_access_self on public.proposal_access_users for select to authenticated using(user_id=auth.uid() or public.has_app_capability('manageUsers'));
create policy proposal_authorized_all on public.proposals for all to authenticated using(public.has_proposal_access()) with check(public.has_proposal_access());
create policy proposal_lines_authorized_all on public.proposal_lines for all to authenticated using(public.has_proposal_access()) with check(public.has_proposal_access());
create policy proposal_documents_authorized_all on public.proposal_documents for all to authenticated using(public.has_proposal_access()) with check(public.has_proposal_access());
create policy proposal_pdf_authorized_read on public.proposal_pdf_documents for select to authenticated using(public.has_proposal_access());
grant select on public.proposal_access_users to authenticated;
grant select,insert,update,delete on public.proposals,public.proposal_lines,public.proposal_documents to authenticated;
grant select on public.proposal_pdf_documents to authenticated;
grant all on public.proposal_access_users,public.proposals,public.proposal_lines,public.proposal_documents,public.proposal_pdf_documents to service_role;

create or replace function public.create_job_proposal(p_job_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare j public.jobs%rowtype; created_id uuid:=gen_random_uuid(); base text; major integer:=1; minor integer:=0; number text;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  select * into strict j from public.jobs where id=p_job_id;
  if nullif(btrim(j.estimate_number),'') is not null and j.estimate_number ~ '^.+-[0-9]+\.[0-9]+$' then base:=regexp_replace(j.estimate_number,'-[0-9]+\.[0-9]+$',''); major:=split_part(regexp_replace(j.estimate_number,'^.*-([0-9]+\.[0-9]+)$','\1'),'.',1)::integer; minor:=split_part(regexp_replace(j.estimate_number,'^.*-([0-9]+\.[0-9]+)$','\1'),'.',2)::integer;
  else base:='Q'||to_char(current_date,'YY')||'-'||coalesce(nullif(regexp_replace(coalesce(j.job_number,''),'\D','','g'),''),to_char(current_date,'MMDD')); end if;
  number:=base||'-'||major||'.'||minor;
  if exists(select 1 from public.proposals where estimate_number=number) then raise exception 'A Proposal already exists for estimate %.',number using errcode='23505'; end if;
  insert into public.proposals(id,job_id,lineage_id,estimate_base,version_major,version_minor,estimate_number,customer_name,project_name,project_number,requested_delivery,sales_rep,created_by_user_id,created_by_name)
  values(created_id,j.id,created_id,base,major,minor,number,coalesce(j.customer,''),coalesce(j.name,''),coalesce(j.job_number,''),coalesce(j.requested_delivery_date::text,''),(select display_name from public.app_users where user_id=auth.uid()),auth.uid(),(select display_name from public.app_users where user_id=auth.uid()));
  insert into public.proposal_lines(proposal_id,item_number,description,color_plate,display_order) values(created_id,'1','',coalesce(j.color_plate_number,''),0);
  return created_id;
end $$;

create or replace function public.save_proposal_draft(p_proposal jsonb,p_lines jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare pid uuid:=(p_proposal->>'id')::uuid; subtotal_value numeric; tax_value numeric; total_value numeric;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  if not exists(select 1 from public.proposals where id=pid and status='draft') then raise exception 'Only Proposal drafts can be saved.' using errcode='55000'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>100 then raise exception 'Invalid Proposal lines.' using errcode='22023'; end if;
  subtotal_value:=coalesce((select sum(coalesce((line->>'total')::numeric,0)) from jsonb_array_elements(p_lines) line),0);
  tax_value:=case when coalesce((p_proposal->>'tax_enabled')::boolean,false) then round(subtotal_value*coalesce((p_proposal->>'tax_rate')::numeric,0)/100,2) else 0 end; total_value:=subtotal_value+tax_value;
  update public.proposals set proposal_date=(p_proposal->>'proposal_date')::date,customer_name=left(coalesce(p_proposal->>'customer_name',''),500),customer_address=left(coalesce(p_proposal->>'customer_address',''),2000),customer_contact=left(coalesce(p_proposal->>'customer_contact',''),1000),project_name=left(coalesce(p_proposal->>'project_name',''),500),project_number=left(coalesce(p_proposal->>'project_number',''),100),project_location=left(coalesce(p_proposal->>'project_location',''),500),side_mark=left(coalesce(p_proposal->>'side_mark',''),500),sales_rep=left(coalesce(p_proposal->>'sales_rep',''),200),terms=left(coalesce(p_proposal->>'terms',''),500),valid_days=coalesce((p_proposal->>'valid_days')::integer,30),requested_delivery=left(coalesce(p_proposal->>'requested_delivery',''),500),fob=left(coalesce(p_proposal->>'fob',''),500),notes=left(coalesce(p_proposal->>'notes',''),30000),disclaimer_snapshot=left(coalesce(p_proposal->>'disclaimer_snapshot',''),30000),formula_snapshot=left(coalesce(p_proposal->>'formula_snapshot',''),30000),proposal_field_sources=coalesce(p_proposal->'proposal_field_sources','{}'::jsonb),tax_enabled=coalesce((p_proposal->>'tax_enabled')::boolean,false),tax_rate=coalesce((p_proposal->>'tax_rate')::numeric,0),subtotal=subtotal_value,tax=tax_value,total=total_value where id=pid;
  delete from public.proposal_lines where proposal_id=pid;
  insert into public.proposal_lines(proposal_id,line_type,item_number,description,ref,color_plate,quantity,unit,length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,display_order)
  select pid,coalesce(nullif(line->>'line_type',''),'product'),coalesce(line->>'item_number',''),coalesce(line->>'description',''),coalesce(line->>'ref',''),coalesce(line->>'color_plate',''),nullif(line->>'quantity','')::numeric,coalesce(line->>'unit',''),coalesce(line->>'length',''),coalesce(line->>'width',''),coalesce(line->>'height_thickness',''),coalesce(line->>'cft',''),coalesce(line->>'lf',''),coalesce(line->>'estimated_weight',''),nullif(line->>'rate','')::numeric,coalesce((line->>'total')::numeric,0),coalesce(line->'source_metadata','{}'::jsonb),ordinality-1 from jsonb_array_elements(p_lines) with ordinality as valueset(line,ordinality);
end $$;

create or replace function public.issue_proposal(p_proposal_id uuid)
returns public.proposals language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.proposals; snapshot jsonb;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  select to_jsonb(p)||jsonb_build_object('lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.display_order),'[]'::jsonb) from public.proposal_lines l where l.proposal_id=p.id)) into snapshot from public.proposals p where p.id=p_proposal_id and p.status='draft' for update;
  if snapshot is null then raise exception 'Proposal draft not found.' using errcode='55000'; end if;
  if btrim(snapshot->>'customer_name')='' or not exists(select 1 from public.proposal_lines where proposal_id=p_proposal_id and btrim(description)<>'' and quantity is not null) then raise exception 'Customer and at least one described line with Quantity are required.' using errcode='22023'; end if;
  update public.proposals set status='issued',issued_snapshot=snapshot,issued_at=now(),issued_by_user_id=auth.uid() where id=p_proposal_id returning * into result;
  insert into public.proposal_pdf_documents(proposal_id,status) values(p_proposal_id,'pending'); return result;
end $$;

create or replace function public.create_proposal_revision(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.proposals; created_id uuid:=gen_random_uuid(); next_minor integer;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  select * into strict source from public.proposals where id=p_proposal_id and status='issued';
  select coalesce(max(version_minor),source.version_minor)+1 into next_minor from public.proposals where lineage_id=source.lineage_id and version_major=source.version_major;
  insert into public.proposals(id,job_id,lineage_id,prior_proposal_id,estimate_base,version_major,version_minor,estimate_number,status,proposal_date,customer_name,customer_address,customer_contact,project_name,project_number,project_location,side_mark,sales_rep,terms,valid_days,requested_delivery,fob,notes,disclaimer_snapshot,formula_snapshot,proposal_field_sources,tax_enabled,tax_rate,subtotal,tax,total,created_by_user_id,created_by_name)
  select created_id,job_id,lineage_id,id,estimate_base,version_major,next_minor,estimate_base||'-'||version_major||'.'||next_minor,'draft',current_date,customer_name,customer_address,customer_contact,project_name,project_number,project_location,side_mark,sales_rep,terms,valid_days,requested_delivery,fob,notes,disclaimer_snapshot,formula_snapshot,proposal_field_sources,tax_enabled,tax_rate,subtotal,tax,total,auth.uid(),(select display_name from public.app_users where user_id=auth.uid()) from public.proposals where id=source.id;
  insert into public.proposal_lines(proposal_id,line_type,item_number,description,ref,color_plate,quantity,unit,length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,display_order) select created_id,line_type,item_number,description,ref,color_plate,quantity,unit,length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,display_order from public.proposal_lines where proposal_id=source.id;
  return created_id;
end $$;

grant execute on function public.create_job_proposal(uuid),public.save_proposal_draft(jsonb,jsonb),public.issue_proposal(uuid),public.create_proposal_revision(uuid) to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('proposal-documents','proposal-documents',false,52428800,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy proposal_storage_read on storage.objects for select to authenticated using(bucket_id='proposal-documents' and public.has_proposal_access());
create policy proposal_storage_service on storage.objects for all to service_role using(bucket_id='proposal-documents') with check(bucket_id='proposal-documents');

commit;
