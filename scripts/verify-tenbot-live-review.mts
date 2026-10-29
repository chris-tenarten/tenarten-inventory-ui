import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { approvalForCurrentReview, catalogRequestIssues, editableRows, localAgentExperimentRequested, localReceivalCandidateRequested, prepareInvoiceImage, RECEIVAL_EXECUTION_BLOCKED, receivalExecutionBlock, receivalLineValidation, receivalOrderIssues, reviewChanged, singlePdfPageScale, type LocalDemoStatus, type LocalReceivalDraft, type ProposedCatalogMaterial } from '../src/modules/tenbot/live-review';
import { ReceivalDraftReview } from '../src/modules/tenbot/ReceivalDraftReview';

// Offline UI/lifecycle checks. This never starts a server or invokes a provider.
const checks: string[] = [];
const base: LocalReceivalDraft = { id: 'local-draft-1', revision: 2, hash: 'server-reviewed-current-hash', simulation: true, status: 'review_required', attachmentId: 'owner-image-1', orderDetails: { orderedBy: 'Synthetic Employee', orderDate: '2026-10-28', location: 'Denton' }, missingFields: [], canApprove: true, rows: [{ lineId: 'line-1', sourceText: 'AW-1 | Alaska White | #1 | 150 LB', materialId: 'standard:synthetic-aw1', materialName: 'Alaska White', size: '#1', quantity: '3', unit: 'Bag', jobId: null, excluded: false, reasons: [] }] };
const status: LocalDemoStatus = { mode: 'synthetic-live', simulation: true, maxAttachmentBytes: 90000, mediaTypes: ['image/png', 'image/jpeg'], catalog: [{ id: 'standard:synthetic-aw1', materialName: 'Alaska White', size: '#1', unit: 'Bag', supplier: 'T&M Supply', packageLabel: '50 LB Bag' }, { id: 'standard:green-a', materialName: 'CC Green', size: '#1', unit: 'Bag', supplier: 'T&M Supply', packageLabel: '50 LB Bag' }, { id: 'standard:green-b', materialName: 'CC Green', size: '#1', unit: 'Bag', supplier: 'T&M Supply', packageLabel: '25 LB Bag' }], jobs: [{ id: 'synthetic-job', label: 'SYN-1 — Synthetic Job' }] };
const copy = <T,>(value: T): T => structuredClone(value);
async function check(name: string, action: () => void | Promise<void>) { await action(); checks.push(name); }
function render(draft = base, currentStatus = status) { return renderToStaticMarkup(createElement(ReceivalDraftReview, { draft, status: currentStatus, busy: false, approval: null, onDetails() {}, async onReview() {}, async onApprove() {} })); }

await check('approval requires explicit confirmation of the current reviewed revision/hash', () => {
  const rows = editableRows(base);
  assert.equal(approvalForCurrentReview(base, rows, base.orderDetails, false, false), false);
  assert.equal(approvalForCurrentReview(base, rows, base.orderDetails, true, true), false);
  assert.equal(approvalForCurrentReview(base, rows, base.orderDetails, true, false), true);
  for (const change of [{ canApprove: false }, { hash: '' }, { revision: 0 }, { status: 'approved_simulated' as const }]) assert.equal(approvalForCurrentReview({ ...base, ...change }, rows, base.orderDetails, true, false), false);
});
await check('quantity, catalog identity, unit, Job, exclusion and metadata edits invalidate approval', () => {
  for (const change of [{ quantity: '4' }, { materialId: 'standard:green-a' }, { unit: 'KG' }, { jobId: 'synthetic-job' }, { excluded: true }]) {
    const rows = editableRows(base); rows[0] = { ...rows[0], ...change };
    assert.equal(reviewChanged(base, rows, base.orderDetails), true);
    assert.equal(approvalForCurrentReview(base, rows, base.orderDetails, true, false), false);
  }
  assert.equal(approvalForCurrentReview(base, editableRows(base), { ...base.orderDetails, location: 'Carrollton' }, true, false), false);
});
await check('editing does not mutate the server-owned draft or its hash', () => {
  const original = JSON.stringify(base), rows = editableRows(base); rows[0].quantity = '99';
  assert.equal(JSON.stringify(base), original); assert.equal(base.hash, 'server-reviewed-current-hash');
});
await check('review UI exposes canonical catalog choices, positive quantity, units, Job and explicit approval', () => {
  const html = render();
  for (const label of ['Catalog material for line-1', 'Expected quantity for line-1', 'Unit for line-1', 'Production Job for line-1', 'General stock', 'Save changes for review', 'I reviewed these exact lines', 'Approve simulated pending receivals', '50 LB Bag', '25 LB Bag']) assert.ok(html.includes(label), label);
  assert.ok(html.includes('No size') === false);
  assert.ok(!html.includes('Create new material'));
  assert.ok(/disabled=""[^>]*>Approve simulated pending receivals/.test(html));
});
await check('held lines and missing metadata remain visible and cannot be approved initially', () => {
  const held = copy(base); held.canApprove = false; held.missingFields = ['ordered_by']; held.orderDetails.orderedBy = ''; held.rows[0].materialId = null; held.rows[0].reasons = ['ambiguous_catalog_match'];
  const html = render(held);
  for (const text of ['Needs catalog match', 'Ordered by is required.', 'Exclude this line', 'existing catalog material', 'Request new catalog material', 'Before approval']) assert.ok(html.includes(text), text);
  assert.equal(approvalForCurrentReview(held, editableRows(held), held.orderDetails, true, false), false);
});
await check('current quantity/unit/catalog validation clears corrected field errors without approving unsaved edits', () => {
  const source = copy(base.rows[0]); source.reasons = ['invalid_quantity', 'incompatible_unit'];
  const row = editableRows(base)[0]; row.quantity = '0'; row.unit = 'Pail';
  const invalid = receivalLineValidation(source, row, status);
  assert.equal(invalid.state, 'Invalid quantity/unit'); assert(invalid.fields.quantity); assert(invalid.fields.unit);
  row.quantity = '4'; row.unit = 'Bag';
  const corrected = receivalLineValidation(source, row, status);
  assert.equal(corrected.state, 'Ready'); assert.deepEqual(corrected.fields, {}); assert.equal(corrected.changed, true);
  assert.equal(approvalForCurrentReview(base, [row], base.orderDetails, true, false), false);
  for (const quantity of ['', '-1', 'NaN', 'Infinity', '9'.repeat(400)]) assert(receivalLineValidation(source, {...row, quantity}, status).fields.quantity);
});
await check('existing catalog identity resolves current match errors while fabricated catalog IDs do not', () => {
  const source = {...copy(base.rows[0]), materialId: null, reasons: ['unmatched_material', 'ambiguous_catalog_match']};
  const row = {...editableRows(base)[0], materialId: null};
  assert.equal(receivalLineValidation(source, row, status).state, 'Needs catalog match');
  assert.equal(receivalLineValidation(source, {...row, materialId: 'proposed-not-a-catalog-id'}, status).state, 'Needs catalog match');
  const resolved = receivalLineValidation(source, {...row, materialId: status.catalog[0].id}, status);
  assert.equal(resolved.state, 'Ready'); assert.deepEqual(resolved.holds, []);
});
const proposed: ProposedCatalogMaterial = {supplier:'T&M Supply',itemName:'Unlisted Violet',vendorSku:'UNK-99',materialType:'chip',size:'#1',unitSize:'50',unitSizeUom:'LB',packaging:'Bag',priceUnit:'Bag',notes:'Verify against original invoice.',prepared:true};
await check('a complete proposed catalog material resolves an unmatched line without an invented catalog ID', () => {
  const source = {...copy(base.rows[0]), materialId:null, materialName:'Unlisted Violet', reasons:['unmatched_material','incomplete_catalog_request']};
  const row = {...editableRows(base)[0], materialId:null, catalogRequest:copy(proposed)};
  assert.deepEqual(catalogRequestIssues(proposed), {});
  const validation = receivalLineValidation(source,row,{...status,canCreateCatalog:true});
  assert.equal(validation.state,'Ready'); assert.deepEqual(validation.fields,{}); assert.deepEqual(validation.holds,[]);
  assert.equal(row.materialId,null); assert.equal(validation.changed,true);
  assert(receivalLineValidation(source,{...row,catalogRequest:{...proposed,prepared:false}},status).fields.materialId);
  assert(receivalLineValidation(source,{...row,catalogRequest:{...proposed,unitSize:''}},status).fields.materialId);
  assert(receivalLineValidation(source,{...row,materialId:status.catalog[0].id},status).fields.materialId);
  assert(receivalLineValidation(source,{...row,unit:'Pail'},status).fields.unit);
});
await check('all proposed material edits invalidate approval, while explicit null matches omitted request metadata', () => {
  const draft = copy(base); draft.rows[0].materialId=null; draft.rows[0].catalogRequest=copy(proposed);
  const rows = editableRows(draft);
  assert.equal(approvalForCurrentReview(draft,rows,draft.orderDetails,true,false),true);
  for (const key of ['supplier','itemName','vendorSku','materialType','size','unitSize','unitSizeUom','packaging','priceUnit','notes','prepared'] as const) {
    const edits=editableRows(draft); const request=edits[0].catalogRequest!;
    edits[0].catalogRequest={...request,[key]:key==='prepared'?false:`${request[key]} changed`};
    assert.equal(approvalForCurrentReview(draft,edits,draft.orderDetails,true,false),false,key);
  }
  rows[0].catalogRequest!.notes='changed'; assert.equal(draft.rows[0].catalogRequest.notes,proposed.notes);
  const unchanged=editableRows(base); unchanged[0].catalogRequest=null;
  assert.equal(reviewChanged(base,unchanged,base.orderDetails),false);
});
await check('new materials remain reviewable requests without catalog permission and real combined execution stays blocked', () => {
  const draft=copy(base); draft.rows[0]={...draft.rows[0],materialId:null,catalogRequest:copy(proposed)};
  const denied=receivalLineValidation(draft.rows[0],editableRows(draft)[0],{...status,canCreateCatalog:false});
  assert.equal(denied.state,'Needs review'); assert.equal(denied.holds.length,1); assert.deepEqual(denied.fields,{});
  const html=render(draft,{...status,canCreateCatalog:false});
  for(const text of ['Request for an authorized employee','Simulated catalog material + pending receival','catalog creation and dependent pending receivals','1 catalog material + 1 pending receivals']) assert(html.includes(text),text);
  assert(/disabled=""[^>]*>Approve simulated catalog and receivals/.test(html));
  const real=receivalLineValidation(draft.rows[0],editableRows(draft)[0],{...status,simulation:false,canCreateCatalog:true});
  assert(real.holds.some(hold=>hold.includes('Combined catalog and receival execution is unavailable')));
});
await check('duplicate, document conflicts and unknown server holds survive unrelated edits until server review or exclusion', () => {
  for (const reason of ['potential_duplicate', 'duplicate_draft_line', 'supplier_mismatch', 'invoice_catalog_package_conflict', 'future_server_hold']) {
    const source = {...copy(base.rows[0]), reasons: [reason]}, row = {...editableRows(base)[0], quantity: '6', jobId: status.jobs[0].id};
    const held = receivalLineValidation(source, row, status);
    assert.equal(held.state, 'Needs review'); assert.equal(held.holds.length, 1);
    const excluded = receivalLineValidation(source, {...row, excluded: true, quantity: '0'}, status);
    assert.equal(excluded.state, 'Excluded'); assert.deepEqual(excluded.fields, {}); assert.deepEqual(excluded.holds, []);
  }
});
await check('metadata, Job and real decimal bounds name current fields and discard obsolete missing-field snapshots', () => {
  assert.deepEqual(receivalOrderIssues(base.orderDetails), {});
  assert.deepEqual(Object.keys(receivalOrderIssues({orderedBy: ' ', orderDate: '2026-02-30', location: ''})).sort(), ['location', 'orderDate', 'orderedBy']);
  assert(receivalLineValidation(base.rows[0], {...editableRows(base)[0], jobId: 'unknown-job'}, status).fields.jobId);
  const real = {...status, simulation: false};
  for (const quantity of ['1000000000', '0.0000001', '01']) assert(receivalLineValidation(base.rows[0], {...editableRows(base)[0], quantity}, real).fields.quantity);
  assert(!receivalLineValidation(base.rows[0], {...editableRows(base)[0], unit: 'Bags'}, real).fields.unit);
  const stale = {...copy(base), missingFields: ['ordered_by']};
  assert(!render(stale).includes('Ordered by is required.'));
});
await check('successful simulation is explicitly distinguished from Production and on-hand inventory', () => {
  const approved = { ...copy(base), status: 'approved_simulated' as const };
  const html = render(approved);
  for (const text of ['simulated pending receival', 'Received quantity: 0', 'On-hand inventory is unchanged', 'No Production records were written']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Approve simulated pending receivals'));
  const replay = renderToStaticMarkup(createElement(ReceivalDraftReview, { draft: approved, status, busy: false, approval: { draft: approved, receivals: [{ id: 'existing-1' }, { id: 'existing-2' }], createdCount: 0, simulation: true, idempotent: true }, onDetails() {}, async onReview() {}, async onApprove() {} }));
  assert.ok(replay.includes('2 simulated pending receivals already created'));
});
await check('real execution is disabled independently of model readiness and cannot inherit simulation approval', () => {
  const realStatus: LocalDemoStatus = { ...copy(status), mode: 'authenticated-receivals', simulation: false, executionEnabled: false, blockedReason: RECEIVAL_EXECUTION_BLOCKED };
  const realDraft: LocalReceivalDraft = { ...copy(base), simulation: false, executionEnabled: false, blockReason: RECEIVAL_EXECUTION_BLOCKED };
  assert.equal(receivalExecutionBlock(realDraft, realStatus), RECEIVAL_EXECUTION_BLOCKED);
  assert.equal(approvalForCurrentReview(realDraft, editableRows(realDraft), realDraft.orderDetails, true, false), false);
  const html = render(realDraft, realStatus);
  assert.ok(html.includes(RECEIVAL_EXECUTION_BLOCKED));
  assert.ok(html.includes('disabled=""') && /disabled=""[^>]*>Approve pending receivals/.test(html));
  assert.ok(!html.includes('Approve simulated pending receivals'));
  assert.ok(!html.includes('pending receivals created'));
  assert.ok(receivalExecutionBlock(base, realStatus));
});
await check('future real approval requires both durable server identities and unchanged current review', () => {
  const realDraft: LocalReceivalDraft = { ...copy(base), simulation: false, executionEnabled: true, durableDraftId: 'immutable-server-draft-id', durableHash: 'normalized-server-snapshot-hash' };
  const realStatus: LocalDemoStatus = { ...copy(status), mode: 'authenticated-receivals', simulation: false, executionEnabled: true };
  assert.equal(receivalExecutionBlock(realDraft, realStatus), null);
  assert.equal(approvalForCurrentReview(realDraft, editableRows(realDraft), realDraft.orderDetails, true, false), true);
  for (const change of [{ durableDraftId: '' }, { durableHash: '' }, { executionEnabled: false }]) {
    const changed = { ...realDraft, ...change };
    assert.equal(approvalForCurrentReview(changed, editableRows(changed), changed.orderDetails, true, false), false);
    assert.ok(receivalExecutionBlock(changed, realStatus));
  }
  const rows = editableRows(realDraft); rows[0].quantity = '4';
  assert.equal(approvalForCurrentReview(realDraft, rows, realDraft.orderDetails, true, false), false);
  assert.ok(receivalExecutionBlock(realDraft, { ...realStatus, executionEnabled: false }));
});
await check('authenticated candidate opt-in is limited to exact localhost origin and both explicit query flags', () => {
  const query = '?tenbotExperiment=1&tenbotReceivals=1';
  assert.equal(localAgentExperimentRequested('http://localhost:3000', query, true), true);
  assert.equal(localReceivalCandidateRequested('http://localhost:3000', query, true), true);
  for (const origin of ['https://tenops.pages.dev', 'http://127.0.0.1:3000', 'http://localhost:3001', 'https://localhost:3000']) assert.equal(localReceivalCandidateRequested(origin, query, true), false);
  for (const search of ['', '?tenbotReceivals=1', '?tenbotExperiment=1', '?tenbotExperiment=0&tenbotReceivals=1']) assert.equal(localReceivalCandidateRequested('http://localhost:3000', search, true), false);
  assert.equal(localReceivalCandidateRequested('http://localhost:3000', query, false), false);
});
await check('unsafe formats and excessive originals fail before any browser image processing or upload', async () => {
  await assert.rejects(prepareInvoiceImage({ type: 'image/svg+xml', size: 10 } as File, 90000), /PNG, JPEG or one-page PDF/);
  await assert.rejects(prepareInvoiceImage({ type: 'application/pdf', size: 12000001 } as File, 90000), /smaller than 12 MB/);
  await assert.rejects(prepareInvoiceImage({ type: 'image/jpeg', size: 12000001 } as File, 90000), /smaller than 12 MB/);
  await assert.rejects(prepareInvoiceImage({ type: 'image/png', size: 10 } as File, 0), /image limit is unavailable/);
});
await check('PDF intake refuses silent page truncation and bounds portrait/landscape rendering', () => {
  assert.throws(() => singlePdfPageScale(2, 612, 792), /one-page PDFs/);
  assert.throws(() => singlePdfPageScale(0, 612, 792), /one-page PDFs/);
  assert.throws(() => singlePdfPageScale(1, 0, 792), /page size is invalid/);
  assert.throws(() => singlePdfPageScale(1, 612, Number.NaN), /page size is invalid/);
  for (const [width, height] of [[612, 792], [792, 612], [2400, 3600]]) {
    const scale = singlePdfPageScale(1, width, height);
    assert.ok(Math.floor(width * scale) <= 1024 && Math.floor(height * scale) <= 1024);
    assert.equal(Math.floor(Math.max(width, height) * scale), 1024);
  }
});

console.log(JSON.stringify({ status: 'pass', mode: 'offline UI rendering and approval lifecycle only; no browser image-compression or model-quality claim', groups: checks.length, checks, inferenceCalls: 0, databaseWrites: 0 }, null, 2));
