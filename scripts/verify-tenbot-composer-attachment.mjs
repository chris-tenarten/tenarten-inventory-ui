// Actual localhost component/file-picker/PDF rendering checks. All agent HTTP
// responses are explicitly simulated or replayed receipts: no model or DB calls.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import sharp from 'sharp';

const origin = 'http://localhost:3000';
const directory = '/private/tmp/tenops-tenbot-composer-2026-10-29';
const evidence = 'docs/project-memory/evidence/2026-10-29-tenbot-live-openai';
const invoiceReceipt = JSON.parse(readFileSync(`${evidence}/docker-independent/browser-report.json`, 'utf8'));
const helpReceipt = JSON.parse(readFileSync(`${evidence}/conversational-help/confirmation-retry-browser/report.json`, 'utf8'));
const recorded = action => invoiceReceipt.responses.find(item => item.action === action && item.status === 200).body;
const ledgerPath = '/private/tmp/tenops-tenbot-agent-poc/openai-budget.json';
const journalBefore = readFileSync(ledgerPath);
const png = readFileSync('scripts/fixtures/tenbot-invoice-live-demo.png');
const jpg = await sharp(png).resize({width: 1600}).jpeg({quality: 92}).toBuffer();
const pdf = readFileSync('scripts/fixtures/tenbot-invoice-live-demo.pdf');
const files = [
  {name: 'composer-synthetic-invoice.png', mimeType: 'image/png', buffer: png},
  {name: 'composer-synthetic-invoice.jpg', mimeType: 'image/jpeg', buffer: jpg},
  {name: 'composer-synthetic-invoice.pdf', mimeType: 'application/pdf', buffer: pdf},
];
const checks = [], traces = [], errors = [], unexpectedNetwork = [];
const privacyText = 'TenBot uses AI to help answer questions and process attachments. Submitted content may be processed by OpenAI. Your TenOps permissions still apply.';
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});

async function openConversation({mode = 'normal', realAuthFailure = false, canPrepare = true, uploadFailure = false, viewport = {width: 1440, height: 1000}} = {}) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const calls = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
      const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
      if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
      const body = request.postDataJSON(), entry = {endpoint: url.origin, action: body.action};
      calls.push({body, entry}); traces.push(entry);
      if (realAuthFailure) return route.fulfill({status: 401, headers, json: {error: 'Recorded isolated-auth fixture rejection; no database request.'}});
      if (body.action === 'status') return route.fulfill({headers, json: {...recorded('status'), canPrepare}});
      if (body.action === 'upload') {
        if (uploadFailure) return route.fulfill({status: 503, headers, json: {error: 'Simulated upload unavailable. Retry without losing this attachment.'}});
        assert.equal(body.syntheticConfirmed, true);
        assert(['image/png', 'image/jpeg'].includes(body.attachment.mediaType));
        const bytes = Buffer.from(body.attachment.dataBase64, 'base64'), metadata = await sharp(bytes).metadata();
        assert(bytes.length <= 90000); assert(metadata.width <= 1024 && metadata.height <= 1024);
        assert(['png', 'jpeg'].includes(metadata.format));
        Object.assign(entry, {filename: body.attachment.filename, mediaType: body.attachment.mediaType, byteSize: bytes.length, width: metadata.width, height: metadata.height, sha256: createHash('sha256').update(bytes).digest('hex')});
        return route.fulfill({headers, json: {...recorded('upload'), filename: body.attachment.filename, mediaType: body.attachment.mediaType}});
      }
      if (body.action === 'ask') {
        entry.attachmentId = body.attachmentId ?? null;
        const answer = body.attachmentId ? recorded('ask') : helpReceipt.response;
        return route.fulfill({headers, json: {...answer, notices: ['UI validation uses a saved actual Terra answer with simulated transport. No inference or database actions were performed.']}});
      }
      if (body.action === 'clear') return route.fulfill({headers, json: {cleared: true}});
      throw new Error(`Unexpected experimental request: ${body.action}`);
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    unexpectedNetwork.push({origin: url.origin, method: request.method()});
    return route.abort();
  });
  const search = mode === 'production' ? '' : `?tenbotExperiment=1${realAuthFailure ? '&tenbotReceivals=1' : ''}`;
  await page.goto(`${origin}/my-work${search}`, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: 'Messaging', exact: true}).click();
  const panel = page.getByRole('dialog', {name: 'Inbox', exact: true});
  await panel.locator('aside').getByRole('button').filter({has: page.getByText('TenBot', {exact: true})}).click();
  const composer = panel.locator('[data-messaging-composer]');
  if (mode !== 'production') await expect.poll(() => calls.filter(item => item.body.action === 'status').length).toBeGreaterThan(0);
  return {context, page, panel, composer, calls, picker: composer.getByRole('button', {name: 'Attach PDF or image', exact: true})};
}

async function chooseNative(page, picker, file) {
  const selected = page.waitForEvent('filechooser');
  await picker.click();
  await (await selected).setFiles(file);
}

try {
  // Each accepted type crosses the real browser preparation path; returned model
  // and catalog data are saved evidence, not an independent inference result.
  for (const file of files) {
    const view = await openConversation();
    try {
      const {page, panel, composer, picker, calls} = view;
      const controls = panel.getByLabel('Local agent experiment controls', {exact: true});
      await expect(controls).not.toHaveAttribute('open', '');
      await expect(controls.locator('summary').first()).toHaveText('Local experiment');
      assert.equal(await controls.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
      await expect(picker).toBeVisible(); await expect(picker).toBeEnabled();
      const box = await picker.boundingBox(); assert(box && box.width >= 44 && box.height >= 44);
      if (file.mimeType === 'image/png') {
        await page.screenshot({path: `${directory}/desktop-clean-composer.png`});
        await page.setViewportSize({width: 390, height: 844});
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({path: `${directory}/mobile-clean-composer.png`});
        await page.setViewportSize({width: 1440, height: 1000});
        checks.push('Initial desktop/mobile composer stays clean with neutral white Local experiment settings collapsed');
        const info = panel.getByLabel('About TenBot AI', {exact: true});
        const privacy = panel.locator('[role="note"][aria-label="TenBot AI privacy"]');
        await expect(info).toBeVisible(); await expect(privacy).not.toBeVisible();
        assert.equal(await info.evaluate(element => Boolean(element.closest('[data-messaging-composer]'))), false);
        await expect(composer.getByText(privacyText, {exact: true})).toHaveCount(0);
        await expect(composer.getByText('OpenAI processes your submitted image and requests · Local experiment details', {exact: true})).toHaveCount(0);
        await info.click(); await expect(privacy).toBeVisible();
        await expect(privacy.getByText(privacyText, {exact: true})).toBeVisible();
        await privacy.getByText('More privacy details', {exact: true}).click();
        await expect(privacy).toContainText('No Production records are read or written');
        await expect(privacy.getByText(/This local demo sends the approved synthetic attachment/)).toBeVisible();
        await page.screenshot({path: `${directory}/desktop-privacy-info.png`});
        await composer.getByRole('textbox', {name: 'Message', exact: true}).click();
        await expect(privacy).not.toBeVisible();
        await info.focus(); await info.press('Enter'); await expect(privacy).toBeVisible();
        await info.press('Escape'); await expect(privacy).not.toBeVisible();
        await expect(info).toBeFocused(); await expect(panel).toBeVisible();
        checks.push('Header info icon replaces persistent composer privacy copy; exact Product disclosure and further details open on demand, close outside, and support keyboard/Escape without dismissing Messaging');
      }
      await chooseNative(page, picker, file);
      const chip = composer.getByLabel('TenBot attachment', {exact: true});
      await expect(chip).toContainText(file.name); await expect(chip).toContainText('Ready to send');
      assert(!calls.some(item => ['upload', 'ask'].includes(item.body.action)));
      if (file.mimeType === 'image/png') {
        await composer.getByRole('button', {name: `Remove ${file.name}`, exact: true}).click();
        await expect(chip).toHaveCount(0);
        assert(!calls.some(item => ['upload', 'ask'].includes(item.body.action)));
        await chooseNative(page, picker, file);
        await composer.getByRole('textbox', {name: 'Message', exact: true}).fill('Prepare pending receivals from this synthetic invoice.');
        await composer.getByRole('button', {name: 'Send', exact: true}).click();
        await expect(panel.getByRole('alert')).toContainText('Confirm the attachment contains approved synthetic test data before sending.');
        assert(!calls.some(item => ['upload', 'ask'].includes(item.body.action)));
        checks.push('Visible 44 px composer paperclip opens native picker with experiment panel closed; filename/remove work before upload; consent blocks Send');
      }
      await composer.getByRole('textbox', {name: 'Message', exact: true}).fill('Prepare pending receivals from this synthetic invoice.');
      await composer.getByRole('checkbox', {name: 'I confirm this attachment contains approved synthetic test data.', exact: true}).check();
      await composer.getByRole('button', {name: 'Send', exact: true}).click();
      await expect.poll(() => calls.filter(item => item.body.action === 'ask').length, {timeout: 30000}).toBe(1);
      const operational = calls.filter(item => ['upload', 'ask'].includes(item.body.action));
      assert.deepEqual(operational.map(item => item.body.action), ['upload', 'ask']);
      assert.equal(operational[1].body.attachmentId, recorded('upload').attachmentId);
      await expect(composer.getByLabel('TenBot attachment', {exact: true})).toContainText(file.name);
      await expect(composer.getByLabel('TenBot attachment', {exact: true})).toContainText('Attached');
      await expect(panel.locator('[data-tenbot-answer]')).toHaveCount(1);
      await expect(controls).not.toHaveAttribute('open', '');
      const reply = panel.getByLabel('TenBot assistant reply', {exact: true});
      const diagnostics = reply.locator('details').filter({has: page.locator('summary').filter({hasText: 'Sources and evidence'})}).first();
      await expect(diagnostics).not.toHaveAttribute('open', '');
      await expect(reply.getByText('Recorded observations', {exact: true})).not.toBeVisible();
      const preview = panel.locator('summary').filter({hasText: `Attachment preview · ${file.name}`});
      await expect(preview).toBeVisible();
      assert.equal(await preview.evaluate(element => Boolean(element.closest('[aria-label="Local agent experiment controls"]'))), false);
      await expect(panel.getByLabel('Editable pending receival draft', {exact: true})).toBeVisible();
      checks.push(`${file.mimeType}: selected filename precedes upload; real browser preparation generates bounded decoded image; Send sequences upload then ask with exact returned attachment ID`);
      if (file.mimeType === 'application/pdf') checks.push('Invoice reply diagnostics/settings remain collapsed while relevant attachment preview and editable draft remain visible outside them');
      if (file.mimeType === 'application/pdf') {
        await page.screenshot({path: `${directory}/desktop-pdf-attachment.png`});
        await page.setViewportSize({width: 390, height: 844});
        await composer.scrollIntoViewIfNeeded();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const panelBox = await panel.boundingBox(); assert(panelBox && panelBox.width <= 391);
        await expect(picker).toBeVisible();
        await page.screenshot({path: `${directory}/mobile-pdf-attachment.png`});
        const info = panel.getByLabel('About TenBot AI', {exact: true});
        await info.click();
        const privacy = panel.locator('[role="note"][aria-label="TenBot AI privacy"]');
        await expect(privacy.getByText(privacyText, {exact: true})).toBeVisible();
        const privacyBox = await privacy.boundingBox();
        assert(privacyBox && privacyBox.x >= 0 && privacyBox.x + privacyBox.width <= 390);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({path: `${directory}/mobile-privacy-info.png`});
        await info.press('Escape'); await expect(privacy).not.toBeVisible();
        checks.push('390 px mobile layout contains filename, paperclip, Message and Send without horizontal document overflow');
        checks.push('Mobile privacy popup displays exact disclosure inside viewport and closes with Escape');
      }
    } finally {await view.context.close();}
  }

  const text = await openConversation();
  try {
    await text.composer.getByRole('textbox', {name: 'Message', exact: true}).fill(helpReceipt.question);
    await text.composer.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(text.panel.locator('[data-tenbot-answer]')).toContainText(helpReceipt.actualAnswer);
    const diagnostics = text.panel.getByLabel('TenBot assistant reply', {exact: true}).locator('details').filter({has: text.page.locator('summary').filter({hasText: 'Sources and evidence'})}).first();
    await expect(diagnostics).not.toHaveAttribute('open', '');
    await expect(text.panel.getByText('Suggested next steps', {exact: true})).not.toBeVisible();
    await text.page.screenshot({path: `${directory}/desktop-text-help.png`});
    await text.page.setViewportSize({width: 390, height: 844});
    assert(await text.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await text.page.screenshot({path: `${directory}/mobile-text-help.png`});
    assert(!text.calls.some(item => item.body.action === 'upload'));
    const ask = text.calls.find(item => item.body.action === 'ask'); assert(ask && !Object.hasOwn(ask.body, 'attachmentId'));
    checks.push('Text-only conversation remains direct and sends no attachment ID or upload');
  } finally {await text.context.close();}

  const failed = await openConversation({uploadFailure: true});
  try {
    await chooseNative(failed.page, failed.picker, files[0]);
    await failed.composer.getByRole('textbox', {name: 'Message', exact: true}).fill('Prepare pending receivals.');
    await failed.composer.getByRole('checkbox', {name: 'I confirm this attachment contains approved synthetic test data.', exact: true}).check();
    await failed.composer.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(failed.panel.getByRole('alert')).toContainText('Simulated upload unavailable.');
    await expect(failed.composer.getByLabel('TenBot attachment', {exact: true})).toContainText(files[0].name);
    assert.equal(failed.calls.filter(item => item.body.action === 'upload').length, 1);
    assert(!failed.calls.some(item => item.body.action === 'ask'));
    checks.push('Upload failure preserves selected filename/question and makes no ask/inference request');
  } finally {await failed.context.close();}

  const readonly = await openConversation({canPrepare: false});
  try {
    await expect(readonly.picker).toBeVisible(); await expect(readonly.picker).toBeDisabled();
    await readonly.composer.getByRole('textbox', {name: 'Message', exact: true}).fill('How do I save proposed dates?');
    await readonly.composer.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(readonly.panel.locator('[data-tenbot-answer]')).toHaveCount(1);
    assert(!readonly.calls.some(item => item.body.action === 'upload'));
    checks.push('Read-only preparation gate disables picker while preserving text-only help');
  } finally {await readonly.context.close();}

  const unauthenticated = await openConversation({realAuthFailure: true});
  try {
    await expect(unauthenticated.picker).toBeVisible(); await expect(unauthenticated.picker).toBeDisabled();
    await expect(unauthenticated.panel.getByRole('alert')).toContainText('Authenticated database unavailable; writes disabled.');
    assert(!unauthenticated.calls.some(item => item.entry.endpoint !== 'http://localhost:55596'));
    assert(!unauthenticated.calls.some(item => ['upload', 'ask', 'review', 'approve'].includes(item.body.action)));
    checks.push('Authenticated database failure keeps composer picker disabled and never falls back to simulated provider');
  } finally {await unauthenticated.context.close();}

  const standard = await openConversation({mode: 'production'});
  try {
    await expect(standard.picker).toHaveCount(0);
    await expect(standard.composer.locator('input[type=file]')).toHaveCount(0);
    const peer = standard.panel.locator('aside').getByRole('button').filter({hasNot: standard.page.getByText('TenBot', {exact: true})}).filter({hasNot: standard.page.getByText('New message', {exact: true})}).filter({hasNot: standard.page.getByText('New group', {exact: true})}).first();
    if (await peer.count()) {
      await peer.click();
      await expect(standard.panel.getByLabel('Attach files', {exact: true})).toHaveCount(1);
      checks.push('Nonexperimental TenBot has no new picker; ordinary Messaging retains its existing Attach files control');
    } else checks.push('Nonexperimental TenBot has no new picker; ordinary Messaging unchanged by source inspection (fixture has no peer)');
  } finally {await standard.context.close();}

  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(unexpectedNetwork.length, 0, JSON.stringify(unexpectedNetwork));
  assert(journalBefore.equals(readFileSync(ledgerPath)), 'Inference ledger changed during UI-only verifier');
  const result = {passed: true, mode: 'Actual localhost UI/native picker/image/PDF preparation; ALL experimental HTTP transport simulated or replayed from committed actual-response receipts', groups: checks.length, checks, traces, errors, unexpectedNetwork, inferenceCalls: 0, databaseRequests: 0, databaseSecurityVerified: false, operationalWrites: 0, journalUnchanged: true, journalSha256: createHash('sha256').update(journalBefore).digest('hex'), sourcePins: Object.fromEntries(['src/modules/tenbot/TenbotWorkspace.tsx', 'src/modules/my-work/InboxDialog.tsx', 'src/modules/tenbot/live-review.ts'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed: true, groups: checks.length, inferenceCalls: 0, databaseRequests: 0, report: `${directory}/report.json`}));
} catch (error) {
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error instanceof Error ? error.message : String(error), checks, traces, errors, unexpectedNetwork, journalUnchanged: journalBefore.equals(readFileSync(ledgerPath)), mode: 'UI-only; all experimental transport intercepted; no inference or DB calls'}, null, 2));
  throw error;
} finally {await browser.close();}
