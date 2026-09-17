-- Run after applying 20260908_003. Read-only verification transaction.
begin;

do $verification$
begin
  if pg_get_functiondef(to_regprocedure('public.save_chip_purchase_order_draft(jsonb,jsonb,text)')) not like '%Every Chip line requires Bag as its order unit.%' then
    raise exception 'Chip Bag order-unit draft guard is missing.';
  end if;
  if pg_get_functiondef(to_regprocedure('public.issue_purchase_order(uuid,text,timestamptz)')) not like '%lower(trim(details.order_unit)) not in (''bag'',''bags'')%' then
    raise exception 'Chip Bag order-unit issuance guard is missing.';
  end if;
end;
$verification$;

rollback;
