-- Transaction-safe verification for migration 20260723_006.
-- This script creates temporary rows only and always rolls back.
begin;

do $verification$
declare
  stock_one uuid;
  stock_two uuid;
  linked_order uuid;
  preserved_order uuid;
  selected_job public.jobs%rowtype;
  stock_one_number text;
  stock_two_number text;
  linked_number text;
  preserved_number text;
  expected_prefix text;
begin
  insert into public.purchase_orders (
    vendor_name_snapshot, order_date, created_by, updated_by
  ) values (
    'Rollback-only numbering verification', current_date, 'Verification', 'Verification'
  ) returning id into stock_one;

  insert into public.purchase_orders (
    vendor_name_snapshot, order_date, created_by, updated_by
  ) values (
    'Rollback-only numbering verification', current_date, 'Verification', 'Verification'
  ) returning id into stock_two;

  stock_one_number := public.allocate_purchase_order_number(stock_one);
  stock_two_number := public.allocate_purchase_order_number(stock_two);
  if stock_one_number !~ '^9999-[0-9]{3}$'
     or stock_two_number !~ '^9999-[0-9]{3}$'
     or stock_one_number = stock_two_number then
    raise exception 'Stock numbering was not unique or did not use prefix 9999.';
  end if;
  if public.allocate_purchase_order_number(stock_one) <> stock_one_number then
    raise exception 'Repeated allocation changed an existing Purchase Order number.';
  end if;

  select jobs.*
    into selected_job
  from public.jobs jobs
  where regexp_replace(coalesce(jobs.job_number, ''), '[^0-9]', '', 'g') ~ '[0-9]{4}$'
  order by jobs.created_at
  limit 1;
  if found then
    expected_prefix := right(regexp_replace(selected_job.job_number, '[^0-9]', '', 'g'), 4);
    insert into public.purchase_orders (
      production_job_id, job_number_snapshot, job_name_snapshot,
      vendor_name_snapshot, order_date, created_by, updated_by
    ) values (
      selected_job.id, selected_job.job_number, selected_job.name,
      'Rollback-only numbering verification', current_date, 'Verification', 'Verification'
    ) returning id into linked_order;
    linked_number := public.allocate_purchase_order_number(linked_order);
    if linked_number !~ ('^' || expected_prefix || '-[0-9]{3}$') then
      raise exception 'Linked numbering did not use the final four Job digits.';
    end if;
  end if;

  insert into public.purchase_orders (
    po_number, vendor_name_snapshot, order_date, created_by, updated_by
  ) values (
    'VERIFY-PRESERVE-' || replace(gen_random_uuid()::text, '-', ''),
    'Rollback-only numbering verification', current_date, 'Verification', 'Verification'
  ) returning id, po_number into preserved_order, preserved_number;
  if public.allocate_purchase_order_number(preserved_order) <> preserved_number then
    raise exception 'Allocation changed a pre-existing Purchase Order number.';
  end if;
end;
$verification$;

rollback;
