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
const directory = '/private/tmp/tenops-tenbot-receival-unblock-2026-10-29/browser';
const fixture = JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json', 'utf8'));
const imagePath = 'scripts/fixtures/tenbot-invoice-live-demo.png';
const {createTenbotLiveDemo} = await tsImport('./support/tenbot-live-demo.mts', import.meta.url);
const {createScriptedTenbotAgentProvider} = await tsImport('./support/tenbot-agent-scripted.mts', import.meta.url);
const cases = new Map(), serverResponses = [];
let transportSteps = 0;
function makeCase(catalogPermission) {
  const id = randomUUID(), owner = randomUUID();
  const testCase = {id, owner, current: null};
  testCase.handler = createTenbotLiveDemo({model: 'offline-fixture-browser', catalog: clone(fixture.catalog), receivals: clone(fixture.receivals),
    can: async (_owner, capability) => capability !== 'manageVendorsCatalog' || catalogPermission,
    remainingUsd: () => 0, assertNoFatal() {},
    createProvider(_label, attachment) {
      if (attachment) return {name: 'Offline extraction fixture', model: 'offline', async step() {transportSteps++; return {calls: [], continuation: [], usage: {inputTokens: 0, outputTokens: 0, costUsd: 0, reservedUsd: 0}, final: {raw_lines: fixture.document.text.split('\n')}};}};
      const scripted = createScriptedTenbotAgentProvider('invoice-preparation');
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
const checks = [], traces = [], errors = [], unexpectedNetwork = [];
const clone = value => structuredClone(value);
const fileHash = value => createHash('sha256').update(value).digest('hex');
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});
let lastPage;

async function open({catalogPermission = true, viewport = {width: 1440, height: 1100}, existingCase} = {}) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(12000);
  const calls = [], approvals = [], testCase = existingCase || makeCase(catalogPermission);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
      const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
      if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
      const body = request.postDataJSON(); calls.push(clone(body));
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
  await composer.locator('input[type=file]').setInputFiles(imagePath);
  await expect(composer.getByText('tenbot-invoice-live-demo.png', {exact: true})).toBeVisible();
  await composer.getByRole('checkbox', {name: 'I confirm this attachment contains approved synthetic test data.', exact: true}).check();
  await composer.getByRole('textbox', {name: 'Message', exact: true}).fill('Prepare pending receivals from this synthetic invoice.');
  await composer.getByRole('button', {name: 'Send', exact: true}).click();
  const draft = panel.getByLabel('Editable pending receival draft', {exact: true}); await expect(draft).toBeVisible();
  const line = id => draft.locator('[data-line-id]').filter({has: page.locator(`input[aria-label="Expected quantity for ${id}"]`)});
  const row = name => testCase.current.rows.find(item => item.sourceText.includes(name));
  return {context, page, panel, composer, draft, calls, approvals, line, row, testCase, snapshot: () => clone(testCase.current)};
}

async function fillCatalog(view) {
  const violet = view.row('Unlisted Violet'), line = view.line(violet.lineId);
  await line.getByRole('button', {name: 'Request new catalog material', exact: true}).click();
  const request = line.getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
  await request.getByLabel('Proposed supplier', {exact: true}).fill('T&M Supply');
  await request.getByLabel('Proposed material name', {exact: true}).fill('Unlisted Violet');
  await request.getByLabel('Proposed vendor SKU', {exact: true}).fill('UNK-99');
  await request.getByLabel('Proposed material type', {exact: true}).selectOption('chip');
  await request.getByLabel('Proposed size', {exact: true}).fill('#2');
  await request.getByLabel('Proposed unit', {exact: true}).fill('Bag');
  await request.getByLabel('Proposed package amount', {exact: true}).fill('50');
  await request.getByLabel('Proposed package measure', {exact: true}).selectOption('LB');
  await request.getByLabel('Proposed container', {exact: true}).fill('Bag');
  await request.getByLabel('Proposed notes', {exact: true}).fill('Synthetic catalog material and dependent receival proposal.');
  await request.getByRole('button', {name: 'Prepare catalog request', exact: true}).click();
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
    const acknowledged = view.snapshot(); firstAcknowledgement = acknowledged.rows.find(row => row.lineId === coal.lineId).duplicateAcknowledgement;
    assert.match(firstAcknowledgement, /^[a-f0-9]{64}$/); assert.equal(acknowledged.canApprove, true);
    assert.equal(acknowledged.rows.find(row => row.lineId === coal.lineId).duplicateReview.acknowledged, true);
    const confirm = view.draft.getByRole('checkbox', {name: /I reviewed these exact/}), approve = view.draft.getByRole('button', {name: 'Approve simulated catalog and receivals', exact: true});
    await confirm.check(); await expect(approve).toBeEnabled();
    await capture(view, 'desktop-duplicate-evidence.png', evidence);
    checks.push('Actual matching-record evidence and explicit separate-order acknowledgement are server-validated before combined simulated approval becomes available');
    await coalLine.getByLabel(`Expected quantity for ${coal.lineId}`, {exact: true}).fill('4');
    await expect(ack).not.toBeChecked(); await expect(ack).toBeDisabled(); await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await save(view);
    const edited = view.snapshot(); assert.equal(edited.rows.find(row => row.lineId === coal.lineId).duplicateAcknowledgement, null); assert.notEqual(edited.rows.find(row => row.lineId === coal.lineId).duplicateReview.fingerprint, firstAcknowledgement);
    await expect(ack).toBeEnabled();
    await coalLine.getByLabel(`Expected quantity for ${coal.lineId}`, {exact: true}).fill('3'); await save(view); await ack.check(); await save(view);
    assert(view.snapshot().canApprove); assert.notEqual(view.snapshot().hash, acknowledged.hash);
    checks.push('Editing duplicate-sensitive quantity clears acknowledgement and final approval, requires fresh evidence/review, and prevents reuse of the old reviewed hash');
    const request = violetLine.getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
    await confirm.check();
    if (await request.locator('details').getAttribute('open') === null) await request.getByText('Material details', {exact: true}).click();
    await request.getByLabel('Proposed notes', {exact: true}).fill('Edited catalog operation needs new exact approval.');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await request.getByRole('button', {name: 'Prepare catalog request', exact: true}).click(); await save(view);
    assert(view.snapshot().canApprove);
    const combined = view.draft.getByRole('region', {name: 'Combined proposed operations', exact: true});
    await expect(combined).toContainText('1 catalog material + 5 pending receivals');
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
  const paths = ['scripts/support/tenbot-live-demo.mts', 'scripts/support/tenbot-agent-scripted.mts', 'src/modules/tenbot/ReceivalDraftReview.tsx', 'src/modules/tenbot/live-review.ts', 'src/modules/tenbot/TenbotWorkspace.tsx', 'scripts/verify-tenbot-combined-receival-browser.mjs'];
  const report = {passed: true, groups: checks.length, checks, traces, errors, unexpectedNetwork, mode: 'Actual localhost UI and simulator handlers over bounded disposable HTTP; extraction and model transport use existing offline fixtures, not fresh inference or database security validation', simulatedTransportSteps: transportSteps, inferenceCalls: 0, databaseRequests: 0, operationalWrites: 0, databaseSecurityVerified: false, journalUnchanged: true, journalSha256: fileHash(journalBefore), sourcePins: Object.fromEntries(paths.map(path => [path, fileHash(readFileSync(path))]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: true, groups: checks.length, inferenceCalls: 0, databaseRequests: 0, report: `${directory}/report.json`}));
} catch (error) {
  await lastPage?.screenshot({path: `${directory}/failure.png`}).catch(() => {});
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error instanceof Error ? error.message : String(error), checks, traces, errors, unexpectedNetwork, journalUnchanged: journalBefore.equals(readFileSync(ledgerPath)), mode: 'UI-only, agent transport intercepted; no new inference or database security verification'}, null, 2));
  throw error;
} finally {await browser.close(); loopback.closeAllConnections(); await new Promise(resolve => loopback.close(resolve));}
