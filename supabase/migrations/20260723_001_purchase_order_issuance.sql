begin;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if exists (
    select 1
    from public.purchase_orders
    where nullif(trim(po_number), '') is not null
    group by lower(trim(po_number))
    having count(*) > 1
  ) then
    raise exception 'Purchase Order numbers contain case- or whitespace-insensitive duplicates. Reconcile them before applying issuance.';
  end if;
end;
$$;

create unique index if not exists purchase_orders_po_number_normalized_unique_idx
  on public.purchase_orders (lower(trim(po_number)))
  where nullif(trim(po_number), '') is not null;

create table if not exists public.purchase_order_issuances (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  revision_number integer not null,
  issued_at timestamptz not null,
  issued_by text not null,
  order_snapshot jsonb not null,
  lines_snapshot jsonb not null,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  constraint purchase_order_issuances_revision_positive check (revision_number > 0),
  constraint purchase_order_issuances_actor_not_blank check (length(trim(issued_by)) > 0),
  constraint purchase_order_issuances_hash_format check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint purchase_order_issuances_lines_array check (
    jsonb_typeof(lines_snapshot) = 'array' and jsonb_array_length(lines_snapshot) > 0
  ),
  unique (purchase_order_id, revision_number)
);

create index if not exists purchase_order_issuances_order_idx
  on public.purchase_order_issuances (purchase_order_id, revision_number desc);

alter table public.purchase_order_issuances enable row level security;
drop policy if exists "Purchase Order issuance read" on public.purchase_order_issuances;
create policy "Purchase Order issuance read"
  on public.purchase_order_issuances for select to anon, authenticated using (true);

create or replace function public.guard_purchase_order_issuance_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  raise exception 'Issued Purchase Order snapshots are immutable.';
end;
$function$;

drop trigger if exists purchase_order_issuances_guard_immutable on public.purchase_order_issuances;
create trigger purchase_order_issuances_guard_immutable
  before update or delete on public.purchase_order_issuances
  for each row execute function public.guard_purchase_order_issuance_snapshot();

create or replace function public.guard_issued_purchase_order()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if old.status <> 'draft' then
    raise exception 'Issued Purchase Orders are immutable. Create a future revision instead.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists purchase_orders_guard_issued on public.purchase_orders;
create trigger purchase_orders_guard_issued
  before update or delete on public.purchase_orders
  for each row execute function public.guard_issued_purchase_order();

create or replace function public.guard_issued_purchase_order_line()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
declare parent_status text; parent_id uuid;
begin
  if tg_op = 'DELETE' then parent_id := old.purchase_order_id;
  else parent_id := new.purchase_order_id;
  end if;
  select status into parent_status
  from public.purchase_orders
  where id = parent_id;
  if tg_op = 'DELETE' and parent_status is null then return old; end if;
  if parent_status is distinct from 'draft' then
    raise exception 'Issued Purchase Order lines are immutable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists purchase_order_lines_guard_issued on public.purchase_order_lines;
create trigger purchase_order_lines_guard_issued
  before insert or update or delete on public.purchase_order_lines
  for each row execute function public.guard_issued_purchase_order_line();

create or replace function public.guard_issued_chip_purchase_order_detail()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
declare parent_status text; detail_line_id uuid;
begin
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

drop trigger if exists chip_purchase_order_details_guard_issued on public.chip_purchase_order_line_details;
create trigger chip_purchase_order_details_guard_issued
  before insert or update or delete on public.chip_purchase_order_line_details
  for each row execute function public.guard_issued_chip_purchase_order_detail();

create or replace function public.issue_purchase_order(
  p_purchase_order_id uuid,
  p_actor text,
  p_expected_updated_at timestamptz
)
returns table (
  purchase_order_id uuid,
  issuance_id uuid,
  issued_at timestamptz,
  issued_by text,
  revision_number integer,
  snapshot_hash text,
  status text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  selected_order public.purchase_orders%rowtype;
  existing_issuance public.purchase_order_issuances%rowtype;
  selected_issuance public.purchase_order_issuances%rowtype;
  line_count integer;
  detail_count integer;
  calculated_subtotal numeric(14,2);
  calculated_discount numeric(14,2);
  taxable_subtotal numeric(14,2);
  calculated_tax numeric(14,2);
  calculated_total numeric(14,2);
  header_snapshot jsonb;
  ordered_lines_snapshot jsonb;
  calculated_hash text;
  issued_timestamp timestamptz := clock_timestamp();
begin
  if nullif(trim(p_actor), '') is null then
    raise exception 'PO Originated By is required to issue this Purchase Order.';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Reload this Purchase Order before issuing it.';
  end if;

  select * into selected_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then raise exception 'Purchase Order was not found.'; end if;

  select * into existing_issuance
  from public.purchase_order_issuances
  where purchase_order_id = selected_order.id
    and revision_number = selected_order.revision_number;
  if found then
    return query select
      existing_issuance.purchase_order_id,
      existing_issuance.id,
      existing_issuance.issued_at,
      existing_issuance.issued_by,
      existing_issuance.revision_number,
      existing_issuance.snapshot_hash,
      'issued'::text;
    return;
  end if;

  if selected_order.status in ('cancelled', 'superseded') then
    raise exception 'Cancelled or prior-revision Purchase Orders cannot be issued.';
  end if;
  if selected_order.status <> 'draft' then
    raise exception 'Only Draft Purchase Orders can be issued.';
  end if;
  if selected_order.updated_at is distinct from p_expected_updated_at then
    raise exception 'This Purchase Order changed since it was loaded. Reload and review it before issuing.';
  end if;
  if nullif(trim(selected_order.po_number), '') is null then
    raise exception 'Enter and save a Purchase Order number before issuing.';
  end if;
  if exists (
    select 1 from public.purchase_orders other
    where other.id <> selected_order.id
      and nullif(trim(other.po_number), '') is not null
      and lower(trim(other.po_number)) = lower(trim(selected_order.po_number))
  ) then
    raise exception 'Purchase Order number "%" is already in use.', trim(selected_order.po_number);
  end if;
  if selected_order.vendor_id is null
     or not exists (select 1 from public.vendors where id = selected_order.vendor_id) then
    raise exception 'Select a configured Vendor before issuing.';
  end if;

  select count(*) into line_count
  from public.purchase_order_lines
  where purchase_order_id = selected_order.id;
  if line_count = 0 then raise exception 'Add at least one valid line before issuing.'; end if;

  select count(*) into detail_count
  from public.purchase_order_lines lines
  join public.chip_purchase_order_line_details details
    on details.purchase_order_line_id = lines.id
  where lines.purchase_order_id = selected_order.id
    and lines.line_category = 'chip'
    and lines.status = 'active';
  if detail_count <> line_count then
    raise exception 'Purchase Order lines are incomplete or do not belong to this Purchase Order.';
  end if;
  if exists (
    select 1 from (
      select line_number, row_number() over (order by line_number)::integer as expected_line_number
      from public.purchase_order_lines
      where purchase_order_id = selected_order.id
    ) ordered
    where ordered.line_number <> ordered.expected_line_number
  ) then
    raise exception 'Purchase Order line numbering must be sequential and deterministic.';
  end if;
  if exists (
    select 1
    from public.purchase_order_lines lines
    join public.chip_purchase_order_line_details details on details.purchase_order_line_id = lines.id
    where lines.purchase_order_id = selected_order.id
      and (
        nullif(trim(details.material_name_snapshot), '') is null
        or nullif(trim(details.chip_size), '') is null
        or details.quantity_ordered <= 0
        or nullif(trim(details.order_unit), '') is null
        or details.unit_price is null
        or details.unit_price < 0
      )
  ) then
    raise exception 'Every issued line requires material, size, positive quantity, order unit, and a non-negative unit price.';
  end if;

  select round(sum(round(details.quantity_ordered * details.unit_price, 2)), 2)
    into calculated_subtotal
  from public.purchase_order_lines lines
  join public.chip_purchase_order_line_details details on details.purchase_order_line_id = lines.id
  where lines.purchase_order_id = selected_order.id;
  calculated_subtotal := coalesce(calculated_subtotal, 0);
  if selected_order.discount_percent is not null and selected_order.discount_percent not between 0 and 100 then
    raise exception 'Discount percent must be between 0 and 100.';
  end if;
  if selected_order.tax_percent is not null and selected_order.tax_percent not between 0 and 100 then
    raise exception 'Tax percent must be between 0 and 100.';
  end if;
  if selected_order.freight is not null and selected_order.freight < 0 then
    raise exception 'Freight cannot be negative.';
  end if;
  calculated_discount := round(calculated_subtotal * coalesce(selected_order.discount_percent, 0) / 100, 2);
  taxable_subtotal := calculated_subtotal - calculated_discount;
  calculated_tax := round(taxable_subtotal * coalesce(selected_order.tax_percent, 0) / 100, 2);
  calculated_total := taxable_subtotal + calculated_tax + coalesce(selected_order.freight, 0);
  if calculated_total < 0 then raise exception 'Calculated Purchase Order total cannot be negative.'; end if;

  header_snapshot := jsonb_build_object(
    'purchase_order_id', selected_order.id,
    'po_family_id', selected_order.po_family_id,
    'po_number', trim(selected_order.po_number),
    'po_category', selected_order.po_category,
    'status', 'issued',
    'production_job_id', selected_order.production_job_id,
    'job_number', selected_order.job_number_snapshot,
    'job_name', selected_order.job_name_snapshot,
    'vendor_id', selected_order.vendor_id,
    'vendor_name', selected_order.vendor_name_snapshot,
    'vendor_contact', selected_order.vendor_contact_snapshot,
    'vendor_address', selected_order.vendor_address_snapshot,
    'payment_terms', selected_order.payment_terms_snapshot,
    'ship_to', selected_order.ship_to_snapshot,
    'bill_to', null,
    'requested_date', selected_order.requested_date,
    'po_date', selected_order.order_date,
    'originated_by', selected_order.created_by,
    'authorized_by', selected_order.authorized_by_snapshot,
    'commercial_notes', selected_order.commercial_notes,
    'internal_notes', selected_order.internal_notes,
    'currency', selected_order.currency,
    'discount_percent', selected_order.discount_percent,
    'discount_amount', calculated_discount,
    'tax_percent', selected_order.tax_percent,
    'tax_amount', calculated_tax,
    'freight', selected_order.freight,
    'subtotal', calculated_subtotal,
    'total', calculated_total,
    'revision_number', selected_order.revision_number,
    'issued_at', issued_timestamp,
    'issued_by', trim(p_actor)
  );

  select jsonb_agg(
    jsonb_build_object(
      'purchase_order_line_id', lines.id,
      'line_number', lines.line_number,
      'line_kind', lines.line_category,
      'line_status', lines.status,
      'production_job_id', details.production_job_id,
      'material', details.material_name_snapshot,
      'vendor_sku', details.vendor_sku_snapshot,
      'chip_size', details.chip_size,
      'package_quantity', details.package_quantity,
      'package_measure', details.package_measure,
      'container_type', details.container_type,
      'moisture_condition', details.moisture_condition,
      'quantity', details.quantity_ordered,
      'unit', details.order_unit,
      'unit_price', details.unit_price,
      'line_total', round(details.quantity_ordered * details.unit_price, 2),
      'price_basis', details.price_basis,
      'notes', details.notes,
      'catalog_source', details.catalog_source,
      'maintained_catalog_id', case when details.catalog_source = 'specialty' then details.catalog_item_id else null end,
      'legacy_catalog_id', case when details.catalog_source = 'standard' then details.catalog_item_id else null end,
      'display_description', concat_ws(', ',
        nullif(trim(details.material_name_snapshot), ''),
        nullif(trim(details.chip_size), ''),
        nullif(trim(concat_ws(' ', details.package_quantity, details.package_measure, details.container_type)), ''),
        initcap(nullif(trim(details.moisture_condition), ''))
      )
    )
    order by lines.line_number
  ) into ordered_lines_snapshot
  from public.purchase_order_lines lines
  join public.chip_purchase_order_line_details details on details.purchase_order_line_id = lines.id
  where lines.purchase_order_id = selected_order.id;

  calculated_hash := encode(
    digest(convert_to(header_snapshot::text || E'\n' || ordered_lines_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.purchase_order_issuances (
    purchase_order_id, revision_number, issued_at, issued_by,
    order_snapshot, lines_snapshot, snapshot_hash
  ) values (
    selected_order.id, selected_order.revision_number, issued_timestamp, trim(p_actor),
    header_snapshot, ordered_lines_snapshot, calculated_hash
  )
  returning * into selected_issuance;

  update public.purchase_orders
  set status = 'issued',
      po_number = trim(po_number),
      subtotal = calculated_subtotal,
      discount_amount = calculated_discount,
      tax_amount = calculated_tax,
      total = calculated_total,
      issued_at = issued_timestamp,
      issued_by = trim(p_actor),
      updated_by = trim(p_actor),
      updated_at = issued_timestamp
  where id = selected_order.id;

  return query select
    selected_issuance.purchase_order_id,
    selected_issuance.id,
    selected_issuance.issued_at,
    selected_issuance.issued_by,
    selected_issuance.revision_number,
    selected_issuance.snapshot_hash,
    'issued'::text;
end;
$function$;

revoke all on function public.issue_purchase_order(uuid, text, timestamptz) from public;
grant execute on function public.issue_purchase_order(uuid, text, timestamptz)
  to anon, authenticated, service_role;

comment on table public.purchase_order_issuances is
  'Immutable business-document snapshots captured atomically when a Purchase Order revision is issued.';
comment on function public.issue_purchase_order(uuid, text, timestamptz) is
  'Idempotently issues one saved Draft revision with optimistic concurrency and server-authoritative totals.';

commit;
