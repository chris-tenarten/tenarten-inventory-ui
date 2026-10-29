// Narrow regression for independent QA's eabac4c C14 blur/focus failure.
// Actual localhost Messaging + actual session/SIM handlers; the model transport
// replays the archived Terra response. No inference, hosted database or writes.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tsImport} from 'tsx/esm/api';

const origin = 'http://localhost:3000';
const directory = '/private/tmp/tenops-tenbot-history-lifecycle-2026-10-29';
const fixture = JSON.parse(readFileSync('scripts/fixtures/tenbot-capability-history.synthetic.json', 'utf8'));
const invoice = JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json', 'utf8'));
const {createTenbotLiveDemo} = await tsImport('./support/tenbot-live-demo.mts', import.meta.url);
const {createScriptedTenbotAgentProvider} = await tsImport('./support/tenbot-agent-scripted.mts', import.meta.url);
const ledgerPath = '/private/tmp/tenops-tenbot-agent-poc/openai-budget.json';
const journal = readFileSync(ledgerPath), hash = value => createHash('sha256').update(value).digest('hex');
const checks = [], traces = [], errors = [], unexpectedNetwork = [];
const zeroUsage = () => ({inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costUsd: 0, reservedUsd: 0});
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});
let lastPage;

async function openCase({mobile = false, operational = false} = {}) {
  const test = {calls: [], responses: [], providerSteps: 0, now: Date.now(), allowed: true, ownerOverride: null};
  test.handler = createTenbotLiveDemo({model: 'offline-saved-Terra-C14', catalog: invoice.catalog, receivals: invoice.receivals,
    can: async () => test.allowed, remainingUsd: () => 0, assertNoFatal() {}, now: () => test.now,
    createProvider() {
      if (operational) {
        const provider = createScriptedTenbotAgentProvider('job-investigation');
        return {...provider, async step(request) {test.providerSteps++; return provider.step(request);}};
      }
      let index = 0;
      return {name: 'Offline replay of independent QA Terra C14', model: 'offline-saved-Terra-C14', async step() {
        test.providerSteps++;
        const saved = structuredClone(fixture.modelSteps[index++]); assert(saved, 'Unexpected extra inference step');
        return {...saved, continuation: [], usage: zeroUsage()};
      }};
    }});
  const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1440, height: 1000}});
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
      const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
      if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
      const body = request.postDataJSON(); test.calls.push(structuredClone(body));
      const jwt = request.headers().authorization?.split(' ')[1];
      assert(jwt?.endsWith('.local'), 'Disposable local fixture token required');
      const caller = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url')).sub;
      try {
        const result = await test.handler(body, caller);
        test.responses.push({action: body.action, status: 200, body: structuredClone(result)});
        traces.push({action: body.action, status: 200});
        return route.fulfill({headers, json: result});
      } catch (error) {
        const status = error.status || 500;
        test.responses.push({action: body.action, status, error: error.message});
        traces.push({action: body.action, status});
        return route.fulfill({status, headers, json: {error: error.message}});
      }
    }
    if (url.origin === origin) {
      if (test.ownerOverride && request.isNavigationRequest()) {
        // The existing local review page injects its synthetic account on every
        // experimental-page load. Override only that disposable fixture session
        // after injection to exercise a real owner change in the browser.
        const response = await route.fetch(), contentType = response.headers()['content-type'] || '';
        if (contentType.includes('text/html')) {
          const html = (await response.text()).replace('</head>', `<script>localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(test.ownerOverride))});sessionStorage.setItem(${JSON.stringify(`tenops.welcomeHeroPlayed:${test.ownerOverride.user.id}`)},'true');</script></head>`);
          return route.fulfill({response, body: html});
        }
        return route.fulfill({response});
      }
      return route.continue();
    }
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    unexpectedNetwork.push({origin: url.origin, method: request.method()}); return route.abort();
  });
  test.page = page; test.context = context;
  test.panel = () => page.getByRole('dialog', {name: 'Inbox', exact: true});
  test.answers = () => test.panel().locator('[data-tenbot-answer]');
  test.chooseConversation = async name => {
    const button = test.panel().locator('aside').getByRole('button').filter({has: page.getByText(name, {exact: true})});
    const back = test.panel().getByRole('button', {name: 'Back to conversations', exact: true});
    if (!await button.isVisible() && await back.isVisible()) await back.click();
    await button.click();
  };
  test.leaveConversation = async () => {
    const back = test.panel().getByRole('button', {name: 'Back to conversations', exact: true});
    if (await back.isVisible()) await back.click();
    await test.panel().locator('aside').getByRole('button', {name: 'New message', exact: true}).click();
  };
  test.openConversation = async () => {
    await page.getByRole('button', {name: 'Messaging', exact: true}).click();
    await expect(test.panel()).toBeVisible();
    await test.chooseConversation('TenBot');
    await expect(test.panel().getByRole('textbox', {name: 'Message', exact: true})).toBeEnabled();
    await expect.poll(() => test.calls.filter(call => call.action === 'status').length).toBeGreaterThan(0);
  };
  test.ask = async () => {
    const composer = test.panel().locator('[data-messaging-composer]');
    await composer.getByRole('textbox', {name: 'Message', exact: true}).fill(operational ? 'Investigate TB-2801.' : fixture.question);
    await composer.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(test.answers()).toHaveCount(1);
    return test.answers().textContent();
  };
  test.assertNoNewInference = () => assert.equal(test.calls.filter(call => call.action === 'ask').length, 1, 'Lifecycle changes must not reissue an employee request');
  test.reload = async () => {await page.reload({waitUntil: 'domcontentloaded'}); await test.openConversation();};
  await page.goto(`${origin}/my-work?tenbotExperiment=1`, {waitUntil: 'domcontentloaded'});
  await test.openConversation();
  return test;
}

async function storageIsOpaque(page) {
  const storage = await page.evaluate(() => ({local: {...localStorage}, session: {...sessionStorage}}));
  const serialized = JSON.stringify(storage);
  assert(!serialized.includes(fixture.question), 'Question must not be copied into browser history storage');
  assert(!serialized.includes(fixture.expectedMessage), 'Answer must not be copied into browser history storage');
  assert(!serialized.includes('SIMULATED North Countertops'), 'Job evidence must not be copied into browser history storage');
}

try {
  const probe = await browser.newContext();
  try {const response = await probe.request.get(`${origin}/__review/state`, {timeout: 5000}); assert(response.ok()); assert.equal((await response.json()).mode, 'synthetic');} finally {await probe.close();}
  for (const mobile of [false, true]) {
    const test = await openCase({mobile});
    try {
      assert.equal(await test.ask(), fixture.expectedMessage);
      assert.equal(test.responses.find(row => row.action === 'ask').body.contentScope, 'scope');
      const steps = test.providerSteps;
      await test.page.evaluate(() => {window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus'));});
      await expect(test.answers()).toHaveText(fixture.expectedMessage);
      await test.page.evaluate(() => {Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'}); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'}); document.dispatchEvent(new Event('visibilitychange'));});
      await expect(test.answers()).toHaveText(fixture.expectedMessage);
      await test.panel().getByRole('button', {name: 'Close Inbox', exact: true}).click();
      await test.openConversation(); await expect(test.answers()).toHaveText(fixture.expectedMessage);
      await test.leaveConversation();
      await test.chooseConversation('TenBot');
      await expect(test.answers()).toHaveText(fixture.expectedMessage);
      await test.page.goto(`${origin}/inventory?tenbotExperiment=1`, {waitUntil: 'domcontentloaded'});
      await test.openConversation(); await expect(test.answers()).toHaveText(fixture.expectedMessage);
      await test.page.goto(`${origin}/my-work?tenbotExperiment=1`, {waitUntil: 'domcontentloaded'});
      await test.openConversation(); await expect(test.answers()).toHaveText(fixture.expectedMessage);
      await test.reload(); await expect(test.answers()).toHaveText(fixture.expectedMessage);
      assert(test.responses.some(row => row.action === 'history' && row.status === 200));
      test.assertNoNewInference(); assert.equal(test.providerSteps, steps); await storageIsOpaque(test.page);
      assert(await test.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await test.page.screenshot({path: `${directory}/${mobile ? 'mobile' : 'desktop'}-restored.png`});
      checks.push(`${mobile ? 'Mobile' : 'Desktop'}: archived QA C14 answer survives blur/focus, hidden/visible, Inbox reopen, switching to a new-message composer and back, module navigation and full reload with authorized history and no new inference`);
      await test.panel().getByLabel('TenBot conversation actions', {exact: true}).click();
      await test.panel().getByRole('button', {name: 'Clear assistant chat', exact: true}).click();
      await expect(test.answers()).toHaveCount(0); await test.reload(); await expect(test.answers()).toHaveCount(0);
      test.assertNoNewInference(); assert.equal(test.providerSteps, steps);
      checks.push(`${mobile ? 'Mobile' : 'Desktop'}: explicit Clear removes the server session and remount pointer without rehydrating cleared text`);
    } finally {await test.context.close();}
  }
  for (const mode of ['revoked', 'expired', 'owner-changed', 'operational']) {
    const test = await openCase({operational: mode === 'operational'});
    try {
      await test.ask(); const steps = test.providerSteps;
      if (mode === 'revoked') test.allowed = false;
      if (mode === 'expired') test.now += 9 * 60 * 60 * 1000;
      if (mode === 'owner-changed') {
        test.ownerOverride = await test.page.evaluate(() => JSON.parse(localStorage.getItem('sb-localhost-auth-token')));
        const nextOwner = '90000000-0000-4000-8000-000000000099';
        const pieces = test.ownerOverride.access_token.split('.'), claims = JSON.parse(Buffer.from(pieces[1], 'base64url'));
        claims.sub = nextOwner; pieces[1] = Buffer.from(JSON.stringify(claims)).toString('base64url');
        test.ownerOverride.access_token = pieces.join('.'); test.ownerOverride.user.id = nextOwner;
      }
      if (mode === 'operational') {
        await test.page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(test.answers()).toHaveCount(0);
      }
      await test.reload();
      if (mode === 'revoked') await expect.poll(() => test.responses.some(row => ['status', 'history'].includes(row.action) && row.status === 403)).toBe(true);
      if (mode === 'expired') await expect.poll(() => test.responses.some(row => row.action === 'history' && row.status === 403)).toBe(true);
      if (mode === 'operational') await expect.poll(() => test.responses.some(row => row.action === 'history' && row.status === 200 && row.body.turns.length === 0)).toBe(true);
      await expect(test.answers()).toHaveCount(0); test.assertNoNewInference(); assert.equal(test.providerSteps, steps); await storageIsOpaque(test.page);
      checks.push(`${mode}: no completed text is restored or re-inferred; live Job evidence is never returned from display history`);
    } finally {await test.context.close();}
  }
  assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(unexpectedNetwork.length, 0, JSON.stringify(unexpectedNetwork));
  assert(journal.equals(readFileSync(ledgerPath)), 'Inference ledger changed during offline lifecycle regression');
  const paths = ['src/modules/tenbot/TenbotWorkspace.tsx', 'src/modules/tenbot/conversation-history.ts', 'supabase/functions/_shared/tenbot-agent-session.ts', 'scripts/support/tenbot-live-demo.mts', 'scripts/verify-tenbot-history-lifecycle.mjs', 'scripts/fixtures/tenbot-capability-history.synthetic.json'];
  const result = {passed: true, groups: checks.length, checks, traces, errors, unexpectedNetwork, mode: 'Actual localhost desktop/mobile UI and session/SIM handlers; archived QA Terra transport replay, no fresh inference or database validation', inferenceCalls: 0, operationalWrites: 0, journalUnchanged: true, journalSha256: hash(journal), sourcePins: Object.fromEntries(paths.map(path => [path, hash(readFileSync(path))]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed: true, groups: checks.length, report: `${directory}/report.json`}));
} catch (error) {
  await lastPage?.screenshot({path: `${directory}/failure.png`}).catch(() => {});
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error.message, checks, traces, errors, unexpectedNetwork}, null, 2)); throw error;
} finally {await browser.close();}
