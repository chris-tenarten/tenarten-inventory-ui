-- Fixed isolated Free fixture only. Actual shared metadata; no Production data.
-- Empty PO/receiving FK targets are ID/JSON scaffolds, not full purchasing validation.
begin;set local lock_timeout='3s';set local statement_timeout='25s';
do $$begin
 if to_regclass('public.tenops_fixture_shared_receival_contract') is not null then raise exception 'Parity projection was already applied; inspect rather than replay';end if;
 if to_regclass('public.purchase_order_issuances') is not null or to_regclass('public.purchase_order_lines') is not null or to_regclass('public.receiving_documents') is not null or to_regclass('public.receiving_document_lines') is not null then raise exception 'Unreviewed FK target tables exist';end if;
end$$;
create table public.purchase_order_issuances(id uuid primary key,order_snapshot jsonb not null default '{}'::jsonb,lines_snapshot jsonb not null default '[]'::jsonb);
create table public.purchase_order_lines(id uuid primary key);
create table public.receiving_documents(id uuid primary key);
create table public.receiving_document_lines(id uuid primary key);
revoke all on public.purchase_order_issuances,public.purchase_order_lines,public.receiving_documents,public.receiving_document_lines from public,anon,authenticated,service_role;

alter table public.vendor_catalog drop constraint vendor_catalog_pkey;
alter table public.vendor_catalog alter column id drop default;
alter table public.vendor_catalog alter column "id" drop not null;
alter table public.vendor_catalog alter column "vendor" drop not null;
alter table public.vendor_catalog alter column "item_name" drop not null;
alter table public.vendor_catalog alter column "price" type text using "price"::text;
alter table public.vendor_catalog add column "notes" text;
alter table public.vendor_catalog add column "match_warning" text;
alter table public.vendor_catalog add column "appearance_notes" text;
alter table public.vendor_catalog alter column "created_at" drop default;
alter table public.vendor_catalog add column "source_file" text;
alter table public.vendor_catalog add column "price_basis" text;
alter table public.vendor_catalog alter column "updated_at" drop default;
alter table public.vendor_catalog add column "annotated_by" text;
alter table public.vendor_catalog add column "source_url" text;
alter table public.vendor_catalog add column "pricing_status" text;
alter table public.vendor_catalog add column "customizable" boolean default false;
alter table public.vendor_catalog add column "custom_identifier_type" text;
 drop policy "fixture_caller_operational_read" on public.vendor_catalog;
create policy "tenops_business_write_delete" on public.vendor_catalog as RESTRICTIVE for DELETE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_insert" on public.vendor_catalog as RESTRICTIVE for INSERT to "anon","authenticated" with check(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_update" on public.vendor_catalog as RESTRICTIVE for UPDATE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text)) with check(has_app_capability('writeBusinessData'::text));
alter table public.vendor_catalog disable row level security;
alter table public.vendor_catalog_v2 add column "manufacturer" text;
alter table public.vendor_catalog_v2 add column "source_url" text;
alter table public.vendor_catalog_v2 alter column "category" set not null;
alter table public.vendor_catalog_v2 add column "subcategory" text;
alter table public.vendor_catalog_v2 add column "variant" text;
alter table public.vendor_catalog_v2 alter column "unit_size" type numeric using "unit_size"::numeric;
alter table public.vendor_catalog_v2 add column "finish" text;
alter table public.vendor_catalog_v2 add column "description" text;
alter table public.vendor_catalog_v2 alter column "quote_required" set not null;
alter table public.vendor_catalog_v2 add column "region" text default 'Texas'::text;
do $$begin if exists(select 1 from public.vendor_catalog_v2 where "minimum_order_qty" is not null and "minimum_order_qty"<>round("minimum_order_qty",2)) then raise exception 'Unsafe fixture decimal narrowing';end if;end$$;
alter table public.vendor_catalog_v2 alter column "minimum_order_qty" type numeric(12,2) using "minimum_order_qty"::numeric(12,2);
alter table public.vendor_catalog_v2 alter column "created_at" set not null;
alter table public.vendor_catalog_v2 alter column "updated_at" set not null;
alter table public.vendor_catalog_v2 add column "source_vendor_product_family" text;
alter table public.vendor_catalog_v2 add constraint "vendor_catalog_v2_bulk_configuration_complete" CHECK (bulk_price IS NULL AND bulk_minimum_quantity IS NULL AND bulk_minimum_uom IS NULL OR bulk_minimum_quantity IS NOT NULL AND NULLIF(TRIM(BOTH FROM bulk_minimum_uom), ''::text) IS NOT NULL);
alter table public.vendor_catalog_v2 add constraint "vendor_catalog_v2_bulk_minimum_positive" CHECK (bulk_minimum_quantity IS NULL OR bulk_minimum_quantity > 0::numeric);
alter table public.vendor_catalog_v2 add constraint "vendor_catalog_v2_bulk_price_nonnegative" CHECK (bulk_price IS NULL OR bulk_price >= 0::numeric);
alter table public.vendor_catalog_v2 add constraint "vendor_catalog_v2_category_check" CHECK (category = ANY (ARRAY['glass'::text, 'filler'::text, 'resin'::text, 'marble'::text, 'misc'::text])) not valid;
alter table public.vendor_catalog_v2 drop constraint "vendor_catalog_v2_vendor_id_fkey";
alter table public.vendor_catalog_v2 add constraint "vendor_catalog_v2_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
 drop policy "fixture_caller_operational_read" on public.vendor_catalog_v2;
create policy "tenops_business_write_delete" on public.vendor_catalog_v2 as RESTRICTIVE for DELETE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_insert" on public.vendor_catalog_v2 as RESTRICTIVE for INSERT to "anon","authenticated" with check(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_update" on public.vendor_catalog_v2 as RESTRICTIVE for UPDATE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text)) with check(has_app_capability('writeBusinessData'::text));
alter table public.vendor_catalog_v2 disable row level security;
CREATE OR REPLACE FUNCTION public.set_updated_at_vendor_catalog_v2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$
;
CREATE TRIGGER trg_set_updated_at_vendor_catalog_v2 BEFORE UPDATE ON vendor_catalog_v2 FOR EACH ROW EXECUTE FUNCTION set_updated_at_vendor_catalog_v2();
alter table public.vendors add column "address_line_1" text;
alter table public.vendors add column "address_line_2" text;
alter table public.vendors add column "city" text;
alter table public.vendors add column "state" text;
alter table public.vendors add column "postal_code" text;
alter table public.vendors add column "country" text;
alter table public.vendors add column "website" text;
alter table public.vendors add column "notes" text;
 drop policy "fixture_caller_operational_read" on public.vendors;
create policy "Purchasing reference read" on public.vendors as PERMISSIVE for SELECT to "anon","authenticated" using(true);
create policy "tenops_business_write_delete" on public.vendors as RESTRICTIVE for DELETE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_insert" on public.vendors as RESTRICTIVE for INSERT to "anon","authenticated" with check(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_update" on public.vendors as RESTRICTIVE for UPDATE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text)) with check(has_app_capability('writeBusinessData'::text));
alter table public.vendors enable row level security;
alter table public.pending_receivals alter column "vendor" drop not null;
alter table public.pending_receivals alter column "quantity_received" drop not null;
alter table public.pending_receivals alter column "unit" drop not null;
alter table public.pending_receivals alter column "unit" set default 'Bags'::text;
alter table public.pending_receivals alter column "location" set default 'Denton'::text;
alter table public.pending_receivals alter column "is_earmarked" set not null;
alter table public.pending_receivals add column "source_purchase_order_issuance_id" uuid;
alter table public.pending_receivals add column "source_purchase_order_line_id" uuid;
alter table public.pending_receivals add column "source_purchase_order_line_number" integer;
alter table public.pending_receivals add column "source_purchase_order_number" text;
alter table public.pending_receivals add column "source_receiving_document_id" uuid;
alter table public.pending_receivals add column "source_receiving_document_line_id" uuid;
alter table public.pending_receivals add column "source_allocation_key" text default 'legacy'::text not null;
alter table public.pending_receivals add constraint "pending_receivals_source_purchase_order_issuance_id_fkey" FOREIGN KEY (source_purchase_order_issuance_id) REFERENCES purchase_order_issuances(id) ON DELETE RESTRICT;
alter table public.pending_receivals add constraint "pending_receivals_source_purchase_order_line_id_fkey" FOREIGN KEY (source_purchase_order_line_id) REFERENCES purchase_order_lines(id) ON DELETE RESTRICT;
alter table public.pending_receivals add constraint "pending_receivals_source_receiving_document_id_fkey" FOREIGN KEY (source_receiving_document_id) REFERENCES receiving_documents(id) ON DELETE RESTRICT;
alter table public.pending_receivals add constraint "pending_receivals_source_receiving_document_line_id_fkey" FOREIGN KEY (source_receiving_document_line_id) REFERENCES receiving_document_lines(id) ON DELETE RESTRICT;
alter table public.pending_receivals drop constraint "pending_receivals_status_check";
alter table public.pending_receivals add constraint "pending_receivals_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'received'::text, 'cancelled'::text, 'cleared'::text]));
alter table public.pending_receivals drop constraint pending_receivals_quantity_expected_check;alter table public.pending_receivals drop constraint pending_receivals_quantity_received_check;
 drop policy "Pending Receivals RBAC delete" on public.pending_receivals;
 drop policy "Pending Receivals RBAC insert" on public.pending_receivals;
 drop policy "Pending Receivals RBAC update" on public.pending_receivals;
 drop policy "fixture_caller_operational_read" on public.pending_receivals;
create policy "Allow anon read pending receivals" on public.pending_receivals as PERMISSIVE for SELECT to "anon" using(true);
create policy "Pending Receivals RBAC delete" on public.pending_receivals as PERMISSIVE for DELETE to "authenticated" using(has_app_capability('adjustInventory'::text));
create policy "Pending Receivals RBAC insert" on public.pending_receivals as PERMISSIVE for INSERT to "authenticated" with check(has_app_capability('adjustInventory'::text));
create policy "Pending Receivals RBAC update" on public.pending_receivals as PERMISSIVE for UPDATE to "authenticated" using(has_app_capability('adjustInventory'::text)) with check(has_app_capability('adjustInventory'::text));
create policy "Pending receivals read" on public.pending_receivals as PERMISSIVE for SELECT to public using(true);
create policy "tenops_business_write_delete" on public.pending_receivals as RESTRICTIVE for DELETE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_insert" on public.pending_receivals as RESTRICTIVE for INSERT to "anon","authenticated" with check(has_app_capability('writeBusinessData'::text));
create policy "tenops_business_write_update" on public.pending_receivals as RESTRICTIVE for UPDATE to "anon","authenticated" using(has_app_capability('writeBusinessData'::text)) with check(has_app_capability('writeBusinessData'::text));
alter table public.pending_receivals enable row level security;
CREATE OR REPLACE FUNCTION public.tenops_catalog_save_impl(p_item jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      coalesce(nullif(trim(p_item->>'category'),''),'Chip / Aggregate'),
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
$function$
;
alter function public.tenops_catalog_save_impl(jsonb) owner to postgres;revoke all on function public.tenops_catalog_save_impl(jsonb) from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.tenops_catalog_save_v2_impl(p_item jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare item_id uuid; selected_type text:=nullif(btrim(p_item->>'material_type'),''); selected_category text;
begin
  if selected_type not in ('chip','resin','pigment','filler','other') then
    raise exception 'Catalog material type must be a supported Purchase Order material classification.' using errcode='22023';
  end if;
  selected_category:=case selected_type
    when 'chip' then 'Chip / Aggregate'
    when 'resin' then 'Resin'
    when 'pigment' then 'Pigment'
    when 'filler' then 'Filler'
    else 'Other'
  end;
  item_id:=public.save_purchasing_catalog_item(p_item);
  update public.vendor_catalog_v2 set
    material_type=selected_type,
    category=coalesce(nullif(btrim(p_item->>'category'),''),selected_category),
    color=case when selected_type='resin' then nullif(btrim(p_item->>'color'),'') else null end,
    component_type=case when selected_type='resin' then nullif(btrim(p_item->>'component_type'),'') else null end,
    updated_at=now()
  where id=item_id;
  return item_id;
end;$function$
;
alter function public.tenops_catalog_save_v2_impl(jsonb) owner to postgres;revoke all on function public.tenops_catalog_save_v2_impl(jsonb) from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.check_po_receival_allocations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare issuance_id uuid; line_id uuid; snapshot jsonb; header jsonb; expected jsonb; actual jsonb;
begin
 if tg_op='UPDATE' and row(new.source_purchase_order_issuance_id,new.source_purchase_order_line_id,new.source_allocation_key) is distinct from row(old.source_purchase_order_issuance_id,old.source_purchase_order_line_id,old.source_allocation_key) then raise exception 'PO receival source identity is immutable.'; end if;
 issuance_id:=coalesce(new.source_purchase_order_issuance_id,old.source_purchase_order_issuance_id);
 line_id:=coalesce(new.source_purchase_order_line_id,old.source_purchase_order_line_id);
 select order_snapshot,value into header,snapshot from public.purchase_order_issuances i cross join lateral jsonb_array_elements(i.lines_snapshot) where i.id=issuance_id and value->>'purchase_order_line_id'=line_id::text;
 if header->>'reservation_allocation_version' is distinct from '1' then return null; end if;
 if exists(select 1 from public.pending_receivals where source_purchase_order_issuance_id=issuance_id and source_purchase_order_line_id=line_id and (quantity_expected<=0 or quantity_received<0 or quantity_received>quantity_expected or material_name is distinct from snapshot->>'material' or unit is distinct from snapshot->>'unit' or temporary_job_label is not null or coalesce(is_earmarked,false) is distinct from (production_job_id is not null))) then raise exception 'Issued PO receipt identity or quantity cannot be changed; cancel an undelivered balance instead.'; end if;
 select coalesce(jsonb_object_agg(a->>'production_job_id',(a->>'quantity')::numeric),'{}'::jsonb) into expected from jsonb_array_elements(snapshot->'reservation_allocations') a;
 expected:=expected||jsonb_build_object('stock',(snapshot->>'quantity')::numeric-(select coalesce(sum((a->>'quantity')::numeric),0) from jsonb_array_elements(snapshot->'reservation_allocations') a));
 select coalesce(jsonb_object_agg(job,qty),'{}'::jsonb) into actual from (select coalesce(production_job_id::text,'stock') job,sum(quantity_expected) qty from public.pending_receivals where source_purchase_order_issuance_id=issuance_id and source_purchase_order_line_id=line_id group by production_job_id) totals;
 if not(actual?'stock') then actual:=actual||'{"stock":0}'::jsonb; end if;
 if actual<>expected then raise exception 'PO receipt portions must reconcile to the immutable Job allocations and general-stock remainder.'; end if;
 return null;
end $function$
;
CREATE CONSTRAINT TRIGGER po_receival_allocation_reconciliation AFTER INSERT OR DELETE OR UPDATE ON pending_receivals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_po_receival_allocations();
CREATE INDEX idx_pending_receivals_status ON public.pending_receivals USING btree (status);
CREATE UNIQUE INDEX pending_receivals_allocation_source_uidx ON public.pending_receivals USING btree (source_purchase_order_issuance_id, source_purchase_order_line_id, source_allocation_key) WHERE ((source_purchase_order_issuance_id IS NOT NULL) AND (source_purchase_order_line_id IS NOT NULL));
CREATE INDEX pending_receivals_production_job_idx ON public.pending_receivals USING btree (production_job_id) WHERE (production_job_id IS NOT NULL);
CREATE INDEX pending_receivals_purchase_order_number_idx ON public.pending_receivals USING btree (source_purchase_order_number) WHERE (source_purchase_order_number IS NOT NULL);
CREATE UNIQUE INDEX pending_receivals_purchase_order_source_uidx ON public.pending_receivals USING btree (source_purchase_order_issuance_id, source_purchase_order_line_id) WHERE ((source_purchase_order_issuance_id IS NOT NULL) AND (source_purchase_order_line_id IS NOT NULL) AND (source_allocation_key = 'legacy'::text));
CREATE UNIQUE INDEX pending_receivals_receiving_document_line_unique_idx ON public.pending_receivals USING btree (source_receiving_document_line_id) WHERE (source_receiving_document_line_id IS NOT NULL);
CREATE INDEX pending_receivals_status_eta_idx ON public.pending_receivals USING btree (status, eta, created_at);
create table public.tenops_fixture_shared_receival_contract(id boolean primary key default true check(id),shared_metadata_sha256 text not null,applied_at timestamptz not null default now());
revoke all on public.tenops_fixture_shared_receival_contract from public,anon,authenticated,service_role;
insert into public.tenops_fixture_shared_receival_contract(shared_metadata_sha256) values('15ba1e4f1206d5aeaabb537acf6b0ed1b14113f574c56ff8eab763ae090c8b94');
notify pgrst,'reload schema';commit;
