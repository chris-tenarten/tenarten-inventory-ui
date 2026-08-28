-- Proposal commercial defaults and structured quote-contact/tax destination fields.
alter table public.proposals
  add column if not exists destination_zip text not null default '',
  add column if not exists tax_county text not null default 'Dallas County',
  add column if not exists submitted_by_name text not null default 'Anthony Iorio',
  add column if not exists submitted_by_phone text not null default '469-491-7002',
  add column if not exists submitted_by_email text not null default 'sales@tenartenterrazzo.com';

alter table public.proposals alter column sales_rep set default 'House';

create or replace function public.create_job_proposal(p_job_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare j public.jobs%rowtype; created_id uuid:=gen_random_uuid(); base text; major integer:=1; minor integer:=0; number text;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  select * into strict j from public.jobs where id=p_job_id;
  if nullif(btrim(j.estimate_number),'') is not null and j.estimate_number ~ '^.+-[0-9]+\.[0-9]+$' then base:=regexp_replace(j.estimate_number,'-[0-9]+\.[0-9]+$',''); major:=split_part(regexp_replace(j.estimate_number,'^.*-([0-9]+\.[0-9]+)$','\1'),'.',1)::integer; minor:=split_part(regexp_replace(j.estimate_number,'^.*-([0-9]+\.[0-9]+)$','\1'),'.',2)::integer;
  else base:='Q'||coalesce(nullif(btrim(j.job_number),''),to_char(current_date,'YY-MMDD')); end if;
  number:=base||'-'||major||'.'||minor;
  if exists(select 1 from public.proposals where estimate_number=number) then raise exception 'A Proposal already exists for estimate %.',number using errcode='23505'; end if;
  insert into public.proposals(id,job_id,lineage_id,estimate_base,version_major,version_minor,estimate_number,customer_name,project_name,project_number,requested_delivery,sales_rep,tax_county,tax_rate,submitted_by_name,submitted_by_phone,submitted_by_email,created_by_user_id,created_by_name)
  values(created_id,j.id,created_id,base,major,minor,number,coalesce(j.customer,''),coalesce(j.name,''),coalesce(j.job_number,''),coalesce(j.requested_delivery_date::text,''),'House','Dallas County',8.25,'Anthony Iorio','469-491-7002','sales@tenartenterrazzo.com',auth.uid(),(select display_name from public.app_users where user_id=auth.uid()));
  insert into public.proposal_lines(proposal_id,item_number,description,color_plate,unit,display_order) values(created_id,'1','','','',0);
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
  update public.proposals set proposal_date=(p_proposal->>'proposal_date')::date,customer_name=left(coalesce(p_proposal->>'customer_name',''),500),customer_address=left(coalesce(p_proposal->>'customer_address',''),2000),customer_contact=left(coalesce(p_proposal->>'customer_contact',''),1000),project_name=left(coalesce(p_proposal->>'project_name',''),500),project_number=left(coalesce(p_proposal->>'project_number',''),100),project_location=left(coalesce(p_proposal->>'project_location',''),500),side_mark=left(coalesce(p_proposal->>'side_mark',''),500),sales_rep=left(coalesce(p_proposal->>'sales_rep',''),200),terms=left(coalesce(p_proposal->>'terms',''),500),valid_days=coalesce((p_proposal->>'valid_days')::integer,30),requested_delivery=left(coalesce(p_proposal->>'requested_delivery',''),500),fob=left(coalesce(p_proposal->>'fob',''),500),destination_zip=left(coalesce(p_proposal->>'destination_zip',''),20),tax_county=left(coalesce(p_proposal->>'tax_county',''),100),submitted_by_name=left(coalesce(p_proposal->>'submitted_by_name',''),200),submitted_by_phone=left(coalesce(p_proposal->>'submitted_by_phone',''),100),submitted_by_email=left(coalesce(p_proposal->>'submitted_by_email',''),320),notes=left(coalesce(p_proposal->>'notes',''),30000),disclaimer_snapshot=left(coalesce(p_proposal->>'disclaimer_snapshot',''),30000),formula_snapshot=left(coalesce(p_proposal->>'formula_snapshot',''),30000),proposal_field_sources=coalesce(p_proposal->'proposal_field_sources','{}'::jsonb),tax_enabled=coalesce((p_proposal->>'tax_enabled')::boolean,false),tax_rate=coalesce((p_proposal->>'tax_rate')::numeric,0),subtotal=subtotal_value,tax=tax_value,total=total_value where id=pid;
  delete from public.proposal_lines where proposal_id=pid;
  insert into public.proposal_lines(proposal_id,line_type,item_number,description,ref,color_plate,quantity,unit,length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,display_order)
  select pid,coalesce(nullif(line->>'line_type',''),'product'),coalesce(line->>'item_number',''),coalesce(line->>'description',''),coalesce(line->>'ref',''),coalesce(line->>'color_plate',''),nullif(line->>'quantity','')::numeric,coalesce(line->>'unit',''),coalesce(line->>'length',''),coalesce(line->>'width',''),coalesce(line->>'height_thickness',''),coalesce(line->>'cft',''),coalesce(line->>'lf',''),coalesce(line->>'estimated_weight',''),nullif(line->>'rate','')::numeric,coalesce((line->>'total')::numeric,0),coalesce(line->'source_metadata','{}'::jsonb),ordinality-1 from jsonb_array_elements(p_lines) with ordinality as valueset(line,ordinality);
end $$;

create or replace function public.create_proposal_revision(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.proposals; created_id uuid:=gen_random_uuid(); next_minor integer;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  select * into strict source from public.proposals where id=p_proposal_id and status='issued';
  select coalesce(max(version_minor),source.version_minor)+1 into next_minor from public.proposals where lineage_id=source.lineage_id and version_major=source.version_major;
  insert into public.proposals(id,job_id,lineage_id,prior_proposal_id,estimate_base,version_major,version_minor,estimate_number,status,proposal_date,customer_name,customer_address,customer_contact,project_name,project_number,project_location,side_mark,sales_rep,terms,valid_days,requested_delivery,fob,destination_zip,tax_county,submitted_by_name,submitted_by_phone,submitted_by_email,notes,disclaimer_snapshot,formula_snapshot,proposal_field_sources,tax_enabled,tax_rate,subtotal,tax,total,created_by_user_id,created_by_name)
  select created_id,job_id,lineage_id,id,estimate_base,version_major,next_minor,estimate_base||'-'||version_major||'.'||next_minor,'draft',current_date,customer_name,customer_address,customer_contact,project_name,project_number,project_location,side_mark,sales_rep,terms,valid_days,requested_delivery,fob,destination_zip,tax_county,submitted_by_name,submitted_by_phone,submitted_by_email,notes,disclaimer_snapshot,formula_snapshot,proposal_field_sources,tax_enabled,tax_rate,subtotal,tax,total,auth.uid(),(select display_name from public.app_users where user_id=auth.uid()) from public.proposals where id=source.id;
  insert into public.proposal_lines(proposal_id,line_type,item_number,description,ref,color_plate,quantity,unit,length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,display_order) select created_id,line_type,item_number,description,ref,color_plate,quantity,unit,length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,display_order from public.proposal_lines where proposal_id=source.id;
  return created_id;
end $$;

grant execute on function public.create_job_proposal(uuid),public.save_proposal_draft(jsonb,jsonb),public.create_proposal_revision(uuid) to authenticated,service_role;
