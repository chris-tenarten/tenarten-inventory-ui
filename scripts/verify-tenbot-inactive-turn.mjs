// UI-only regression: deferred saved-response envelopes, never model inference.
// Every agent endpoint is intercepted; no hosted data or database is accessed.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const origin = 'http://localhost:3000', directory = '/private/tmp/tenops-tenbot-inactive-response-2026-10-29';
const receipt = JSON.parse(readFileSync('docs/project-memory/evidence/2026-10-29-tenbot-live-openai/docker-independent/browser-report.json', 'utf8'));
const saved = action => structuredClone(receipt.responses.find(row => row.action === action && row.status === 200).body);
const ledgerPath = '/private/tmp/tenops-tenbot-agent-poc/openai-budget.json', journal = readFileSync(ledgerPath);
const terminal = 'TenBot finished while TenOps was inactive. Ask again to refresh this answer. No action was approved.';
const marker = 'SYNTHETIC_HIDDEN_RESPONSE_MUST_NOT_RENDER', retryText = 'Synthetic foreground retry completed. No action was performed.';
const checks = [], traces = [], errors = [], unexpectedNetwork = [];
const hash = value => createHash('sha256').update(value).digest('hex');
mkdirSync(directory, {recursive: true});
const browser = await chromium.launch({headless: true});
let lastPage;
try {
  const probe = await browser.newContext();
  try {const response = await probe.request.get(`${origin}/__review/state`, {timeout: 5000}); assert(response.ok()); assert.equal((await response.json()).mode, 'synthetic');} finally {await probe.close();}
  for (const variant of ['blur', 'hidden', 'provider-failure', 'workflow-history', 'workflow-history-mobile']) {
    const workflowHistory=variant.startsWith('workflow-history');
    const context = await browser.newContext({viewport: variant === 'hidden'||variant.endsWith('-mobile') ? {width: 390, height: 844} : {width: 1440, height: 1000}});
    const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(8000);
    const calls = []; let asks = 0, release, observed;
    const gate = new Promise(resolve => {release = resolve;}), pending = new Promise(resolve => {observed = resolve;});
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (['http://localhost:55595', 'http://localhost:55596'].includes(url.origin)) {
        const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'};
        if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers});
        const body = request.postDataJSON(); calls.push(body.action); traces.push({variant, action: body.action});
        if (body.action === 'status') return route.fulfill({headers, json: {...saved('status'), canPrepare: true}});
        if (body.action !== 'ask') return route.fulfill({status: 403, headers, json: {error: 'No automatic refresh or other action is permitted in this UI regression.'}});
        asks++;
        if (asks === 1) {observed(); await gate;}
        if (variant === 'provider-failure') return route.fulfill({status: 503, headers, json: {error: 'Synthetic transport failure.'}});
        const result = saved('ask'); result.message = asks === 1 ? marker : retryText;
        result.conversationId = 'offline-inactive-response';
        result.notices = ['Saved response envelope for UI regression only; no new inference or database request.'];
        if (asks === 1) {
          // Exercise both live guards and ensure no operational/draft payload is
          // published when the response arrives in an inactive conversation.
          if(workflowHistory){
            delete result.operational;result.localDemo.draft=null;result.contentScope='workflow';
            result.agent.evidence=[{id:'e1',tool:'search_workflow_knowledge',data:{sources:[{id:'group',guidance:marker}]}}];
          }else{
            result.operational = {complete: true, observedAt: '2026-10-29T12:00:00Z', truncated: false, facts: [{id: 'fixture-hidden', text: marker}]};
            result.localDemo.draft.rows[0].sourceText = marker;
          }
        } else {delete result.operational; result.localDemo.draft = null;}
        return route.fulfill({headers, json: result});
      }
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      unexpectedNetwork.push({variant, origin: url.origin}); return route.abort();
    });
    try {
      await page.goto(`${origin}/my-work?tenbotExperiment=1`, {waitUntil: 'domcontentloaded'});
      await page.getByRole('button', {name: 'Messaging', exact: true}).click();
      const panel = page.getByRole('dialog', {name: 'Inbox', exact: true});
      await panel.locator('aside').getByRole('button').filter({has: page.getByText('TenBot', {exact: true})}).click();
      const composer = panel.locator('[data-messaging-composer]'), input = composer.getByRole('textbox', {name: 'Message', exact: true});
      await expect.poll(() => calls.includes('status')).toBe(true);
      await input.fill('Investigate this synthetic test request.');
      await composer.getByRole('button', {name: 'Send', exact: true}).click(); await pending;
      await expect(panel.getByText('Working…', {exact: true})).toBeVisible();
      if (variant === 'blur'||workflowHistory) await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (variant === 'hidden') await page.evaluate(() => {Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'}); document.dispatchEvent(new Event('visibilitychange'));});
      release();
      await expect(composer.getByRole('button', {name: 'Attach PDF or image', exact: true})).toBeEnabled();
      await expect(panel.getByText('Working…', {exact: true})).toHaveCount(0);
      if(workflowHistory){
        await expect(panel.getByText(marker,{exact:true})).toBeVisible();
        await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await input.fill('I completed that step. What next?');
        await composer.getByRole('button',{name:'Send',exact:true}).click();
        await expect(panel.getByText(retryText,{exact:true})).toBeVisible();
        await expect(panel.getByText(marker,{exact:true})).toBeVisible();
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
        await expect(panel.getByText(marker,{exact:true})).toBeVisible();
        assert.deepEqual(calls,['status','ask','ask']);
        await page.screenshot({path:`${directory}/${variant}.png`});
        checks.push(`${variant}: server-classified knowledge-only guidance survives background completion, next turn and blur; no automatic inference or operational refresh`);
        continue;
      }
      await expect(panel.getByText(marker, {exact: true})).toHaveCount(0);
      await expect(panel.getByLabel('Editable pending receival draft', {exact: true})).toHaveCount(0);
      if (variant === 'provider-failure') {
        await expect(panel.getByRole('alert')).toContainText('Synthetic transport failure.');
        checks.push('Provider failure ends Working and clears busy without publishing a draft or operational facts');
      } else {
        await expect(panel.getByText(terminal, {exact: true})).toBeVisible();
        if (variant === 'hidden') await page.screenshot({path: `${directory}/mobile-terminal.png`});
        await page.evaluate(() => {Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));});
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(calls, ['status', 'ask'], 'Focus must not automatically retry or refresh a discarded response');
        await input.fill('Investigate this synthetic test request.');
        await composer.getByRole('button', {name: 'Send', exact: true}).click();
        await expect(panel.locator('[data-tenbot-answer]')).toContainText(retryText);
        await expect(panel.getByText('Working…', {exact: true})).toHaveCount(0);
        assert.deepEqual(calls, ['status', 'ask', 'ask']);
        checks.push(`${variant}: deferred response ends in a neutral terminal message, discards hidden facts/draft, makes no focus retry, and accepts explicit foreground Send`);
      }
    } finally {release(); await context.close();}
  }
  assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(unexpectedNetwork.length, 0, JSON.stringify(unexpectedNetwork));
  assert(journal.equals(readFileSync(ledgerPath)), 'Inference ledger changed during UI-only regression');
  const paths = ['src/modules/tenbot/TenbotWorkspace.tsx', 'scripts/verify-tenbot-inactive-turn.mjs'];
  const result = {passed: true, groups: checks.length, checks, traces, errors, unexpectedNetwork, mode: 'Actual localhost desktop/mobile UI; deferred saved response envelopes, no model or database test', inferenceCalls: 0, databaseRequests: 0, operationalWrites: 0, journalUnchanged: true, journalSha256: hash(journal), sourcePins: Object.fromEntries(paths.map(path => [path, hash(readFileSync(path))]))};
  writeFileSync(`${directory}/report.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify({passed: true, groups: checks.length, report: `${directory}/report.json`}));
} catch (error) {
  await lastPage?.screenshot({path: `${directory}/failure.png`}).catch(() => {});
  writeFileSync(`${directory}/failure.json`, JSON.stringify({passed: false, message: error.message, checks, traces, errors, unexpectedNetwork}, null, 2)); throw error;
} finally {await browser.close();}
