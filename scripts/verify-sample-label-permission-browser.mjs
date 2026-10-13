// Focused permission transitions/output guards only. No PDF geometry or printing suite.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const cfg = JSON.parse(readFileSync('.tmp-label-permission-validation/config.json'));
const browser = await chromium.launch();
const results = [], errors = [], downloads = [], printCalls = [];
const dir = 'output/label-permission'; mkdirSync(dir, { recursive: true });
let admin, member;
try {
 const contexts = await Promise.all([browser.newContext({ viewport: { width: 1440, height: 1100 } }), browser.newContext({ viewport: { width: 1440, height: 1100 } })]);
 for (const ctx of contexts) {
  await ctx.route('**/*', route => { const url = new URL(route.request().url()); if (['http:', 'https:'].includes(url.protocol) && url.origin !== cfg.appOrigin) throw new Error('Unexpected external request'); return route.continue(); });
  await ctx.exposeFunction('permissionTestPrint', () => printCalls.push('unexpected-print'));
  await ctx.addInitScript(() => { window.print = () => window.permissionTestPrint(); });
  ctx.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.on('download', download => downloads.push(download.suggestedFilename())); });
 }
 [admin, member] = await Promise.all(contexts.map(ctx => ctx.newPage()));
 async function login(page, name) {
  await page.goto(cfg.appOrigin + '/settings');
  await page.getByLabel('Email', { exact: true }).first().fill(cfg.actors[name].email);
  await page.getByLabel('Password', { exact: true }).first().fill(cfg.actors[name].password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Sign out of account' })).toBeVisible({ timeout: 20000 });
 }
 await login(admin, 'admin'); await login(member, 'member');
 const identity = page => page.evaluate(() => { const session = JSON.parse(localStorage.getItem('sb-localhost-auth-token')); return { id: session.user.id, token: session.access_token }; });
 const before = await identity(member);
 const permissions = admin.getByRole('group', { name: 'Roles & Permissions for Label Permission member', exact: true });
 const checkbox = permissions.getByLabel('Generate Color Plate Labels', { exact: true });
 await expect(checkbox).not.toBeChecked();
 await expect(permissions.getByLabel('Allow Production Blend planning')).not.toBeChecked();
 const adminCheck = admin.getByRole('group', { name: 'Roles & Permissions for Label Permission admin', exact: true }).getByLabel(/Generate Color Plate Labels/);
 await expect(adminCheck).toBeChecked(); await expect(adminCheck).toBeDisabled();
 results.push('Admin inherent checkbox and Member independent checkbox verified');
 async function grant(value) {
  await checkbox.setChecked(value);
  const response = admin.waitForResponse(r => r.url().endsWith('/functions/v1/admin-manage-users') && r.request().postDataJSON()?.action === 'update');
  await permissions.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
  assert.equal((await response).status(), 200);
  await expect(checkbox).toBeEnabled();
  await expect(permissions.getByLabel('Allow Production Blend planning')).not.toBeChecked();
 }
 const route = cfg.appOrigin + '/samples?open=' + cfg.sampleId;
 const action = member.getByRole('button', { name: 'PRINT COLOR PLATE LABEL', exact: true });
 await member.goto(route);
 await expect(member.getByRole('button', { name: 'Generate Sample Work Order', exact: true })).toBeVisible({ timeout: 20000 });
 await expect(action).toHaveCount(0);
 results.push('OFF direct Sample route retains existing generator, hides label action');
 await grant(true); await member.reload(); await expect(action).toBeVisible({ timeout: 20000 });
 assert.deepEqual(await identity(member), before);
 results.push('OFF→ON actual Admin checkbox grant, Member refresh, same real session');
 async function openLabel() {
  await action.click(); const dialog = member.getByRole('dialog', { name: 'Print Color Plate Label' });
  await expect(dialog.getByLabel(/^Chips \(/)).toBeVisible();
  await dialog.getByLabel(/^Chips \(/).fill('Custom Blended White Marble');
  // Keep this focused on authorized generation; reuse accepted wording without layout tests.
  await dialog.getByLabel(/^Chip sizes/).fill('NTMA #0, #1, #2 & #3-5');
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeEnabled({ timeout: 20000 });
  return dialog;
 }
 let dialog = await openLabel(); results.push('Authorized Member preview generation succeeds');
 await member.screenshot({ path: dir + '/granted.png' });
 await grant(false);
 // The open tab still has its granted profile: output must consult current DB state.
 await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
 await expect(action).toHaveCount(0, { timeout: 20000 });
 assert.deepEqual(downloads, []); assert.deepEqual(await identity(member), before);
 results.push('ON→OFF stale open editor download denied, action disappears, no sign-out');
 // Reopen transitions and independently exercise print and generation guards.
 for (const operation of ['print', 'generation']) {
  await grant(true); await member.goto(cfg.appOrigin + '/samples'); await member.goto(route);
  await expect(action).toBeVisible({ timeout: 20000 }); dialog = await openLabel();
  await grant(false);
  if (operation === 'print') {
   const popupPromise = member.waitForEvent('popup');
   await dialog.getByRole('button', { name: 'Print', exact: true }).click();
   const popup = await popupPromise; await expect.poll(() => popup.isClosed()).toBe(true);
  } else await dialog.getByLabel(/^Chips \(/).fill('Edited after revoke');
  await expect(action).toHaveCount(0, { timeout: 20000 });
  assert.deepEqual(await identity(member), before);
  results.push('Revoked stale editor ' + operation + ' denied; reopen grant uses same session');
 }
 await member.reload(); await expect(action).toHaveCount(0);
 await expect(member.getByRole('button', { name: 'Generate Sample Work Order', exact: true })).toBeVisible();
 assert.deepEqual(downloads, []); assert.deepEqual(printCalls, []); assert.deepEqual(errors, []);
 await member.screenshot({ path: dir + '/revoked.png' });
 results.push('Revoked refresh preserves Sample generator; no output or page errors');
 writeFileSync('docs/project-memory/evidence/2026-10-13-label-permission-browser.json', JSON.stringify({ timestamp: new Date().toISOString(), environment: cfg.project, realSeparateContexts: true, sessionUnchanged: true, checks: results, downloads, printCalls, errors }, null, 2) + '\n');
 console.log(JSON.stringify({ passed: results.length, checks: results }, null, 2));
} catch (error) { if (member) { await member.screenshot({ path: dir + '/failure.png' }); writeFileSync(dir + '/failure.txt', await member.locator('body').innerText()); } throw error; }
finally { await browser.close(); }
