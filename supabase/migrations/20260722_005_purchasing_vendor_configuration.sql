begin;

alter table public.vendors
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists website text,
  add column if not exists notes text;

update public.vendors
set address_line_1 = address
where address_line_1 is null and nullif(trim(address), '') is not null;

create table if not exists public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  contact_name text not null,
  role text,
  email text,
  phone text,
  notes text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_contacts_name_not_blank check (length(trim(contact_name)) > 0)
);
create unique index if not exists vendor_contacts_identity_unique_idx
  on public.vendor_contacts (vendor_id, lower(contact_name), lower(coalesce(email, '')));
create unique index if not exists vendor_contacts_one_default_idx
  on public.vendor_contacts (vendor_id) where is_default and is_active;
create index if not exists vendor_contacts_vendor_idx on public.vendor_contacts (vendor_id, is_active);

insert into public.vendor_contacts (vendor_id, contact_name, email, phone, is_default)
select id, contact_name, email, phone, true
from public.vendors
where nullif(trim(contact_name), '') is not null
on conflict (vendor_id, lower(contact_name), lower(coalesce(email, ''))) do nothing;

alter table public.vendor_catalog_v2
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;
create index if not exists vendor_catalog_v2_vendor_idx
  on public.vendor_catalog_v2 (vendor_id) where vendor_id is not null;
create unique index if not exists vendor_catalog_v2_vendor_sku_unique_idx
  on public.vendor_catalog_v2 (vendor_id, lower(vendor_sku))
  where vendor_id is not null and nullif(trim(vendor_sku), '') is not null;

create or replace function public.save_chip_purchase_order_draft_v2(p_order jsonb, p_lines jsonb, p_actor text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  order_id uuid;
  requested_number text := nullif(trim(p_order->>'po_number'), '');
begin
  order_id := public.save_chip_purchase_order_draft(p_order, p_lines, p_actor);
  update public.purchase_orders
  set po_number = requested_number, updated_at = now()
  where id = order_id and status = 'draft';
  if not found then raise exception 'Only draft Purchase Orders can be numbered.'; end if;
  return order_id;
exception
  when unique_violation then raise exception 'Purchase Order number "%" is already in use.', requested_number;
end;
$function$;

create or replace function public.delete_purchase_order_draft(p_purchase_order_id uuid, p_actor text)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare existing public.purchase_orders%rowtype;
begin
  if nullif(trim(p_actor), '') is null then raise exception 'Your name is required to delete a draft.'; end if;
  select * into existing from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase Order draft was not found.'; end if;
  if existing.status <> 'draft' then raise exception 'Only saved drafts may be deleted.'; end if;
  delete from public.purchase_orders where id = p_purchase_order_id;
end;
$function$;

create or replace function public.save_vendor_profile(p_vendor jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare vendor_id uuid := nullif(p_vendor->>'id', '')::uuid; canonical text;
begin
  canonical := lower(regexp_replace(trim(p_vendor->>'name'), '[^a-zA-Z0-9]+', '', 'g'));
  if canonical = '' then raise exception 'Vendor name is required.'; end if;
  if vendor_id is null then
    insert into public.vendors (name, canonical_name, address, address_line_1, address_line_2, city, state, postal_code, country, phone, email, website, payment_terms, notes, is_active)
    values (trim(p_vendor->>'name'), canonical, nullif(trim(p_vendor->>'address_line_1'), ''), nullif(trim(p_vendor->>'address_line_1'), ''), nullif(trim(p_vendor->>'address_line_2'), ''), nullif(trim(p_vendor->>'city'), ''), nullif(trim(p_vendor->>'state'), ''), nullif(trim(p_vendor->>'postal_code'), ''), nullif(trim(p_vendor->>'country'), ''), nullif(trim(p_vendor->>'phone'), ''), nullif(trim(p_vendor->>'email'), ''), nullif(trim(p_vendor->>'website'), ''), nullif(trim(p_vendor->>'payment_terms'), ''), nullif(trim(p_vendor->>'notes'), ''), coalesce((p_vendor->>'is_active')::boolean, true))
    returning id into vendor_id;
  else
    update public.vendors set name=trim(p_vendor->>'name'), canonical_name=canonical, address=nullif(trim(p_vendor->>'address_line_1'), ''), address_line_1=nullif(trim(p_vendor->>'address_line_1'), ''), address_line_2=nullif(trim(p_vendor->>'address_line_2'), ''), city=nullif(trim(p_vendor->>'city'), ''), state=nullif(trim(p_vendor->>'state'), ''), postal_code=nullif(trim(p_vendor->>'postal_code'), ''), country=nullif(trim(p_vendor->>'country'), ''), phone=nullif(trim(p_vendor->>'phone'), ''), email=nullif(trim(p_vendor->>'email'), ''), website=nullif(trim(p_vendor->>'website'), ''), payment_terms=nullif(trim(p_vendor->>'payment_terms'), ''), notes=nullif(trim(p_vendor->>'notes'), ''), is_active=coalesce((p_vendor->>'is_active')::boolean, is_active), updated_at=now() where id=vendor_id;
    if not found then raise exception 'Vendor was not found.'; end if;
  end if;
  return vendor_id;
exception when unique_violation then raise exception 'A vendor with this name already exists.';
end;
$function$;

create or replace function public.save_vendor_contact(p_contact jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare contact_id uuid := nullif(p_contact->>'id', '')::uuid; selected_vendor uuid := nullif(p_contact->>'vendor_id', '')::uuid; make_default boolean := coalesce((p_contact->>'is_default')::boolean, false);
begin
  if selected_vendor is null then raise exception 'Vendor is required.'; end if;
  if nullif(trim(p_contact->>'contact_name'), '') is null then raise exception 'Contact name is required.'; end if;
  if make_default then update public.vendor_contacts set is_default=false, updated_at=now() where vendor_id=selected_vendor and is_default; end if;
  if contact_id is null then
    insert into public.vendor_contacts (vendor_id,contact_name,role,email,phone,notes,is_default,is_active)
    values (selected_vendor,trim(p_contact->>'contact_name'),nullif(trim(p_contact->>'role'),''),nullif(trim(p_contact->>'email'),''),nullif(trim(p_contact->>'phone'),''),nullif(trim(p_contact->>'notes'),''),make_default,coalesce((p_contact->>'is_active')::boolean,true)) returning id into contact_id;
  else
    update public.vendor_contacts set contact_name=trim(p_contact->>'contact_name'),role=nullif(trim(p_contact->>'role'),''),email=nullif(trim(p_contact->>'email'),''),phone=nullif(trim(p_contact->>'phone'),''),notes=nullif(trim(p_contact->>'notes'),''),is_default=make_default,is_active=coalesce((p_contact->>'is_active')::boolean,is_active),updated_at=now() where id=contact_id and vendor_id=selected_vendor;
    if not found then raise exception 'Vendor contact was not found.'; end if;
  end if;
  return contact_id;
exception when unique_violation then raise exception 'This vendor contact already exists or another active default contact is selected.';
end;
$function$;

create or replace function public.save_purchasing_catalog_item(p_item jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare item_id uuid := nullif(p_item->>'id','')::uuid; selected_vendor uuid := nullif(p_item->>'vendor_id','')::uuid; vendor_name text; price_value numeric := round(nullif(p_item->>'price','')::numeric, 2);
begin
  select name into vendor_name from public.vendors where id=selected_vendor;
  if vendor_name is null then raise exception 'Select a configured Vendor.'; end if;
  if nullif(trim(p_item->>'item_name'),'') is null then raise exception 'Material name is required.'; end if;
  if price_value is not null and price_value < 0 then raise exception 'Catalog price cannot be negative.'; end if;
  if item_id is null then
    insert into public.vendor_catalog_v2 (vendor_id,vendor_name,vendor_sku,category,item_name,size,unit_size,unit_size_uom,packaging,price,price_unit,quote_required,is_active,lead_time_days,minimum_order_qty,minimum_order_uom,notes,product_line,material_type,canonical_vendor,canonical_item_name,canonical_size,pricing_status,updated_at)
    values (selected_vendor,vendor_name,nullif(trim(p_item->>'vendor_sku'),''),coalesce(nullif(trim(p_item->>'category'),''),'Chip / Aggregate'),trim(p_item->>'item_name'),nullif(trim(p_item->>'size'),''),nullif(p_item->>'unit_size','')::numeric,nullif(trim(p_item->>'unit_size_uom'),''),nullif(trim(p_item->>'packaging'),''),price_value,nullif(trim(p_item->>'price_unit'),''),price_value is null,coalesce((p_item->>'is_active')::boolean,true),nullif(p_item->>'lead_time_days','')::integer,nullif(p_item->>'minimum_order_qty','')::numeric,nullif(trim(p_item->>'minimum_order_uom'),''),nullif(trim(p_item->>'notes'),''),nullif(trim(p_item->>'product_line'),''),coalesce(nullif(trim(p_item->>'material_type'),''),'chip'),vendor_name,trim(p_item->>'item_name'),nullif(trim(p_item->>'size'),''),case when price_value is null then 'quote_required' else 'priced' end,now()) returning id into item_id;
  else
    update public.vendor_catalog_v2 set vendor_id=selected_vendor,price=price_value,price_unit=nullif(trim(p_item->>'price_unit'),''),quote_required=price_value is null,pricing_status=case when price_value is null then 'quote_required' else 'priced' end,updated_at=now() where id=item_id and (vendor_id=selected_vendor or vendor_id is null);
    if not found then raise exception 'Vendor catalog item was not found.'; end if;
  end if;
  return item_id;
exception when unique_violation then raise exception 'This Vendor SKU already exists for the selected Vendor.';
end;
$function$;

alter table public.vendor_contacts enable row level security;
drop policy if exists "Vendor contact read" on public.vendor_contacts;
create policy "Vendor contact read" on public.vendor_contacts for select to anon, authenticated using (true);

revoke all on function public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text) from public;
revoke all on function public.delete_purchase_order_draft(uuid,text) from public;
revoke all on function public.save_vendor_profile(jsonb) from public;
revoke all on function public.save_vendor_contact(jsonb) from public;
revoke all on function public.save_purchasing_catalog_item(jsonb) from public;
grant execute on function public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text) to anon, authenticated, service_role;
grant execute on function public.delete_purchase_order_draft(uuid,text) to anon, authenticated, service_role;
grant execute on function public.save_vendor_profile(jsonb) to anon, authenticated, service_role;
grant execute on function public.save_vendor_contact(jsonb) to anon, authenticated, service_role;
grant execute on function public.save_purchasing_catalog_item(jsonb) to anon, authenticated, service_role;

commit;
