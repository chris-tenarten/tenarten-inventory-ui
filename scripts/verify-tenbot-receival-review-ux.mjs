// Focused localhost component checks. All agent transport is intercepted;
// invoice/model output is a saved receipt, and review replies are UI fixtures.
// This verifies presentation and interaction, never inference, RLS or writes.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const origin = 'http://localhost:3000';
const directory = '/private/tmp/tenops-tenbot-receival-review-ux-2026-10-29';
const receiptPath = 'docs/project-memory/evidence/2026-10-29-tenbot-live-openai/docker-independent/browser-report.json';
const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
const recorded = action => structuredClone(receipt.responses.find(item => item.action === action && item.status === 200).body);
const initial = recorded('ask').localDemo.draft;
const aw = initial.rows.find(row => row.materialName === 'Alaska White');
const resin = initial.rows.find(row => row.materialName === 'Clear Resin');
const duplicate = initial.rows.find(row => row.materialName === 'Blue Coal');
const green = initial.rows.find(row => row.materialName === 'CC Green');
const violet = initial.rows.find(row => row.materialName === 'Unlisted Violet');
assert(aw && resin && duplicate && green && violet);
const ledgerPath = '/private/tmp/tenops-tenbot-agent-poc/openai-budget.json';
const journalBefore = readFileSync(ledgerPath);
const checks = [], traces = [], errors = [], unexpectedNetwork = [];
const privacyText = 'TenBot uses AI to help answer questions and process attachments. Submitted content may be processed by OpenAI. Your TenOps permissions still apply.';
const clean = value => value.trim().toLowerCase().replace(/\.$/, '').replace(/s$/, '');
const clone = value => structuredClone(value);
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});
let lastPage;

async function open({catalogPermission = true, viewport = {width: 1440, height: 1100}, sourceDraft = initial} = {}) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  lastPage = page;
  page.setDefaultTimeout(12000);
  const calls = [];
  let current = clone(sourceDraft);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
      const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
      if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
      const body = request.postDataJSON();
      calls.push(body); traces.push({action: body.action, endpoint: url.origin});
      if (body.action === 'status') return route.fulfill({headers, json: {...recorded('status'), canPrepare: true}});
      if (body.action === 'upload') return route.fulfill({headers, json: recorded('upload')});
      if (body.action === 'ask') {
        const answer = recorded('ask'); answer.localDemo.draft = clone(current);
        answer.notices = ['UI validation replays saved actual model evidence; no new inference or database calls.'];
        return route.fulfill({headers, json: answer});
      }
      if (body.action === 'review') {
        assert.deepEqual(Object.keys(body).sort(), ['action', 'draftId', 'edits', 'orderDetails', 'revision'].sort());
        for (const edit of body.edits) {
          assert.deepEqual(Object.keys(edit).sort(), ['lineId', 'materialId', 'quantity', 'unit', 'jobId', 'excluded'].sort());
          assert(edit.materialId === null || recorded('status').catalog.some(item => item.id === edit.materialId));
          const row = current.rows.find(item => item.lineId === edit.lineId); assert(row);
          Object.assign(row, edit);
          const material = recorded('status').catalog.find(item => item.id === row.materialId);
          if (row.excluded) row.reasons = [];
          else if (!material) row.reasons = ['unmatched_material'];
          else {
            row.materialName = material.materialName; row.size = material.size;
            row.reasons = [
              ...(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(row.quantity) || !(Number(row.quantity) > 0) ? ['invalid_quantity'] : []),
              ...(clean(row.unit) !== clean(material.unit) ? ['incompatible_unit'] : []),
              ...(row.lineId === duplicate.lineId ? ['potential_duplicate'] : []),
            ];
          }
        }
        current.orderDetails = clone(body.orderDetails); current.revision++;
        current.hash = createHash('sha256').update(JSON.stringify({rows: current.rows, details: current.orderDetails, revision: current.revision})).digest('hex');
        current.missingFields = Object.entries(current.orderDetails).filter(([, value]) => !value).map(([key]) => key);
        current.canApprove = current.rows.some(row => !row.excluded) && current.rows.every(row => row.excluded || !row.reasons.length) && !current.missingFields.length;
        return route.fulfill({headers, json: {draft: clone(current), simulation: true}});
      }
      if (body.action === 'clear') return route.fulfill({headers, json: {cleared: true, simulation: true}});
      // Approval and catalog creation must never occur in this focused test.
      unexpectedNetwork.push({origin: url.origin, action: body.action});
      return route.fulfill({status: 403, headers, json: {error: 'UI verifier blocks every non-read/review agent action.'}});
    }
    if (url.origin === origin) {
      if (url.pathname.endsWith('/rpc/get_my_app_access') && !catalogPermission) {
        const response = await route.fetch();
        const rows = await response.json();
        assert(Array.isArray(rows));
        return route.fulfill({response, json: rows.map(row => ({...row, role: 'member'}))});
      }
      if (/\/rpc\/(?:save_.*catalog|prepare_invoice|approve_invoice|execute_invoice)/.test(url.pathname)) {
        unexpectedNetwork.push({origin: url.origin, path: url.pathname});
        return route.fulfill({status: 403, json: {error: 'Operational and catalog writes blocked by verifier.'}});
      }
      return route.continue();
    }
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    unexpectedNetwork.push({origin: url.origin, method: request.method()});
    return route.abort();
  });
  await page.goto(`${origin}/my-work?tenbotExperiment=1`, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: 'Messaging', exact: true}).click();
  const panel = page.getByRole('dialog', {name: 'Inbox', exact: true});
  await panel.locator('aside').getByRole('button').filter({has: page.getByText('TenBot', {exact: true})}).click();
  const composer = panel.locator('[data-messaging-composer]');
  await expect.poll(() => calls.filter(item => item.action === 'status').length).toBeGreaterThan(0);
  await expect(panel.getByText('AI-assisted TenOps helper', {exact: true})).toBeVisible();
  await expect(panel.getByText('TenOps guidance', {exact: true})).toHaveCount(0);
  const info = panel.getByLabel('About TenBot AI', {exact: true});
  await expect(info).toBeVisible();
  assert.equal(await info.evaluate(element => Boolean(element.closest('[data-messaging-composer]'))), false);
  const privacy = panel.getByRole('note', {name: 'TenBot AI privacy', exact: true});
  await expect(privacy).not.toBeVisible();
  await expect(composer.getByText(privacyText, {exact: true})).toHaveCount(0);
  await expect(composer.getByText('OpenAI processes your submitted image and requests · Local experiment details', {exact: true})).toHaveCount(0);
  await composer.locator('input[type=file]').setInputFiles('scripts/fixtures/tenbot-invoice-live-demo.png');
  await composer.getByRole('checkbox', {name: 'I confirm this attachment contains approved synthetic test data.', exact: true}).check();
  await composer.getByRole('textbox', {name: 'Message', exact: true}).fill('Prepare pending receivals from this synthetic invoice.');
  await composer.getByRole('button', {name: 'Send', exact: true}).click();
  const draft = panel.getByLabel('Editable pending receival draft', {exact: true});
  await expect(draft).toBeVisible();
  const line = id => draft.locator('[data-line-id]').filter({has: page.locator(`input[aria-label="Expected quantity for ${id}"]`)});
  return {context, page, panel, draft, calls, line};
}

async function expectState(line, state) { await expect(line).toHaveAttribute('data-line-state', state); }
const countAction = (view, action) => view.calls.filter(item => item.action === action).length;
async function fillOrder(view) {
  await view.draft.getByLabel('Draft ordered by', {exact: true}).fill('Synthetic Review Employee');
  await view.draft.getByLabel('Draft order date', {exact: true}).fill('2026-10-29');
  await view.draft.getByLabel('Draft destination location', {exact: true}).fill('Denton');
}
async function exclude(view, row) { await view.line(row.lineId).getByRole('checkbox', {name: 'Exclude this line from the proposed receivals', exact: true}).check(); }
async function screenshotContained(view, filename) {
  await view.draft.scrollIntoViewIfNeeded();
  assert(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const boxes = await view.draft.locator('input,select,textarea,button').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => ({left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right})));
  assert(boxes.every(box => box.left >= 0 && box.right <= 1441));
  await view.page.screenshot({path: `${directory}/${filename}`, fullPage: false});
}

try {
  // Ensure the existing app review server is disposable before opening the UI.
  const probe = await browser.newContext();
  try {
    const response = await probe.request.get(`${origin}/__review/state`, {timeout: 5000});
    assert(response.ok()); assert.equal((await response.json()).mode, 'synthetic');
  } finally {await probe.close();}

  const view = await open();
  try {
    const info = view.panel.getByLabel('About TenBot AI', {exact: true});
    await info.click();
    const privacy = view.panel.getByRole('note', {name: 'TenBot AI privacy', exact: true});
    await expect(privacy.getByText(privacyText, {exact: true})).toBeVisible();
    await privacy.getByText('More privacy details', {exact: true}).click();
    await expect(privacy).toContainText('No Production records are read or written');
    await info.press('Escape');
    await expect(privacy).not.toBeVisible();
    checks.push('Muted header identifies the AI-assisted TenOps helper; About TenBot AI retains on-demand disclosure without redundant persistent composer processing text');
    const whiteLine = view.line(aw.lineId), resinLine = view.line(resin.lineId), duplicateLine = view.line(duplicate.lineId), greenLine = view.line(green.lineId), violetLine = view.line(violet.lineId);
    await expectState(whiteLine, 'Ready');
    await expectState(violetLine, 'Needs catalog match');
    await expectState(duplicateLine, 'Needs review');
    await expect(violetLine).toContainText('Unlisted Violet');
    await screenshotContained(view, 'desktop-initial-review.png');
    checks.push('Each recorded invoice line shows an explicit current state; unmatched Violet and duplicate Blue Coal remain held');

    const before = view.calls.length;
    await violetLine.getByRole('button', {name: 'Request new catalog material', exact: true}).click();
    const request = violetLine.getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
    await expect(request).toBeVisible();
    await request.getByLabel('Proposed material name', {exact: true}).fill('Unlisted Violet');
    await request.getByLabel('Proposed supplier', {exact: true}).fill('T&M Supply');
    await request.getByLabel('Proposed vendor SKU', {exact: true}).fill('UNK-99');
    await request.getByLabel('Proposed material type', {exact: true}).selectOption('chip');
    await request.getByLabel('Proposed size', {exact: true}).fill('#2');
    await request.getByLabel('Proposed unit', {exact: true}).fill('Bag');
    await request.getByLabel('Proposed package amount', {exact: true}).fill('50');
    await request.getByLabel('Proposed package measure', {exact: true}).selectOption('LB');
    await request.getByLabel('Proposed container', {exact: true}).fill('Bag');
    await request.getByLabel('Proposed notes', {exact: true}).fill('Synthetic proposed catalog addition only.');
    await request.getByRole('button', {name: 'Prepare catalog request', exact: true}).click();
    await expect(request).toContainText('Catalog request prepared locally · Not submitted.');
    await expect(request.locator('details')).not.toHaveAttribute('open', '');
    await expectState(violetLine, 'Needs catalog match');
    await expect(violetLine.getByLabel(`Catalog material for ${violet.lineId}`, {exact: true})).toHaveValue('');
    assert.equal(view.calls.length, before, 'Preparing proposed catalog details must issue no agent request');
    await request.scrollIntoViewIfNeeded();
    await view.page.screenshot({path: `${directory}/desktop-proposed-material.png`});
    checks.push('Unmatched line prepares reviewable catalog details locally without inventing a material ID, submitting an RPC, or clearing the catalog hold');

    await view.page.setViewportSize({width: 390, height: 844});
    await request.getByText('Material details', {exact: true}).click();
    await expect(request.getByLabel('Proposed material name', {exact: true})).toBeVisible();
    await request.scrollIntoViewIfNeeded();
    assert(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const mobileBoxes = await request.locator('input,select,textarea,button').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => ({left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right})));
    assert(mobileBoxes.every(box => box.left >= 0 && box.right <= 391));
    await view.page.screenshot({path: `${directory}/mobile-proposed-material.png`});
    await request.getByText('Material details', {exact: true}).click();
    await view.page.setViewportSize({width: 1440, height: 1100});
    checks.push('390 px mobile catalog request preserves readable fields and contained controls without horizontal overflow');

    await greenLine.getByLabel(`Catalog material for ${green.lineId}`, {exact: true}).selectOption('standard:synthetic-green-a');
    await expectState(greenLine, 'Ready');
    await expect(greenLine).not.toContainText('ambiguous catalog match');
    await expect(greenLine).not.toContainText('unmatched material');
    await expect(view.draft).toContainText(/not.*reviewed|unsaved|save.*review/i);
    checks.push('Choosing an existing material immediately clears obsolete unmatched/ambiguity validation while preserving unsaved review state');

    const quantity = whiteLine.getByLabel(`Expected quantity for ${aw.lineId}`, {exact: true});
    await quantity.fill('0'); await expectState(whiteLine, 'Invalid quantity/unit');
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(whiteLine).toContainText(/quantity.*positive|positive.*quantity|greater than 0/i);
    await expect(view.draft.getByLabel('Approval blockers', {exact: true})).toContainText('Line 1 · Alaska White: Expected quantity');
    await quantity.fill('6'); await expectState(whiteLine, 'Ready');
    await expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    const resinUnit = resinLine.getByLabel(`Unit for ${resin.lineId}`, {exact: true});
    await resinUnit.fill('Bag'); await expectState(resinLine, 'Invalid quantity/unit');
    await expect(resinUnit).toHaveAttribute('aria-invalid', 'true');
    await expect(resinLine).toContainText(/Pail/);
    await resinLine.scrollIntoViewIfNeeded();
    await view.page.screenshot({path: `${directory}/desktop-unit-validation.png`});
    await view.page.setViewportSize({width: 390, height: 844});
    await resinLine.scrollIntoViewIfNeeded();
    assert(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await view.page.screenshot({path: `${directory}/mobile-unit-validation.png`});
    await view.page.setViewportSize({width: 1440, height: 1100});
    await resinUnit.fill('Pail'); await expectState(resinLine, 'Ready');
    await expect(resinUnit).not.toHaveAttribute('aria-invalid', 'true');
    checks.push('Quantity and catalog-compatible unit errors name their exact fields and disappear immediately after correction');

    await duplicateLine.getByLabel(`Expected quantity for ${duplicate.lineId}`, {exact: true}).fill('2');
    await duplicateLine.getByLabel(`Production Job for ${duplicate.lineId}`, {exact: true}).selectOption(recorded('status').jobs[0].id);
    await expectState(duplicateLine, 'Needs review');
    await expect(duplicateLine).toContainText(/duplicate/i);
    await exclude(view, violet);
    await expectState(violetLine, 'Excluded');
    await expect(violetLine.getByLabel(`Catalog material for ${violet.lineId}`, {exact: true})).toBeDisabled();
    await expect(violetLine.locator('[aria-invalid="true"]')).toHaveCount(0);
    checks.push('Duplicate concern survives unrelated quantity/Job edits; explicit exclusion suppresses obsolete invalid-field feedback without assigning a catalog item');

    await fillOrder(view);
    await view.draft.getByRole('button', {name: 'Save changes for review', exact: true}).click();
    await expect.poll(() => countAction(view, 'review')).toBe(1);
    await expectState(view.line(duplicate.lineId), 'Needs review');
    await expect(view.line(duplicate.lineId)).toContainText(/duplicate/i);
    const firstReview = view.calls.find(item => item.action === 'review');
    const violetEdit = firstReview.edits.find(row => row.lineId === violet.lineId);
    assert.equal(violetEdit.materialId, null); assert.equal(violetEdit.excluded, true);
    assert(!JSON.stringify(firstReview).includes('Synthetic proposed catalog addition only.'));
    const retained = view.line(violet.lineId).getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true});
    await expect(retained).toContainText('Catalog request prepared locally · Not submitted.');
    await expect(retained.getByLabel('Proposed material name', {exact: true})).toHaveValue('Unlisted Violet');
    await expect(retained.getByLabel('Proposed notes', {exact: true})).toHaveValue('Synthetic proposed catalog addition only.');
    await expect(retained.getByLabel('Proposed material name', {exact: true})).toBeDisabled();
    checks.push('Review submission contains only canonical receival edits; catalog proposal survives server revision/remount read-only on the excluded line, stays outside payloads, and duplicate remains held after authoritative-response fixture');

    await exclude(view, duplicate);
    await view.draft.getByRole('button', {name: 'Save changes for review', exact: true}).click();
    await expect.poll(() => countAction(view, 'review')).toBe(2);
    const confirm = view.draft.getByRole('checkbox', {name: 'I reviewed these exact lines and approve creating simulated pending receivals.', exact: true});
    await expect(confirm).toBeEnabled(); await confirm.check();
    const approve = view.draft.getByRole('button', {name: 'Approve simulated pending receivals', exact: true});
    await expect(approve).toBeEnabled();
    await view.line(aw.lineId).getByLabel(`Expected quantity for ${aw.lineId}`, {exact: true}).fill('7');
    await expect(confirm).not.toBeChecked(); await expect(approve).toBeDisabled();
    await screenshotContained(view, 'desktop-edited-unreviewed.png');
    await view.page.setViewportSize({width: 390, height: 844});
    await view.line(aw.lineId).scrollIntoViewIfNeeded();
    assert(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await view.page.screenshot({path: `${directory}/mobile-edited-unreviewed.png`});
    assert.equal(countAction(view, 'approve'), 0);
    checks.push('Reviewed valid draft permits explicit approval selection; any subsequent receival edit immediately clears approval and disables execution until another server review');
  } finally {await view.context.close();}

  const denied = await open({catalogPermission: false});
  try {
    const line = denied.line(violet.lineId);
    const action = line.getByRole('button', {name: 'Request new catalog material', exact: true});
    if (await action.count()) await expect(action).toBeDisabled();
    await expect(line.getByRole('region', {name: `Catalog material request for ${violet.lineId}`, exact: true})).toHaveCount(0);
    assert(!denied.calls.some(item => !['status', 'upload', 'ask'].includes(item.action)));
    checks.push('UI profile without manageVendorsCatalog cannot prepare a catalog addition; this is a fixture permission check, not database authorization certification');
  } finally {await denied.context.close();}

  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(unexpectedNetwork.length, 0, JSON.stringify(unexpectedNetwork));
  assert(journalBefore.equals(readFileSync(ledgerPath)), 'Inference ledger changed during UI-only verification');
  const result = {passed: true, mode: 'Actual localhost UI; saved model receipt and explicitly simulated review transport, zero fresh inference/database actions', groups: checks.length, checks, traces, errors, unexpectedNetwork, inferenceCalls: 0, databaseRequests: 0, databaseSecurityVerified: false, operationalWrites: 0, journalUnchanged: true, journalSha256: createHash('sha256').update(journalBefore).digest('hex'), sourcePins: Object.fromEntries(['src/modules/tenbot/ReceivalDraftReview.tsx', 'src/modules/tenbot/live-review.ts', 'src/modules/tenbot/TenbotWorkspace.tsx', 'src/modules/my-work/inbox.ts', 'scripts/verify-tenbot-receival-review-ux.mjs'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed: true, groups: checks.length, inferenceCalls: 0, databaseRequests: 0, report: `${directory}/report.json`}));
} catch (error) {
  await lastPage?.screenshot({path: `${directory}/failure.png`}).catch(() => {});
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error instanceof Error ? error.message : String(error), checks, traces, errors, unexpectedNetwork, journalUnchanged: journalBefore.equals(readFileSync(ledgerPath)), mode: 'UI-only; every agent transport intercepted; no fresh inference or DB validation'}, null, 2));
  throw error;
} finally {await browser.close();}
