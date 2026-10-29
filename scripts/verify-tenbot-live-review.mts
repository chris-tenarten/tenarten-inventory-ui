import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { approvalForCurrentReview, editableRows, localAgentExperimentRequested, localReceivalCandidateRequested, prepareInvoiceImage, RECEIVAL_EXECUTION_BLOCKED, receivalExecutionBlock, reviewChanged, singlePdfPageScale, type LocalDemoStatus, type LocalReceivalDraft } from '../src/modules/tenbot/live-review';
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
  const held = copy(base); held.canApprove = false; held.missingFields = ['ordered_by']; held.rows[0].materialId = null; held.rows[0].reasons = ['ambiguous_catalog_match'];
  const html = render(held);
  for (const text of ['ambiguous catalog match', 'Information needed: ordered by', 'Exclude this line', 'existing catalog material', 'Resolve or exclude held lines']) assert.ok(html.includes(text), text);
  assert.equal(approvalForCurrentReview(held, editableRows(held), held.orderDetails, true, false), false);
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
