import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, ambiguityFix, compatibilitySupport, mutations, queries, editor, workspace, schemaDoc, workflowDoc] = await Promise.all([
  read('../supabase/migrations/20260723_001_purchase_order_issuance.sql'),
  read('../supabase/migrations/20260723_003_purchase_order_issuance_column_resolution.sql'),
  read('../supabase/migrations/20260818_004_final_compatibility_support.sql'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../src/modules/purchasing/queries.ts'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'),
  read('../src/modules/purchasing/PurchasingWorkspace.tsx'),
  read('../docs/schemas/PURCHASING.md'),
  read('../docs/workflows/PURCHASING.md'),
]);

assert.match(migration, /create table if not exists public\.purchase_order_issuances/);
assert.match(migration, /unique \(purchase_order_id, revision_number\)/);
assert.match(migration, /create or replace function public\.issue_purchase_order/);
assert.match(ambiguityFix, /pg_get_functiondef/);
assert.match(ambiguityFix, /issuance\.purchase_order_id = selected_order\.id/);
assert.match(ambiguityFix, /issuance\.revision_number = selected_order\.revision_number/);
assert.match(ambiguityFix, /order_lines\.purchase_order_id = selected_order\.id/);
assert.doesNotMatch(ambiguityFix, /set plpgsql\.variable_conflict/);
assert.doesNotMatch(
  ambiguityFix,
  /from\s+public\.purchase_order_(?:issuances|lines)\s+where\s+purchase_order_id/,
);
assert.match(migration, /for update/);
assert.match(migration, /selected_order\.updated_at is distinct from p_expected_updated_at/);
assert.match(migration, /return query select[\s\S]*existing_issuance\.id/);
assert.match(migration, /lower\(trim\(po_number\)\)/);
assert.match(migration, /jsonb_agg\([\s\S]*order by lines\.line_number/);
assert.match(migration, /digest\(convert_to/);
assert.match(migration, /calculated_subtotal/);
assert.match(migration, /calculated_discount/);
assert.match(migration, /calculated_tax/);
assert.match(migration, /calculated_total/);
assert.match(migration, /production_job_id', selected_order\.production_job_id/);
assert.doesNotMatch(migration, /production_job_id is null.*raise exception/is);
assert.match(migration, /Purchase Order lines are incomplete or do not belong/);
assert.match(migration, /guard_purchase_order_issuance_snapshot/);
assert.match(migration, /guard_issued_purchase_order/);
assert.match(migration, /guard_issued_purchase_order_line/);
assert.match(migration, /guard_issued_chip_purchase_order_detail/);
assert.match(compatibilitySupport, /job_po_reference_type is null or job_po_reference_type in \('resin', 'chip'\)/);
assert.match(compatibilitySupport, /after insert on public\.purchase_order_issuances/);
assert.match(compatibilitySupport, /if nullif\(btrim\(current_reference\), ''\) is not null[\s\S]*already has a different/);
assert.match(compatibilitySupport, /update public\.jobs set resin_po = btrim\(selected_order\.po_number\)/);
assert.match(compatibilitySupport, /update public\.jobs set chip_po = btrim\(selected_order\.po_number\)/);
assert.doesNotMatch(compatibilitySupport, /description.*(?:resin|chip)/i);
assert.match(mutations, /issue_purchase_order/);
assert.match(mutations, /job_po_reference_type:draft\.jobPoReferenceType \|\| null/);
assert.match(mutations, /p_expected_updated_at: expectedUpdatedAt/);
assert.match(queries, /purchase_order_issuances/);
assert.match(editor, /Issue Purchase Order/);
assert.match(editor, /window\.confirm/);
assert.match(editor, /issuanceInFlight/);
assert.match(editor, /Save your latest changes before issuing/);
assert.match(editor, /This draft changed after you opened it/);
assert.match(editor, /fieldset disabled=\{readOnly\}/);
assert.match(editor, /Production PO Reference/);
assert.match(editor, /The selected Job reference is populated only after this PO is successfully issued/);
assert.match(workspace, /status:po\.status/);
assert.match(schemaDoc, /purchase_order_issuances/);
assert.match(workflowDoc, /Draft.*Issued/s);

console.log('Purchasing issuance integrity checks passed.');
