import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPurchaseOrderPdfModel,
  PURCHASE_ORDER_PDF_VERSION,
  PURCHASE_ORDER_ROWS_PER_PAGE,
} from '../supabase/functions/_shared/purchase-order-pdf-model.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [migration, v2Migration, pgcryptoFix, databaseVerification, edgeFunction, editor, mutations, queries] = await Promise.all([
  read('../supabase/migrations/20260723_004_purchase_order_pdf_documents.sql'),
  read('../supabase/migrations/20260723_005_purchase_order_pdf_v2.sql'),
  read('../supabase/migrations/20260723_009_purchase_order_pdf_snapshot_pgcrypto_path.sql'),
  read('../supabase/inspection/20260723_003_purchase_order_pdf_verification.sql'),
  read('../supabase/functions/generate-purchase-order-pdf/index.ts'),
  read('../src/modules/purchasing/PurchaseOrderEditor.tsx'),
  read('../src/modules/purchasing/mutations.ts'),
  read('../src/modules/purchasing/queries.ts'),
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
  display_description:`Snapshot Description ${index + 1}`, quantity:10, unit:'Bag',
  unit_price:10, line_total:100,
}));
const model = buildPurchaseOrderPdfModel(header, lines);
assert.equal(model.documentVersion, PURCHASE_ORDER_PDF_VERSION);
assert.equal(model.documentVersion, 'po-pdf-v2');
assert.equal(model.templateName, 'tenops');
assert.equal(model.templateVersion, 1);
assert.equal(model.poNumber, '0206-002.1', 'PO numbers must remain exact text');
assert.equal(model.poDate, '');
assert.equal(model.job.customer, 'Snapshot Customer');
assert.equal(model.lines.length, 35);
assert.equal(model.lines[0].vendorSku, 'SKU-1');
assert.equal(model.pages.length, Math.ceil(35 / PURCHASE_ORDER_ROWS_PER_PAGE));
assert.deepEqual(model.pages.map(page => page.length), [12,12,11]);
assert.equal(model.totals.grandTotal, '$3650.00');
assert.equal(model.totals.taxPercent, '');

const currentVendor = {name:'Changed Live Vendor'};
const currentJob = {name:'Changed Live Job',customer:'Changed Live Customer'};
assert.equal(model.vendor.name, 'Snapshot Vendor');
assert.equal(model.job.name, 'Snapshot Job');
assert.notEqual(model.vendor.name, currentVendor.name);
assert.notEqual(model.job.customer, currentJob.customer);

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
assert.match(mutations, /body: \{ action:'preview', issuanceId \}/);
assert.match(queries, /purchase_order_documents/);

console.log('Purchasing permanent PDF checks passed.');
