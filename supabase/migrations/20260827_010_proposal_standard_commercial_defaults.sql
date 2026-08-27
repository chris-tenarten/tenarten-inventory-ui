begin;

alter table public.proposals
  alter column tax_county set default 'Dallas County',
  alter column tax_rate set default 8.25;

create or replace function public.proposal_acceptance_defaults()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' and new.prior_proposal_id is null then
    new.destination_zip:='';
    new.tax_county:='Dallas County';
    new.tax_rate:=8.25;
    new.freight_estimate:=null;
  elsif tg_op='UPDATE' and btrim(coalesce(new.tax_county,''))='' and coalesce(new.tax_rate,0)=0 then
    new.tax_rate:=null;
  end if;
  return new;
end $$;

commit;
