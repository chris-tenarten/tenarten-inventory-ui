begin;

do $preflight$
begin
  if to_regclass('public.pending_receivals') is null
    or to_regclass('public.purchase_order_issuances') is null
    or to_regclass('public.purchase_order_documents') is null
    or to_regclass('public.purchase_order_lines') is null then
    raise exception 'Migration 20260723_008 requires pending_receivals, Purchase Order issuances, documents, and lines.';
  end if;
end;
$preflight$;

alter table public.pending_receivals
  add column if not exists source_purchase_order_issuance_id uuid
    references public.purchase_order_issuances(id) on delete restrict,
  add column if not exists source_purchase_order_line_id uuid
    references public.purchase_order_lines(id) on delete restrict,
  add column if not exists source_purchase_order_line_number integer,
  add column if not exists source_purchase_order_number text;

comment on column public.pending_receivals.source_purchase_order_issuance_id is
  'Immutable Purchase Order issuance projected into this operational receival.';
comment on column public.pending_receivals.source_purchase_order_line_id is
  'Stable Purchase Order line identity captured in the immutable issuance snapshot.';
comment on column public.pending_receivals.source_purchase_order_line_number is
  'Human-readable source line number captured from the immutable issuance snapshot.';
comment on column public.pending_receivals.source_purchase_order_number is
  'Immutable Purchase Order number retained for display, search, and audit context.';

create unique index if not exists pending_receivals_purchase_order_source_uidx
  on public.pending_receivals (
    source_purchase_order_issuance_id,
    source_purchase_order_line_id
  )
  where source_purchase_order_issuance_id is not null
    and source_purchase_order_line_id is not null;

create index if not exists pending_receivals_purchase_order_number_idx
  on public.pending_receivals (source_purchase_order_number)
  where source_purchase_order_number is not null;

create or replace function public.create_pending_receivals_from_purchase_order(
  p_issuance_id uuid,
  p_lines jsonb,
  p_actor text
)
returns table (
  pending_receival_id uuid,
  source_line_id uuid,
  source_line_number integer,
  creation_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  selected_issuance public.purchase_order_issuances%rowtype;
  order_data jsonb;
  snapshot_lines jsonb;
  submitted_line jsonb;
  snapshot_line jsonb;
  selected_line_id uuid;
  selected_line_number integer;
  selected_job_id uuid;
  selected_po_number text;
  selected_job_name text;
  selected_job_number text;
  selected_vendor text;
  selected_material text;
  selected_size text;
  selected_category text;
  selected_unit text;
  selected_location text;
  selected_eta date;
  selected_quantity numeric;
  selected_sku text;
  selected_line_notes text;
  provenance_note text;
  inserted_id uuid;
begin
  if p_issuance_id is null then
    raise exception 'An issuance ID is required.';
  end if;
  if nullif(trim(p_actor), '') is null then
    raise exception 'An actor is required.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Select at least one eligible Purchase Order line.';
  end if;

  select issuance.*
  into selected_issuance
  from public.purchase_order_issuances issuance
  where issuance.id = p_issuance_id
  for share;

  if not found then
    raise exception 'The immutable Purchase Order issuance was not found.';
  end if;

  if not exists (
    select 1
    from public.purchase_order_documents document
    where document.issuance_id = selected_issuance.id
      and document.status = 'generated'
      and document.snapshot_hash = selected_issuance.snapshot_hash
      and nullif(trim(document.storage_path), '') is not null
  ) then
    raise exception 'The permanent Purchase Order PDF must be generated before Pending Receivals can be created.';
  end if;

  order_data := selected_issuance.order_snapshot;
  snapshot_lines := selected_issuance.lines_snapshot;
  selected_po_number := nullif(trim(order_data ->> 'po_number'), '');
  selected_job_name := nullif(trim(order_data ->> 'job_name'), '');
  selected_job_number := nullif(trim(order_data ->> 'job_number'), '');
  selected_vendor := nullif(trim(order_data ->> 'vendor_name'), '');
  selected_job_id := nullif(order_data ->> 'production_job_id', '')::uuid;

  if selected_vendor is null then
    raise exception 'The issued Purchase Order does not contain a Vendor name.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) submitted
    group by submitted ->> 'source_line_id'
    having count(*) > 1
  ) then
    raise exception 'A Purchase Order line was selected more than once.';
  end if;

  for submitted_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      selected_line_id := nullif(submitted_line ->> 'source_line_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'A selected Purchase Order line has an invalid source identity.';
    end;
    if selected_line_id is null then
      raise exception 'Every selected line requires its immutable source identity.';
    end if;

    select value
    into snapshot_line
    from jsonb_array_elements(snapshot_lines)
    where value ->> 'purchase_order_line_id' = selected_line_id::text;

    if snapshot_line is null then
      raise exception 'Purchase Order line % is not part of this immutable issuance.', selected_line_id;
    end if;

    selected_line_number := nullif(snapshot_line ->> 'line_number', '')::integer;
    if coalesce(snapshot_line ->> 'line_kind', '') <> 'chip'
      or coalesce((snapshot_line ->> 'quantity')::numeric, 0) <= 0
      or nullif(trim(snapshot_line ->> 'material'), '') is null
      or nullif(trim(snapshot_line ->> 'unit'), '') is null then
      raise exception 'Purchase Order line % is not eligible for Pending Receivals.', coalesce(selected_line_number::text, selected_line_id::text);
    end if;

    selected_material := nullif(trim(submitted_line ->> 'material_name'), '');
    selected_size := nullif(trim(submitted_line ->> 'size'), '');
    selected_category := nullif(trim(submitted_line ->> 'category'), '');
    selected_unit := nullif(trim(submitted_line ->> 'unit'), '');
    selected_location := nullif(trim(submitted_line ->> 'location'), '');
    selected_quantity := nullif(submitted_line ->> 'quantity_expected', '')::numeric;
    selected_eta := nullif(submitted_line ->> 'eta', '')::date;

    if selected_material is null or selected_unit is null or selected_location is null
      or selected_quantity is null or selected_quantity <= 0 then
      raise exception 'Line % requires material, positive quantity, unit, and location.', selected_line_number;
    end if;

    selected_sku := nullif(trim(snapshot_line ->> 'vendor_sku'), '');
    selected_line_notes := nullif(trim(snapshot_line ->> 'notes'), '');
    provenance_note := concat_ws(' | ',
      'Created from PO ' || coalesce(selected_po_number, 'Unnumbered'),
      'Line ' || selected_line_number,
      case when selected_sku is not null then 'SKU ' || selected_sku end
    );
    if selected_line_notes is not null then
      provenance_note := provenance_note || E'\n' || selected_line_notes;
    end if;

    insert into public.pending_receivals (
      vendor,
      material_name,
      size,
      category,
      quantity_expected,
      quantity_received,
      unit,
      location,
      status,
      ordered_by,
      order_date,
      eta,
      notes,
      is_earmarked,
      earmarked_job_name,
      earmark_notes,
      production_job_id,
      temporary_job_label,
      source_purchase_order_issuance_id,
      source_purchase_order_line_id,
      source_purchase_order_line_number,
      source_purchase_order_number
    ) values (
      selected_vendor,
      selected_material,
      selected_size,
      selected_category,
      selected_quantity,
      0,
      selected_unit,
      selected_location,
      'pending',
      trim(p_actor),
      coalesce(nullif(order_data ->> 'po_date', '')::date, selected_issuance.issued_at::date),
      selected_eta,
      provenance_note,
      selected_job_id is not null,
      case when selected_job_id is not null then selected_job_name end,
      case when selected_job_id is not null then concat_ws(' | ',
        case when selected_po_number is not null then 'PO ' || selected_po_number end,
        case when selected_job_number is not null then 'Job ' || selected_job_number end
      ) end,
      selected_job_id,
      null,
      selected_issuance.id,
      selected_line_id,
      selected_line_number,
      selected_po_number
    )
    on conflict (
      source_purchase_order_issuance_id,
      source_purchase_order_line_id
    ) where source_purchase_order_issuance_id is not null
      and source_purchase_order_line_id is not null
    do nothing
    returning id into inserted_id;

    if inserted_id is null then
      select receival.id
      into inserted_id
      from public.pending_receivals receival
      where receival.source_purchase_order_issuance_id = selected_issuance.id
        and receival.source_purchase_order_line_id = selected_line_id;

      return query select inserted_id, selected_line_id, selected_line_number, 'existing'::text;
    else
      return query select inserted_id, selected_line_id, selected_line_number, 'created'::text;
    end if;
    inserted_id := null;
    snapshot_line := null;
  end loop;
end;
$function$;

revoke all on function public.create_pending_receivals_from_purchase_order(uuid, jsonb, text) from public;
grant execute on function public.create_pending_receivals_from_purchase_order(uuid, jsonb, text) to anon, authenticated, service_role;

commit;
