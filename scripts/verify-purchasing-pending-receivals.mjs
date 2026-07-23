import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, queries, mutations, editor, dialog] = await Promise.all([
  read('../supabase/migrations/20260723_008_purchase_order_pending_receivals.sql'),
  read('../src/modules/purchasing/queries.ts'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'),
  read('../src/modules/purchasing/PendingReceivalsReviewDialog.tsx'),
]);

assert.match(migration, /source_purchase_order_issuance_id uuid[\s\S]*references public\.purchase_order_issuances/);
assert.match(migration, /source_purchase_order_line_id uuid/);
assert.match(migration, /create unique index if not exists pending_receivals_purchase_order_source_uidx/);
assert.match(migration, /create or replace function public\.create_pending_receivals_from_purchase_order/);
assert.match(migration, /document\.status = 'generated'/);
assert.match(migration, /jsonb_array_elements\(snapshot_lines\)/);
assert.match(migration, /on conflict \([\s\S]*source_purchase_order_issuance_id,[\s\S]*source_purchase_order_line_id/);
assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/);
assert.match(migration, /grant execute on function public\.create_pending_receivals_from_purchase_order[\s\S]*to anon, authenticated, service_role/);
assert.doesNotMatch(migration, /vendor_catalog/);

assert.match(queries, /loadPurchaseOrderPendingReceivalProjection/);
assert.match(queries, /order_snapshot,lines_snapshot/);
assert.match(queries, /source_purchase_order_issuance_id/);
assert.match(mutations, /createPendingReceivalsFromPurchaseOrder/);
assert.match(mutations, /create_pending_receivals_from_purchase_order/);
assert.match(editor, /Create Remaining Lines/);
assert.match(editor, /Pending Receivals have been created for every eligible line/);
assert.match(dialog, /Review Pending Receivals/);
assert.match(dialog, /ETA is intentionally blank/);
assert.match(dialog, /alreadyCreated/);

console.log('Purchasing to Pending Receivals integration checks passed.');
