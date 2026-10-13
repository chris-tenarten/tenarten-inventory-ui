import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const fixture = JSON.parse(readFileSync('/private/tmp/tenops-color-plate-label-review/server.json', 'utf8'));
const origin = 'http://localhost:3000';
assert.ok(fixture.route.startsWith(origin + '/samples?open='));
const dir = 'output/pdf/color-plate-label'; mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  // Instrument only print(), preserving the standalone document, popup and rendering.
  // Native Chrome dialog opening is verified separately; this is deterministic regression evidence.
  await context.addInitScript(() => { window.print = () => { window.__labelPrintCalls = (window.__labelPrintCalls || 0) + 1; }; });
  const page = await context.newPage(); const errors = [], external = [], downloads = [];
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  page.on('pageerror', e => errors.push(e.message));
  page.on('download', d => downloads.push(d.suggestedFilename()));
  await context.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) { external.push(url); return route.abort(); }
    return route.continue();
  });
  const rows = async () => (await page.request.post(origin + '/rest/v1/rpc/list_samples', { data: {} })).json();
  const evidence = async () => (await page.request.get(origin + '/review/evidence')).json();
  await page.goto(fixture.route);
  await expect(page.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true })).toBeVisible();
  await expect(page.locator('[data-welcome-hero="true"]')).toBeHidden({ timeout: 20000 });
  const beforeRows = await rows(), beforeWrites = (await evidence()).writes;
  const open = () => page.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true }).click();
  await open();
  const dialog = page.getByRole('dialog', { name: 'Print Color Plate Label' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Project/)).toHaveValue('Cartersville City Hall');
  await expect(dialog.getByLabel(/^Label date/)).toHaveValue('2026-05-08');
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel(/^Chips/)).toBeFocused();
  await dialog.getByLabel(/^Chips/).fill('Custom Blended White Marble');
  await dialog.getByLabel(/^Color Plate number/).fill('T26-256-A');
  await dialog.getByLabel(/^Chip sizes/).fill('NTMA #0, #1, #2 & #3–5');
  await dialog.getByLabel(/^Finish/).fill('200g. w/ TerraGlaze WB Acrylic Sealer');
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await dialog.getByLabel(/^Chips/).fill('Unreasonably long text '.repeat(40));
  await expect(dialog.getByRole('alert')).toContainText('too long');
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeDisabled();
  await dialog.getByLabel(/^Chips/).fill('Custom Blended White Marble');
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  // The only primary-print output is a prepared page, followed immediately by print().
  const popupPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.evaluate(() => window.__labelPrintCalls || 0)).toBe(1);
  await expect(popup.getByRole('img', { name: 'Color Plate label' })).toBeVisible();
  assert.equal(await popup.evaluate(() => window.opener), null);
  const printed = await popup.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(`${dir}/browser-print.pdf`, printed);
  const pdf = await PDFDocument.load(printed); assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 288) < 0.1);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 166.5) < 0.6);
  assert.deepEqual(downloads, [], 'Print must not download a file');
  await popup.close();
  // Cancel/retry and a blocked popup are recoverable without losing label wording.
  await page.evaluate(() => { window.__originalOpen = window.open; window.open = () => null; });
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Allow pop-ups');
  await page.evaluate(() => { window.open = window.__originalOpen; });
  const retryPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  const retry = await retryPromise;
  await expect.poll(() => retry.evaluate(() => window.__labelPrintCalls || 0)).toBe(1);
  await retry.close();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
  await (await downloadPromise).saveAs(`${dir}/browser-fallback.pdf`);
  assert.equal((await PDFDocument.load(readFileSync(`${dir}/browser-fallback.pdf`))).getPageCount(), 1);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(dialog).toBeVisible();
    assert.ok(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), `Dialog overflow at ${width}`);
    await page.screenshot({ path: `${dir}/editor-${width}.png` });
  }
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true })).toBeFocused();
  await open(); await expect(dialog.getByLabel(/^Chips/)).toHaveValue('');
  await expect(dialog.getByLabel(/^Color Plate number/)).toHaveValue('T26-256A');
  await page.keyboard.press('Escape');
  assert.deepEqual(await rows(), beforeRows, 'Label editing/printing must preserve all Sample/formulation/history data');
  assert.deepEqual((await evidence()).writes, beforeWrites, 'Label editing/printing must perform no persistence calls');
  // Unsaved Samples remain preview-only; label date does not establish Sample approval.
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(origin + '/samples');
  await expect(page.getByText('Cartersville City Hall', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'New Sample', exact: false }).click();
  await open();
  await expect(dialog.getByText(/Draft preview/)).toBeVisible();
  const draftValues = { Project: 'New local Sample', 'Color Plate number': 'T26-999-A', 'Label date': '2026-10-13', 'Matrix / color': 'White', Chips: 'White marble', 'Chip sizes': 'NTMA #1', 'Finish / sealer': '200g.' };
  for (const [name, value] of Object.entries(draftValues)) await dialog.getByLabel(new RegExp('^' + name)).fill(value);
  await expect(dialog.getByRole('img', { name: 'Color Plate label' })).toBeVisible();
  await expect(dialog.locator('svg')).toContainText('DRAFT COLOR PLATE');
  await page.keyboard.press('Escape');
  // Save a genuinely new Sample through the released creation RPC on the local database.
  await page.getByLabel('Project Name', { exact: true }).fill('Local label creation check');
  const resinSystem = page.getByRole('combobox', { name: 'Resin System', exact: true });
  const mtt = await resinSystem.locator('option').filter({ hasText: /^MTT/ }).first().getAttribute('value');
  assert.ok(mtt); await resinSystem.selectOption(mtt);
  const createdResponse = page.waitForResponse(r => r.url().includes('/rpc/create_sample_with_formulation'));
  await page.getByRole('button', { name: 'Save Sample', exact: true }).click();
  const created = await createdResponse; assert.equal(created.status(), 200, await created.text());
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeVisible();
  assert.equal((await rows()).length, beforeRows.length + 1);
  await open(); await expect(dialog.getByLabel(/^Project/)).toHaveValue('Local label creation check');
  await expect(dialog.getByText(/Draft preview/)).toBeVisible();
  await expect(dialog.getByLabel(/^Label date/)).toHaveValue('');
  await page.keyboard.press('Escape');
  // Adjacent document action still runs through the established local database/PDF handler.
  await page.goto(fixture.route);
  const response = page.waitForResponse(r => r.url().includes('/functions/v1/generate-sample-pdf') && r.request().postDataJSON()?.action === 'generate');
  await page.getByRole('button', { name: 'Generate Sample Work Order', exact: true }).click();
  assert.equal((await response).status(), 200);
  await expect(page.getByRole('button', { name: 'Close document viewer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close document viewer', exact: true }).click();
  // Unauthorized/inactive sessions never expose the label action or private Sample content.
  const denied = await context.newPage();
  await denied.route('**/rest/v1/rpc/get_my_app_access', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000010', display_name: 'Inactive test', role: 'admin', is_active: false }) }));
  await denied.goto(fixture.route);
  await expect(denied.getByText(/This account is disabled/)).toBeVisible();
  await expect(denied.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true })).toHaveCount(0);
  await expect(denied.getByText('Cartersville City Hall', { exact: false })).toHaveCount(0);
  assert.deepEqual(external, [], 'Review must not contact hosted services');
  assert.deepEqual(errors, []);
  writeFileSync(`${dir}/browser-evidence.json`, JSON.stringify({ origin, fixture: fixture.sampleId, primaryPrintDownloads: 0, labelPersistenceCalls: 0, pdfPages: 1, widths: [1440, 390, 320], externalRequests: external, pageErrors: errors, nativeDialog: 'verified separately with Chrome UI', dymoDriver: 'not connected', physicalPrinting: 'not tested' }, null, 2));
  console.log('PASS actual localhost Sample UI: sources, missing/long fields, standalone print handoff, CSS-sized browser PDF, no primary download, popup retry/block recovery, secondary PDF, mobile, cancel/reset, unchanged Sample/formulation/history and zero label writes, new draft and saved Sample creation, adjacent Work Order generation, inactive access denial, zero external requests.');
} finally { await browser.close(); }
