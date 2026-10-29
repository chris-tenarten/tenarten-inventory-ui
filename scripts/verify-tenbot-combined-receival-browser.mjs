// Actual localhost UI with every agent request intercepted. Saved model output
// supplies the invoice; review/approval responses are explicit UI fixtures.
// No new inference, catalog/database writes, or JWT/RLS verification occurs.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const origin = 'http://localhost:3000';
const directory = '/private/tmp/tenops-tenbot-combined-receival-2026-10-29/browser';
const receipt = JSON.parse(readFileSync('docs/project-memory/evidence/2026-10-29-tenbot-live-openai/docker-independent/browser-report.json', 'utf8'));
const recorded = action => structuredClone(receipt.responses.find(item => item.action === action && item.status === 200).body);
const sourceDraft = recorded('ask').localDemo.draft;
const sourceRows = Object.fromEntries(['Alaska White', 'Clear Resin', 'Blue Coal', 'CC Green', 'Unlisted Violet'].map(name => [name, sourceDraft.rows.find(row => row.materialName === name)]));
assert(Object.values(sourceRows).every(Boolean));
const violet = sourceRows['Unlisted Violet'];
const imagePath = 'scripts/fixtures/tenbot-invoice-live-demo.png';
const provenance = {supplier: 'T&M Supply', documentReference: 'DEMO-REC-2189', attachmentSha256: createHash('sha256').update(readFileSync(imagePath)).digest('hex')};
const ledgerPath = '/private/tmp/tenops-tenbot-agent-poc/openai-budget.json';
const journalBefore = readFileSync(ledgerPath);
const checks = [], traces = [], errors = [], unexpectedNetwork = [];
const clone = value => structuredClone(value);
const clean = value => value.trim().toLowerCase().replace(/\.$/, '').replace(/s$/, '');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash = value => createHash('sha256').update(value).digest('hex');
const complete = value => Boolean(value?.prepared && value.supplier?.trim() && value.itemName?.trim() && ['chip', 'resin', 'pigment', 'filler', 'other'].includes(value.materialType) && value.priceUnit?.trim() && value.packaging?.trim() && Number(value.unitSize) > 0 && value.unitSizeUom);
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});
let lastPage;

async function open({catalogPermission = true, viewport = {width: 1440, height: 1100}} = {}) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(12000);
  const calls = [], approvals = [];
  let current = {...clone(sourceDraft), provenance: clone(provenance)};
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
      const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
      if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
      const body = request.postDataJSON(); calls.push(clone(body)); traces.push({action: body.action, endpoint: url.origin, catalogPermission});
      if (body.action === 'status') return route.fulfill({headers, json: {...recorded('status'), canPrepare: true, canCreateCatalog: catalogPermission}});
      if (body.action === 'upload') return route.fulfill({headers, json: recorded('upload')});
      if (body.action === 'ask') {
        const answer = recorded('ask'); answer.localDemo.draft = clone(current);
        answer.notices = ['UI verification replays saved model evidence; subsequent review and approval are simulated response fixtures.'];
        return route.fulfill({headers, json: answer});
      }
      if (body.action === 'review') {
        assert.deepEqual(Object.keys(body).sort(), ['action', 'draftId', 'edits', 'orderDetails', 'revision'].sort());
        assert.equal(body.draftId, current.id); assert.equal(body.revision, current.revision);
        assert.equal(body.edits.length, current.rows.length);
        for (const edit of body.edits) {
          assert(Object.keys(edit).every(key => ['lineId', 'materialId', 'quantity', 'unit', 'jobId', 'excluded', 'catalogRequest'].includes(key)));
          const row = current.rows.find(item => item.lineId === edit.lineId); assert(row);
          assert(edit.materialId === null || recorded('status').catalog.some(item => item.id === edit.materialId));
          if (edit.catalogRequest) assert.equal(edit.materialId, null, 'A proposed material must not receive an invented catalog ID');
          Object.assign(row, clone(edit));
          const material = recorded('status').catalog.find(item => item.id === row.materialId);
          if (row.excluded) row.reasons = [];
          else {
            row.reasons = [
              ...(!material && !complete(row.catalogRequest) ? ['unmatched_material'] : []),
              ...(!(Number(row.quantity) > 0) ? ['invalid_quantity'] : []),
              ...(clean(row.unit) !== clean(material?.unit || row.catalogRequest?.priceUnit || '') ? ['incompatible_unit'] : []),
              ...(row.lineId === sourceRows['Blue Coal'].lineId ? ['potential_duplicate'] : []),
            ];
            if (material) {row.materialName = material.materialName; row.size = material.size;}
          }
        }
        current.orderDetails = clone(body.orderDetails); current.revision++;
        current.catalogApprovalRequired = current.rows.some(row => !row.excluded && complete(row.catalogRequest)) && !catalogPermission;
        current.missingFields = Object.entries(current.orderDetails).filter(([, value]) => !value).map(([key]) => key);
        current.canApprove = !current.catalogApprovalRequired && !current.missingFields.length && current.rows.some(row => !row.excluded) && current.rows.every(row => row.excluded || !row.reasons.length);
        current.hash = hash({rows: current.rows, details: current.orderDetails, revision: current.revision, provenance: current.provenance});
        return route.fulfill({headers, json: {draft: clone(current), simulation: true}});
      }
      if (body.action === 'approve') {
        assert(catalogPermission, 'Unauthorized catalog addition must never reach approval');
        assert.equal(body.confirmation, true); assert.equal(body.hash, current.hash); assert.equal(body.revision, current.revision); assert(current.canApprove);
        const included = current.rows.filter(row => !row.excluded);
        const catalogAdditions = included.filter(row => row.catalogRequest).map(row => ({simulation: true, sourceLineId: row.lineId, catalogId: null, material: clone(row.catalogRequest), provenance: {...clone(current.provenance), sourceText: row.sourceText}}));
        const receivals = included.map((row, index) => ({id: `simulated-ui-fixture-${index + 1}`, simulation: true, catalogId: row.materialId, ...(row.catalogRequest ? {catalogOperationSourceLineId: row.lineId} : {}), material_name: row.catalogRequest?.itemName || row.materialName, size: row.catalogRequest?.size || row.size, quantity_expected: Number(row.quantity), quantity_received: 0, unit: row.unit, production_job_id: row.jobId, status: 'pending'}));
        current.status = 'approved_simulated'; current.canApprove = false;
        const answer = {draft: clone(current), catalogAdditions, receivals, createdCount: receivals.length, simulation: true, idempotent: false, onHandChanged: false};
        approvals.push(clone(answer)); return route.fulfill({headers, json: answer});
      }
      if (body.action === 'clear') return route.fulfill({headers, json: {cleared: true, simulation: true}});
      unexpectedNetwork.push({origin: url.origin, action: body.action});
      return route.fulfill({status: 403, headers, json: {error: 'Unexpected agent action blocked by UI verifier.'}});
    }
    if (url.origin === origin) {
      if (url.pathname.endsWith('/rpc/get_my_app_access') && !catalogPermission) {
        const response = await route.fetch(); const rows = await response.json(); assert(Array.isArray(rows));
        return route.fulfill({response, json: rows.map(row => ({...row, role: 'member'}))});
      }
      if (/\/rpc\/(?:save_.*catalog|prepare_invoice|approve_invoice|execute_invoice)/.test(url.pathname)) {
        unexpectedNetwork.push({origin: url.origin, path: url.pathname});
        return route.fulfill({status: 403, json: {error: 'Operational writes blocked by UI verifier.'}});
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
  return {context, page, panel, composer, draft, calls, approvals, line, snapshot: () => clone(current)};
}

async function fillCatalog(view) {
  const line = view.line(violet.lineId);
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
  await view.line(sourceRows['CC Green'].lineId).getByLabel(`Catalog material for ${sourceRows['CC Green'].lineId}`, {exact: true}).selectOption('standard:synthetic-green-a');
  await view.line(sourceRows['Blue Coal'].lineId).getByRole('checkbox', {name: 'Exclude this line from the proposed receivals', exact: true}).check();
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
async function capture(view, filename, target = view.line(violet.lineId)) {
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
  try {
    checks.push('Ordinary Messaging composer and PDF/photo attachment control remain available; employee experiment dropdown is absent');
    const white = view.line(sourceRows['Alaska White'].lineId), violetLine = view.line(violet.lineId);
    await expect(white).toHaveAttribute('data-line-state', 'Ready');
    await expect(violetLine).toHaveAttribute('data-line-state', 'Needs catalog match');
    await fillCatalog(view);
    await expect(violetLine).toHaveAttribute('data-line-state', 'Ready');
    await expect(violetLine.getByLabel(`Catalog material for ${violet.lineId}`, {exact: true})).toHaveValue('');
    await expect(violetLine.getByRole('checkbox', {name: 'Exclude this line from the proposed receivals', exact: true})).not.toBeChecked();
    await expect(violetLine).toContainText(/simulated/i);
    checks.push('Complete proposed Violet material removes catalog-match blocker without an existing or invented ID, exclusion, or immediate submission');

    await finishOtherLines(view); await capture(view, 'desktop-combined-unreviewed.png');
    const combined = view.draft.getByRole('region', {name: 'Combined proposed operations', exact: true});
    await expect(combined).toContainText('1 catalog material + 4 pending receivals');
    await expect(combined).toContainText('Line 5: create Unlisted Violet, then its 4 Bag pending receival.');
    await capture(view, 'desktop-combined-summary.png', combined);
    await save(view);
    const first = view.snapshot(), submitted = view.calls.filter(item => item.action === 'review').at(-1).edits.find(row => row.lineId === violet.lineId);
    assert.equal(submitted.materialId, null); assert.equal(submitted.excluded, false); assert.equal(submitted.catalogRequest.prepared, true);
    assert.equal(submitted.catalogRequest.vendorSku, 'UNK-99'); assert.equal(submitted.catalogRequest.itemName, 'Unlisted Violet');
    assert.equal(first.rows.find(row => row.lineId === violet.lineId).sourceText, violet.sourceText);
    assert.deepEqual(first.provenance, provenance); assert(first.canApprove);
    const confirm = view.draft.getByRole('checkbox', {name: /I reviewed these exact/});
    const approve = view.draft.getByRole('button', {name: /^Approve simulated/});
    await expect(approve).toHaveText('Approve simulated catalog and receivals');
    await expect(confirm).toHaveAccessibleName('I reviewed these exact lines and approve simulated catalog creation and dependent pending receivals.');
    await expect(confirm).toBeEnabled(); await confirm.check(); await expect(approve).toBeEnabled();
    await capture(view, 'desktop-combined-approval.png', approve);
    checks.push('One server-review fixture receives complete catalog details and dependent receival, retains original invoice source/provenance, and enables explicit combined simulated approval');

    const request = view.line(violet.lineId).getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
    if (await request.locator('details').getAttribute('open') === null) await request.getByText('Material details', {exact: true}).click();
    await request.getByLabel('Proposed notes', {exact: true}).fill('Edited catalog details require a new exact review.');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await request.getByRole('button', {name: 'Prepare catalog request', exact: true}).click();
    await save(view);
    const revised = view.snapshot(); assert(revised.revision > first.revision); assert.notEqual(revised.hash, first.hash);
    assert.equal(revised.rows.find(row => row.lineId === violet.lineId).catalogRequest.notes, 'Edited catalog details require a new exact review.');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    checks.push('Editing catalog details immediately invalidates approval, and resaving binds a new revision/hash that includes the changed catalog operation');

    await view.page.setViewportSize({width: 390, height: 844});
    await capture(view, 'mobile-combined-review.png');
    await capture(view, 'mobile-combined-approval.png', approve);
    checks.push('Combined proposal remains compact and contained at 390 px without horizontal document overflow');
    await view.page.setViewportSize({width: 1440, height: 1100});
    await confirm.check(); await approve.click();
    await expect.poll(() => view.approvals.length).toBe(1);
    const result = view.approvals[0]; assert.equal(result.catalogAdditions.length, 1); assert.equal(result.receivals.length, 4);
    const addition = result.catalogAdditions[0], dependent = result.receivals.find(row => row.catalogOperationSourceLineId === violet.lineId);
    assert(addition.simulation); assert.equal(addition.catalogId, null); assert.equal(addition.sourceLineId, violet.lineId);
    assert.deepEqual(addition.provenance, {...provenance, sourceText: violet.sourceText});
    assert(dependent?.simulation); assert.equal(dependent.catalogId, null); assert.equal(dependent.material_name, 'Unlisted Violet');
    assert.equal(dependent.quantity_expected, 4); assert.equal(dependent.quantity_received, 0);
    assert(result.receivals.every(row => row.status === 'pending' && row.quantity_received === 0));
    const completed = view.draft.getByRole('status').filter({hasText: '1 simulated catalog material(s) and 4 simulated pending receivals created.'});
    await expect(completed).toBeVisible();
    await expect(completed).toContainText('No actual catalog or receival records were created.');
    await capture(view, 'desktop-combined-approved.png', completed);
    await view.page.setViewportSize({width: 390, height: 844});
    await capture(view, 'mobile-combined-approved.png', completed);
    writeFileSync(`${directory}/combined-ui-response.json`, JSON.stringify(result, null, 2));
    checks.push('Explicit approval returns separately labeled simulated catalog addition and four pending rows, including Violet dependency with catalogId null and unchanged on-hand quantities');
  } finally {await view.context.close();}

  const denied = await open({catalogPermission: false});
  try {
    await fillCatalog(denied); await finishOtherLines(denied);
    await expect(denied.line(violet.lineId)).toContainText(/authorized employee|catalog permission|catalog.management|catalog.*approval/i);
    await save(denied);
    assert.equal(denied.snapshot().catalogApprovalRequired, true);
    assert.equal(denied.snapshot().rows.find(row => row.lineId === violet.lineId).catalogRequest.itemName, 'Unlisted Violet');
    await expect(denied.draft.getByRole('checkbox', {name: /I reviewed these exact/})).toBeDisabled();
    await expect(denied.draft.getByRole('button', {name: /^Approve simulated/})).toBeDisabled();
    assert.equal(denied.calls.filter(item => item.action === 'approve').length, 0);
    await denied.page.setViewportSize({width: 390, height: 844}); await capture(denied, 'mobile-authorized-review-required.png');
    checks.push('Employee without catalog-management capability can prepare and review the request but receives an authorized-employee hold and cannot approve the combined simulated write');
  } finally {await denied.context.close();}

  assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(unexpectedNetwork.length, 0, JSON.stringify(unexpectedNetwork));
  assert(journalBefore.equals(readFileSync(ledgerPath)), 'Inference ledger changed during UI-only verification');
  const paths = ['src/modules/tenbot/ReceivalDraftReview.tsx', 'src/modules/tenbot/live-review.ts', 'src/modules/tenbot/TenbotWorkspace.tsx', 'scripts/verify-tenbot-combined-receival-browser.mjs'];
  const report = {passed: true, groups: checks.length, checks, traces, errors, unexpectedNetwork, mode: 'Actual localhost UI, saved model output, intercepted review/approval fixtures; not a live model or database security test', inferenceCalls: 0, databaseRequests: 0, operationalWrites: 0, databaseSecurityVerified: false, journalUnchanged: true, journalSha256: fileHash(journalBefore), sourcePins: Object.fromEntries(paths.map(path => [path, fileHash(readFileSync(path))]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: true, groups: checks.length, inferenceCalls: 0, databaseRequests: 0, report: `${directory}/report.json`}));
} catch (error) {
  await lastPage?.screenshot({path: `${directory}/failure.png`}).catch(() => {});
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error instanceof Error ? error.message : String(error), checks, traces, errors, unexpectedNetwork, journalUnchanged: journalBefore.equals(readFileSync(ledgerPath)), mode: 'UI-only, agent transport intercepted; no new inference or database security verification'}, null, 2));
  throw error;
} finally {await browser.close();}
