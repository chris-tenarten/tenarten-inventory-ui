-- Retained archived links can be explicitly refreshed within the atomic save.
begin;
drop trigger project_contact_detach on public.jobs;
create or replace function public.detach_project_contact_on_customer_change() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 delete from public.production_job_contacts c using public.jobs j
 where c.job_id=new.id and j.id=c.job_id
 and (c.customer_contact_snapshot->>'company_name') is distinct from coalesce(j.customer,'');
 return new;
end;$$;
create constraint trigger project_contact_detach after update on public.jobs
 deferrable initially deferred for each row execute function public.detach_project_contact_on_customer_change();
commit;
