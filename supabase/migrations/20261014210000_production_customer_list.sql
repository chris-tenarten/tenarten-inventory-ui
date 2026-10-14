-- Customer-list simplification. Forward-only extension of the local contact candidate.
-- No hosted application authorized. No historical backfill or identity inference.
begin;
alter table public.production_companies
 add column archived_at timestamptz,
 add column default_contact_id uuid,
 add constraint production_company_default_contact_fk foreign key(id,default_contact_id)
 references public.production_contacts(company_id,id) on delete restrict;
create index production_companies_active_search on public.production_companies(lower(name) text_pattern_ops,id) where archived_at is null;

create or replace function public.search_production_contacts(p_search text default '',p_offset integer default 0)
returns table(company jsonb,contact jsonb)
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare prefix text;
begin
 perform public.require_app_capability('readOperationalData');
 if p_offset<0 or p_offset>10000 or length(p_search)>300 then raise exception 'Invalid search.' using errcode='22023';end if;
 prefix:=replace(replace(replace(lower(btrim(coalesce(p_search,''))),'\','\\'),'%','\%'),'_','\_')||'%';
 return query with choices as (
 select to_jsonb(c) as company,to_jsonb(t) as contact,lower(c.name) as company_sort,lower(t.name) as contact_sort,c.id as company_id,t.id as contact_id
 from public.production_companies c join public.production_contacts t on t.company_id=c.id
 where c.archived_at is null and (lower(c.name) like prefix or lower(t.name) like prefix)
 union all
 select to_jsonb(c),null::jsonb,lower(c.name),''::text,c.id,null::uuid
 from public.production_companies c where c.archived_at is null and lower(c.name) like prefix
 ) select choices.company,choices.contact from choices
 order by company_sort,company_id,contact_sort,contact_id nulls first limit 21 offset p_offset;
end;$$;

create or replace function public.save_production_contact(p_company jsonb,p_contact jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.production_companies; t public.production_contacts; cid uuid; tid uuid; company_changed boolean;
begin
 if not public.can_manage_production_contacts(false) then raise exception 'Production editing permission required.' using errcode='42501';end if;
 if jsonb_typeof(p_company) is distinct from 'object' or (p_contact is not null and jsonb_typeof(p_contact) is distinct from 'object') then raise exception 'Invalid customer/contact.' using errcode='22023';end if;
 cid:=nullif(p_company->>'id','')::uuid;tid:=nullif(p_contact->>'id','')::uuid;
 if cid is null then
  insert into public.production_companies(name,phone,email,mailing_address,notes)
  values(btrim(p_company->>'name'),coalesce(p_company->>'phone',''),coalesce(p_company->>'email',''),coalesce(p_company->>'mailing_address',''),coalesce(p_company->>'notes','')) returning * into c;
 else
  select * into strict c from public.production_companies where id=cid for update;
  if c.archived_at is not null then raise exception 'Customer has been removed from the list.' using errcode='55000';end if;
  -- Existing company may be selected by a Member without editing shared fields.
  company_changed := (to_jsonb(c)-array['id','created_at','updated_at','archived_at','default_contact_id']) is distinct from
   jsonb_build_object('name',btrim(p_company->>'name'),'phone',coalesce(p_company->>'phone',''),'email',coalesce(p_company->>'email',''),'mailing_address',coalesce(p_company->>'mailing_address',''),'notes',coalesce(p_company->>'notes',''));
  if company_changed then
   if not public.can_manage_production_contacts(true) then raise exception 'Shared editing permission required.' using errcode='42501';end if;
   if c.updated_at is distinct from (p_company->>'updated_at')::timestamptz then raise exception 'Company changed. Reopen before saving.' using errcode='55000';end if;
   update public.production_companies set name=btrim(p_company->>'name'),phone=coalesce(p_company->>'phone',''),email=coalesce(p_company->>'email',''),mailing_address=coalesce(p_company->>'mailing_address',''),notes=coalesce(p_company->>'notes',''),updated_at=clock_timestamp() where id=cid returning * into c;
  end if;
 end if;
 if p_contact is not null then
  if tid is null then
   insert into public.production_contacts(company_id,name,email,phone,title,notes)
   values(c.id,btrim(p_contact->>'name'),coalesce(p_contact->>'email',''),coalesce(p_contact->>'phone',''),coalesce(p_contact->>'title',''),coalesce(p_contact->>'notes','')) returning * into t;
  else
   if not public.can_manage_production_contacts(true) then raise exception 'Shared editing permission required.' using errcode='42501';end if;
   select * into strict t from public.production_contacts where id=tid and company_id=c.id for update;
   if t.updated_at is distinct from (p_contact->>'updated_at')::timestamptz then raise exception 'Contact changed. Reopen before saving.' using errcode='55000';end if;
   update public.production_contacts set name=btrim(p_contact->>'name'),email=coalesce(p_contact->>'email',''),phone=coalesce(p_contact->>'phone',''),title=coalesce(p_contact->>'title',''),notes=coalesce(p_contact->>'notes',''),updated_at=clock_timestamp() where id=tid returning * into t;
  end if;
 end if;
 return jsonb_build_object('company',to_jsonb(c),'contact',case when p_contact is null then null else to_jsonb(t) end);
end;$$;

create function public.get_production_customer(p_company_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare c public.production_companies;
begin
 perform public.require_app_capability('readOperationalData');
 select * into strict c from public.production_companies where id=p_company_id and archived_at is null;
 return public.get_production_contact(c.id,c.default_contact_id);
end;$$;

create function public.search_production_customers(p_search text default '',p_offset integer default 0)
returns table(company jsonb,contact jsonb)
language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare prefix text;
begin
 perform public.require_app_capability('readOperationalData');
 if p_offset is null or p_offset<0 or p_offset>10000 or length(p_search)>300 then raise exception 'Invalid search.' using errcode='22023';end if;
 prefix:=replace(replace(replace(lower(btrim(coalesce(p_search,''))),'\','\\'),'%','\%'),'_','\_')||'%';
 return query select to_jsonb(c),case when t.id is null then null::jsonb else to_jsonb(t) end
 from public.production_companies c left join public.production_contacts t on t.company_id=c.id and t.id=c.default_contact_id
 where c.archived_at is null and lower(c.name) like prefix
 order by lower(c.name),c.id limit 21 offset p_offset;
end;$$;

create function public.list_production_company_contacts(p_company_id uuid,p_offset integer default 0)
returns setof public.production_contacts language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 perform public.require_app_capability('readOperationalData');
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page.' using errcode='22023';end if;
 return query select t.* from public.production_contacts t join public.production_companies c on c.id=t.company_id
 where c.id=p_company_id and c.archived_at is null order by lower(t.name),t.id limit 21 offset p_offset;
end;$$;

-- One save contract for Add New, explicit historical promotion and list management.
-- A nullable default lets customer selection capture optional details in one step.
-- No historical/default contact assignments are inferred during migration.
create function public.save_production_customer(p_company jsonb,p_contact jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.production_companies; saved jsonb; cid uuid; contact_id uuid;
begin
 if not public.can_manage_production_contacts(false) then raise exception 'Production editing permission required.' using errcode='42501';end if;
 cid:=nullif(p_company->>'id','')::uuid;
 if cid is not null then
  if not public.can_manage_production_contacts(true) then raise exception 'Shared editing permission required.' using errcode='42501';end if;
  select * into strict c from public.production_companies where id=cid for update;
  if c.archived_at is not null then raise exception 'Customer has been removed from the list.' using errcode='55000';end if;
  if c.updated_at is distinct from (p_company->>'updated_at')::timestamptz then raise exception 'Customer changed. Reopen before saving.' using errcode='55000';end if;
 end if;
 saved:=public.save_production_contact(p_company,p_contact);
 cid:=(saved->'company'->>'id')::uuid;contact_id:=nullif(saved->'contact'->>'id','')::uuid;
 update public.production_companies set default_contact_id=contact_id,updated_at=clock_timestamp() where id=cid;
 return public.get_production_customer(cid);
end;$$;

create function public.archive_production_customer(p_company_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.production_companies;
begin
 if not public.can_manage_production_contacts(true) then raise exception 'Shared editing permission required.' using errcode='42501';end if;
 select * into strict c from public.production_companies where id=p_company_id for update;
 if c.updated_at is distinct from p_expected_updated_at then raise exception 'Customer changed. Reopen before removing it.' using errcode='55000';end if;
 if c.archived_at is not null then return;end if;
 update public.production_companies set archived_at=clock_timestamp(),updated_at=clock_timestamp() where id=c.id;
 -- Intentionally no Jobs, contacts or document updates/deletes.
end;$$;

create function public.guard_project_archived_customer() returns trigger
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
create trigger jobs_customer_list_guard before insert or update on public.jobs for each row execute function public.guard_project_archived_customer();
revoke all on function public.guard_project_archived_customer() from public,anon,authenticated;
revoke all on function public.get_production_customer(uuid),public.search_production_customers(text,integer),public.list_production_company_contacts(uuid,integer),public.save_production_customer(jsonb,jsonb),public.archive_production_customer(uuid,timestamptz) from public,anon;
grant execute on function public.get_production_customer(uuid),public.search_production_customers(text,integer),public.list_production_company_contacts(uuid,integer),public.save_production_customer(jsonb,jsonb),public.archive_production_customer(uuid,timestamptz) to authenticated;
commit;
