-- Guarded cleanup for explicitly confirmed demonstration Purchase Orders.
-- Issued snapshots remain immutable during normal application behavior.

create or replace function public.guard_purchase_order_issuance_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if tg_op = 'DELETE'
     and current_setting('tenops.allow_test_po_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'Issued Purchase Order snapshots are immutable.';
end;
$function$;

create or replace function public.guard_issued_purchase_order()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if tg_op = 'DELETE'
     and current_setting('tenops.allow_test_po_purge', true) = 'on' then
    return old;
  end if;
  if old.status <> 'draft' then
    raise exception 'Issued Purchase Orders are immutable. Create a future revision instead.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function public.guard_issued_purchase_order_line()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
declare parent_status text; parent_id uuid;
begin
  if tg_op = 'DELETE'
     and current_setting('tenops.allow_test_po_purge', true) = 'on' then
    return old;
  end if;
  if tg_op = 'DELETE' then parent_id := old.purchase_order_id;
  else parent_id := new.purchase_order_id;
  end if;
  select status into parent_status from public.purchase_orders where id = parent_id;
  if tg_op = 'DELETE' and parent_status is null then return old; end if;
  if parent_status is distinct from 'draft' then
    raise exception 'Issued Purchase Order lines are immutable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function public.guard_issued_chip_purchase_order_detail()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
declare parent_status text; detail_line_id uuid;
begin
  if tg_op = 'DELETE'
     and current_setting('tenops.allow_test_po_purge', true) = 'on' then
    return old;
  end if;
  if tg_op = 'DELETE' then detail_line_id := old.purchase_order_line_id;
  else detail_line_id := new.purchase_order_line_id;
  end if;
  select orders.status into parent_status
  from public.purchase_order_lines lines
  join public.purchase_orders orders on orders.id = lines.purchase_order_id
  where lines.id = detail_line_id;
  if tg_op = 'DELETE' and parent_status is null then return old; end if;
  if parent_status is distinct from 'draft' then
    raise exception 'Issued Purchase Order line details are immutable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function public.purge_test_purchase_order(
  p_purchase_order_id uuid,
  p_expected_po_number text,
  p_confirmation text
)
returns table (storage_bucket text, storage_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare selected_order public.purchase_orders%rowtype;
begin
  select * into selected_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then raise exception 'Purchase Order was not found.'; end if;
  if selected_order.status <> 'issued' then
    raise exception 'Only an issued demonstration Purchase Order can use this cleanup.';
  end if;
  if selected_order.po_number is distinct from trim(p_expected_po_number)
     or trim(p_confirmation) <> 'DELETE ' || selected_order.po_number then
    raise exception 'The Purchase Order number or deletion confirmation does not match.';
  end if;
  if exists (
    select 1 from public.purchase_orders
    where supersedes_purchase_order_id = selected_order.id
  ) then raise exception 'A later revision depends on this Purchase Order.'; end if;
  if exists (
    select 1
    from public.pending_receivals receival
    join public.purchase_order_issuances issuance
      on issuance.id = receival.source_purchase_order_issuance_id
    where issuance.purchase_order_id = selected_order.id
      and (
        receival.status <> 'cancelled'
        or coalesce(receival.quantity_received, 0) <> 0
        or receival.receipt_inventory_item_id is not null
        or receival.receipt_transaction_id is not null
      )
  ) then
    raise exception 'This Purchase Order has active or received material and cannot be deleted.';
  end if;

  return query
  select document.storage_bucket, document.storage_path
  from public.purchase_order_documents document
  join public.purchase_order_issuances issuance on issuance.id = document.issuance_id
  where issuance.purchase_order_id = selected_order.id;

  perform set_config('tenops.allow_test_po_purge', 'on', true);

  delete from public.pending_receivals receival
  using public.purchase_order_issuances issuance
  where issuance.purchase_order_id = selected_order.id
    and receival.source_purchase_order_issuance_id = issuance.id;
  delete from public.purchase_order_documents document
  using public.purchase_order_issuances issuance
  where issuance.purchase_order_id = selected_order.id
    and document.issuance_id = issuance.id;
  delete from public.purchase_order_issuances where purchase_order_id = selected_order.id;
  delete from public.chip_purchase_order_line_details detail
  using public.purchase_order_lines line
  where line.purchase_order_id = selected_order.id
    and detail.purchase_order_line_id = line.id;
  delete from public.purchase_order_lines where purchase_order_id = selected_order.id;
  delete from public.purchase_orders where id = selected_order.id;
end;
$function$;

revoke all on function public.purge_test_purchase_order(uuid, text, text) from public;
grant execute on function public.purge_test_purchase_order(uuid, text, text) to anon, authenticated;

comment on function public.purge_test_purchase_order(uuid, text, text) is
  'Explicitly confirmed demonstration cleanup. Refuses active/received receivals and dependent revisions.';
