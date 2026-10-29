// Actual localhost UI and actual simulator review/approval over bounded loopback.
// Only extraction/model transport are offline doubles. No paid provider/env is
// loaded; no new inference, database write or JWT/RLS certification occurs.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {tsImport} from 'tsx/esm/api';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const origin = 'http://localhost:3000';
const directory = '/private/tmp/tenops-tenbot-p1-reconciliation-2026-10-29/browser';
const fixture = JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json', 'utf8'));
const imagePath = 'scripts/fixtures/tenbot-invoice-live-demo.png';
const {createTenbotLiveDemo} = await tsImport('./support/tenbot-live-demo.mts', import.meta.url);
const {createScriptedTenbotAgentProvider} = await tsImport('./support/tenbot-agent-scripted.mts', import.meta.url);
// Exact gold text from independent QA's synthetic two-line image. This transport
// is offline; the separate live receipt establishes real transcription accuracy.
const prefillLines = ['SYNTHETIC QA - DO NOT POST OR PAY', 'Supplier: T&M Supply', 'Invoice: QA-CLEAN-1029', 'Invoice date: 2026-10-29', 'Order date: 2026-10-28', 'Ordered by: Synthetic QA Employee', 'Destination location: Denton', 'Item 1 | AW-1 | Alaska White | #1 | 150 LB', 'Item 2 | RES-5 | Clear Resin | Part A | 10 GAL', 'Freight | Delivery charge | $25.00'];
const zeroUsage = () => ({inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costUsd: 0, reservedUsd: 0});
function prefillTransport() {
  let phase = 0;
  const toolResult = (request, tool) => request.history.filter(item => item.kind === 'tool_result' && item.name === tool).map(item => JSON.parse(item.output)).at(-1);
  const invoke = calls => ({calls: calls.map((item, index) => ({id: `prefill_${phase}_${index}`, name: item.name, arguments: item.args})), continuation: [], usage: zeroUsage()});
  return {name: 'Offline exact-QA-text transport fixture', model: 'offline', async step(request) {
    if (phase++ === 0) return invoke([{name: 'discover_capabilities', args: {names: ['read_invoice', 'search_catalog', 'check_receival_duplicates', 'prepare_pending_receivals']}}]);
    if (phase === 2) return invoke([{name: 'read_invoice', args: {}}]);
    const document = toolResult(request, 'read_invoice')?.data, ref = number => `${document.document_id}:L${number}`;
    if (phase === 3) return invoke([{name: 'search_catalog', args: {source_ref: ref(8), description: 'Alaska White', quantity: '150', unit: 'LB', size: '#1', vendor_sku: 'AW-1'}}, {name: 'search_catalog', args: {source_ref: ref(9), description: 'Clear Resin', quantity: '10', unit: 'GAL', size: 'Part A', vendor_sku: 'RES-5'}}]);
    if (phase === 4) return invoke([{name: 'check_receival_duplicates', args: {supplier: 'T&M Supply', supplier_source_ref: ref(2), document_ref: 'QA-CLEAN-1029', document_source_ref: ref(3)}}]);
    if (phase === 5) return invoke([{name: 'prepare_pending_receivals', args: {selections: [{source_ref: ref(8), candidate_id: 'standard:synthetic-aw1'}, {source_ref: ref(9), candidate_id: 'standard:synthetic-res5'}], exclusions: [{source_ref: ref(10), reason: 'freight'}]}}]);
    const prepared = toolResult(request, 'prepare_pending_receivals');
    return {calls: [], continuation: [], usage: zeroUsage(), final: {answer: 'Prepared the two synthetic material lines for employee review. No records were created.', observations: [{text: 'Two material lines were prepared as review-only drafts.', evidence_ids: [prepared.evidence_id]}], inferences: [], recommendations: [], questions: [], completed_actions: []}};
  }};
}
const cases = new Map(), serverResponses = [];
let transportSteps = 0;
function makeCase(catalogPermission, scenario = 'combined') {
  const id = randomUUID(), owner = randomUUID();
  const data = clone(fixture);
  if (scenario !== 'combined') {
    data.catalog.standard = data.catalog.standard.filter(item => item.id !== 'synthetic-green-b');
    data.catalog.standard.push({id: 'synthetic-violet-clean', vendor: 'T&M Supply', vendor_sku: 'UNK-99', item_name: 'Unlisted Violet', size: '#2', category: 'Aggregate', material_class: 'Marble chips', unit: '50 LB Bag'});
    data.receivals.rows = [];
  }
  if (scenario === 'held-package') {
    data.document.text = data.document.text.replace('Alaska White | #1 | 100 LB', 'Alaska White | #1 | 150 LB').replace('Clear Resin | Part A | 5 GAL', 'Clear Resin | Part A | 10 GAL');
    data.receivals.rows = [
      {id: 'offline-existing-aw', vendor: 'T&M Supply', material_name: 'Alaska White', size: '#1', quantity_expected: '3', quantity_received: '0', unit: 'Bag', status: 'pending'},
      {id: 'offline-existing-res', vendor: 'T&M Supply', material_name: 'Clear Resin', size: 'Part A', quantity_expected: '2', quantity_received: '0', unit: 'Pail', status: 'pending'},
    ];
  }
  if (scenario.startsWith('prefill')) {
    data.document.text = prefillLines.join('\n');
    if (scenario === 'prefill-conflict') data.document.text += '\nOrder date: 2026-10-27\nDestination: Shop';
  }
  const testCase = {id, owner, current: null, scenario, data, imagePath: scenario.startsWith('prefill') ? 'scripts/fixtures/tenbot-invoice-quantity-qa.png' : imagePath};
  testCase.handler = createTenbotLiveDemo({model: 'offline-fixture-browser', catalog: data.catalog, receivals: data.receivals,
    can: async (_owner, capability) => capability !== 'manageVendorsCatalog' || catalogPermission,
    remainingUsd: () => 0, assertNoFatal() {},
    createProvider(_label, attachment) {
      if (attachment) return {name: 'Offline extraction fixture', model: 'offline', async step() {transportSteps++; return {calls: [], continuation: [], usage: {inputTokens: 0, outputTokens: 0, costUsd: 0, reservedUsd: 0}, final: {raw_lines: data.document.text.split('\n')}};}};
      const scripted = scenario.startsWith('prefill') ? prefillTransport() : createScriptedTenbotAgentProvider('invoice-preparation');
      return {...scripted, async step(request) {transportSteps++; return scripted.step(request);}};
    }});
  cases.set(id, testCase); return testCase;
}
const loopback = createServer(async (request, response) => {
  const send = (status, body) => response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}).end(JSON.stringify(body));
  const testCase = cases.get(request.url?.slice(1));
  if (request.method !== 'POST' || request.headers.origin !== origin || !testCase) return send(403, {error: 'Disposable fixture endpoint only.'});
  try {
    let raw = ''; for await (const chunk of request) {raw += chunk; if (Buffer.byteLength(raw) > 145000) return send(413, {error: 'Fixture request too large.'});}
    const body = JSON.parse(raw);
    assert(['status', 'upload', 'ask', 'review', 'approve', 'clear'].includes(body.action));
    const result = await testCase.handler(body, testCase.owner);
    if (result.draft) testCase.current = clone(result.draft);
    if (result.localDemo?.draft) testCase.current = clone(result.localDemo.draft);
    serverResponses.push({caseId: testCase.id, action: body.action, status: 200, body: clone(result)});
    return send(200, result);
  } catch (error) {
    const status = error.status || 500, body = {error: error.message};
    serverResponses.push({caseId: testCase.id, status, body}); return send(status, body);
  }
});
await new Promise(resolve => loopback.listen(0, '127.0.0.1', resolve));
const loopbackOrigin = `http://127.0.0.1:${loopback.address().port}`;
async function invokeCase(testCase, body) {
  const response = await fetch(`${loopbackOrigin}/${testCase.id}`, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin}, body: JSON.stringify(body), signal: AbortSignal.timeout(5000)});
  const value = await response.json(); traces.push({caseId: testCase.id, action: body.action, status: response.status});
  return {status: response.status, body: value};
}
const ledgerPath = '/private/tmp/tenops-tenbot-agent-poc/openai-budget.json';
const journalBefore = readFileSync(ledgerPath);
const checks = [], traces = [], errors = [], unexpectedNetwork = [], measurements = [];
const clone = value => structuredClone(value);
const fileHash = value => createHash('sha256').update(value).digest('hex');
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});
let lastPage, supplierCaptured = false;

async function open({catalogPermission = true, viewport = {width: 1440, height: 1100}, existingCase, scenario = 'combined'} = {}) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(12000);
  const calls = [], approvals = [], testCase = existingCase || makeCase(catalogPermission, scenario);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
      const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
      if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
      const body = request.postDataJSON(); if (body.action === 'ask' && ['clean', 'held-package'].includes(testCase.scenario)) body.orderDetails = clone(fixture.confirmedMetadataExample); calls.push(clone(body));
      const result = await invokeCase(testCase, body);
      if (body.action === 'approve' && result.status === 200) approvals.push(clone(result.body));
      if (body.action === 'ask' && result.status === 200) {
        // Only the test disclosure is replaced. All draft, validation, hash and
        // approval results come from the actual simulator implementation.
        result.body.notices = ['Offline extraction fixture and scripted tool transport; review and approval use the actual local simulator. No new model inference or database access.'];
      }
      return route.fulfill({status: result.status, headers, json: result.body});
    }
    if (url.origin === origin) {
      if (url.pathname.endsWith('/rpc/get_my_app_access') && !catalogPermission) {
        const response = await route.fetch(); const rows = await response.json(); assert(Array.isArray(rows));
        return route.fulfill({response, json: rows.map(row => ({...row, role: 'member'}))});
      }
      if (/\/rpc\/(?:save_.*catalog|prepare_invoice|approve_invoice|execute_invoice)/.test(url.pathname)) {
        unexpectedNetwork.push({origin: url.origin, path: url.pathname});
        return route.fulfill({status: 403, json: {error: 'Operational writes blocked by verifier.'}});
      }
      return route.continue();
    }
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    unexpectedNetwork.push({origin: url.origin, method: request.method()}); return route.abort();
  });
  await page.goto(`${origin}/my-work?tenbotExperiment=1`, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: 'Messaging', exact: true}).click();
  const panel = page.getByRole('dialog', {name: 'Inbox', exact: true});
  await panel.locator('aside').getByRole('button').filter({has: page.getByText('TenBot', {exact: true})}).click();
  const composer = panel.locator('[data-messaging-composer]');
  await expect.poll(() => calls.filter(item => item.action === 'status').length).toBeGreaterThan(0);
  await expect(panel.getByLabel('Local agent experiment controls', {exact: true})).toHaveCount(0);
  await expect(panel.getByText(/^Local (?:Agent Experiment|experiment)$/)).toHaveCount(0);
  await expect(composer.getByRole('textbox', {name: 'Message', exact: true})).toBeEnabled();
  await expect(composer.getByRole('button', {name: 'Attach PDF or image', exact: true})).toBeEnabled();
  assert((await composer.locator('input[type=file]').getAttribute('accept')).includes('application/pdf'));
  await composer.locator('input[type=file]').setInputFiles(testCase.imagePath);
  await expect(composer.getByText(testCase.imagePath.split('/').at(-1), {exact: true})).toBeVisible();
  await composer.getByRole('checkbox', {name: 'I confirm this attachment contains approved synthetic test data.', exact: true}).check();
  await composer.getByRole('textbox', {name: 'Message', exact: true}).fill('Prepare pending receivals from this synthetic invoice.');
  await composer.getByRole('button', {name: 'Send', exact: true}).click();
  const draft = panel.getByLabel('Editable pending receival draft', {exact: true}); await expect(draft).toBeVisible();
  const line = id => draft.locator(`[data-line-id="${id}"]`);
  const row = name => testCase.current.rows.find(item => item.sourceText.includes(name));
  return {context, page, panel, composer, draft, calls, approvals, line, row, testCase, snapshot: () => clone(testCase.current)};
}

async function expandLine(view, id) {
  const line = view.line(id), edit = line.getByRole('button', {name: /^Edit line \d+$/});
  if (await edit.count()) await edit.click();
  return line;
}
async function fillCatalog(view) {
  const violet = view.row('Unlisted Violet'), line = view.line(violet.lineId);
  await line.getByRole('button', {name: 'Request new catalog material', exact: true}).click();
  const request = line.getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
  await expect(request.getByLabel('Proposed supplier', {exact: true})).toHaveValue(view.snapshot().provenance.supplier);
  const supplier = request.getByRole('combobox', {name: 'Proposed supplier', exact: true});
  await supplier.click();
  await expect(request.getByRole('option', {name: /^T&M Supply/})).toBeVisible();
  if (!supplierCaptured) {await capture(view, 'desktop-supplier-suggestions.png', supplier); supplierCaptured = true;}
  await supplier.press('Escape');
  await expect(view.panel).toBeVisible();
  await expect(supplier).toHaveAttribute('aria-expanded', 'false');
  await request.getByLabel('Proposed material name', {exact: true}).fill('Unlisted Violet');
  await request.getByLabel('Proposed vendor SKU', {exact: true}).fill('UNK-99');
  await request.getByLabel('Proposed material type', {exact: true}).selectOption('chip');
  await request.getByLabel('Proposed size', {exact: true}).fill('#2');
  await request.getByLabel('Proposed unit', {exact: true}).fill('Bag');
  await request.getByLabel('Proposed package amount', {exact: true}).fill('50');
  await request.getByLabel('Proposed package measure', {exact: true}).selectOption('LB');
  await request.getByLabel('Proposed notes', {exact: true}).fill('Synthetic catalog material and dependent receival proposal.');
  await request.getByLabel('Proposed container', {exact: true}).fill('Bag');
  await expect(request.getByRole('button', {name: 'Prepare catalog request', exact: true})).toHaveCount(0);
  return request;
}
async function finishOtherLines(view) {
  await view.line(view.row('CC Green').lineId).getByLabel(`Catalog material for ${view.row('CC Green').lineId}`, {exact: true}).selectOption('standard:synthetic-green-a');
  await view.draft.getByLabel('Draft ordered by', {exact: true}).fill('Synthetic Review Employee');
  await view.draft.getByLabel('Draft order date', {exact: true}).fill('2026-10-29');
  await view.draft.getByLabel('Draft destination location', {exact: true}).fill('Denton');
}
async function save(view) {
  const before = view.calls.filter(item => item.action === 'review').length;
  const revision = view.snapshot().revision;
  await view.draft.getByRole('button', {name: 'Save changes for review', exact: true}).click();
  await expect.poll(() => view.calls.filter(item => item.action === 'review').length).toBe(before + 1);
  await expect.poll(() => view.snapshot().revision).toBe(revision + 1);
}
function editPayload(draft, update = row => row) {
  return draft.rows.map(row => {
    const next = update(clone(row));
    return {lineId: next.lineId, materialId: next.materialId, quantity: next.quantity, unit: next.unit, jobId: next.jobId, excluded: next.excluded, catalogRequest: next.catalogRequest || null, duplicateAcknowledgement: next.duplicateAcknowledgement || null};
  });
}
async function directPrepare(testCase) {
  const upload = await invokeCase(testCase, {action: 'upload', syntheticConfirmed: true, attachment: {filename: 'OFFLINE-synthetic.png', mediaType: 'image/png', dataBase64: readFileSync(imagePath).toString('base64')}});
  assert.equal(upload.status, 200);
  const result = await invokeCase(testCase, {action: 'ask', attachmentId: upload.body.attachmentId, question: 'Prepare pending receivals from this synthetic invoice.', orderDetails: fixture.confirmedMetadataExample});
  assert.equal(result.status, 200); assert(result.body.localDemo?.draft);
  return clone(testCase.current);
}
async function directReview(testCase, update) {
  const draft = clone(testCase.current);
  return invokeCase(testCase, {action: 'review', draftId: draft.id, revision: draft.revision, orderDetails: draft.orderDetails, edits: editPayload(draft, update)});
}
async function directApprove(testCase, draft = testCase.current) {
  return invokeCase(testCase, {action: 'approve', draftId: draft.id, revision: draft.revision, hash: draft.hash, confirmation: true});
}
async function measure(view, label) {
  const metrics = await view.draft.evaluate(element => {
    const visible = child => {const rect = child.getBoundingClientRect(); return rect.width > 0 && rect.height > 0;};
    return {draftHeight: element.getBoundingClientRect().height, viewport: {width: innerWidth, height: innerHeight}, renderedFieldCount: [...element.querySelectorAll('input,select,textarea')].filter(visible).length, lineCards: [...element.querySelectorAll('[data-line-id]')].map(article => ({lineId: article.dataset.lineId, state: article.dataset.lineState, height: article.getBoundingClientRect().height, renderedFields: [...article.querySelectorAll('input,select,textarea')].filter(visible).length}))};
  });
  measurements.push({label, ...metrics});
}
async function capture(view, filename, target = view.line(view.row('Unlisted Violet').lineId)) {
  await target.scrollIntoViewIfNeeded();
  assert(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const boxes = await view.draft.locator('input,select,textarea,button').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => ({left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right})));
  const width = view.page.viewportSize().width;
  assert(boxes.every(box => box.left >= 0 && box.right <= width + 1));
  await view.page.screenshot({path: `${directory}/${filename}`});
}

try {
  const probe = await browser.newContext();
  try {const response = await probe.request.get(`${origin}/__review/state`, {timeout: 5000}); assert(response.ok()); assert.equal((await response.json()).mode, 'synthetic');} finally {await probe.close();}
  const clean = await open({scenario: 'clean'});
  try {
    const initial = clean.snapshot();
    assert.equal(initial.reviewed, true); assert.equal(initial.canApprove, true);
    assert.deepEqual(initial.rows.map(row => row.sourceText.match(/^(Item \d+|Freight)/)?.[1]), ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Freight']);
    assert.deepEqual(initial.rows.filter(row => !row.excluded).map(row => [row.quantity, row.unit]), [['2', 'Bag'], ['3', 'Bag'], ['2', 'Bag'], ['4', 'Bag'], ['1', 'Pail']]);
    await expect(clean.draft.locator('[data-line-state="Ready"]')).toHaveCount(5);
    await expect(clean.draft.locator('[data-line-state="Excluded"]')).toHaveCount(1);
    for (const row of initial.rows) {
      const line = clean.line(row.lineId);
      await expect(line.getByText(`Invoice: ${row.sourceText}`, {exact: true})).toBeVisible();
      assert.equal(await line.locator('input,select,textarea').count(), 0, 'Routine/excluded rows start as compact traceable summaries');
    }
    const saveButton = clean.draft.getByRole('button', {name: 'Save changes for review', exact: true});
    const confirm = clean.draft.getByRole('checkbox', {name: /I reviewed these exact/});
    const approve = clean.draft.getByRole('button', {name: 'Approve simulated pending receivals', exact: true});
    await expect(saveButton).toBeDisabled(); await expect(confirm).toBeEnabled();
    await measure(clean, 'desktop-clean-proposed'); await capture(clean, 'desktop-clean-proposed.png', clean.line(initial.rows[0].lineId));
    await clean.page.setViewportSize({width: 390, height: 844});
    await measure(clean, 'mobile-clean-proposed'); await capture(clean, 'mobile-clean-proposed.png', clean.line(initial.rows[0].lineId));
    await confirm.check(); await expect(approve).toBeEnabled(); await approve.click();
    await expect.poll(() => clean.approvals.length).toBe(1);
    assert.equal(clean.calls.filter(call => call.action === 'review').length, 0, 'Clean server-validated proposal requires no redundant Save');
    assert.equal(clean.approvals[0].receivals.length, 5);
    assert(clean.approvals[0].receivals.every(row => row.status === 'pending' && row.quantity_received === 0 && row.simulation));
    await capture(clean, 'mobile-clean-approved.png', clean.draft.getByRole('status').filter({hasText: '5 simulated pending receivals created.'}));
    checks.push('Clean five-line actual-handler draft stays in invoice order, shows compact ready/excluded summaries with exact source evidence, and reaches explicit simulated approval with no field edits or redundant review Save');
  } finally {await clean.context.close();}

  const prefilled = await open({scenario: 'prefill'});
  try {
    const initial = prefilled.snapshot();
    assert.deepEqual(initial.orderDetails, {orderedBy: 'Synthetic QA Employee', orderDate: '2026-10-28', location: 'Denton'});
    assert.deepEqual(initial.missingFields, []); assert.equal(initial.canApprove, true);
    assert(prefilled.calls.filter(call => call.action === 'ask').every(call => call.orderDetails === undefined || Object.values(call.orderDetails).every(value => value === '')), 'No employee order details were injected into this prefill request');
    for (const [field, expected] of [['ordered by', 'Synthetic QA Employee'], ['order date', '2026-10-28'], ['destination location', 'Denton']]) await expect(prefilled.draft.getByLabel(`Draft ${field}`, {exact: true})).toHaveValue(expected);
    assert.equal(initial.orderDetailEvidence.orderDate.value, '2026-10-28', 'Order date is distinct from invoice date');
    assert.equal(initial.orderDetailEvidence.orderedBy.sourceRef.split(':L')[1], '6');
    await expect(prefilled.draft).toContainText('Order details found on the invoice are prefilled. Check them before approval; you can correct them here.');
    const confirm = prefilled.draft.getByRole('checkbox', {name: /I reviewed these exact/});
    const approve = prefilled.draft.getByRole('button', {name: 'Approve simulated pending receivals', exact: true});
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled(); assert.equal(prefilled.approvals.length, 0);
    await capture(prefilled, 'desktop-order-details-prefilled.png', prefilled.draft.getByLabel('Draft order date', {exact: true}));
    await confirm.check(); await expect(approve).toBeEnabled(); await approve.click(); await expect.poll(() => prefilled.approvals.length).toBe(1);
    assert.equal(prefilled.calls.filter(call => call.action === 'review').length, 0);
    assert(prefilled.approvals[0].receivals.every(row => row.ordered_by === 'Synthetic QA Employee' && row.order_date === '2026-10-28' && row.location === 'Denton' && row.quantity_received === 0));
  } finally {await prefilled.context.close();}
  const conflict = await open({scenario: 'prefill-conflict', viewport: {width: 390, height: 844}});
  try {
    const current = conflict.snapshot();
    assert.deepEqual(current.orderDetails, {orderedBy: 'Synthetic QA Employee', orderDate: '', location: ''});
    await expect(conflict.draft.getByLabel('Draft order date', {exact: true})).toHaveValue(''); await expect(conflict.draft.getByLabel('Draft destination location', {exact: true})).toHaveValue('');
    assert.equal(current.orderDetailEvidence.orderDate, undefined); assert.equal(current.orderDetailEvidence.location, undefined);
    await expect(conflict.draft.getByRole('checkbox', {name: /I reviewed these exact/})).toBeDisabled();
    assert.equal(conflict.approvals.length, 0); await capture(conflict, 'mobile-conflicting-order-details.png', conflict.draft.getByLabel('Draft order date', {exact: true}));
    checks.push('Exact QA document order labels prefill without employee re-entry or invoice-date substitution; source refs remain reviewable, conflicting date/destination labels stay blank, and final explicit approval is still required');
  } finally {await conflict.context.close();}

  const quantity = await open({scenario: 'held-package'});
  try {
    const initial = quantity.snapshot(), aw = quantity.row('Alaska White'), resin = quantity.row('Clear Resin');
    assert.deepEqual([aw.quantity, aw.unit, resin.quantity, resin.unit], ['3', 'Bag', '2', 'Pail']);
    assert.deepEqual(aw.sourceQuantity, {quantity: '150', unit: 'LB'}); assert.deepEqual(resin.sourceQuantity, {quantity: '10', unit: 'GAL'});
    assert.equal(aw.quantityBasis.inventoryStockingUnit, null); assert.equal(resin.quantityBasis.inventoryStockingUnit, null);
    assert.equal(initial.canApprove, false); assert(aw.reasons.includes('potential_duplicate')); assert(resin.reasons.includes('potential_duplicate'));
    const confirm = quantity.draft.getByRole('checkbox', {name: /I reviewed these exact/});
    const approve = quantity.draft.getByRole('button', {name: 'Approve simulated pending receivals', exact: true});
    for (const [row, bad, good] of [[aw, '150', '3'], [resin, '10', '2']]) {
      const line = await expandLine(quantity, row.lineId), input = line.getByLabel(`Expected quantity for ${row.lineId}`, {exact: true});
      await input.fill(bad); await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(confirm).toBeDisabled(); await expect(approve).toBeDisabled();
      await expect(quantity.draft.getByRole('button', {name: 'Save changes for review', exact: true})).toBeDisabled();
      await input.fill(good); await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    }
    await capture(quantity, 'desktop-held-package-evidence.png', quantity.line(aw.lineId));
    const label = 'I checked the matching receival and confirm this is a separate order for simulated approval.';
    await quantity.line(aw.lineId).getByRole('checkbox', {name: label, exact: true}).check();
    await quantity.line(resin.lineId).getByRole('checkbox', {name: label, exact: true}).check();
    await save(quantity); assert.equal(quantity.snapshot().canApprove, true);
    assert.deepEqual(quantity.snapshot().rows.filter(row => [aw.lineId, resin.lineId].includes(row.lineId)).map(row => [row.quantity, row.unit]), [['3', 'Bag'], ['2', 'Pail']]);
    await quantity.page.setViewportSize({width: 390, height: 844}); await capture(quantity, 'mobile-held-package-corrected.png', approve);
    await confirm.check(); await approve.click(); await expect.poll(() => quantity.approvals.length).toBe(1);
    const receipts = quantity.approvals[0].receivals;
    assert.equal(receipts.find(row => row.material_name === 'Alaska White').quantity_expected, 3);
    assert.equal(receipts.find(row => row.material_name === 'Clear Resin').quantity_expected, 2);
    checks.push('Duplicate-held 150 LB and 10 GAL preserve immutable source and exact 3 Bag / 2 Pail basis; contradictory 150 Bag / 10 Pail edits immediately block UI review/approval, while corrected source-consistent quantities survive acknowledgement and simulated approval');
  } finally {await quantity.context.close();}

  const attack = makeCase(true, 'held-package');
  const original = await directPrepare(attack);
  let bad = await directReview(attack, row => ({...row, quantity: row.materialId === 'standard:synthetic-aw1' ? '150' : row.materialId === 'standard:synthetic-res5' ? '10' : row.quantity}));
  assert.equal(bad.status, 200); assert.equal(bad.body.draft.canApprove, false);
  bad = await directReview(attack, row => ({...row, duplicateAcknowledgement: row.duplicateReview?.canAcknowledge ? row.duplicateReview.fingerprint : null}));
  assert.equal(bad.status, 200); assert.equal(bad.body.draft.canApprove, false);
  assert(bad.body.draft.rows.filter(row => ['standard:synthetic-aw1', 'standard:synthetic-res5'].includes(row.materialId)).every(row => row.reasons.includes('source_quantity_mismatch')));
  const unsafeApproval = await directApprove(attack); assert.equal(unsafeApproval.status, 409);
  const injectionDraft = clone(attack.current), edits = editPayload(injectionDraft); edits[0].sourceQuantity = {quantity: '150', unit: 'Bag'};
  const injection = await invokeCase(attack, {action: 'review', draftId: injectionDraft.id, revision: injectionDraft.revision, orderDetails: injectionDraft.orderDetails, edits});
  assert.equal(injection.status, 400, 'Client cannot rewrite immutable source evidence');
  let corrected = await directReview(attack, row => ({...row, quantity: row.materialId === 'standard:synthetic-aw1' ? '3' : row.materialId === 'standard:synthetic-res5' ? '2' : row.quantity, duplicateAcknowledgement: null}));
  assert.equal(corrected.status, 200);
  corrected = await directReview(attack, row => ({...row, duplicateAcknowledgement: row.duplicateReview?.canAcknowledge ? row.duplicateReview.fingerprint : null}));
  assert.equal(corrected.status, 200); assert.equal(corrected.body.draft.canApprove, true);
  const stale = await directApprove(attack, original); assert.equal(stale.status, 409);
  const safe = await directApprove(attack); assert.equal(safe.status, 200);
  assert.equal(safe.body.receivals.find(row => row.material_name === 'Alaska White').quantity_expected, 3);
  assert.equal(safe.body.receivals.find(row => row.material_name === 'Clear Resin').quantity_expected, 2);
  checks.push('Actual handler rejects unsafe simulated approval after forced 150 Bag / 10 Pail edits and valid duplicate acknowledgements, rejects source-evidence injection and stale approval, and commits only corrected 3 Bag / 2 Pail memory receipts');

  const view = await open();
  let approvedCase, firstAcknowledgement;
  try {
    checks.push('Ordinary Messaging composer and PDF/photo attachment control remain available; employee experiment dropdown is absent');
    const violet = view.row('Unlisted Violet'), coal = view.row('Blue Coal'), violetLine = view.line(violet.lineId), coalLine = view.line(coal.lineId);
    await expect(violetLine).toHaveAttribute('data-line-state', 'Needs catalog match');
    await fillCatalog(view); await finishOtherLines(view);
    await expect(violetLine).toHaveAttribute('data-line-state', 'Ready');
    await expect(violetLine.getByLabel(`Catalog material for ${violet.lineId}`, {exact: true})).toHaveValue('');
    await expect(violetLine.getByRole('checkbox', {name: 'Exclude this line from the proposed receivals', exact: true})).not.toBeChecked();
    checks.push('Complete proposed Violet material clears the catalog-match hold without inventing an ID or excluding the line');
    await save(view);
    const reviewed = view.snapshot(), currentViolet = reviewed.rows.find(row => row.lineId === violet.lineId), currentCoal = reviewed.rows.find(row => row.lineId === coal.lineId);
    assert.deepEqual(currentViolet.reasons, []); assert.equal(currentViolet.materialId, null); assert.equal(currentViolet.catalogRequest.prepared, true);
    assert.equal(currentViolet.sourceText, violet.sourceText); assert.match(reviewed.provenance.attachmentSha256, /^[a-f0-9]{64}$/);
    assert(currentCoal.reasons.includes('potential_duplicate')); assert.equal(reviewed.canApprove, false);
    await expect(violetLine).toHaveAttribute('data-line-state', 'Ready');
    const blockers = view.draft.getByRole('region', {name: 'Approval blockers', exact: true});
    await expect(blockers).toContainText('Blue Coal'); await expect(blockers).not.toContainText('Unlisted Violet');
    await expect(view.draft.getByRole('button', {name: 'Save changes for review', exact: true})).toBeDisabled();
    checks.push('Actual simulator HTTP review removes stale Violet holds, names only genuine blockers, and disables redundant clean resaves');
    const coalIndex = reviewed.rows.findIndex(row => row.lineId === coal.lineId) + 1;
    const evidence = view.draft.getByRole('region', {name: `Duplicate evidence for line ${coalIndex}`, exact: true});
    await expect(evidence).toContainText('synthetic-existing-bc0'); await expect(evidence).toContainText('3 Bag expected'); await expect(evidence).toContainText('No invoice reference recorded.');
    const ackLabel = 'I checked the matching receival and confirm this is a separate order for simulated approval.';
    const ack = evidence.getByRole('checkbox', {name: ackLabel, exact: true});
    await expect(ack).toBeEnabled(); await ack.check();
    await expect(view.draft.getByRole('checkbox', {name: /I reviewed these exact/})).toBeDisabled();
    await save(view);
    await expandLine(view, coal.lineId);
    const acknowledged = view.snapshot(); firstAcknowledgement = acknowledged.rows.find(row => row.lineId === coal.lineId).duplicateAcknowledgement;
    assert.match(firstAcknowledgement, /^[a-f0-9]{64}$/); assert.equal(acknowledged.canApprove, true);
    assert.equal(acknowledged.rows.find(row => row.lineId === coal.lineId).duplicateReview.acknowledged, true);
    const confirm = view.draft.getByRole('checkbox', {name: /I reviewed these exact/}), approve = view.draft.getByRole('button', {name: 'Approve simulated catalog and receivals', exact: true});
    await confirm.check(); await expect(approve).toBeEnabled();
    await capture(view, 'desktop-duplicate-evidence.png', evidence);
    checks.push('Actual matching-record evidence and explicit separate-order acknowledgement are server-validated before combined simulated approval becomes available');
    await expandLine(view, coal.lineId);
    await coalLine.getByLabel(`Production Job for ${coal.lineId}`, {exact: true}).selectOption('10282026-0000-4000-8000-000000000101');
    await expect(ack).not.toBeChecked(); await expect(ack).toBeDisabled(); await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await save(view);
    const edited = view.snapshot(); assert.equal(edited.rows.find(row => row.lineId === coal.lineId).duplicateAcknowledgement, null); assert.notEqual(edited.rows.find(row => row.lineId === coal.lineId).duplicateReview.fingerprint, firstAcknowledgement);
    await expect(ack).toBeEnabled();
    await expandLine(view, coal.lineId);
    await coalLine.getByLabel(`Production Job for ${coal.lineId}`, {exact: true}).selectOption(''); await save(view); await ack.check(); await save(view);
    assert(view.snapshot().canApprove); assert.notEqual(view.snapshot().hash, acknowledged.hash);
    checks.push('Editing a duplicate-sensitive Job association clears acknowledgement and final approval, requires fresh evidence/review, and prevents reuse of the old reviewed hash');
    await expandLine(view, violet.lineId);
    const request = violetLine.getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
    await confirm.check();
    if (await request.locator('details').getAttribute('open') === null) await request.getByText('Material details', {exact: true}).click();
    const reviewsBeforeMismatch = view.calls.filter(item => item.action === 'review').length;
    await request.getByLabel('Proposed supplier', {exact: true}).fill('T & M');
    await expect(request.getByLabel('Proposed supplier', {exact: true})).toHaveValue('T & M');
    await expect(request).toContainText('Invoice supplier is T&M Supply. Choose that supplier for this proposal.');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await expect(view.draft.getByRole('button', {name: 'Save changes for review', exact: true})).toBeDisabled();
    assert.equal(view.calls.filter(item => item.action === 'review').length, reviewsBeforeMismatch);
    const supplierField = request.getByRole('combobox', {name: 'Proposed supplier', exact: true});
    const supplierLabel = supplierField.locator('xpath=ancestor::label[1]');
    await supplierField.press('Tab');
    await capture(view, 'desktop-supplier-mismatch.png', supplierLabel);
    await view.page.setViewportSize({width: 390, height: 844}); await capture(view, 'mobile-supplier-mismatch.png', supplierLabel);
    await view.page.setViewportSize({width: 1440, height: 1100});
    const useInvoice = request.getByRole('button', {name: 'Use invoice supplier: T&M Supply', exact: true});
    await useInvoice.focus(); await useInvoice.press('Enter');
    await expect(request.getByLabel('Proposed supplier', {exact: true})).toHaveValue('T&M Supply');
    await expect(request).not.toContainText('Invoice supplier is T&M Supply. Choose that supplier for this proposal.');
    await expect(violetLine).toHaveAttribute('data-line-state', 'Ready');
    await expect(request).toContainText('Material details complete · Included in the next review.');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await expect(view.draft.getByRole('button', {name: 'Save changes for review', exact: true})).toBeDisabled();
    await expect(confirm).toBeEnabled();
    assert.deepEqual(view.snapshot().rows.find(row => row.lineId === violet.lineId).reasons, []);
    assert.equal(view.snapshot().canApprove, true);
    await view.page.setViewportSize({width: 390, height: 844}); await capture(view, 'mobile-supplier-corrected.png', supplierLabel);
    await view.page.setViewportSize({width: 1440, height: 1100});
    checks.push('Invoice supplier prefills the proposed material with known-value suggestions; typed T & M remains unchanged and blocks submission until explicit keyboard-accessible invoice correction clears current feedback and restores the reviewed draft with confirmation still required');
    await confirm.check();
    if (await request.locator('details').getAttribute('open') === null) await request.getByText('Material details', {exact: true}).click();
    await request.getByLabel('Proposed notes', {exact: true}).fill('Edited catalog operation needs new exact approval.');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await expect(request.getByRole('button', {name: 'Prepare catalog request', exact: true})).toHaveCount(0); await save(view);
    assert(view.snapshot().canApprove);
    const combined = view.draft.getByRole('region', {name: 'Combined proposed operations', exact: true});
    await expect(combined).toContainText('1 catalog material + 5 pending receivals');
    await expandLine(view, coal.lineId);
    await capture(view, 'desktop-combined-summary.png', combined);
    await view.page.setViewportSize({width: 390, height: 844}); await capture(view, 'mobile-combined-review.png'); await capture(view, 'mobile-duplicate-evidence.png', evidence);
    await capture(view, 'mobile-combined-approval.png', approve);
    checks.push('Catalog edits invalidate exact final approval while unrelated validated duplicate evidence remains scoped to its line; desktop and 390 px mobile remain contained');
    await view.page.setViewportSize({width: 1440, height: 1100}); await confirm.check(); await approve.click();
    await expect.poll(() => view.approvals.length).toBe(1);
    const result = view.approvals[0]; assert.equal(result.catalogAdditions.length, 1); assert.equal(result.receivals.length, 5);
    const dependent = result.receivals.find(row => row.catalogOperationSourceLineId === violet.lineId);
    assert.equal(dependent.catalogId, null); assert.equal(dependent.material_name, 'Unlisted Violet'); assert.equal(dependent.quantity_expected, 4);
    assert(result.receivals.every(row => row.status === 'pending' && row.quantity_received === 0 && row.simulation));
    assert.equal(result.audit[0].duplicateAcknowledgements.length, 1); assert.equal(result.catalogAdditions[0].provenance.sourceText, violet.sourceText);
    const completed = view.draft.getByRole('status').filter({hasText: '1 simulated catalog material(s) and 5 simulated pending receivals created.'});
    await expect(completed).toContainText('No actual catalog or receival records were created.');
    await capture(view, 'desktop-combined-approved.png', completed); await view.page.setViewportSize({width: 390, height: 844}); await capture(view, 'mobile-combined-approved.png', completed);
    writeFileSync(`${directory}/combined-handler-response.json`, JSON.stringify({mode: 'Actual simulator approval with offline extraction and scripted model transport; no fresh inference or database write', inferenceCalls: 0, result}, null, 2)); approvedCase = view.testCase;
    checks.push('Actual simulator approval creates five included pending-memory receipts plus one linked catalog-memory receipt and audits the duplicate acknowledgement; no operational records or on-hand stock change');
  } finally {await view.context.close();}
  const denied = await open({catalogPermission: false});
  try {
    await fillCatalog(denied); await finishOtherLines(denied); await save(denied);
    assert.equal(denied.snapshot().catalogApprovalRequired, true);
    await expect(denied.line(denied.row('Unlisted Violet').lineId)).toContainText(/authorized employee|catalog.*permission/i);
    await expect(denied.line(denied.row('Unlisted Violet').lineId)).toContainText('Not sent to an approver');
    await expect(denied.draft.getByRole('checkbox', {name: /I reviewed these exact/})).toBeDisabled();
    assert.equal(denied.calls.filter(item => item.action === 'approve').length, 0);
    checks.push('Caller without catalog capability can save a reviewable request but actual simulator requires authorized catalog approval');
  } finally {await denied.context.close();}
  const confirmed = await open({existingCase: approvedCase});
  try {
    const coal = confirmed.row('Blue Coal'), coalLine = confirmed.line(coal.lineId);
    await expect(coalLine).toContainText('Confirmed duplicate');
    await expect(coalLine.getByRole('checkbox', {name: 'I checked the matching receival and confirm this is a separate order for simulated approval.', exact: true})).toHaveCount(0);
    const current = confirmed.snapshot(), edits = current.rows.map(({lineId, materialId, quantity, unit, jobId, excluded, catalogRequest}) => ({lineId, materialId, quantity, unit, jobId, excluded, catalogRequest: catalogRequest || null, duplicateAcknowledgement: lineId === coal.lineId ? firstAcknowledgement : null}));
    const rejected = await invokeCase(confirmed.testCase, {action: 'review', draftId: current.id, revision: current.revision, orderDetails: fixture.confirmedMetadataExample, edits});
    assert.equal(rejected.status, 409); assert.match(rejected.body.error, /evidence changed|not reviewable/);
    await capture(confirmed, 'desktop-confirmed-duplicate.png', coalLine);
    checks.push('A second preparation of the committed synthetic invoice yields confirmed duplicates; the UI offers no acknowledgement and actual handler rejects a forced prior fingerprint');
  } finally {await confirmed.context.close();}
  assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(unexpectedNetwork.length, 0, JSON.stringify(unexpectedNetwork));
  assert(journalBefore.equals(readFileSync(ledgerPath)), 'Inference ledger changed during UI-only verification');
  writeFileSync(`${directory}/actual-handler-responses.json`, JSON.stringify({mode: 'Actual simulator HTTP responses using offline extraction and scripted model transport. Fixed controller OpenAI notices/extraction tags do not establish model inference in this verifier.', inferenceCalls: 0, databaseRequests: 0, responses: serverResponses}, null, 2));
  const paths = ['scripts/support/tenbot-live-demo.mts', 'scripts/support/tenbot-agent-scripted.mts', 'src/modules/inventory/invoice-quantity.ts', 'supabase/functions/_shared/tenbot-invoice.ts', 'src/modules/tenbot/ReceivalDraftReview.tsx', 'src/modules/tenbot/live-review.ts', 'src/modules/tenbot/TenbotWorkspace.tsx', 'scripts/verify-tenbot-combined-receival-browser.mjs'];
  const report = {passed: true, measurements, groups: checks.length, checks, traces, errors, unexpectedNetwork, mode: 'Actual localhost UI and simulator handlers over bounded disposable HTTP; extraction and model transport use existing offline fixtures, not fresh inference or database security validation', simulatedTransportSteps: transportSteps, inferenceCalls: 0, databaseRequests: 0, operationalWrites: 0, databaseSecurityVerified: false, journalUnchanged: true, journalSha256: fileHash(journalBefore), sourcePins: Object.fromEntries(paths.map(path => [path, fileHash(readFileSync(path))]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: true, groups: checks.length, inferenceCalls: 0, databaseRequests: 0, report: `${directory}/report.json`}));
} catch (error) {
  await lastPage?.screenshot({path: `${directory}/failure.png`}).catch(() => {});
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error instanceof Error ? error.message : String(error), checks, traces, errors, unexpectedNetwork, journalUnchanged: journalBefore.equals(readFileSync(ledgerPath)), mode: 'UI-only, agent transport intercepted; no new inference or database security verification'}, null, 2));
  throw error;
} finally {await browser.close(); loopback.closeAllConnections(); await new Promise(resolve => loopback.close(resolve));}
