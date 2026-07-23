-- One-time, exact-scope cleanup for the 2026-07-23 Purchasing validation.
--
-- Scope is deliberately restricted to the three Purchase Orders inventoried
-- immediately before execution. Every header must still have a PO number that
-- matches test% case-insensitively.
--
-- Storage objects are removed separately through the Storage API using the
-- exact paths returned by purchase_order_documents.

begin;

create temporary table cleanup_test_orders (
  id uuid primary key,
  po_number text not null
) on commit drop;

insert into cleanup_test_orders (id, po_number) values
  ('f1968dff-98e3-4965-bd53-ea1e32387c15', 'TEST-100'),
  ('58f37998-00b5-4b5e-9f38-b4f5620a6804', 'TEST-VALIDATION-1784838729926-CLASSIC'),
  ('09432b0b-1693-4bdb-96e2-a72145d333d3', 'TEST-VALIDATION-1784838729926-TENOPS');

do $guard$
begin
  if exists (
    select 1
    from cleanup_test_orders expected
    left join public.purchase_orders actual
      on actual.id = expected.id
     and actual.po_number = expected.po_number
     and actual.po_number ilike 'test%'
    where actual.id is null
  ) then
    raise exception 'Cleanup stopped: the exact TEST Purchase Order inventory changed.';
  end if;

  if exists (
    select 1
    from public.purchase_orders actual
    where actual.po_number ilike 'test%'
      and not exists (
        select 1 from cleanup_test_orders expected where expected.id = actual.id
      )
  ) then
    raise exception 'Cleanup stopped: an uninventoried TEST Purchase Order now exists.';
  end if;

  if exists (
    select 1
    from public.purchase_orders other
    join cleanup_test_orders target
      on other.supersedes_purchase_order_id = target.id
    where not exists (
      select 1 from cleanup_test_orders included where included.id = other.id
    )
  ) then
    raise exception 'Cleanup stopped: a non-test Purchase Order supersedes a target.';
  end if;
end;
$guard$;

create temporary table cleanup_test_issuances on commit drop as
select issuance.id
from public.purchase_order_issuances issuance
join cleanup_test_orders target on target.id = issuance.purchase_order_id;

create temporary table cleanup_test_receivals on commit drop as
select receival.id,
       receival.receipt_inventory_item_id,
       receival.receipt_transaction_id,
       receival.receipt_created_inventory_item
from public.pending_receivals receival
join cleanup_test_issuances issuance
  on issuance.id = receival.source_purchase_order_issuance_id;

create temporary table cleanup_test_transactions on commit drop as
select transaction.id
from public.inventory_transactions transaction
join cleanup_test_receivals receival
  on receival.id = transaction.pending_receival_id;

create temporary table cleanup_test_inventory_items on commit drop as
select distinct inventory.id
from public.inventory_items inventory
join cleanup_test_receivals receival
  on receival.receipt_inventory_item_id = inventory.id
where receival.receipt_created_inventory_item is true;

do $guard$
begin
  if exists (
    select 1
    from cleanup_test_inventory_items inventory
    join public.inventory_transactions transaction
      on transaction.inventory_item_id = inventory.id
    where not exists (
      select 1
      from cleanup_test_transactions target
      where target.id = transaction.id
    )
  ) then
    raise exception 'Cleanup stopped: a TEST-created inventory lot has non-test activity.';
  end if;

  if exists (
    select 1
    from cleanup_test_receivals receival
    where receival.receipt_inventory_item_id is not null
      and receival.receipt_created_inventory_item is distinct from true
  ) then
    raise exception 'Cleanup stopped: a TEST receipt merged into a pre-existing inventory lot.';
  end if;
end;
$guard$;

-- Immutable issuance/header guards are bypassed only inside this transaction.
set local session_replication_role = replica;

delete from public.inventory_transactions transaction
using cleanup_test_transactions target
where transaction.id = target.id;

delete from public.inventory_items inventory
using cleanup_test_inventory_items target
where inventory.id = target.id;

delete from public.pending_receivals receival
using cleanup_test_receivals target
where receival.id = target.id;

delete from public.purchase_order_documents document
using cleanup_test_issuances target
where document.issuance_id = target.id;

delete from public.purchase_order_issuances issuance
using cleanup_test_issuances target
where issuance.id = target.id;

delete from public.purchase_orders purchase_order
using cleanup_test_orders target
where purchase_order.id = target.id
  and purchase_order.po_number = target.po_number
  and purchase_order.po_number ilike 'test%';

do $verify$
begin
  if exists (
    select 1 from public.purchase_orders where po_number ilike 'test%'
  ) then
    raise exception 'Cleanup verification failed: a TEST Purchase Order remains.';
  end if;
end;
$verify$;

select
  3::integer as purchase_orders_deleted,
  (select count(*) from cleanup_test_issuances)::integer as issuances_deleted,
  (select count(*) from cleanup_test_receivals)::integer as pending_receivals_deleted,
  (select count(*) from cleanup_test_transactions)::integer as inventory_transactions_deleted,
  (select count(*) from cleanup_test_inventory_items)::integer as inventory_items_deleted;

commit;
