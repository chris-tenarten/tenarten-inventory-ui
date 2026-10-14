-- Local candidate only; hosted application requires separate approval.
begin;
create table public.production_companies (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 300),
 phone text not null default '' check(length(phone)<=100),
 email text not null default '' check(length(email)<=320),
 mailing_address text not null default '' check(length(mailing_address)<=2000),
 notes text not null default '' check(length(notes)<=4000),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.production_contacts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.production_companies(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 300),
 email text not null default '' check(length(email)<=320),
 phone text not null default '' check(length(phone)<=100),
 title text not null default '' check(length(title)<=300),
 notes text not null default '' check(length(notes)<=4000),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(company_id,id)
);
-- Prefix search uses expression indexes; no fuzzy identity matching or name uniqueness.
create index production_companies_search on public.production_companies(lower(name) text_pattern_ops);
create index production_contacts_search on public.production_contacts(lower(name) text_pattern_ops);
create index production_contacts_company on public.production_contacts(company_id,lower(name),id);
alter table public.jobs
 add column customer_company_id uuid references public.production_companies(id) on delete restrict,
 add column customer_contact_id uuid,
 add column customer_contact_snapshot jsonb,
 add constraint jobs_contact_company_required check(customer_contact_id is null or customer_company_id is not null),
 add constraint jobs_contact_company_fk foreign key(customer_company_id,customer_contact_id) references public.production_contacts(company_id,id) on delete restrict;
create index jobs_customer_company on public.jobs(customer_company_id) where customer_company_id is not null;
create index jobs_customer_contact on public.jobs(customer_contact_id) where customer_contact_id is not null;

-- Reuse existing capabilities; do not modify grants or policies on other domains.
create function public.can_manage_production_contacts(p_shared_edit boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.has_app_capability('writeBusinessData') and
 case when p_shared_edit then public.has_app_capability('editProductionJobDetails')
 else public.has_app_capability('createProductionJob') or public.has_app_capability('editProductionJobRoutine') or public.has_app_capability('editProductionJobDetails') end;
$$;
revoke all on function public.can_manage_production_contacts(boolean) from public,anon;
grant execute on function public.can_manage_production_contacts(boolean) to authenticated;
alter table public.production_companies enable row level security;
alter table public.production_contacts enable row level security;
revoke all on public.production_companies,public.production_contacts from anon,authenticated;
grant select on public.production_companies,public.production_contacts to authenticated;
-- Writes are RPC-only, so callers cannot bypass validation/version checks. No delete API.
create policy production_companies_read on public.production_companies for select to authenticated using(public.has_app_capability('readOperationalData'));
create policy production_contacts_read on public.production_contacts for select to authenticated using(public.has_app_capability('readOperationalData'));

create function public.get_production_contact(p_company_id uuid,p_contact_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare company public.production_companies; contact public.production_contacts;
begin
 perform public.require_app_capability('readOperationalData');
 select * into strict company from public.production_companies where id=p_company_id;
 if p_contact_id is not null then select * into strict contact from public.production_contacts where id=p_contact_id and company_id=p_company_id;end if;
 return jsonb_build_object('company',to_jsonb(company),'contact',case when p_contact_id is null then null else to_jsonb(contact) end);
end;$$;

create function public.search_production_contacts(p_search text default '',p_offset integer default 0)
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
 where lower(c.name) like prefix or lower(t.name) like prefix
 union all
 select to_jsonb(c),null::jsonb,lower(c.name),''::text,c.id,null::uuid
 from public.production_companies c where lower(c.name) like prefix
 ) select choices.company,choices.contact from choices
 order by company_sort,company_id,contact_sort,contact_id nulls first limit 21 offset p_offset;
end;$$;

create function public.save_production_contact(p_company jsonb,p_contact jsonb default null)
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
  -- Existing company may be selected by a Member without editing shared fields.
  company_changed := (to_jsonb(c)-array['id','created_at','updated_at']) is distinct from
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

create function public.guard_project_contact_snapshot() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare entry record; changed boolean;
begin
 if tg_op='INSERT' then changed:=new.customer_company_id is not null or new.customer_contact_id is not null or new.customer_contact_snapshot is not null;
 else
  changed:=row(new.customer_company_id,new.customer_contact_id,new.customer_contact_snapshot) is distinct from row(old.customer_company_id,old.customer_contact_id,old.customer_contact_snapshot);
  -- Old text-only editors remain supported; changing the company text detaches the
  -- previous identity instead of retaining a misleading person/company association.
  if new.customer is distinct from old.customer and not changed then
   new.customer_company_id:=null;new.customer_contact_id:=null;new.customer_contact_snapshot:=null;
   return new;
  end if;
 end if;
 if not changed then return new;end if;
 if auth.uid() is not null or auth.role() in ('anon','authenticated') then
  if not public.can_manage_production_contacts(false) then raise exception 'Production editing permission required.' using errcode='42501';end if;
 end if;
 if new.customer_company_id is not null and new.customer_contact_snapshot is null then raise exception 'Linked customer requires a captured snapshot.' using errcode='22023';end if;
 if new.customer_contact_snapshot is not null then
  if jsonb_typeof(new.customer_contact_snapshot) is distinct from 'object' then raise exception 'Invalid contact snapshot.' using errcode='22023';end if;
  for entry in select * from jsonb_each(new.customer_contact_snapshot) loop
   if entry.key not in ('company_name','contact_name','contact_email','contact_phone','contact_title','company_phone','company_email','mailing_address','notes') or jsonb_typeof(entry.value)<>'string' or length(entry.value #>> '{}')>(case when entry.key='notes' then 8001 when entry.key='mailing_address' then 2000 when entry.key in ('contact_phone','company_phone') then 100 when entry.key in ('contact_email','company_email') then 320 else 300 end) then raise exception 'Invalid contact snapshot field.' using errcode='22023';end if;
  end loop;
  if (new.customer_contact_snapshot->>'company_name') is distinct from coalesce(new.customer,'') then raise exception 'Customer and captured company name must agree.' using errcode='22023';end if;
 end if;
 return new;
end;$$;
create trigger jobs_contact_snapshot_guard before insert or update on public.jobs for each row execute function public.guard_project_contact_snapshot();
revoke all on function public.guard_project_contact_snapshot() from public,anon,authenticated;
revoke all on function public.get_production_contact(uuid,uuid),public.search_production_contacts(text,integer),public.save_production_contact(jsonb,jsonb) from public,anon;
grant execute on function public.get_production_contact(uuid,uuid),public.search_production_contacts(text,integer),public.save_production_contact(jsonb,jsonb) to authenticated;
commit;
