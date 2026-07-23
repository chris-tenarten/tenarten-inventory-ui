begin;

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canonical_name text not null,
  address text,
  contact_name text,
  email text,
  phone text,
  payment_terms text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_name_not_blank check (length(trim(name)) > 0),
  constraint vendors_canonical_name_not_blank check (length(trim(canonical_name)) > 0)
);
create unique index vendors_canonical_name_unique_idx on public.vendors (lower(canonical_name));

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_family_id uuid not null default gen_random_uuid(),
  po_number text,
  po_category text not null default 'chip' check (po_category in ('chip')),
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_name_snapshot text not null,
  vendor_address_snapshot text,
  vendor_contact_snapshot text,
  status text not null default 'draft' check (status in ('draft','issued','cancelled','superseded')),
  order_date date not null,
  requested_date date,
  currency text not null default 'USD',
  subtotal numeric(14,2) not null default 0,
  freight numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  commercial_notes text,
  internal_notes text,
  revision_number integer not null default 1,
  supersedes_purchase_order_id uuid references public.purchase_orders(id) on delete restrict,
  revision_reason text,
  created_by text not null,
  updated_by text not null,
  issued_by text,
  issued_at timestamptz,
  cancelled_by text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_vendor_snapshot_not_blank check (length(trim(vendor_name_snapshot)) > 0),
  constraint purchase_orders_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint purchase_orders_money_nonnegative check (subtotal >= 0 and freight >= 0 and tax >= 0 and discount >= 0 and total >= 0),
  constraint purchase_orders_revision_positive check (revision_number > 0),
  constraint purchase_orders_actor_not_blank check (length(trim(created_by)) > 0 and length(trim(updated_by)) > 0),
  constraint purchase_orders_issue_state check ((status in ('issued','superseded')) = (issued_at is not null)),
  constraint purchase_orders_cancel_state check ((status = 'cancelled') = (cancelled_at is not null))
);
create unique index purchase_orders_po_number_unique_idx on public.purchase_orders (po_number) where po_number is not null;
create index purchase_orders_status_order_date_idx on public.purchase_orders (status, order_date desc);
create index purchase_orders_family_revision_idx on public.purchase_orders (po_family_id, revision_number desc);
create index purchase_orders_vendor_idx on public.purchase_orders (vendor_id) where vendor_id is not null;

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  line_number integer not null,
  line_category text not null default 'chip' check (line_category in ('chip')),
  status text not null default 'active' check (status in ('active','cancelled','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_order_lines_number_positive check (line_number > 0),
  unique (purchase_order_id, line_number)
);

create table public.chip_purchase_order_line_details (
  purchase_order_line_id uuid primary key references public.purchase_order_lines(id) on delete cascade,
  production_job_id uuid references public.jobs(id) on delete restrict,
  catalog_source text check (catalog_source is null or catalog_source in ('standard','specialty')),
  catalog_item_id uuid,
  vendor_sku_snapshot text,
  material_name_snapshot text not null,
  chip_size text not null,
  package_quantity numeric(12,3),
  package_measure text,
  container_type text,
  moisture_condition text check (moisture_condition is null or moisture_condition in ('dry','damp','wet')),
  quantity_ordered numeric(12,3) not null,
  order_unit text not null,
  unit_price numeric(14,4),
  price_basis text,
  requested_date_override date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chip_po_material_not_blank check (length(trim(material_name_snapshot)) > 0),
  constraint chip_po_size_not_blank check (length(trim(chip_size)) > 0),
  constraint chip_po_quantity_positive check (quantity_ordered > 0),
  constraint chip_po_package_quantity_positive check (package_quantity is null or package_quantity > 0),
  constraint chip_po_order_unit_not_blank check (length(trim(order_unit)) > 0),
  constraint chip_po_unit_price_nonnegative check (unit_price is null or unit_price >= 0)
);
create index chip_po_details_job_idx on public.chip_purchase_order_line_details (production_job_id) where production_job_id is not null;
create index chip_po_details_material_idx on public.chip_purchase_order_line_details (lower(material_name_snapshot), chip_size);

create or replace function public.save_chip_purchase_order_draft(p_order jsonb, p_lines jsonb, p_actor text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  order_id uuid := nullif(p_order->>'id','')::uuid;
  existing public.purchase_orders%rowtype;
  line jsonb;
  line_id uuid;
  retained_ids uuid[] := '{}';
  calculated_subtotal numeric(14,2) := 0;
  calculated_total numeric(14,2);
  freight_value numeric(14,2) := coalesce(nullif(p_order->>'freight','')::numeric,0);
  tax_value numeric(14,2) := coalesce(nullif(p_order->>'tax','')::numeric,0);
  discount_value numeric(14,2) := coalesce(nullif(p_order->>'discount','')::numeric,0);
begin
  if nullif(trim(p_actor),'') is null then raise exception 'Your name is required.'; end if;
  if nullif(trim(p_order->>'vendor_name_snapshot'),'') is null then raise exception 'Vendor is required.'; end if;
  if nullif(p_order->>'order_date','') is null then raise exception 'Order date is required.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one chip line.'; end if;
  if freight_value < 0 or tax_value < 0 or discount_value < 0 then raise exception 'Commercial adjustments cannot be negative.'; end if;

  if order_id is null then
    insert into public.purchase_orders (vendor_id,vendor_name_snapshot,vendor_address_snapshot,vendor_contact_snapshot,order_date,requested_date,currency,freight,tax,discount,commercial_notes,internal_notes,created_by,updated_by)
    values (nullif(p_order->>'vendor_id','')::uuid,trim(p_order->>'vendor_name_snapshot'),nullif(trim(p_order->>'vendor_address_snapshot'),''),nullif(trim(p_order->>'vendor_contact_snapshot'),''),(p_order->>'order_date')::date,nullif(p_order->>'requested_date','')::date,upper(coalesce(nullif(trim(p_order->>'currency'),''),'USD')),freight_value,tax_value,discount_value,nullif(trim(p_order->>'commercial_notes'),''),nullif(trim(p_order->>'internal_notes'),''),trim(p_actor),trim(p_actor)) returning id into order_id;
  else
    select * into existing from public.purchase_orders where id = order_id for update;
    if not found then raise exception 'Purchase Order was not found.'; end if;
    if existing.status <> 'draft' then raise exception 'Only draft Purchase Orders can be edited.'; end if;
    update public.purchase_orders set vendor_id=nullif(p_order->>'vendor_id','')::uuid,vendor_name_snapshot=trim(p_order->>'vendor_name_snapshot'),vendor_address_snapshot=nullif(trim(p_order->>'vendor_address_snapshot'),''),vendor_contact_snapshot=nullif(trim(p_order->>'vendor_contact_snapshot'),''),order_date=(p_order->>'order_date')::date,requested_date=nullif(p_order->>'requested_date','')::date,currency=upper(coalesce(nullif(trim(p_order->>'currency'),''),'USD')),freight=freight_value,tax=tax_value,discount=discount_value,commercial_notes=nullif(trim(p_order->>'commercial_notes'),''),internal_notes=nullif(trim(p_order->>'internal_notes'),''),updated_by=trim(p_actor),updated_at=now() where id=order_id;
    update public.purchase_order_lines set line_number=line_number+100000 where purchase_order_id=order_id;
  end if;

  for line in select value from jsonb_array_elements(p_lines) loop
    if coalesce((line->>'line_number')::integer,0) <= 0 then raise exception 'Line number must be positive.'; end if;
    if nullif(trim(line->>'material_name_snapshot'),'') is null or nullif(trim(line->>'chip_size'),'') is null then raise exception 'Every chip line needs material and chip size.'; end if;
    if coalesce((line->>'quantity_ordered')::numeric,0) <= 0 then raise exception 'Every chip line needs a positive order quantity.'; end if;
    if nullif(line->>'id','') is not null then
      line_id := (line->>'id')::uuid;
      if not exists (select 1 from public.purchase_order_lines where id=line_id and purchase_order_id=order_id) then raise exception 'A submitted line does not belong to this draft.'; end if;
      update public.purchase_order_lines set line_number=(line->>'line_number')::integer,updated_at=now() where id=line_id;
    else
      insert into public.purchase_order_lines (purchase_order_id,line_number) values (order_id,(line->>'line_number')::integer) returning id into line_id;
    end if;
    insert into public.chip_purchase_order_line_details (purchase_order_line_id,production_job_id,catalog_source,catalog_item_id,vendor_sku_snapshot,material_name_snapshot,chip_size,package_quantity,package_measure,container_type,moisture_condition,quantity_ordered,order_unit,unit_price,price_basis,requested_date_override,notes)
    values (line_id,nullif(line->>'production_job_id','')::uuid,nullif(line->>'catalog_source',''),nullif(line->>'catalog_item_id','')::uuid,nullif(trim(line->>'vendor_sku_snapshot'),''),trim(line->>'material_name_snapshot'),trim(line->>'chip_size'),nullif(line->>'package_quantity','')::numeric,nullif(trim(line->>'package_measure'),''),nullif(trim(line->>'container_type'),''),nullif(line->>'moisture_condition',''),(line->>'quantity_ordered')::numeric,trim(line->>'order_unit'),nullif(line->>'unit_price','')::numeric,nullif(trim(line->>'price_basis'),''),nullif(line->>'requested_date_override','')::date,nullif(trim(line->>'notes'),''))
    on conflict (purchase_order_line_id) do update set production_job_id=excluded.production_job_id,catalog_source=excluded.catalog_source,catalog_item_id=excluded.catalog_item_id,vendor_sku_snapshot=excluded.vendor_sku_snapshot,material_name_snapshot=excluded.material_name_snapshot,chip_size=excluded.chip_size,package_quantity=excluded.package_quantity,package_measure=excluded.package_measure,container_type=excluded.container_type,moisture_condition=excluded.moisture_condition,quantity_ordered=excluded.quantity_ordered,order_unit=excluded.order_unit,unit_price=excluded.unit_price,price_basis=excluded.price_basis,requested_date_override=excluded.requested_date_override,notes=excluded.notes,updated_at=now();
    retained_ids := array_append(retained_ids,line_id);
  end loop;
  delete from public.purchase_order_lines where purchase_order_id=order_id and not (id=any(retained_ids));
  select coalesce(sum(round(details.quantity_ordered*details.unit_price,2)),0) into calculated_subtotal from public.purchase_order_lines lines join public.chip_purchase_order_line_details details on details.purchase_order_line_id=lines.id where lines.purchase_order_id=order_id and details.unit_price is not null;
  calculated_total := calculated_subtotal+freight_value+tax_value-discount_value;
  if calculated_total < 0 then raise exception 'Discount cannot exceed subtotal, freight, and tax.'; end if;
  update public.purchase_orders set subtotal=calculated_subtotal,total=calculated_total,updated_by=trim(p_actor),updated_at=now() where id=order_id;
  return order_id;
end;
$function$;

alter table public.vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.chip_purchase_order_line_details enable row level security;
create policy "Purchasing reference read" on public.vendors for select to anon, authenticated using (true);
create policy "Purchase Order read" on public.purchase_orders for select to anon, authenticated using (true);
create policy "Purchase Order line read" on public.purchase_order_lines for select to anon, authenticated using (true);
create policy "Chip PO detail read" on public.chip_purchase_order_line_details for select to anon, authenticated using (true);
revoke all on function public.save_chip_purchase_order_draft(jsonb,jsonb,text) from public;
grant execute on function public.save_chip_purchase_order_draft(jsonb,jsonb,text) to anon, authenticated, service_role;

commit;
