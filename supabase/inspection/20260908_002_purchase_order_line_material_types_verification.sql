-- Run after applying 20260908_002 in a disposable database. Always rolls back.
begin;

do $verification$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchase_order_lines' and column_name='material_type') then raise exception 'Line material type is missing.'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='chip_purchase_order_line_details' and column_name='resin_color') then raise exception 'Resin Color is missing.'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='chip_purchase_order_line_details' and column_name='component_type') then raise exception 'Component Type is missing.'; end if;
  if to_regprocedure('public.save_purchasing_catalog_item_v2(jsonb)') is null then raise exception 'Mode-aware Catalog save RPC is missing.'; end if;
  if pg_get_functiondef(to_regprocedure('public.issue_purchase_order(uuid,text,timestamptz)')) not like '%''line_kind'', lines.material_type%' then raise exception 'Issuance does not snapshot line classification.'; end if;
  if pg_get_functiondef(to_regprocedure('public.tenops_create_pending_receivals_from_po_impl(uuid,jsonb,text)')) not like '%not in (''chip'',''resin'')%' then raise exception 'Pending Receivals do not accept Resin lines.'; end if;
end;
$verification$;

rollback;
