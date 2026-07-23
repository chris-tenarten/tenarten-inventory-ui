import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculatePurchaseOrderTotals, lineTotalCents } from '../src/modules/purchasing/calculations.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [foundation, simplification, optionalCharges, configuration, referenceData, noteCleanup, mutations, catalog, editor, defaults, validation, printModel, documentTemplate, viewer, inspector] = await Promise.all([
  read('../supabase/migrations/20260722_002_purchasing_phase1.sql'),
  read('../supabase/migrations/20260722_003_purchasing_phase1_1_simplification.sql'),
  read('../supabase/migrations/20260722_004_purchasing_optional_charges.sql'),
  read('../supabase/migrations/20260722_005_purchasing_vendor_configuration.sql'),
  read('../supabase/migrations/20260722_006_purchasing_reference_data.sql'),
  read('../supabase/migrations/20260722_007_remove_vendor_import_notes.sql'),
  read('../src/modules/purchasing/mutations.ts'), read('../src/modules/purchasing/catalog.ts'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'), read('../src/modules/purchasing/defaults.ts'),
  read('../src/modules/purchasing/validation.ts'), read('../src/modules/purchasing/print-model.ts'),
  read('../src/modules/purchasing/PurchaseOrderDocument.tsx'), read('../src/components/documents/DocumentViewer.tsx'),
  read('../src/modules/production/components/ProductionJobInspector.tsx'),
]);

for (const table of ['vendors', 'purchase_orders', 'purchase_order_lines', 'chip_purchase_order_line_details']) assert.match(foundation, new RegExp(`create table public\\.${table}`));
assert.match(foundation, /unique \(purchase_order_id, line_number\)/);
assert.match(foundation, /moisture_condition in \('dry','damp','wet'\)/);
assert.match(foundation, /save_chip_purchase_order_draft/);
assert.doesNotMatch(foundation, /pending_receivals|inventory_items|inventory_transactions/);
for (const field of ['production_job_id', 'job_number_snapshot', 'job_name_snapshot', 'ship_to_snapshot', 'payment_terms_snapshot', 'authorized_by_snapshot']) assert.match(simplification, new RegExp(`add column ${field}`));
assert.match(simplification, /drop column requested_date_override/);
for (const field of ['discount_percent', 'discount_amount', 'tax_percent', 'tax_amount', 'freight', 'total']) assert.match(optionalCharges, new RegExp(`add column ${field}`));
assert.match(optionalCharges, /calculated_subtotal\*coalesce\(discount_rate,0\)\/100/);
assert.match(optionalCharges, /taxable_subtotal\*coalesce\(tax_rate,0\)\/100/);
assert.doesNotMatch(optionalCharges, /pending_receivals|inventory_items|inventory_transactions/);
for (const rpc of ['save_chip_purchase_order_draft_v2','delete_purchase_order_draft','save_vendor_profile','save_vendor_contact','save_purchasing_catalog_item']) assert.match(configuration, new RegExp(rpc));
assert.match(configuration, /create table if not exists public\.vendor_contacts/);
assert.match(configuration, /add column if not exists vendor_id uuid references public\.vendors/);
for (const vendor of ['Arim','ASG','CCQ','EnviroGlas','Klein & Co\. Inc\.','Southern Aggregates','Terrazzo & Marble Supply']) assert.match(referenceData, new RegExp(vendor));
assert.match(referenceData, /Raymond Kent/);
assert.match(referenceData, /Bill Fryer/);
assert.match(noteCleanup, /update public\.vendors/);
assert.match(noteCleanup, /update public\.vendor_contacts/);
assert.doesNotMatch(configuration, /pending_receivals|inventory_items|inventory_transactions/);

assert.equal(lineTotalCents('40', '19.25'), 77000);
assert.deepEqual(calculatePurchaseOrderTotals([{ quantityOrdered: '40', unitPrice: '19.25' }, { quantityOrdered: '2.5', unitPrice: '10' }], '10', '8.25', '25'), {
  lineTotals: [77000, 2500], subtotal: 79500, discountAmount: 7950, taxableSubtotal: 71550,
  taxAmount: 5903, freightAmount: 2500, total: 79953,
});
assert.deepEqual(calculatePurchaseOrderTotals([{ quantityOrdered: '1', unitPrice: '10' }]), { lineTotals: [1000], subtotal: 1000, discountAmount: 0, taxableSubtotal: 1000, taxAmount: 0, freightAmount: 0, total: 1000 });
assert.match(defaults, /createdBy:'AI'/);
assert.match(validation, /Discount.*between 0 and 100/);
assert.match(validation, /Freight must be a non-negative currency amount/);
assert.match(mutations, /discount_percent:draft\.discountPercent/);
assert.match(mutations, /tax_percent:draft\.taxPercent/);
assert.match(mutations, /freight:draft\.freight/);
assert.match(mutations, /save_chip_purchase_order_draft_v2/);
assert.match(mutations, /delete_purchase_order_draft/);
assert.match(catalog, /vendor_sku/);
assert.match(catalog, /vendor_name\.ilike/);
assert.match(catalog, /canonical_size\.ilike/);
assert.doesNotMatch(catalog, /rows\.filter\(row=>!vendor/);
assert.match(editor, /Preview Draft PDF/);
assert.match(editor, /Search Catalog/);
assert.match(editor, /Amount Per Container/);
assert.match(editor, /Purchase Order Number/);
assert.match(editor, /Update Individual Catalog Price/);
assert.match(editor, /Update Bulk Pricing/);
assert.match(editor, /Configure Bulk Pricing/);
assert.match(editor, /Configure Truckload Pricing/);
assert.match(editor, /Create Vendor Catalog Item/);
assert.match(editor, /Delete Saved Draft/);
assert.match(editor, /JobTag/);
assert.match(editor, /Discount %/);
assert.match(editor, /Sales Tax %/);
assert.match(editor, /Freight/);
assert.match(printModel, /calculatePurchaseOrderTotals/);
assert.match(documentTemplate, /PURCHASE ORDER/);
assert.match(documentTemplate, /DRAFT/);
assert.match(documentTemplate, /\/logo\.png/);
assert.match(documentTemplate, /Additional Notes &amp; Special Conditions/);
assert.match(viewer, /application\/pdf/);
assert.match(viewer, /image\/webp/);
assert.match(viewer, /Preview unavailable/);
assert.match(viewer, /Zoom in/);
assert.match(inspector, /<DocumentViewer/);
assert.match(inspector, /createJobAttachmentDownloadUrl/);
assert.match(editor, /Generate PDF/);
assert.match(editor, /Create Pending Receivals/);
assert.doesNotMatch(editor, /Upload PDF to Project Files/);
console.log('Purchasing and Forms foundation checks passed.');
