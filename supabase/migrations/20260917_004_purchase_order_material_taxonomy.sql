-- Expand canonical PO line classification beyond Chip/Resin without changing
-- historical rows or issued snapshots. Purchase Orders remain material-agnostic.
begin;

alter table public.purchase_order_lines drop constraint if exists purchase_order_lines_material_type_check;
alter table public.purchase_order_lines add constraint purchase_order_lines_material_type_check
  check (material_type is null or material_type in ('chip','resin','pigment','filler','other'));

do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.save_chip_purchase_order_draft(jsonb,jsonb,text)')) into original_definition;
  if original_definition is null then raise exception 'Purchase Order draft save function was not found.'; end if;
  patched_definition:=replace(original_definition,
    $search$if coalesce(line->>'material_type','') not in ('chip','resin') then raise exception 'Every material line requires Chip or Resin classification.'; end if;$search$,
    $replacement$if coalesce(line->>'material_type','') not in ('chip','resin','pigment','filler','other') then raise exception 'Every material line requires a supported material classification.'; end if;$replacement$);
  if patched_definition=original_definition or patched_definition not like '%''pigment'',''filler'',''other''%' then
    raise exception 'Purchase Order draft material taxonomy patch did not match expected definition.';
  end if;
  execute patched_definition;
end;
$migration$;

do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.issue_purchase_order(uuid,text,timestamptz)')) into original_definition;
  if original_definition is null then raise exception 'Purchase Order issuance function was not found.'; end if;
  patched_definition:=replace(original_definition,
    $search$lines.material_type not in ('chip','resin')$search$,
    $replacement$lines.material_type not in ('chip','resin','pigment','filler','other')$replacement$);
  if patched_definition=original_definition or patched_definition not like '%lines.material_type not in (''chip'',''resin'',''pigment'',''filler'',''other'')%' then
    raise exception 'Purchase Order issuance material taxonomy patch did not match expected definition.';
  end if;
  execute patched_definition;
end;
$migration$;

create or replace function public.save_purchasing_catalog_item_v2(p_item jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
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
end;$function$;
revoke all on function public.save_purchasing_catalog_item_v2(jsonb) from public;
grant execute on function public.save_purchasing_catalog_item_v2(jsonb) to anon,authenticated,service_role;

-- Exceptional recovery boundary for evidence-backed lost drafts. It delegates
-- to the canonical draft save core but intentionally omits number allocation;
-- the next ordinary save through save_chip_purchase_order_draft_v2 allocates
-- the number using the unchanged normal workflow.
create or replace function public.recover_purchase_order_draft_v2(
  p_order jsonb,p_lines jsonb,p_actor text,p_confirmation text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare order_id uuid; line jsonb;
begin
  if p_confirmation <> 'RECOVER_EVIDENCE_BACKED_UNNUMBERED_DRAFT' then
    raise exception 'Recovery confirmation is required.' using errcode='22023';
  end if;
  if nullif(p_order->>'id','') is not null or nullif(p_order->>'po_number','') is not null then
    raise exception 'Recovery creates only a new unnumbered Draft.' using errcode='22023';
  end if;
  order_id:=public.save_chip_purchase_order_draft(p_order-'po_number'-'job_po_reference_type',p_lines,p_actor);
  update public.purchase_orders set job_po_reference_type=null,updated_at=now()
  where id=order_id and status='draft' and po_number is null;
  if not found then raise exception 'Recovery did not create an unnumbered Purchase Order Draft.'; end if;
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
  return order_id;
end;$function$;
revoke all on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text) from public,anon;
grant execute on function public.recover_purchase_order_draft_v2(jsonb,jsonb,text,text) to authenticated,service_role;

do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)')) into original_definition;
  if original_definition is null then raise exception 'Pending Receival projection implementation was not found.'; end if;
  patched_definition:=replace(original_definition,
    $search$coalesce(snapshot_line ->> 'line_kind', '') not in ('chip','resin')$search$,
    $replacement$coalesce(snapshot_line ->> 'line_kind', '') not in ('chip','resin','pigment','filler','other')$replacement$);
  if patched_definition=original_definition or patched_definition not like '%''pigment'',''filler'',''other''%' then
    raise exception 'Pending Receival material taxonomy patch did not match expected definition.';
  end if;
  execute patched_definition;
end;
$migration$;

commit;
