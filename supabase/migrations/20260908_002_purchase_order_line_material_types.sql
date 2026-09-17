-- Canonical per-line Chip/Resin classification for material-agnostic Purchase Orders.
-- Historical rows and immutable issuance snapshots remain unchanged.
begin;

alter table public.purchase_order_lines add column if not exists material_type text;
alter table public.purchase_order_lines drop constraint if exists purchase_order_lines_material_type_check;
alter table public.purchase_order_lines add constraint purchase_order_lines_material_type_check
  check (material_type is null or material_type in ('chip','resin'));

alter table public.chip_purchase_order_line_details
  alter column chip_size drop not null,
  add column if not exists resin_color text,
  add column if not exists component_type text;
alter table public.chip_purchase_order_line_details drop constraint if exists chip_po_size_not_blank;

alter table public.vendor_catalog_v2
  add column if not exists color text,
  add column if not exists component_type text;

-- Keep the legacy save function name/signature, but make its validation line-aware.
do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.save_chip_purchase_order_draft(jsonb,jsonb,text)')) into original_definition;
  if original_definition is null then raise exception 'Purchase Order draft save function was not found.'; end if;
  patched_definition := regexp_replace(
    original_definition,
    $pattern$if\s+nullif\(trim\(line->>'material_name_snapshot'\),''\) is null or nullif\(trim\(line->>'chip_size'\),''\) is null then raise exception 'Every chip line needs material and chip size\.'; end if;$pattern$,
    $replacement$if nullif(trim(line->>'material_name_snapshot'),'') is null then raise exception 'Every material line needs a product or material.'; end if;
    if coalesce(line->>'material_type','') not in ('chip','resin') then raise exception 'Every material line requires Chip or Resin classification.'; end if;
    if line->>'material_type' = 'chip' and nullif(trim(line->>'chip_size'),'') is null then raise exception 'Every Chip line requires Size.'; end if;$replacement$,
    'g'
  );
  if patched_definition = original_definition then raise exception 'Purchase Order draft validation patch did not match.'; end if;
  execute patched_definition;
end;
$migration$;

-- The compatibility wrapper remains the public save boundary and persists the
-- new fields after the legacy core has retained stable line identities.
create or replace function public.save_chip_purchase_order_draft_v2(p_order jsonb,p_lines jsonb,p_actor text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare order_id uuid; reference_type text:=nullif(btrim(p_order->>'job_po_reference_type'),''); line jsonb;
begin
  if reference_type is not null and reference_type not in ('resin','chip') then raise exception 'Production PO reference type must be Resin or Chip.' using errcode='22023'; end if;
  if reference_type is not null and nullif(p_order->>'production_job_id','') is null then raise exception 'Link a Production Job before selecting a Resin or Chip PO reference.' using errcode='22023'; end if;
  order_id:=public.save_chip_purchase_order_draft(p_order-'po_number'-'job_po_reference_type',p_lines,p_actor);
  update public.purchase_orders set job_po_reference_type=reference_type,updated_at=now() where id=order_id and status='draft';
  if not found then raise exception 'Only draft Purchase Orders can set a Production PO reference.'; end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    update public.purchase_order_lines set material_type=line->>'material_type',updated_at=now()
    where purchase_order_id=order_id and line_number=(line->>'line_number')::integer;
    update public.chip_purchase_order_line_details details set
      resin_color=nullif(btrim(line->>'resin_color'),''),
      component_type=nullif(btrim(line->>'component_type'),''),
      moisture_condition=case when line->>'material_type'='chip' then nullif(line->>'moisture_condition','') else null end,
      updated_at=now()
    from public.purchase_order_lines order_line
    where order_line.purchase_order_id=order_id and order_line.line_number=(line->>'line_number')::integer
      and details.purchase_order_line_id=order_line.id;
  end loop;
  perform public.allocate_purchase_order_number(order_id);
  return order_id;
end;$function$;
revoke all on function public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text) from public;
grant execute on function public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text) to anon,authenticated,service_role;

-- Patch issuance validation and enrich only future immutable snapshots.
do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.issue_purchase_order(uuid,text,timestamptz)')) into original_definition;
  if original_definition is null then raise exception 'Purchase Order issuance function was not found.'; end if;
  patched_definition:=regexp_replace(original_definition,
    $pattern$or\s+nullif\(trim\(details\.chip_size\),\s*''\)\s+is\s+null\s+or\s+details\.quantity_ordered\s*<=\s*0$pattern$,
    $replacement$or lines.material_type not in ('chip','resin')
        or (lines.material_type = 'chip' and nullif(trim(details.chip_size), '') is null)
        or details.quantity_ordered <= 0$replacement$,
    'g');
  if patched_definition=original_definition then raise exception 'Purchase Order issuance validation patch did not match expected definition.'; end if;
  patched_definition:=replace(patched_definition,
    $search$'po_category', selected_order.po_category,$search$,
    $replacement$'po_category', selected_order.po_category,
    'material_classification', (select case when count(distinct classification_lines.material_type)=2 then 'mixed' else min(classification_lines.material_type) end from public.purchase_order_lines classification_lines where classification_lines.purchase_order_id=selected_order.id),$replacement$);
  if patched_definition not like '%material_classification%' then raise exception 'Purchase Order issuance header snapshot patch did not match expected definition.'; end if;
  patched_definition:=replace(patched_definition,
    $search$'line_kind', lines.line_category,$search$,
    $replacement$'line_kind', lines.material_type,$replacement$);
  if patched_definition not like '%''line_kind'', lines.material_type%' then raise exception 'Purchase Order issuance line classification patch did not match expected definition.'; end if;
  patched_definition:=replace(patched_definition,
    $search$'chip_size', details.chip_size,$search$,
    $replacement$'chip_size', details.chip_size,
      'resin_color', details.resin_color,
      'component_type', details.component_type,$replacement$);
  if patched_definition not like '%''resin_color'', details.resin_color%' then raise exception 'Purchase Order issuance Resin attribute patch did not match expected definition.'; end if;
  execute patched_definition;
end;$migration$;

-- Existing catalog authorization remains in the original RPC; this wrapper
-- enriches the row returned by that authorized operation.
create or replace function public.save_purchasing_catalog_item_v2(p_item jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare item_id uuid; selected_type text:=nullif(btrim(p_item->>'material_type'),'');
begin
  if selected_type not in ('chip','resin') then raise exception 'Catalog material type must be Chip or Resin.' using errcode='22023'; end if;
  item_id:=public.save_purchasing_catalog_item(p_item);
  update public.vendor_catalog_v2 set
    material_type=selected_type,
    category=coalesce(nullif(btrim(p_item->>'category'),''),case when selected_type='resin' then 'Resin' else 'Chip / Aggregate' end),
    color=case when selected_type='resin' then nullif(btrim(p_item->>'color'),'') else null end,
    component_type=case when selected_type='resin' then nullif(btrim(p_item->>'component_type'),'') else null end,
    updated_at=now()
  where id=item_id;
  return item_id;
end;$function$;
revoke all on function public.save_purchasing_catalog_item_v2(jsonb) from public;
grant execute on function public.save_purchasing_catalog_item_v2(jsonb) to anon,authenticated,service_role;

-- The public projection RPC retains its RBAC boundary and delegates to this
-- non-executable implementation function. Extend only the implementation's
-- immutable-snapshot eligibility gate.
do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)')) into original_definition;
  if original_definition is null then raise exception 'Pending Receival projection implementation was not found.'; end if;
  patched_definition:=replace(original_definition,
    $search$coalesce(snapshot_line ->> 'line_kind', '') <> 'chip'$search$,
    $replacement$coalesce(snapshot_line ->> 'line_kind', '') not in ('chip','resin')$replacement$);
  if patched_definition=original_definition then raise exception 'Pending Receival material eligibility patch did not match the protected implementation.'; end if;
  execute patched_definition;
end;$migration$;

commit;
