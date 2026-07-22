begin;

alter table public.inventory_transactions
  add column if not exists pending_receival_id uuid references public.pending_receivals(id) on delete set null,
  add column if not exists inventory_item_id bigint references public.inventory_items(id) on delete set null,
  add column if not exists reversal_of_transaction_id uuid references public.inventory_transactions(id) on delete set null,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by text;

alter table public.pending_receivals
  add column if not exists receipt_inventory_item_id bigint references public.inventory_items(id) on delete set null,
  add column if not exists receipt_transaction_id uuid references public.inventory_transactions(id) on delete set null,
  add column if not exists receipt_created_inventory_item boolean;

create index if not exists inventory_transactions_pending_receival_idx
  on public.inventory_transactions (pending_receival_id)
  where pending_receival_id is not null;

create index if not exists inventory_transactions_reversal_idx
  on public.inventory_transactions (reversal_of_transaction_id)
  where reversal_of_transaction_id is not null;

create or replace function public.receive_pending_receival_with_reservation(
  p_receival_id uuid,
  p_received_by text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  receival public.pending_receivals%rowtype;
  destination public.inventory_items%rowtype;
  remaining_quantity numeric;
  reservation_label text;
  reservation_enabled boolean;
  transaction_vendor text;
  destination_found boolean := false;
  created_inventory_item boolean := false;
  destination_id bigint;
  new_receipt_transaction_id uuid;
  receipt_note text;
  event_time timestamptz := now();
begin
  if nullif(trim(p_received_by), '') is null then
    raise exception 'Received by is required.';
  end if;

  select * into receival
  from public.pending_receivals
  where id = p_receival_id
  for update;

  if not found then raise exception 'Pending receival was not found.'; end if;
  if receival.status not in ('pending', 'partially_received') then
    raise exception 'Pending receival is no longer receivable.';
  end if;

  remaining_quantity := receival.quantity_expected - coalesce(receival.quantity_received, 0);
  if receival.quantity_expected is null
    or coalesce(receival.quantity_received, 0) < 0
    or coalesce(receival.quantity_received, 0) > receival.quantity_expected then
    raise exception 'Pending receival has invalid expected or received quantities.';
  end if;
  if remaining_quantity <= 0 then raise exception 'Pending receival has no remaining quantity.'; end if;

  if receival.production_job_id is not null then
    select coalesce(
      nullif(trim(receival.earmarked_job_name), ''),
      case when nullif(trim(job_number), '') is not null then trim(job_number) || ' — ' || name else name end
    ) into reservation_label
    from public.jobs where id = receival.production_job_id;
  else
    reservation_label := coalesce(
      nullif(trim(receival.temporary_job_label), ''),
      nullif(trim(receival.earmarked_job_name), '')
    );
  end if;

  reservation_enabled := receival.production_job_id is not null
    or nullif(trim(receival.temporary_job_label), '') is not null
    or coalesce(receival.is_earmarked, false);
  transaction_vendor := coalesce(nullif(trim(receival.vendor), ''), 'Unspecified');
  receipt_note := concat_ws(' ', 'Received from pending receival.', nullif(receival.notes, ''));

  if not reservation_enabled then
    select * into destination
    from public.inventory_items inventory
    where lower(trim(coalesce(inventory.vendor, ''))) = lower(trim(coalesce(receival.vendor, '')))
      and lower(trim(coalesce(inventory.color, ''))) = lower(trim(coalesce(receival.material_name, '')))
      and lower(trim(coalesce(inventory.size, ''))) = lower(trim(coalesce(receival.size, '')))
      and lower(trim(coalesce(inventory.category, ''))) = lower(trim(coalesce(receival.category, '')))
      and lower(trim(coalesce(inventory.unit, 'Bags'))) = lower(trim(coalesce(nullif(receival.unit, ''), 'Bags')))
      and lower(trim(coalesce(inventory.location, 'Denton'))) = lower(trim(coalesce(nullif(receival.location, ''), 'Denton')))
      and lower(trim(coalesce(inventory.pallet_number, ''))) = lower(trim(coalesce(receival.pallet_number, '')))
      and coalesce(inventory.earmarked_for_job, false) = false
      and inventory.production_job_id is null
      and nullif(trim(inventory.temporary_job_label), '') is null
    order by inventory.updated_at desc nulls last, inventory.id desc
    limit 1 for update;
    destination_found := found;
  end if;

  if destination_found then
    destination_id := destination.id;
    update public.inventory_items
    set quantity = coalesce(quantity, 0) + remaining_quantity,
        updated_at = event_time,
        last_counted_at = event_time
    where id = destination_id;
  else
    insert into public.inventory_items (
      vendor, color, size, category, quantity, unit, location, pallet_number, notes,
      earmarked_for_job, earmarked_job, earmark_notes, production_job_id, temporary_job_label,
      updated_at, last_counted_at
    ) values (
      nullif(receival.vendor, ''), receival.material_name, nullif(receival.size, ''), nullif(receival.category, ''),
      remaining_quantity, coalesce(nullif(receival.unit, ''), 'Bags'),
      coalesce(nullif(receival.location, ''), 'Denton'), nullif(receival.pallet_number, ''), receival.notes,
      reservation_enabled, reservation_label, nullif(receival.earmark_notes, ''), receival.production_job_id,
      nullif(trim(receival.temporary_job_label), ''), event_time, event_time
    ) returning id into destination_id;
    created_inventory_item := true;
  end if;

  insert into public.inventory_transactions (
    transaction_type, vendor, item_name, size, unit, quantity, location, notes,
    catalog_source, is_earmarked, earmarked_job_name, earmarked_job_id,
    earmark_notes, production_job_id, temporary_job_label, synced_to_inventory_at,
    pending_receival_id, inventory_item_id
  ) values (
    'intake', transaction_vendor, receival.material_name, nullif(receival.size, ''),
    coalesce(nullif(receival.unit, ''), 'Bags'), remaining_quantity,
    coalesce(nullif(receival.location, ''), 'Denton'), receipt_note,
    'standard', reservation_enabled, reservation_label, null, nullif(receival.earmark_notes, ''),
    receival.production_job_id, nullif(trim(receival.temporary_job_label), ''), event_time,
    receival.id, destination_id
  ) returning id into new_receipt_transaction_id;

  update public.pending_receivals
  set quantity_received = quantity_expected,
      status = 'received',
      received_by = trim(p_received_by),
      received_at = event_time,
      receipt_inventory_item_id = destination_id,
      receipt_transaction_id = new_receipt_transaction_id,
      receipt_created_inventory_item = created_inventory_item
  where id = p_receival_id;
end;
$function$;

create or replace function public.undo_pending_receival_receipt(
  p_receival_id uuid,
  p_actor text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  receival public.pending_receivals%rowtype;
  receipt_tx public.inventory_transactions%rowtype;
  inventory public.inventory_items%rowtype;
  reversal_note text;
  event_time timestamptz := now();
begin
  if nullif(trim(p_actor), '') is null then raise exception 'Your name is required.'; end if;

  select * into receival from public.pending_receivals where id = p_receival_id for update;
  if not found then raise exception 'Pending receival was not found.'; end if;
  if receival.status <> 'received' then raise exception 'Only a received queue item can be undone.'; end if;
  if receival.receipt_transaction_id is null or receival.receipt_inventory_item_id is null
    or receival.receipt_created_inventory_item is null then
    raise exception 'This receipt predates undo tracking and cannot be safely undone automatically.';
  end if;

  select * into receipt_tx
  from public.inventory_transactions
  where id = receival.receipt_transaction_id
  for update;
  if not found or receipt_tx.pending_receival_id is distinct from receival.id
    or receipt_tx.inventory_item_id is distinct from receival.receipt_inventory_item_id
    or receipt_tx.transaction_type <> 'intake'
    or receipt_tx.reversed_at is not null then
    raise exception 'The linked receipt transaction is missing, invalid, or already reversed.';
  end if;

  select * into inventory
  from public.inventory_items
  where id = receival.receipt_inventory_item_id
  for update;
  if not found then raise exception 'The received inventory lot no longer exists.'; end if;
  if inventory.updated_at is distinct from receival.received_at
    or inventory.last_counted_at is distinct from receival.received_at then
    raise exception 'This stock changed after receipt. Reverse its later inventory activity before undoing the receipt.';
  end if;
  if coalesce(inventory.quantity, 0) < receipt_tx.quantity then
    raise exception 'The received quantity is no longer fully available and cannot be undone.';
  end if;

  reversal_note := '[' || trim(p_actor) || '] Undid pending receival receipt.';
  if nullif(trim(p_reason), '') is not null then reversal_note := reversal_note || E'\nReason: ' || trim(p_reason); end if;

  if receival.receipt_created_inventory_item then
    if inventory.quantity <> receipt_tx.quantity then
      raise exception 'The received lot quantity changed after receipt and cannot be undone.';
    end if;
    delete from public.inventory_items where id = inventory.id;
  else
    update public.inventory_items
    set quantity = quantity - receipt_tx.quantity,
        updated_at = event_time,
        last_counted_at = event_time
    where id = inventory.id;
  end if;

  update public.inventory_transactions
  set reversed_at = event_time, reversed_by = trim(p_actor)
  where id = receipt_tx.id;

  insert into public.inventory_transactions (
    transaction_type, vendor, item_name, size, unit, quantity, location, notes,
    catalog_source, is_earmarked, earmarked_job_name, earmarked_job_id,
    earmark_notes, production_job_id, temporary_job_label, synced_to_inventory_at,
    pending_receival_id, inventory_item_id, reversal_of_transaction_id
  ) values (
    'adjustment', receipt_tx.vendor, receipt_tx.item_name, receipt_tx.size, receipt_tx.unit,
    -receipt_tx.quantity, receipt_tx.location, reversal_note, receipt_tx.catalog_source,
    receipt_tx.is_earmarked, receipt_tx.earmarked_job_name, receipt_tx.earmarked_job_id,
    receipt_tx.earmark_notes, receipt_tx.production_job_id, receipt_tx.temporary_job_label,
    event_time, receival.id,
    case when receival.receipt_created_inventory_item then null else inventory.id end,
    receipt_tx.id
  );

  update public.pending_receivals
  set quantity_received = 0,
      status = 'pending',
      received_by = null,
      received_at = null,
      receipt_inventory_item_id = null,
      receipt_transaction_id = null,
      receipt_created_inventory_item = null
  where id = receival.id;
end;
$function$;

revoke all on function public.receive_pending_receival_with_reservation(uuid, text) from public;
revoke all on function public.undo_pending_receival_receipt(uuid, text, text) from public;
grant execute on function public.receive_pending_receival_with_reservation(uuid, text) to anon, authenticated, service_role;
grant execute on function public.undo_pending_receival_receipt(uuid, text, text) to anon, authenticated, service_role;

commit;
