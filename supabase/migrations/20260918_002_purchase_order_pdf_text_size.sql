-- Draft preference and future issuance snapshots only. No historical backfill.
begin;
alter table public.purchase_orders add column pdf_text_size text
  check (pdf_text_size in ('compact', 'standard', 'large'));
comment on column public.purchase_orders.pdf_text_size is
  'PDF readability preset. NULL is Standard for historical compatibility.';

-- Preserve the installed authorization/save implementation and its grants.
-- Fail closed if the expected insertion points have changed.
do $migration$
declare original text; patched text;
begin
  select pg_get_functiondef('public.save_chip_purchase_order_draft_v2(jsonb,jsonb,text)'::regprocedure) into original;
  patched := replace(original,
    'order_id:=public.save_chip_purchase_order_draft(',
    $patch$if p_order ? 'pdf_text_size' and (p_order->>'pdf_text_size' is null or p_order->>'pdf_text_size' not in ('compact','standard','large')) then
    raise exception 'PDF text size must be compact, standard, or large.' using errcode='22023';
  end if;
  order_id:=public.save_chip_purchase_order_draft($patch$);
  if patched = original then raise exception 'PDF text-size validation patch did not match'; end if;
  original := patched;
  patched := replace(original, 'set job_po_reference_type=reference_type,',
    $patch$set pdf_text_size=case when p_order ? 'pdf_text_size' then p_order->>'pdf_text_size' else pdf_text_size end, job_po_reference_type=reference_type,$patch$);
  if patched = original then raise exception 'PDF text-size persistence patch did not match'; end if;
  execute patched;

  select pg_get_functiondef('public.capture_purchase_order_pdf_snapshot_fields()'::regprocedure) into original;
  patched := replace(original, '''customer'', customer_snapshot,',
    $patch$'pdf_text_size', coalesce((select pdf_text_size from public.purchase_orders where id=new.purchase_order_id), 'standard'),
    'customer', customer_snapshot,$patch$);
  if patched = original then raise exception 'PDF text-size issuance snapshot patch did not match'; end if;
  execute patched;
end;$migration$;
commit;
