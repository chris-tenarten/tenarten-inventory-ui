import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, mutations, editor, issuance] = await Promise.all([
  read('../supabase/migrations/20260723_006_purchase_order_number_allocation.sql'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'),
  read('../supabase/migrations/20260723_001_purchase_order_issuance.sql'),
]);

assert.match(migration, /purchase_order_number_sequences/);
assert.match(migration, /prefix text primary key/);
assert.match(migration, /on conflict \(prefix\) do update/);
assert.match(migration, /last_value = public\.purchase_order_number_sequences\.last_value \+ 1/);
assert.match(migration, /selected_order\.production_job_id is null[\s\S]*selected_prefix := '9999'/);
assert.match(migration, /right\(regexp_replace\(coalesce\(selected_order\.job_number_snapshot/);
assert.match(migration, /selected_prefix \|\| '-' \|\| lpad\(selected_value::text, 3, '0'\)/);
assert.match(migration, /nullif\(trim\(selected_order\.po_number\), ''\) is not null[\s\S]*return trim\(selected_order\.po_number\)/);
assert.match(migration, /public\.save_chip_purchase_order_draft\(p_order - 'po_number'/);
assert.doesNotMatch(
  migration.slice(migration.indexOf('create or replace function public.allocate_purchase_order_number')),
  /max\s*\(/i,
  'Runtime allocation must not use MAX()+1.',
);
const saveMutation = mutations.slice(
  mutations.indexOf('export async function savePurchaseOrderDraft'),
  mutations.indexOf('export async function deletePurchaseOrderDraft'),
);
assert.doesNotMatch(saveMutation, /po_number:draft\.poNumber/);
assert.match(editor, /const displayedPoNumber = draft\.poNumber \|\| provisionalPoPrefix/);
assert.match(editor, /Final suffix assigned on first save/);
assert.match(issuance, /'po_number', trim\(selected_order\.po_number\)/);

console.log('Purchasing automatic number allocation checks passed.');
