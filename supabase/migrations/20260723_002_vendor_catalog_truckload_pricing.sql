begin;

alter table public.vendor_catalog_v2
  add column if not exists truckload_price numeric(12,2),
  add column if not exists truckload_minimum_quantity numeric(12,3),
  add column if not exists truckload_minimum_uom text;

alter table public.vendor_catalog_v2
  drop constraint if exists vendor_catalog_v2_truckload_price_nonnegative,
  drop constraint if exists vendor_catalog_v2_truckload_minimum_positive,
  drop constraint if exists vendor_catalog_v2_truckload_configuration_complete;

alter table public.vendor_catalog_v2
  add constraint vendor_catalog_v2_truckload_price_nonnegative
    check (truckload_price is null or truckload_price >= 0),
  add constraint vendor_catalog_v2_truckload_minimum_positive
    check (truckload_minimum_quantity is null or truckload_minimum_quantity > 0),
  add constraint vendor_catalog_v2_truckload_configuration_complete check (
    (truckload_price is null and truckload_minimum_quantity is null and truckload_minimum_uom is null)
    or (truckload_minimum_quantity is not null and nullif(trim(truckload_minimum_uom), '') is not null)
  );

comment on column public.vendor_catalog_v2.truckload_price is
  'Optional truckload unit price suggestion.';
comment on column public.vendor_catalog_v2.truckload_minimum_quantity is
  'Quantity at which truckload pricing supersedes bulk and individual pricing.';
comment on column public.vendor_catalog_v2.truckload_minimum_uom is
  'Order unit required for the truckload threshold; no automatic unit conversion is performed.';

create or replace function public.save_purchasing_catalog_item(p_item jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  item_id uuid := nullif(p_item->>'id','')::uuid;
  selected_vendor uuid := nullif(p_item->>'vendor_id','')::uuid;
  vendor_name text;
  individual_price numeric := round(nullif(p_item->>'price','')::numeric, 2);
  selected_bulk_price numeric := round(nullif(p_item->>'bulk_price','')::numeric, 2);
  selected_bulk_minimum numeric := nullif(p_item->>'bulk_minimum_quantity','')::numeric;
  selected_bulk_uom text := nullif(trim(p_item->>'bulk_minimum_uom'),'');
  selected_truckload_price numeric := round(nullif(p_item->>'truckload_price','')::numeric, 2);
  selected_truckload_minimum numeric := nullif(p_item->>'truckload_minimum_quantity','')::numeric;
  selected_truckload_uom text := nullif(trim(p_item->>'truckload_minimum_uom'),'');
begin
  select name into vendor_name from public.vendors where id=selected_vendor;
  if vendor_name is null then raise exception 'Select a configured Vendor.'; end if;
  if nullif(trim(p_item->>'item_name'),'') is null then raise exception 'Material name is required.'; end if;
  if individual_price is not null and individual_price < 0 then raise exception 'Individual catalog price cannot be negative.'; end if;
  if selected_bulk_price is not null and selected_bulk_price < 0 then raise exception 'Bulk catalog price cannot be negative.'; end if;
  if selected_bulk_minimum is not null and selected_bulk_minimum <= 0 then raise exception 'Bulk minimum quantity must be positive.'; end if;
  if selected_truckload_price is not null and selected_truckload_price < 0 then raise exception 'Truckload catalog price cannot be negative.'; end if;
  if selected_truckload_minimum is not null and selected_truckload_minimum <= 0 then raise exception 'Truckload minimum quantity must be positive.'; end if;
  if (selected_bulk_price is not null or selected_bulk_minimum is not null or selected_bulk_uom is not null)
     and (selected_bulk_minimum is null or selected_bulk_uom is null) then
    raise exception 'Bulk pricing requires a positive minimum quantity and compatible unit.';
  end if;
  if (selected_truckload_price is not null or selected_truckload_minimum is not null or selected_truckload_uom is not null)
     and (selected_truckload_minimum is null or selected_truckload_uom is null) then
    raise exception 'Truckload pricing requires a positive minimum quantity and compatible unit.';
  end if;
  if selected_bulk_minimum is not null
     and selected_truckload_minimum is not null
     and lower(trim(selected_bulk_uom)) = lower(trim(selected_truckload_uom))
     and selected_truckload_minimum <= selected_bulk_minimum then
    raise exception 'Truckload minimum quantity must be greater than the Bulk minimum for the same unit.';
  end if;

  if item_id is null then
    insert into public.vendor_catalog_v2 (
      vendor_id,vendor_name,vendor_sku,category,item_name,size,unit_size,unit_size_uom,packaging,
      price,bulk_price,bulk_minimum_quantity,bulk_minimum_uom,
      truckload_price,truckload_minimum_quantity,truckload_minimum_uom,
      price_unit,quote_required,is_active,lead_time_days,minimum_order_qty,minimum_order_uom,
      notes,product_line,material_type,canonical_vendor,canonical_item_name,canonical_size,
      pricing_status,updated_at
    ) values (
      selected_vendor,vendor_name,nullif(trim(p_item->>'vendor_sku'),''),
      coalesce(nullif(trim(p_item->>'category'),''),'misc'),
      trim(p_item->>'item_name'),nullif(trim(p_item->>'size'),''),
      nullif(p_item->>'unit_size','')::numeric,nullif(trim(p_item->>'unit_size_uom'),''),
      nullif(trim(p_item->>'packaging'),''),individual_price,
      selected_bulk_price,selected_bulk_minimum,selected_bulk_uom,
      selected_truckload_price,selected_truckload_minimum,selected_truckload_uom,
      nullif(trim(p_item->>'price_unit'),''),individual_price is null,
      coalesce((p_item->>'is_active')::boolean,true),nullif(p_item->>'lead_time_days','')::integer,
      nullif(p_item->>'minimum_order_qty','')::numeric,nullif(trim(p_item->>'minimum_order_uom'),''),
      nullif(trim(p_item->>'notes'),''),nullif(trim(p_item->>'product_line'),''),
      coalesce(nullif(trim(p_item->>'material_type'),''),'chip'),vendor_name,
      trim(p_item->>'item_name'),nullif(trim(p_item->>'size'),''),
      case when individual_price is null then 'quote_required' else 'priced' end,now()
    ) returning id into item_id;
  else
    update public.vendor_catalog_v2 set
      vendor_id=selected_vendor,
      price=individual_price,
      bulk_price=selected_bulk_price,
      bulk_minimum_quantity=selected_bulk_minimum,
      bulk_minimum_uom=selected_bulk_uom,
      truckload_price=selected_truckload_price,
      truckload_minimum_quantity=selected_truckload_minimum,
      truckload_minimum_uom=selected_truckload_uom,
      price_unit=nullif(trim(p_item->>'price_unit'),''),
      quote_required=individual_price is null,
      pricing_status=case when individual_price is null then 'quote_required' else 'priced' end,
      updated_at=now()
    where id=item_id and (vendor_id=selected_vendor or vendor_id is null);
    if not found then raise exception 'Vendor catalog item was not found.'; end if;
  end if;
  return item_id;
exception when unique_violation then
  raise exception 'This Vendor SKU already exists for the selected Vendor.';
end;
$function$;

revoke all on function public.save_purchasing_catalog_item(jsonb) from public;
grant execute on function public.save_purchasing_catalog_item(jsonb)
  to anon, authenticated, service_role;

commit;
