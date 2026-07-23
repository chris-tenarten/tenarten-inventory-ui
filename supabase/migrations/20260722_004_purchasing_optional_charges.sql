begin;

alter table public.purchase_orders
  add column discount_percent numeric(7,4),
  add column discount_amount numeric(14,2),
  add column tax_percent numeric(7,4),
  add column tax_amount numeric(14,2),
  add column freight numeric(14,2),
  add column total numeric(14,2) not null default 0,
  add constraint purchase_orders_optional_charge_rates check (
    (discount_percent is null or discount_percent between 0 and 100)
    and (tax_percent is null or tax_percent between 0 and 100)
  ),
  add constraint purchase_orders_optional_charge_amounts check (
    (discount_amount is null or discount_amount >= 0)
    and (tax_amount is null or tax_amount >= 0)
    and (freight is null or freight >= 0)
    and total >= 0
  );

update public.purchase_orders set total = subtotal where total = 0;

create or replace function public.save_chip_purchase_order_draft(p_order jsonb, p_lines jsonb, p_actor text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  order_id uuid := nullif(p_order->>'id','')::uuid;
  existing public.purchase_orders%rowtype;
  line jsonb;
  line_id uuid;
  retained_ids uuid[] := '{}';
  calculated_subtotal numeric(14,2) := 0;
  discount_rate numeric(7,4) := nullif(p_order->>'discount_percent','')::numeric;
  tax_rate numeric(7,4) := nullif(p_order->>'tax_percent','')::numeric;
  freight_value numeric(14,2) := nullif(p_order->>'freight','')::numeric;
  calculated_discount numeric(14,2);
  taxable_subtotal numeric(14,2);
  calculated_tax numeric(14,2);
  calculated_total numeric(14,2);
begin
  if nullif(trim(p_actor),'') is null then raise exception 'PO Originated By is required.'; end if;
  if nullif(trim(p_order->>'vendor_name_snapshot'),'') is null then raise exception 'Vendor is required.'; end if;
  if nullif(p_order->>'order_date','') is null then raise exception 'PO Date is required.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one chip line.'; end if;
  if discount_rate is not null and (discount_rate < 0 or discount_rate > 100) then raise exception 'Discount percent must be between 0 and 100.'; end if;
  if tax_rate is not null and (tax_rate < 0 or tax_rate > 100) then raise exception 'Tax percent must be between 0 and 100.'; end if;
  if freight_value is not null and freight_value < 0 then raise exception 'Freight cannot be negative.'; end if;

  if order_id is null then
    insert into public.purchase_orders (
      production_job_id,job_number_snapshot,job_name_snapshot,
      vendor_id,vendor_name_snapshot,vendor_address_snapshot,vendor_contact_snapshot,
      ship_to_snapshot,payment_terms_snapshot,authorized_by_snapshot,
      order_date,requested_date,currency,commercial_notes,internal_notes,
      discount_percent,tax_percent,freight,created_by,updated_by
    ) values (
      nullif(p_order->>'production_job_id','')::uuid,
      nullif(trim(p_order->>'job_number_snapshot'),''),nullif(trim(p_order->>'job_name_snapshot'),''),
      nullif(p_order->>'vendor_id','')::uuid,trim(p_order->>'vendor_name_snapshot'),
      nullif(trim(p_order->>'vendor_address_snapshot'),''),nullif(trim(p_order->>'vendor_contact_snapshot'),''),
      nullif(trim(p_order->>'ship_to_snapshot'),''),nullif(trim(p_order->>'payment_terms_snapshot'),''),
      nullif(trim(p_order->>'authorized_by_snapshot'),''),(p_order->>'order_date')::date,
      nullif(p_order->>'requested_date','')::date,'USD',nullif(trim(p_order->>'commercial_notes'),''),
      nullif(trim(p_order->>'internal_notes'),''),discount_rate,tax_rate,freight_value,trim(p_actor),trim(p_actor)
    ) returning id into order_id;
  else
    select * into existing from public.purchase_orders where id = order_id for update;
    if not found then raise exception 'Purchase Order was not found.'; end if;
    if existing.status <> 'draft' then raise exception 'Only draft Purchase Orders can be edited.'; end if;
    update public.purchase_orders set
      production_job_id=nullif(p_order->>'production_job_id','')::uuid,
      job_number_snapshot=nullif(trim(p_order->>'job_number_snapshot'),''),
      job_name_snapshot=nullif(trim(p_order->>'job_name_snapshot'),''),
      vendor_id=nullif(p_order->>'vendor_id','')::uuid,vendor_name_snapshot=trim(p_order->>'vendor_name_snapshot'),
      vendor_address_snapshot=nullif(trim(p_order->>'vendor_address_snapshot'),''),
      vendor_contact_snapshot=nullif(trim(p_order->>'vendor_contact_snapshot'),''),
      ship_to_snapshot=nullif(trim(p_order->>'ship_to_snapshot'),''),
      payment_terms_snapshot=nullif(trim(p_order->>'payment_terms_snapshot'),''),
      authorized_by_snapshot=nullif(trim(p_order->>'authorized_by_snapshot'),''),
      order_date=(p_order->>'order_date')::date,requested_date=nullif(p_order->>'requested_date','')::date,
      currency='USD',commercial_notes=nullif(trim(p_order->>'commercial_notes'),''),
      internal_notes=nullif(trim(p_order->>'internal_notes'),''),discount_percent=discount_rate,
      tax_percent=tax_rate,freight=freight_value,updated_by=trim(p_actor),updated_at=now()
    where id=order_id;
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
    insert into public.chip_purchase_order_line_details (
      purchase_order_line_id,production_job_id,catalog_source,catalog_item_id,vendor_sku_snapshot,
      material_name_snapshot,chip_size,package_quantity,package_measure,container_type,moisture_condition,
      quantity_ordered,order_unit,unit_price,price_basis,notes
    ) values (
      line_id,nullif(line->>'production_job_id','')::uuid,nullif(line->>'catalog_source',''),
      nullif(line->>'catalog_item_id','')::uuid,nullif(trim(line->>'vendor_sku_snapshot'),''),
      trim(line->>'material_name_snapshot'),trim(line->>'chip_size'),nullif(line->>'package_quantity','')::numeric,
      nullif(trim(line->>'package_measure'),''),nullif(trim(line->>'container_type'),''),
      nullif(line->>'moisture_condition',''),(line->>'quantity_ordered')::numeric,trim(line->>'order_unit'),
      nullif(line->>'unit_price','')::numeric,nullif(trim(line->>'price_basis'),''),nullif(trim(line->>'notes'),'')
    ) on conflict (purchase_order_line_id) do update set
      production_job_id=excluded.production_job_id,catalog_source=excluded.catalog_source,
      catalog_item_id=excluded.catalog_item_id,vendor_sku_snapshot=excluded.vendor_sku_snapshot,
      material_name_snapshot=excluded.material_name_snapshot,chip_size=excluded.chip_size,
      package_quantity=excluded.package_quantity,package_measure=excluded.package_measure,
      container_type=excluded.container_type,moisture_condition=excluded.moisture_condition,
      quantity_ordered=excluded.quantity_ordered,order_unit=excluded.order_unit,
      unit_price=excluded.unit_price,price_basis=excluded.price_basis,notes=excluded.notes,updated_at=now();
    retained_ids := array_append(retained_ids,line_id);
  end loop;

  delete from public.purchase_order_lines where purchase_order_id=order_id and not (id=any(retained_ids));
  select coalesce(sum(round(details.quantity_ordered*details.unit_price,2)),0)
    into calculated_subtotal from public.purchase_order_lines lines
    join public.chip_purchase_order_line_details details on details.purchase_order_line_id=lines.id
    where lines.purchase_order_id=order_id and details.unit_price is not null;
  calculated_discount := round(calculated_subtotal*coalesce(discount_rate,0)/100,2);
  taxable_subtotal := calculated_subtotal-calculated_discount;
  calculated_tax := round(taxable_subtotal*coalesce(tax_rate,0)/100,2);
  calculated_total := taxable_subtotal+calculated_tax+coalesce(freight_value,0);
  update public.purchase_orders set subtotal=calculated_subtotal,discount_amount=calculated_discount,
    tax_amount=calculated_tax,total=calculated_total,updated_by=trim(p_actor),updated_at=now()
    where id=order_id;
  return order_id;
end;
$function$;

revoke all on function public.save_chip_purchase_order_draft(jsonb,jsonb,text) from public;
grant execute on function public.save_chip_purchase_order_draft(jsonb,jsonb,text) to anon, authenticated, service_role;

commit;
