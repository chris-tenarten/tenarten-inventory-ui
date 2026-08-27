-- Structured Proposal clarifications and safe authorized Draft deletion.
alter table public.proposals
  add column if not exists freight_estimate numeric(14,2) check(freight_estimate is null or freight_estimate>=0),
  add column if not exists preliminary_drawings_attached boolean not null default false,
  add column if not exists crating_included boolean not null default false,
  add column if not exists cut_tickets_included boolean not null default false,
  add column if not exists field_dimensioning_excluded boolean not null default false;

create or replace function public.proposal_clarification_revision_defaults()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.prior_proposal_id is not null then
    select freight_estimate,preliminary_drawings_attached,crating_included,cut_tickets_included,field_dimensioning_excluded
    into new.freight_estimate,new.preliminary_drawings_attached,new.crating_included,new.cut_tickets_included,new.field_dimensioning_excluded
    from public.proposals where id=new.prior_proposal_id;
  end if;
  return new;
end $$;

create trigger proposal_clarification_revision_defaults
before insert on public.proposals
for each row execute function public.proposal_clarification_revision_defaults();

create or replace function public.save_proposal_clarifications(p_proposal jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare pid uuid:=(p_proposal->>'id')::uuid;
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  if not exists(select 1 from public.proposals where id=pid and status='draft') then raise exception 'Only Proposal drafts can be saved.' using errcode='55000'; end if;
  update public.proposals set
    freight_estimate=nullif(p_proposal->>'freight_estimate','')::numeric,
    preliminary_drawings_attached=coalesce((p_proposal->>'preliminary_drawings_attached')::boolean,false),
    crating_included=coalesce((p_proposal->>'crating_included')::boolean,false),
    cut_tickets_included=coalesce((p_proposal->>'cut_tickets_included')::boolean,false),
    field_dimensioning_excluded=coalesce((p_proposal->>'field_dimensioning_excluded')::boolean,false)
  where id=pid;
end $$;

create or replace function public.delete_proposal_draft(p_proposal_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_proposal_access() then raise exception 'TenOps Proposal access denied.' using errcode='42501'; end if;
  if not exists(select 1 from public.proposals where id=p_proposal_id and status='draft') then
    raise exception 'Only Proposal drafts can be deleted.' using errcode='55000';
  end if;
  if exists(select 1 from public.proposals where prior_proposal_id=p_proposal_id) then
    raise exception 'A Proposal with dependent revisions cannot be deleted.' using errcode='55000';
  end if;
  delete from public.proposals where id=p_proposal_id and status='draft';
end $$;

revoke all on function public.save_proposal_clarifications(jsonb),public.delete_proposal_draft(uuid) from public,anon;
grant execute on function public.save_proposal_clarifications(jsonb),public.delete_proposal_draft(uuid) to authenticated,service_role;
