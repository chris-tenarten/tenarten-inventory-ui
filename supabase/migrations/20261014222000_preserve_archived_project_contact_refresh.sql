-- Existing archived links remain editable and explicitly refreshable.
begin;
create or replace function public.save_production_project(p_job_id uuid,p_job jsonb,p_contact jsonb default null,p_save_contact boolean default false)
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
  update public.production_job_contacts set customer_company_id=(p_contact->>'customer_company_id')::uuid,
   customer_contact_id=(p_contact->>'customer_contact_id')::uuid,
   customer_contact_snapshot=nullif(p_contact->'customer_contact_snapshot','null'::jsonb) where job_id=result_id;
  if not found then
   insert into public.production_job_contacts(job_id,customer_company_id,customer_contact_id,customer_contact_snapshot)
   values(result_id,(p_contact->>'customer_company_id')::uuid,(p_contact->>'customer_contact_id')::uuid,nullif(p_contact->'customer_contact_snapshot','null'::jsonb));
  end if;
 end if;
 return result_id;
end;$$;
commit;
