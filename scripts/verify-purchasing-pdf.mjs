import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPurchaseOrderPdfModel,
  PURCHASE_ORDER_PDF_VERSION,
  PURCHASE_ORDER_ROWS_PER_PAGE,
} from '../supabase/functions/_shared/purchase-order-pdf-model.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, v2Migration, pgcryptoFix, databaseVerification, edgeFunction, editor, mutations, queries, validation, printModel] = await Promise.all([
  read('../supabase/migrations/20260723_004_purchase_order_pdf_documents.sql'),
  read('../supabase/migrations/20260723_005_purchase_order_pdf_v2.sql'),
  read('../supabase/migrations/20260723_009_purchase_order_pdf_snapshot_pgcrypto_path.sql'),
  read('../supabase/inspection/20260723_003_purchase_order_pdf_verification.sql'),
  read('../supabase/functions/generate-purchase-order-pdf/index.ts'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../src/modules/purchasing/queries.ts'),
  read('../src/modules/purchasing/validation.ts'),
  read('../src/modules/purchasing/print-model.ts'),
]);

const header = {
  po_number:'0206-002.1', status:'issued', issued_at:'2026-07-23T16:00:00Z',
  vendor_name:'Snapshot Vendor', vendor_address:'Snapshot Address', vendor_contact:'Snapshot Contact',
  production_job_id:'job-id', job_number:'26-0206', job_name:'Snapshot Job', customer:'Snapshot Customer',
  requested_date:'2026-08-01', ship_to:'Snapshot Ship To', payment_terms:'Net 30',
  originated_by:'Anthony', authorized_by:'Anthony', commercial_notes:'Snapshot vendor note',
  subtotal:3500, freight:100, tax_amount:50, miscellaneous_amount:null, total:3650,
};
const lines = Array.from({length:35}, (_, index) => ({
  line_number:index + 1, material:`Snapshot Material ${index + 1}`, vendor_sku:`SKU-${index + 1}`,
  chip_size:index === 0 ? 'Part A' : '', notes:index === 0 ? 'Granite Brown 0702226 with a longer description that must wrap cleanly' : `Snapshot Description ${index + 1}`,
  display_description:`Legacy synthesized description ${index + 1}`, container_type:index === 0 ? 'pail' : '', package_quantity:index === 0 ? 5 : null, package_measure:index === 0 ? 'gal' : null, quantity:10, unit:'gal',
  unit_price:10, line_total:100,
}));
const model = buildPurchaseOrderPdfModel(header, lines);
assert.equal(model.documentVersion, PURCHASE_ORDER_PDF_VERSION);
assert.equal(model.documentVersion, 'po-pdf-v2');
assert.equal(model.templateName, 'tenops');
assert.equal(model.templateVersion, 1);
assert.equal(model.poNumber, '0206-002.1', 'PO numbers must remain exact text');
assert.equal(model.poDate, '');
assert.equal('customer' in model.job, false, 'Customer must not be exposed in the vendor-facing PDF model');
assert.equal(model.lines.length, 35);
assert.equal(model.lines[0].vendorSku, 'SKU-1');
assert.equal(model.lines[0].partComponent, 'Part A');
assert.equal(model.lines[0].description, 'Granite Brown 0702226 with a longer description that must wrap cleanly');
assert.equal(model.lines[0].description.includes('Snapshot Material'), false, 'Description must not synthesize Material');
assert.equal(model.lines[0].description.includes('SKU-1'), false, 'Description must not synthesize Vendor SKU');
assert.equal(model.lines[0].container, 'pail');
assert.equal(model.lines[0].containerSize, '5 gal');
assert.equal(model.pages.length, Math.ceil(35 / PURCHASE_ORDER_ROWS_PER_PAGE));
assert.deepEqual(model.pages.map(page => page.length), [12,12,11]);
assert.equal(model.totals.grandTotal, '$3650.00');
assert.equal(model.totals.taxPercent, '');

const currentVendor = {name:'Changed Live Vendor'};
assert.equal(model.vendor.name, 'Snapshot Vendor');
assert.equal(model.job.name, 'Snapshot Job');
assert.notEqual(model.vendor.name, currentVendor.name);

const stock = buildPurchaseOrderPdfModel({...header,production_job_id:null,job_number:null,job_name:null,customer:null}, [lines[0]]);
assert.equal(stock.job.kind, 'stock');
assert.equal(stock.job.name, 'Stock Purchase');

assert.match(migration, /unique references public\.purchase_order_issuances/);
assert.match(migration, /'pending', 'generating', 'generated', 'failed'/);
assert.match(migration, /purchase-order-documents/);
assert.match(v2Migration, /alter column document_version set default 'po-pdf-v2'/);
assert.match(v2Migration, /document_template text not null default 'tenops'/);
assert.match(v2Migration, /template_name text not null default 'tenops'/);
assert.match(v2Migration, /set_purchase_order_document_template/);
assert.match(v2Migration, /status in \('pending', 'failed'\)/);
assert.match(v2Migration, /storage_path is null/);
assert.match(migration, /public\.claim_purchase_order_pdf_generation/);
assert.match(migration, /purchase_order_issuances_capture_pdf_fields/);
assert.match(pgcryptoFix, /extensions\.digest\(bytea,text\)/);
assert.match(pgcryptoFix, /alter function public\.capture_purchase_order_pdf_snapshot_fields\(\)[\s\S]*set search_path = public, extensions, pg_temp/);
assert.match(databaseVerification, /always rolls back/i);
assert.match(databaseVerification, /Concurrent PDF generation was not rejected/);
assert.match(databaseVerification, /Retry created a duplicate PDF document/);
assert.match(databaseVerification, /Generated PDF was not reused idempotently/);
assert.match(edgeFunction, /claim\.order_snapshot/);
assert.match(edgeFunction, /claim\.lines_snapshot/);
assert.match(edgeFunction, /body\.action === "draft-preview"/);
assert.match(edgeFunction, /DRAFT - NOT ISSUED/);
assert.match(edgeFunction, /lineCount \* rowLineHeight \+ 8/);
assert.match(edgeFunction, /rowTop - 10 - lineIndex \* rowLineHeight/);
assert.doesNotMatch(edgeFunction, /model\.job\.customer/);
assert.match(edgeFunction, /"Cache-Control": "no-store"/);
assert.match(edgeFunction, /upsert: false/);
assert.match(edgeFunction, /body\.action === "download" \|\| body\.action === "preview"/);
assert.match(edgeFunction, /body\.action === "download"\s*\?\s*\{ download: true \}/);
assert.doesNotMatch(edgeFunction, /\.from\(["'](?:vendors|jobs|vendor_catalog|purchase_orders)/);
assert.match(editor, /Retry PDF Generation/);
assert.match(editor, /Preview Draft PDF/);
assert.match(editor, /View Issued PDF/);
assert.match(editor, /Document Template/);
assert.match(mutations, /generate-purchase-order-pdf/);
assert.match(mutations, /action:'draft-preview'/);
assert.match(mutations, /display_description:details\.notes/);
assert.match(mutations, /part_component:details\.chipSize/);
assert.match(mutations, /container_size:\[details\.packageQuantity,details\.packageMeasure\]/);
assert.doesNotMatch(printModel, /const description = \[details\.materialNameSnapshot/);
assert.doesNotMatch(validation, /chip size is required/i, 'Part B and Part / Component must remain optional');
assert.match(editor, /Purchase Order Line/);
assert.match(editor, /Part \/ Component/);
assert.match(editor, /Quantity Unit/);
assert.match(editor, /Container Size/);
assert.match(editor, /const quantityUnits = \["gal", "lb", "oz", "ea", "sq ft", "lin ft"\]/);
assert.match(editor, /const containerTypes = \["pail", "drum", "bag", "box", "case", "tote"\]/);
assert.doesNotMatch(editor, /const quantityUnits = \[[^\]]*"(?:bag|pail|drum|box|case|tote)"/);
assert.doesNotMatch(editor, /const containerTypes = \[[^\]]*"(?:gal|lb|oz|ea|sq ft|lin ft)"/);
assert.match(editor, /const \[custom, setCustom\] = useState\(Boolean\(value\) && !recognized\)/);
assert.match(editor, /<option value="__other">Other<\/option>/);
assert.match(mutations, /body: \{ action:'preview', issuanceId \}/);
assert.match(queries, /purchase_order_documents/);

console.log('Purchasing permanent PDF checks passed.');
