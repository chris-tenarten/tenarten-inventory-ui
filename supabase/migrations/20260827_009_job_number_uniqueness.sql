begin;

-- Canonical storage remains human-readable; identity comparison is trim + case-fold.
create or replace function public.canonicalize_job_number()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $$
begin
  new.job_number:=nullif(btrim(new.job_number),'');
  return new;
end $$;

create trigger jobs_canonicalize_job_number
before insert or update of job_number on public.jobs
for each row execute function public.canonicalize_job_number();

create unique index jobs_job_number_normalized_unique
on public.jobs(lower(btrim(job_number)))
where nullif(btrim(job_number),'') is not null;

commit;
