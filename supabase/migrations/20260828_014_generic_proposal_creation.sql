-- Allow new Proposals to exist independently from Production while preserving
-- every historical Job relationship and the legacy Job creation RPC.
begin;

alter table public.proposals alter column job_id drop not null;

create or replace function public.create_proposal()
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  created_id uuid:=gen_random_uuid();
  base text:='Q'||to_char(current_date,'YY-MMDD');
  major integer;
  number text;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(base,0));
  select coalesce(max(version_major),0)+1
    into major
    from public.proposals
   where estimate_base=base;
  number:=base||'-'||major||'.0';

  insert into public.proposals(
    id,job_id,lineage_id,estimate_base,version_major,version_minor,
    estimate_number,sales_rep,terms,valid_days,fob,
    submitted_by_name,submitted_by_phone,submitted_by_email,
    created_by_user_id,created_by_name
  ) values (
    created_id,null,created_id,base,major,0,
    number,'House','50% Dep / Net 30',30,'Carrollton, TX',
    'Anthony Iorio','469-491-7002','sales@tenartenterrazzo.com',
    auth.uid(),(select display_name from public.app_users where user_id=auth.uid())
  );

  insert into public.proposal_lines(
    proposal_id,line_type,item_number,description,ref,color_plate,
    quantity,unit,length,width,height_thickness,cft,lf,
    estimated_weight,rate,total,source_metadata,display_order
  ) values (
    created_id,'product','1','','','',null,'ea.','','','','','','',null,0,'{}'::jsonb,0
  );

  return created_id;
end $$;

revoke all on function public.create_proposal() from public,anon;
grant execute on function public.create_proposal() to authenticated,service_role;

commit;
