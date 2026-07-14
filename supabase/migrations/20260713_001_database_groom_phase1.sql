begin;

-- ============================================================
-- TENOPS DATABASE GROOMING — PHASE 1
--
-- Keeps active inventory, receiving, catalog, and Monday data.
-- Archives inactive reference, backup, and staging tables.
-- Removes verified obsolete database objects.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Defensive checks
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.custom_materials') is null then
    raise exception
      'Cleanup stopped: public.custom_materials does not exist.';
  end if;

  if exists (
    select 1
    from public.custom_materials
  ) then
    raise exception
      'Cleanup stopped: public.custom_materials is no longer empty.';
  end if;

  if exists (
    select 1
    from public.inventory_transactions
    where custom_material_id is not null
  ) then
    raise exception
      'Cleanup stopped: inventory_transactions contains custom_material references.';
  end if;

  if to_regclass('public.inventory_items') is null then
    raise exception
      'Cleanup stopped: public.inventory_items is missing.';
  end if;

  if to_regclass('public.inventory_transactions') is null then
    raise exception
      'Cleanup stopped: public.inventory_transactions is missing.';
  end if;

  if to_regclass('public.pending_receivals') is null then
    raise exception
      'Cleanup stopped: public.pending_receivals is missing.';
  end if;

  if to_regclass('public.vendor_catalog') is null then
    raise exception
      'Cleanup stopped: public.vendor_catalog is missing.';
  end if;

  if to_regclass('public.vendor_catalog_v2') is null then
    raise exception
      'Cleanup stopped: public.vendor_catalog_v2 is missing.';
  end if;

  if to_regclass('public.processed_webhooks') is null then
    raise exception
      'Cleanup stopped: public.processed_webhooks is missing.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'receive_pending_receival'
  ) then
    raise exception
      'Cleanup stopped: receive_pending_receival RPC is missing.';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2. Create the archive schema
-- ------------------------------------------------------------

create schema if not exists archive;

comment on schema archive is
  'Inactive legacy, backup, staging, and reference objects retained for recovery or historical inspection.';

-- ------------------------------------------------------------
-- 3. Archive inactive reference/import tables
-- ------------------------------------------------------------

alter table if exists public.catalog_item_aliases
  set schema archive;

alter table if exists public.catalog_vendor_aliases
  set schema archive;

alter table if exists public.inventory_items_backup_april_2026
  set schema archive;

alter table if exists public.vendor_catalog_backup_2026_04_13
  set schema archive;

alter table if exists public.vendor_catalog_klein_2016_staging
  set schema archive;

-- ------------------------------------------------------------
-- 4. Remove the obsolete ledger reconstruction view
-- ------------------------------------------------------------

drop view if exists public.inventory_balances;

-- ------------------------------------------------------------
-- 5. Remove the abandoned custom-material experiment
-- ------------------------------------------------------------

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_custom_material_id_fkey;

alter table public.inventory_transactions
  drop column if exists custom_material_id;

drop table if exists public.custom_materials;

drop function if exists public.set_updated_at();

-- ------------------------------------------------------------
-- 6. Remove abandoned inventory-sync state
-- ------------------------------------------------------------

drop table if exists public.inventory_sync_state;

-- ------------------------------------------------------------
-- 7. Final verification before commit
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.inventory_items') is null then
    raise exception
      'Verification failed: inventory_items is missing.';
  end if;

  if to_regclass('public.inventory_transactions') is null then
    raise exception
      'Verification failed: inventory_transactions is missing.';
  end if;

  if to_regclass('public.pending_receivals') is null then
    raise exception
      'Verification failed: pending_receivals is missing.';
  end if;

  if to_regclass('public.vendor_catalog') is null then
    raise exception
      'Verification failed: vendor_catalog is missing.';
  end if;

  if to_regclass('public.vendor_catalog_v2') is null then
    raise exception
      'Verification failed: vendor_catalog_v2 is missing.';
  end if;

  if to_regclass('public.processed_webhooks') is null then
    raise exception
      'Verification failed: processed_webhooks is missing.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'receive_pending_receival'
  ) then
    raise exception
      'Verification failed: receive_pending_receival RPC is missing.';
  end if;
end;
$$;

commit;