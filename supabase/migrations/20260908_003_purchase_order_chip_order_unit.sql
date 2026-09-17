-- Enforce the Tenarten Chip ordering invariant at canonical write/issue boundaries:
-- package capacity may be LB, but ordered quantity is a count of Bags.
begin;

do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.save_chip_purchase_order_draft(jsonb,jsonb,text)')) into original_definition;
  if original_definition is null then raise exception 'Purchase Order draft save function was not found.'; end if;
  patched_definition:=replace(original_definition,
    $search$if line->>'material_type' = 'chip' and nullif(trim(line->>'chip_size'),'') is null then raise exception 'Every Chip line requires Size.'; end if;$search$,
    $replacement$if line->>'material_type' = 'chip' and nullif(trim(line->>'chip_size'),'') is null then raise exception 'Every Chip line requires Size.'; end if;
    if line->>'material_type' = 'chip' and lower(trim(coalesce(line->>'order_unit',''))) not in ('bag','bags') then raise exception 'Every Chip line requires Bag as its order unit.'; end if;$replacement$);
  if patched_definition=original_definition or patched_definition not like '%Every Chip line requires Bag as its order unit.%' then raise exception 'Purchase Order Chip draft order-unit patch did not match expected definition.'; end if;
  execute patched_definition;
end;
$migration$;

do $migration$
declare original_definition text; patched_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.issue_purchase_order(uuid,text,timestamptz)')) into original_definition;
  if original_definition is null then raise exception 'Purchase Order issuance function was not found.'; end if;
  patched_definition:=regexp_replace(original_definition,
    $pattern$or\s+\(lines\.material_type\s*=\s*'chip'\s+and\s+nullif\(trim\(details\.chip_size\),\s*''\)\s+is\s+null\)\s+or\s+details\.quantity_ordered\s*<=\s*0$pattern$,
    $replacement$or (lines.material_type = 'chip' and nullif(trim(details.chip_size), '') is null)
        or (lines.material_type = 'chip' and lower(trim(details.order_unit)) not in ('bag','bags'))
        or details.quantity_ordered <= 0$replacement$,
    'g');
  if patched_definition=original_definition or patched_definition not like '%lower(trim(details.order_unit)) not in (''bag'',''bags'')%' then raise exception 'Purchase Order Chip issuance order-unit patch did not match expected definition.'; end if;
  execute patched_definition;
end;
$migration$;

commit;
