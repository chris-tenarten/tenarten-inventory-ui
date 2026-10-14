// Focused first-use hint checks against the actual local app; no printer/PDF suite.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const origin = 'http://localhost:3000', key = 'tenops.colorPlateLabel.printSetupDismissed.v1';
const browser = await chromium.launch();
const checks = [], external = [];
const output = 'output/dymo-print-qol'; mkdirSync(output, { recursive: true });
try {
 const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
 await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) { external.push(url.origin); return route.abort(); }
  return route.continue();
 });
 const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
 const route = origin + '/samples?open=00000000-0000-0000-0000-000000000056';
 const open = async () => {
  await page.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Print Color Plate Label' })).toBeVisible();
 };
 const hint = page.getByRole('complementary', { name: 'Printer setup tip' });
 await page.goto(route);
 await expect(hint).toHaveCount(0); checks.push('No global printer instruction outside label review');
 await open();
 await expect(hint).toHaveText(/Select DYMO LabelWriter 550 and label size 30256 the first time you print./);
 const dialog = page.getByRole('dialog', { name: 'Print Color Plate Label' });
 await dialog.getByLabel(/^Chips \(/).fill('Custom Blended White Marble');
 await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
 checks.push('First authorized label review shows exact contextual hint; Print remains available without dismissing');
 await page.screenshot({ path: output + '/first-use.png' });
 await dialog.getByRole('button', { name: 'Dismiss printer setup tip' }).click();
 await expect(hint).toHaveCount(0);
 assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '1');
 await dialog.getByRole('button', { name: 'Close label editor' }).click(); await open();
 await expect(hint).toHaveCount(0); await page.reload(); await open(); await expect(hint).toHaveCount(0);
 checks.push('Dismissal persists across editor reopen and page reload');
 const storage = await context.storageState(); await context.close();
 const reopened = await browser.newContext({ storageState: storage, viewport: { width: 390, height: 844 } });
 const mobile = await reopened.newPage();
 await mobile.goto(route); await mobile.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true }).click();
 await expect(mobile.getByRole('dialog', { name: 'Print Color Plate Label' })).toBeVisible();
 await expect(mobile.getByRole('complementary', { name: 'Printer setup tip' })).toHaveCount(0);
 checks.push('Saved browser preference survives context recreation (simulated restart, not native Chrome/driver retention)');
 await mobile.evaluate(key => localStorage.removeItem(key), key); await mobile.reload();
 await mobile.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true }).click();
 await expect(mobile.getByRole('complementary', { name: 'Printer setup tip' })).toBeVisible();
 const bounds = await mobile.getByRole('dialog', { name: 'Print Color Plate Label' }).boundingBox(); assert(bounds.width <= 390);
 await mobile.getByRole('complementary', { name: 'Printer setup tip' }).scrollIntoViewIfNeeded();
 await mobile.screenshot({ path: output + '/narrow.png' }); checks.push('First-use tip fits narrow editor without a new dialog');
 await reopened.close();
 const blocked = await browser.newContext();
 await blocked.addInitScript(key => {
  const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
  Storage.prototype.getItem = function(name) { if (name === key) throw new DOMException('Blocked', 'SecurityError'); return get.call(this, name); };
  Storage.prototype.setItem = function(name, value) { if (name === key) throw new DOMException('Blocked', 'SecurityError'); return set.call(this, name, value); };
 }, key);
 const fallback = await blocked.newPage(); fallback.on('pageerror', error => errors.push(error.message));
 await fallback.goto(route); await fallback.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true }).click();
 const fallbackDialog = fallback.getByRole('dialog', { name: 'Print Color Plate Label' });
 await expect(fallback.getByRole('complementary', { name: 'Printer setup tip' })).toBeVisible();
 await fallbackDialog.getByRole('button', { name: 'Dismiss printer setup tip' }).click();
 await expect(fallback.getByRole('complementary', { name: 'Printer setup tip' })).toHaveCount(0);
 await fallbackDialog.getByLabel(/^Chips \(/).fill('Custom Blended White Marble');
 await expect(fallbackDialog.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
 checks.push('Blocked preference storage still allows dismissal and label preparation');
 assert.deepEqual(errors, []); assert.deepEqual(external, []);
 // Preservation checks reuse completed label evidence; no document or native print rerun.
 const renderer = readFileSync('src/modules/samples/color-plate-label.ts', 'utf8');
 assert(renderer.includes('LABEL_WIDTH = 288') && renderer.includes('LABEL_HEIGHT = 166.5') && renderer.includes('@page{size:4in 2.3125in;margin:0}'));
 writeFileSync('docs/project-memory/evidence/2026-10-14-dymo-print-qol.json', JSON.stringify({ checks, errors, external, sourceSizePreserved: true, hardwareResult: 'Not tested here; Chris reports Anthony successfully printed the released label on Windows; retention remains unverified', browserMode: 'Headless Chromium; synthetic read-only granted local fixture; no print invocation or printer settings changes' }, null, 2) + '\n');
 console.log(JSON.stringify({ passed: checks.length, checks }));
} finally { await browser.close(); }
