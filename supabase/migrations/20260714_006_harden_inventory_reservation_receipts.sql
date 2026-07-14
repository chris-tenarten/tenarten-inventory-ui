begin;

-- Forward-only reconciliation for environments that applied migration 005
-- before its final receipt and constraint hardening was checked in.
do $preflight$
declare
  missing_columns text;
  blank_labels text;
begin
  if to_regclass('public.jobs') is null
    or to_regclass('public.pending_receivals') is null
    or to_regclass('public.inventory_items') is null
    or to_regclass('public.inventory_transactions') is null then
    raise exception 'Migration 20260714_006 requires the Inventory reservation schema from migration 005.';
  end if;

  select string_agg(required.table_name || '.' || required.column_name, ', ' order by required.table_name, required.column_name)
  into missing_columns
  from (values
    ('pending_receivals', 'production_job_id'), ('pending_receivals', 'temporary_job_label'),
    ('pending_receivals', 'vendor'), ('pending_receivals', 'material_name'),
    ('pending_receivals', 'size'), ('pending_receivals', 'category'),
    ('pending_receivals', 'quantity_expected'), ('pending_receivals', 'quantity_received'),
    ('pending_receivals', 'unit'), ('pending_receivals', 'location'),
    ('pending_receivals', 'pallet_number'), ('pending_receivals', 'status'),
    ('pending_receivals', 'received_by'), ('pending_receivals', 'received_at'),
    ('pending_receivals', 'notes'), ('pending_receivals', 'is_earmarked'),
    ('pending_receivals', 'earmarked_job_name'), ('pending_receivals', 'earmark_notes'),
    ('inventory_items', 'production_job_id'), ('inventory_items', 'temporary_job_label'),
    ('inventory_items', 'id'), ('inventory_items', 'vendor'),
    ('inventory_items', 'color'), ('inventory_items', 'size'),
    ('inventory_items', 'category'), ('inventory_items', 'quantity'),
    ('inventory_items', 'unit'), ('inventory_items', 'location'),
    ('inventory_items', 'pallet_number'), ('inventory_items', 'notes'),
    ('inventory_items', 'earmarked_for_job'), ('inventory_items', 'earmarked_job'),
    ('inventory_items', 'earmark_notes'), ('inventory_items', 'updated_at'),
    ('inventory_items', 'last_counted_at'),
    ('inventory_transactions', 'production_job_id'), ('inventory_transactions', 'temporary_job_label'),
    ('inventory_transactions', 'transaction_type'), ('inventory_transactions', 'vendor'),
    ('inventory_transactions', 'item_name'), ('inventory_transactions', 'size'),
    ('inventory_transactions', 'unit'), ('inventory_transactions', 'quantity'),
    ('inventory_transactions', 'location'), ('inventory_transactions', 'notes'),
    ('inventory_transactions', 'catalog_source'), ('inventory_transactions', 'is_earmarked'),
    ('inventory_transactions', 'earmarked_job_name'), ('inventory_transactions', 'earmarked_job_id'),
    ('inventory_transactions', 'earmark_notes'), ('inventory_transactions', 'synced_to_inventory_at')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns existing
    where existing.table_schema = 'public'
      and existing.table_name = required.table_name
      and existing.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'Migration 20260714_006 is incompatible; missing migration-005 columns: %', missing_columns;
  end if;

  if to_regprocedure('public.receive_pending_receival_with_reservation(uuid,text)') is null then
    raise exception 'Migration 20260714_006 requires public.receive_pending_receival_with_reservation(uuid,text) from migration 005.';
  end if;

  select string_agg(invalid.source || '=' || invalid.row_count, ', ' order by invalid.source)
  into blank_labels
  from (
    select 'pending_receivals' as source, count(*)::text as row_count
    from public.pending_receivals
    where temporary_job_label is not null and nullif(trim(temporary_job_label), '') is null
    having count(*) > 0
    union all
    select 'inventory_items', count(*)::text
    from public.inventory_items
    where temporary_job_label is not null and nullif(trim(temporary_job_label), '') is null
    having count(*) > 0
    union all
    select 'inventory_transactions', count(*)::text
    from public.inventory_transactions
    where temporary_job_label is not null and nullif(trim(temporary_job_label), '') is null
    having count(*) > 0
  ) invalid;

  if blank_labels is not null then
    raise exception 'Migration 20260714_006 found blank temporary labels; correct them before retrying: %', blank_labels;
  end if;
end;
$preflight$;

alter table public.pending_receivals
  drop constraint if exists pending_receivals_reservation_identity_check,
  add constraint pending_receivals_reservation_identity_check check (
    (production_job_id is null or temporary_job_label is null)
    and (temporary_job_label is null or length(trim(temporary_job_label)) > 0)
  );

alter table public.inventory_items
  drop constraint if exists inventory_items_reservation_identity_check,
  add constraint inventory_items_reservation_identity_check check (
    (production_job_id is null or temporary_job_label is null)
    and (temporary_job_label is null or length(trim(temporary_job_label)) > 0)
  );

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_reservation_identity_check,
  add constraint inventory_transactions_reservation_identity_check check (
    (production_job_id is null or temporary_job_label is null)
    and (temporary_job_label is null or length(trim(temporary_job_label)) > 0)
  );

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

  if not found then
    raise exception 'Pending receival was not found.';
  end if;

  if receival.status not in ('pending', 'partially_received') then
    raise exception 'Pending receival is no longer receivable.';
  end if;

  remaining_quantity := receival.quantity_expected - coalesce(receival.quantity_received, 0);
  if receival.quantity_expected is null
    or coalesce(receival.quantity_received, 0) < 0
    or coalesce(receival.quantity_received, 0) > receival.quantity_expected then
    raise exception 'Pending receival has invalid expected or received quantities.';
  end if;
  if remaining_quantity <= 0 then
    raise exception 'Pending receival has no remaining quantity.';
  end if;

  if receival.production_job_id is not null then
    select coalesce(
      nullif(trim(receival.earmarked_job_name), ''),
      case
        when nullif(trim(job_number), '') is not null then trim(job_number) || ' — ' || name
        else name
      end
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

  receipt_note := concat_ws(
    ' ',
    'Received from pending receival.',
    nullif(receival.notes, '')
  );

  -- Reserved receivals remain separate lots. Unrestricted receipts only merge
  -- when every Inventory balance dimension matches.
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
    limit 1
    for update;
    destination_found := found;
  end if;

  if destination_found then
    update public.inventory_items inventory
    set quantity = coalesce(inventory.quantity, 0) + remaining_quantity,
        updated_at = event_time,
        last_counted_at = event_time
    where inventory.id = destination.id;
  else
    insert into public.inventory_items (
      vendor, color, size, category, quantity, unit, location, pallet_number, notes,
      earmarked_for_job, earmarked_job, earmark_notes, production_job_id, temporary_job_label,
      updated_at, last_counted_at
    ) values (
      nullif(receival.vendor, ''), receival.material_name, nullif(receival.size, ''), nullif(receival.category, ''),
      remaining_quantity, coalesce(nullif(receival.unit, ''), 'Bags'),
      coalesce(nullif(receival.location, ''), 'Denton'),
      nullif(receival.pallet_number, ''), receival.notes,
      reservation_enabled,
      reservation_label, nullif(receival.earmark_notes, ''), receival.production_job_id,
      nullif(trim(receival.temporary_job_label), ''), event_time, event_time
    );
  end if;

  insert into public.inventory_transactions (
    transaction_type, vendor, item_name, size, unit, quantity, location, notes,
    catalog_source, is_earmarked, earmarked_job_name, earmarked_job_id,
    earmark_notes, production_job_id, temporary_job_label, synced_to_inventory_at
  ) values (
    'intake', transaction_vendor, receival.material_name, nullif(receival.size, ''),
    coalesce(nullif(receival.unit, ''), 'Bags'), remaining_quantity,
    coalesce(nullif(receival.location, ''), 'Denton'),
    receipt_note,
    'standard', reservation_enabled,
    reservation_label, null, nullif(receival.earmark_notes, ''),
    receival.production_job_id, nullif(trim(receival.temporary_job_label), ''), event_time
  );

  update public.pending_receivals
  set quantity_received = quantity_expected,
      status = 'received',
      received_by = trim(p_received_by),
      received_at = event_time
  where id = p_receival_id;
end;
$function$;

revoke all on function public.receive_pending_receival_with_reservation(uuid, text) from public;
grant execute on function public.receive_pending_receival_with_reservation(uuid, text) to anon, authenticated, service_role;

commit;
