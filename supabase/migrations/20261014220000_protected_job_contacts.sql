-- Forward-only local candidate correction. Apply with preceding contact migrations
-- in one reviewed release transaction before exposing the application/API.
begin;
drop trigger jobs_contact_snapshot_guard on public.jobs;
drop trigger jobs_customer_list_guard on public.jobs;
create table public.production_job_contacts (
 job_id uuid primary key references public.jobs(id) on delete cascade,
 customer_company_id uuid references public.production_companies(id) on delete restrict,
 customer_contact_id uuid,
 customer_contact_snapshot jsonb,
 check(customer_contact_id is null or customer_company_id is not null),
 foreign key(customer_company_id,customer_contact_id) references public.production_contacts(company_id,id) on delete restrict
);
-- Preserve any local candidate captures; no Jobs row updates or historical backfill.
insert into public.production_job_contacts select id,customer_company_id,customer_contact_id,customer_contact_snapshot from public.jobs
 where customer_company_id is not null or customer_contact_snapshot is not null;
alter table public.jobs drop column customer_contact_id, drop column customer_company_id, drop column customer_contact_snapshot;
alter table public.production_job_contacts enable row level security;
revoke all on public.production_job_contacts from public,anon,authenticated;
grant select,insert,update,delete on public.production_job_contacts to authenticated;
create policy project_contact_read on public.production_job_contacts for select to authenticated using(public.has_app_capability('readOperationalData'));
create policy project_contact_insert on public.production_job_contacts for insert to authenticated with check(public.can_manage_production_contacts(false));
create policy project_contact_update on public.production_job_contacts for update to authenticated using(public.can_manage_production_contacts(false)) with check(public.can_manage_production_contacts(false));
create policy project_contact_delete on public.production_job_contacts for delete to authenticated using(public.can_manage_production_contacts(false));
create or replace function public.guard_project_contact_snapshot() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare entry record; changed boolean;
begin
 if not public.can_manage_production_contacts(false) then raise exception 'Production editing permission required.' using errcode='42501';end if;
 if new.customer_company_id is not null and new.customer_contact_snapshot is null then raise exception 'Linked customer requires a captured snapshot.' using errcode='22023';end if;
 if new.customer_contact_snapshot is not null then
  if jsonb_typeof(new.customer_contact_snapshot) is distinct from 'object' then raise exception 'Invalid contact snapshot.' using errcode='22023';end if;
  for entry in select * from jsonb_each(new.customer_contact_snapshot) loop
   if entry.key not in ('company_name','contact_name','contact_email','contact_phone','contact_title','company_phone','company_email','mailing_address','notes') or jsonb_typeof(entry.value)<>'string' or length(entry.value #>> '{}')>(case when entry.key='notes' then 8001 when entry.key='mailing_address' then 2000 when entry.key in ('contact_phone','company_phone') then 100 when entry.key in ('contact_email','company_email') then 320 else 300 end) then raise exception 'Invalid contact snapshot field.' using errcode='22023';end if;
  end loop;
  if (new.customer_contact_snapshot->>'company_name') is distinct from coalesce((select customer from public.jobs where id=new.job_id),'') then raise exception 'Customer and captured company name must agree.' using errcode='22023';end if;
 end if;
 return new;
end;$$;
create or replace function public.guard_project_archived_customer() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.customer_company_id is null then return new;end if;
 if tg_op='UPDATE' then
  if row(old.customer_company_id,old.customer_contact_id) is not distinct from row(new.customer_company_id,new.customer_contact_id) then return new;end if;
 end if;
 -- Serialize new associations against archive, including direct Jobs writes.
 perform 1 from public.production_companies where id=new.customer_company_id and archived_at is null for share;
 if not found then raise exception 'Customer is no longer available in the list. Choose another customer or use a historical name.' using errcode='55000';end if;
 return new;
end;$$;

create trigger project_contact_validate before insert or update on public.production_job_contacts for each row execute function public.guard_project_contact_snapshot();
create trigger project_contact_customer_available before insert or update on public.production_job_contacts for each row execute function public.guard_project_archived_customer();
-- Text-only legacy editors detach stale associations without changing their Jobs permissions.
create function public.detach_project_contact_on_customer_change() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.customer is distinct from old.customer then delete from public.production_job_contacts where job_id=new.id;end if;
 return new;
end;$$;
revoke all on function public.detach_project_contact_on_customer_change() from public,anon,authenticated;
create trigger project_contact_detach after update of customer on public.jobs for each row execute function public.detach_project_contact_on_customer_change();
-- Invoker privileges preserve the existing Jobs RLS and statement/row guards.
-- The transaction includes the Job and captured contact; an error rolls both back.
create function public.save_production_project(p_job_id uuid,p_job jsonb,p_contact jsonb default null,p_save_contact boolean default false)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result_id uuid; columns_sql text; values_sql text; assignments text; k text;
begin
 if jsonb_typeof(p_job) is distinct from 'object' then raise exception 'Invalid Project.' using errcode='22023';end if;
 for k in select jsonb_object_keys(p_job) loop
  if k not in ('name','customer','job_number','estimate_number','work_order_number','contract_value','deposit_date','color_plate_number','sample_submitted_date','approval_date','resin_po','chip_po','estimated_man_hours','estimated_calendar_days','requested_delivery_date','planned_start','planned_end','production_status','material_status','priority','progress_percent','owner_name','remarks') then raise exception 'Invalid Project field.' using errcode='22023';end if;
 end loop;
 if p_job_id is null and (nullif(p_job->>'planned_start','') is not null or nullif(p_job->>'planned_end','') is not null) then raise exception 'Use guarded scheduling.' using errcode='22023';end if;
 if p_job_id is not null and (p_job ? 'planned_start' or p_job ? 'planned_end') then raise exception 'Use guarded scheduling.' using errcode='22023';end if;
 select string_agg(format('%I',key),','),string_agg(format('r.%I',key),','),string_agg(format('%1$I=r.%1$I',key),',') into columns_sql,values_sql,assignments from jsonb_object_keys(p_job) key;
 if p_job_id is null then
  execute format('insert into public.jobs (%s) select %s from jsonb_populate_record(null::public.jobs,$1) r returning id',columns_sql,values_sql) into result_id using p_job;
 else
  perform 1 from public.jobs where id=p_job_id for update;
  if not found then raise exception 'Project unavailable.' using errcode='42501';end if;
  result_id:=p_job_id;
  if assignments is not null then execute format('update public.jobs j set %s from jsonb_populate_record(null::public.jobs,$1) r where j.id=$2 returning j.id',assignments) into result_id using p_job,p_job_id;end if;
  if result_id is null then raise exception 'Project update denied.' using errcode='42501';end if;
 end if;
 if p_save_contact then
  if not public.can_manage_production_contacts(false) then raise exception 'Production editing permission required.' using errcode='42501';end if;
  insert into public.production_job_contacts(job_id,customer_company_id,customer_contact_id,customer_contact_snapshot)
  values(result_id,(p_contact->>'customer_company_id')::uuid,(p_contact->>'customer_contact_id')::uuid,nullif(p_contact->'customer_contact_snapshot','null'::jsonb))
  on conflict(job_id) do update set customer_company_id=excluded.customer_company_id,customer_contact_id=excluded.customer_contact_id,customer_contact_snapshot=excluded.customer_contact_snapshot;
 end if;
 return result_id;
end;$$;
revoke all on function public.save_production_project(uuid,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_production_project(uuid,jsonb,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
