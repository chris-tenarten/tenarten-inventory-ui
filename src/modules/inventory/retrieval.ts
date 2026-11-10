import {loadCompleteRows} from '@/lib/complete-rows';
import {supabase} from '@/lib/supabase';

export async function loadInventoryRows(signal: AbortSignal) {
  return loadCompleteRows((from, to) => supabase
      .from('inventory_items')
      .select(
        'id, vendor, color, size, category, quantity, unit, location, pallet_number, notes, earmarked_for_job, earmarked_job, earmark_notes, production_job_id, temporary_job_label, production_job:jobs!production_job_id(id,name,job_number,production_status,archived_at), updated_at, last_counted_at, last_counted_by', { count: 'exact' },
      )
      .order('vendor', { ascending: true })
      .order('color', { ascending: true })
      .order('size', { ascending: true }).order('id').range(from, to).abortSignal(signal));
}

export async function loadReceivalRows<T extends {id: string}>(includeReceived: boolean, signal: AbortSignal): Promise<T[]> {
  return loadCompleteRows((from, to) => supabase
      .from('pending_receivals')
      .select(
        'id, vendor, material_name, size, category, quantity_expected, quantity_received, unit, location, pallet_number, status, ordered_by, order_date, received_by, eta, notes, created_at, received_at, is_earmarked, earmarked_job_name, earmark_notes, production_job_id, temporary_job_label, receipt_inventory_item_id, receipt_transaction_id, receipt_created_inventory_item, production_job:jobs!production_job_id(id,name,job_number,production_status,archived_at)', { count: 'exact' },
      )
      .in('status', includeReceived ? ['pending', 'partially_received', 'received'] : ['pending', 'partially_received'])
      .order('eta', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      // Batch-created rows can share timestamps; receive/undo must not reshuffle ties.
      .order('material_name', { ascending: true })
      .order('size', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }).range(from, to).abortSignal(signal).returns<T[]>());
}

/** Activity is the explicit audit-history workspace; never substitute its old 500-row slice for history. */
export async function loadInventoryTransactions<T extends {id: string}>(signal: AbortSignal): Promise<T[]> {
  return loadCompleteRows((from, to) => supabase.from('inventory_transactions')
    .select('id, created_at, transaction_type, vendor, specialty_vendor_name, item_name, size, unit, quantity, location, notes, catalog_source, is_earmarked, earmarked_job_name, earmark_notes, synced_to_inventory_at, reversal_of_transaction_id, reversed_at, reversed_by', {count: 'exact'})
    .order('created_at', {ascending: false}).order('id').range(from, to).abortSignal(signal).returns<T[]>());
}
