-- One-time production cleanup for the supervised TEST-001 issuance only.
-- This script is intentionally ID-, hash-, Job-, and note-locked.

begin;

set local lock_timeout = '5s';

lock table public.purchase_orders in share row exclusive mode;
lock table public.purchase_order_issuances in share row exclusive mode;
lock table public.purchase_order_lines in share row exclusive mode;
lock table public.chip_purchase_order_line_details in share row exclusive mode;

do $safety$
declare
  target_order constant uuid := '16eff624-bafc-4b93-98c4-35039d02fe52';
  target_issuance constant uuid := 'a8077822-86ab-4b0d-8000-2d26c1beb226';
  target_job constant uuid := 'c0f8799b-0f42-4a86-89b8-4e55ba68c9be';
  target_hash constant text := 'fec506f69c2deb377abef41302f7fe47b652be2092046d18a85bbfda16deb2b3';
begin
  if not exists (
    select 1
    from public.purchase_orders orders
    where orders.id = target_order
      and orders.po_number = 'TEST-001'
      and orders.status = 'issued'
      and orders.production_job_id = target_job
      and orders.job_number_snapshot = '26-0130'
      and orders.job_name_snapshot = 'Belmont Park Desk'
      and orders.revision_number = 1
  ) then
    raise exception 'TEST-001 header no longer matches the verified cleanup target.';
  end if;

  if (select count(*) from public.purchase_order_issuances issuance where issuance.purchase_order_id = target_order) <> 1
     or not exists (
       select 1
       from public.purchase_order_issuances issuance
       where issuance.id = target_issuance
         and issuance.purchase_order_id = target_order
         and issuance.revision_number = 1
         and issuance.snapshot_hash = target_hash
     ) then
    raise exception 'TEST-001 issuance no longer matches the verified cleanup target.';
  end if;

  if (select count(*) from public.purchase_order_lines lines where lines.purchase_order_id = target_order) <> 1
     or not exists (
       select 1
       from public.purchase_order_lines lines
       join public.chip_purchase_order_line_details details
         on details.purchase_order_line_id = lines.id
       where lines.purchase_order_id = target_order
         and details.notes = 'This issued PO is a test and should be removed after testing has concluded. -Chris'
     ) then
    raise exception 'TEST-001 lines no longer match the verified cleanup target.';
  end if;

  if exists (
    select 1
    from public.purchase_orders revisions
    where revisions.supersedes_purchase_order_id = target_order
  ) then
    raise exception 'TEST-001 has a dependent revision and will not be purged.';
  end if;
end;
$safety$;

alter table public.purchase_order_issuances
  disable trigger purchase_order_issuances_guard_immutable;
alter table public.chip_purchase_order_line_details
  disable trigger chip_purchase_order_details_guard_issued;
alter table public.purchase_order_lines
  disable trigger purchase_order_lines_guard_issued;
alter table public.purchase_orders
  disable trigger purchase_orders_guard_issued;

delete from public.purchase_order_issuances
where id = 'a8077822-86ab-4b0d-8000-2d26c1beb226'
  and purchase_order_id = '16eff624-bafc-4b93-98c4-35039d02fe52';

delete from public.chip_purchase_order_line_details details
using public.purchase_order_lines lines
where details.purchase_order_line_id = lines.id
  and lines.purchase_order_id = '16eff624-bafc-4b93-98c4-35039d02fe52';

delete from public.purchase_order_lines
where purchase_order_id = '16eff624-bafc-4b93-98c4-35039d02fe52';

delete from public.purchase_orders
where id = '16eff624-bafc-4b93-98c4-35039d02fe52'
  and po_number = 'TEST-001';

alter table public.purchase_order_issuances
  enable trigger purchase_order_issuances_guard_immutable;
alter table public.chip_purchase_order_line_details
  enable trigger chip_purchase_order_details_guard_issued;
alter table public.purchase_order_lines
  enable trigger purchase_order_lines_guard_issued;
alter table public.purchase_orders
  enable trigger purchase_orders_guard_issued;

do $verification$
begin
  if exists (
    select 1 from public.purchase_orders
    where id = '16eff624-bafc-4b93-98c4-35039d02fe52'
  ) or exists (
    select 1 from public.purchase_order_issuances
    where purchase_order_id = '16eff624-bafc-4b93-98c4-35039d02fe52'
  ) or exists (
    select 1 from public.purchase_order_lines
    where purchase_order_id = '16eff624-bafc-4b93-98c4-35039d02fe52'
  ) then
    raise exception 'TEST-001 cleanup verification failed.';
  end if;
end;
$verification$;

commit;
