-- Run only after applying 20260723_001_purchase_order_issuance.sql.
-- This script is destructive only inside its transaction and always rolls back.
-- Do not run against production during implementation. Use an isolated database.

begin;

do $verification$
declare
  fixture_vendor uuid;
  fixture_order uuid;
  stale_order uuid;
  malformed_order uuid;
  fixture_line uuid;
  first_result record;
  retry_result record;
  expected_updated timestamptz;
  blocked boolean;
begin
  insert into public.vendors (name, canonical_name, created_at, updated_at)
  values ('Issuance Verification Vendor', 'issuanceverificationvendor', now(), now())
  returning id into fixture_vendor;

  insert into public.purchase_orders (
    po_number, vendor_id, vendor_name_snapshot, status, order_date,
    created_by, updated_by, production_job_id
  ) values (
    'VERIFY-ISSUE-001', fixture_vendor, 'Issuance Verification Vendor', 'draft',
    current_date, 'Verification', 'Verification', null
  ) returning id, updated_at into fixture_order, expected_updated;

  insert into public.purchase_order_lines (purchase_order_id, line_number)
  values (fixture_order, 1) returning id into fixture_line;
  insert into public.chip_purchase_order_line_details (
    purchase_order_line_id, material_name_snapshot, chip_size,
    quantity_ordered, order_unit, unit_price
  ) values (fixture_line, 'Verification Marble', '#1', 2, 'Bag', 12.50);

  select * into first_result
  from public.issue_purchase_order(fixture_order, 'Verification', expected_updated);
  if first_result.status <> 'issued' then raise exception 'Successful issuance did not return Issued.'; end if;
  if first_result.snapshot_hash !~ '^[0-9a-f]{64}$' then raise exception 'Snapshot hash is invalid.'; end if;

  select * into retry_result
  from public.issue_purchase_order(fixture_order, 'Verification Retry', expected_updated);
  if retry_result.issuance_id <> first_result.issuance_id then
    raise exception 'Idempotent retry created a different issuance.';
  end if;
  if (select count(*) from public.purchase_order_issuances where purchase_order_id = fixture_order) <> 1 then
    raise exception 'Duplicate issuance row was created.';
  end if;
  if (select order_snapshot->>'production_job_id' from public.purchase_order_issuances where id = first_result.issuance_id) is not null then
    raise exception 'Stock PO snapshot unexpectedly requires a Production Job.';
  end if;
  if (select lines_snapshot->0->>'line_number' from public.purchase_order_issuances where id = first_result.issuance_id) <> '1' then
    raise exception 'Ordered line snapshot is missing.';
  end if;
  if (select (order_snapshot->>'subtotal')::numeric from public.purchase_order_issuances where id = first_result.issuance_id) <> 25.00 then
    raise exception 'Server-side subtotal is incorrect.';
  end if;

  blocked := false;
  begin
    update public.purchase_orders set commercial_notes = 'Must fail' where id = fixture_order;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Issued header remained mutable.'; end if;

  blocked := false;
  begin
    update public.chip_purchase_order_line_details set unit_price = 1 where purchase_order_line_id = fixture_line;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Issued line remained mutable.'; end if;

  blocked := false;
  begin
    update public.purchase_order_issuances set issued_by = 'Must fail' where id = first_result.issuance_id;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Issued snapshot remained mutable.'; end if;

  blocked := false;
  begin
    insert into public.purchase_orders (
      po_number, vendor_id, vendor_name_snapshot, status, order_date, created_by, updated_by
    ) values (
      ' verify-issue-001 ', fixture_vendor, 'Issuance Verification Vendor', 'draft',
      current_date, 'Verification', 'Verification'
    );
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'Normalized duplicate PO number was accepted.'; end if;

  insert into public.purchase_orders (
    po_number, vendor_id, vendor_name_snapshot, status, order_date, created_by, updated_by
  ) values (
    'VERIFY-ISSUE-STALE', fixture_vendor, 'Issuance Verification Vendor', 'draft',
    current_date, 'Verification', 'Verification'
  ) returning id, updated_at into stale_order, expected_updated;
  update public.purchase_orders set internal_notes = 'Concurrent change', updated_at = clock_timestamp() where id = stale_order;
  blocked := false;
  begin
    perform public.issue_purchase_order(stale_order, 'Verification', expected_updated);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Stale issuance was not rejected.'; end if;
  if exists (select 1 from public.purchase_order_issuances where purchase_order_id = stale_order) then
    raise exception 'Stale issuance created a snapshot.';
  end if;

  insert into public.purchase_orders (
    po_number, vendor_id, vendor_name_snapshot, status, order_date, created_by, updated_by
  ) values (
    'VERIFY-ISSUE-MALFORMED', fixture_vendor, 'Issuance Verification Vendor', 'draft',
    current_date, 'Verification', 'Verification'
  ) returning id, updated_at into malformed_order, expected_updated;
  insert into public.purchase_order_lines (purchase_order_id, line_number)
  values (malformed_order, 1);
  blocked := false;
  begin
    perform public.issue_purchase_order(malformed_order, 'Verification', expected_updated);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Malformed line ownership/detail state was not rejected.'; end if;
end;
$verification$;

rollback;
