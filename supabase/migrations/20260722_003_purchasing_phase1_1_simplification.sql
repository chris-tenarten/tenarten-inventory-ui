begin;

alter table public.purchase_orders
  add column production_job_id uuid references public.jobs(id) on delete restrict,
  add column job_number_snapshot text,
  add column job_name_snapshot text,
  add column ship_to_snapshot text,
  add column payment_terms_snapshot text,
  add column authorized_by_snapshot text;

create index purchase_orders_production_job_idx
  on public.purchase_orders (production_job_id)
  where production_job_id is not null;

alter table public.purchase_orders
  drop constraint purchase_orders_money_nonnegative,
  drop column freight,
  drop column tax,
  drop column discount,
  drop column total,
  add constraint purchase_orders_subtotal_nonnegative check (subtotal >= 0);

alter table public.chip_purchase_order_line_details
  drop column requested_date_override;

create or replace function public.save_chip_purchase_order_draft(p_order jsonb, p_lines jsonb, p_actor text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  order_id uuid := nullif(p_order->>'id','')::uuid;
  existing public.purchase_orders%rowtype;
  line jsonb;
  line_id uuid;
  retained_ids uuid[] := '{}';
  calculated_subtotal numeric(14,2) := 0;
begin
  if nullif(trim(p_actor),'') is null then raise exception 'PO Originated By is required.'; end if;
  if nullif(trim(p_order->>'vendor_name_snapshot'),'') is null then raise exception 'Vendor is required.'; end if;
  if nullif(p_order->>'order_date','') is null then raise exception 'PO Date is required.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one chip line.'; end if;

  if order_id is null then
    insert into public.purchase_orders (
      production_job_id,job_number_snapshot,job_name_snapshot,
      vendor_id,vendor_name_snapshot,vendor_address_snapshot,vendor_contact_snapshot,
      ship_to_snapshot,payment_terms_snapshot,authorized_by_snapshot,
      order_date,requested_date,currency,commercial_notes,internal_notes,created_by,updated_by
    ) values (
      nullif(p_order->>'production_job_id','')::uuid,
      nullif(trim(p_order->>'job_number_snapshot'),''),nullif(trim(p_order->>'job_name_snapshot'),''),
      nullif(p_order->>'vendor_id','')::uuid,trim(p_order->>'vendor_name_snapshot'),
      nullif(trim(p_order->>'vendor_address_snapshot'),''),nullif(trim(p_order->>'vendor_contact_snapshot'),''),
      nullif(trim(p_order->>'ship_to_snapshot'),''),nullif(trim(p_order->>'payment_terms_snapshot'),''),
      nullif(trim(p_order->>'authorized_by_snapshot'),''),(p_order->>'order_date')::date,
      nullif(p_order->>'requested_date','')::date,'USD',nullif(trim(p_order->>'commercial_notes'),''),
      nullif(trim(p_order->>'internal_notes'),''),trim(p_actor),trim(p_actor)
    ) returning id into order_id;
  else
    select * into existing from public.purchase_orders where id = order_id for update;
    if not found then raise exception 'Purchase Order was not found.'; end if;
    if existing.status <> 'draft' then raise exception 'Only draft Purchase Orders can be edited.'; end if;
    update public.purchase_orders set
      production_job_id=nullif(p_order->>'production_job_id','')::uuid,
      job_number_snapshot=nullif(trim(p_order->>'job_number_snapshot'),''),
      job_name_snapshot=nullif(trim(p_order->>'job_name_snapshot'),''),
      vendor_id=nullif(p_order->>'vendor_id','')::uuid,
      vendor_name_snapshot=trim(p_order->>'vendor_name_snapshot'),
      vendor_address_snapshot=nullif(trim(p_order->>'vendor_address_snapshot'),''),
      vendor_contact_snapshot=nullif(trim(p_order->>'vendor_contact_snapshot'),''),
      ship_to_snapshot=nullif(trim(p_order->>'ship_to_snapshot'),''),
      payment_terms_snapshot=nullif(trim(p_order->>'payment_terms_snapshot'),''),
      authorized_by_snapshot=nullif(trim(p_order->>'authorized_by_snapshot'),''),
      order_date=(p_order->>'order_date')::date,requested_date=nullif(p_order->>'requested_date','')::date,
      currency='USD',commercial_notes=nullif(trim(p_order->>'commercial_notes'),''),
      internal_notes=nullif(trim(p_order->>'internal_notes'),''),updated_by=trim(p_actor),updated_at=now()
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
    into calculated_subtotal
    from public.purchase_order_lines lines
    join public.chip_purchase_order_line_details details on details.purchase_order_line_id=lines.id
    where lines.purchase_order_id=order_id and details.unit_price is not null;
  update public.purchase_orders set subtotal=calculated_subtotal,updated_by=trim(p_actor),updated_at=now() where id=order_id;
  return order_id;
end;
$function$;

revoke all on function public.save_chip_purchase_order_draft(jsonb,jsonb,text) from public;
grant execute on function public.save_chip_purchase_order_draft(jsonb,jsonb,text) to anon, authenticated, service_role;

commit;
