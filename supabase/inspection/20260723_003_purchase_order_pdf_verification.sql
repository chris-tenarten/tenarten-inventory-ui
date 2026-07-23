-- Run only after applying 20260723_004_purchase_order_pdf_documents.sql.
-- Uses disposable fixtures and always rolls back. Prefer an isolated database.

begin;

do $verification$
declare
  fixture_vendor uuid;
  fixture_order uuid;
  fixture_issuance uuid;
  first_claim record;
  retry_claim record;
  reuse_claim record;
  blocked boolean := false;
begin
  insert into public.vendors (name, canonical_name, created_at, updated_at)
  values ('PDF Verification Vendor', 'pdfverificationvendor', now(), now())
  returning id into fixture_vendor;

  insert into public.purchase_orders (
    po_number, vendor_id, vendor_name_snapshot, status, order_date,
    created_by, updated_by
  ) values (
    '9999-VERIFY', fixture_vendor, 'PDF Verification Vendor', 'draft',
    current_date, 'Verification', 'Verification'
  ) returning id into fixture_order;

  insert into public.purchase_order_issuances (
    purchase_order_id, revision_number, issued_at, issued_by,
    order_snapshot, lines_snapshot, snapshot_hash
  ) values (
    fixture_order, 1, now(), 'Verification',
    jsonb_build_object(
      'purchase_order_id', fixture_order,
      'po_number', '9999-VERIFY',
      'status', 'issued',
      'vendor_name', 'PDF Verification Vendor',
      'total', 25
    ),
    jsonb_build_array(jsonb_build_object(
      'line_number', 1,
      'material', 'Verification Marble',
      'quantity', 2,
      'unit', 'Bag',
      'unit_price', 12.5,
      'line_total', 25
    )),
    repeat('0', 64)
  ) returning id into fixture_issuance;

  if not exists (
    select 1 from public.purchase_order_documents documents
    where documents.issuance_id = fixture_issuance
      and documents.status = 'pending'
      and documents.snapshot_hash ~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'Issuance did not initialize a pending PDF document.';
  end if;

  select * into first_claim
  from public.claim_purchase_order_pdf_generation(fixture_issuance, 'Verification');
  if first_claim.document_status <> 'generating'
     or first_claim.order_snapshot->>'po_number' <> '9999-VERIFY'
     or jsonb_array_length(first_claim.lines_snapshot) <> 1 then
    raise exception 'PDF generation claim did not return the immutable snapshots.';
  end if;

  begin
    perform public.claim_purchase_order_pdf_generation(fixture_issuance, 'Duplicate');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Concurrent PDF generation was not rejected.'; end if;

  update public.purchase_order_documents documents
  set status = 'failed', failed_at = now(), last_error = 'Verification failure'
  where documents.id = first_claim.document_id;

  select * into retry_claim
  from public.claim_purchase_order_pdf_generation(fixture_issuance, 'Retry');
  if retry_claim.document_id <> first_claim.document_id then
    raise exception 'Retry created a duplicate PDF document.';
  end if;
  if (select attempt_count from public.purchase_order_documents where id = first_claim.document_id) <> 2 then
    raise exception 'Retry attempt was not recorded.';
  end if;

  update public.purchase_order_documents documents
  set status = 'generated',
      generated_at = now(),
      storage_path = retry_claim.storage_path,
      last_error = null
  where documents.id = retry_claim.document_id;

  select * into reuse_claim
  from public.claim_purchase_order_pdf_generation(fixture_issuance, 'Reuse');
  if reuse_claim.document_id <> first_claim.document_id
     or reuse_claim.document_status <> 'generated' then
    raise exception 'Generated PDF was not reused idempotently.';
  end if;
end;
$verification$;

rollback;
