-- Final Proposal acceptance defaults: destination/tax jurisdiction remain evidence-driven.
alter table public.proposals alter column tax_county set default '';
alter table public.proposals alter column tax_rate drop not null;
alter table public.proposals alter column tax_rate set default null;

create or replace function public.proposal_acceptance_defaults()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' and new.prior_proposal_id is null then
    new.destination_zip:='';
    new.tax_county:='';
    new.tax_rate:=null;
  elsif tg_op='UPDATE' and btrim(coalesce(new.tax_county,''))='' and coalesce(new.tax_rate,0)=0 then
    new.tax_rate:=null;
  end if;
  return new;
end $$;

drop trigger if exists proposal_acceptance_defaults on public.proposals;
create trigger proposal_acceptance_defaults
before insert or update on public.proposals
for each row execute function public.proposal_acceptance_defaults();
