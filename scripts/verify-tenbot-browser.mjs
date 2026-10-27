import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';

const origin = 'http://localhost:3000';
const endpoint = 'http://localhost:55593/';
const output = '/private/tmp/tenops-tenbot-review';
const fixture = JSON.parse(readFileSync('/private/tmp/tenops-intake-materials-review/server.json', 'utf8'));
mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const errors = [], requests = [], asks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.url() === endpoint && request.method() === 'POST') {
    const body = request.postDataJSON();
    if (body.action === 'ask') asks.push(body);
  }
});
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (['blob:', 'data:'].includes(url.protocol) || [origin, 'http://localhost:55593'].includes(url.origin)) {
    requests.push(url.origin);
    return route.continue();
  }
  return route.abort('blockedbyclient');
});

const panel = page.getByRole('dialog', {name: 'TenBot assistant', exact: true});
const workspace = panel.getByRole('region', {name: 'TenBot workspace', exact: true});
const input = workspace.getByLabel('Your question', {exact: true});
const conversation = workspace.getByRole('log', {name: 'TenBot conversation', exact: true});
const checked = [];

async function openAssistant() {
  // Only the launcher is visible while the workspace is minimized.
  await page.getByRole('button', {name: 'Ask TenBot', exact: true}).click();
  await expect(panel).toBeVisible();
  assert.notEqual(await panel.getAttribute('aria-modal'), 'true', 'The assistant must remain nonmodal');
}

async function ask(question, module) {
  await input.fill(question);
  const before = asks.length;
  await workspace.getByRole('button', {name: 'Ask TenBot', exact: true}).click();
  await expect(conversation.getByText(question, {exact: true})).toBeVisible();
  await expect(workspace.getByRole('button', {name: 'Working…', exact: true})).toHaveCount(0);
  await expect(conversation.getByText(/Deployed knowledge:/).last()).toBeVisible();
  assert.equal(asks.length, before + 1);
  const request = asks.at(-1);
  assert.equal(request.context[0], `Current module: ${module}`);
  assert(request.context.length <= 2, 'Context stays within the existing bounded question contract');
  assert(!JSON.stringify(request).includes(fixture.sample), 'The assistant must not receive private route identifiers');
  assert(!JSON.stringify(request.context).includes('reviewRecord'), 'The assistant must not receive query parameters');
}

async function assertContained(locator, bottom = 1000) {
  const box = await locator.boundingBox();
  assert(box, 'The assistant must have a visible box');
  assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= bottom + 1,
    `Assistant must fit within the usable viewport: ${JSON.stringify(box)}, bottom ${bottom}`);
}

try {
  // Start inside another module with an opaque query value. Module guidance may
  // identify My Work, but neither the query nor its identifier is assistant input.
  await page.goto(`${origin}/my-work?reviewRecord=${fixture.sample}`);
  await page.waitForLoadState('networkidle');
  await expect(panel).toBeHidden();
  await openAssistant();
  await expect(workspace.getByText('Current module: My Work', {exact: true})).toBeVisible();
  await assertContained(panel);
  await ask('How do I create a group conversation?', 'My Work');
  await expect(conversation.getByText(/Choose New group, enter a group name/)).toBeVisible();
  await expect(conversation.getByRole('link', {name: 'Open My Work'})).toHaveAttribute('href', '/my-work');
  await expect(conversation.getByText(/not an AI-generated answer/)).toBeVisible();
  await conversation.getByText('How do I create a group conversation?', {exact: true}).scrollIntoViewIfNeeded();
  await page.screenshot({path: `${output}/desktop-floating-guide.png`});
  checked.push('persistent launcher on My Work', 'nonmodal desktop panel containment', 'guide provenance and released workflow', 'allowlisted module context without query or record identifier');

  await ask('Can I add someone to an existing personal DM?', 'My Work');
  await expect(conversation.getByText(/cannot add a third person/)).toBeVisible();
  await ask('Can I estimate material lead times from a blend sheet?', 'My Work');
  await expect(conversation.getByText('Local · unreleased', {exact: true})).toBeVisible();
  await ask('How do I enable notifications on my phone?', 'My Work');
  await expect(conversation.getByText(/Add to Home Screen/)).toBeVisible();
  await ask('Can I set a recurring task?', 'My Work');
  await expect(conversation.getByText(/cannot verify recurring tasks/)).toBeVisible();

  await workspace.getByRole('button', {name: 'Draft a feature suggestion', exact: true}).click();
  const draft = workspace.getByRole('form', {name: 'Feature suggestion draft'});
  await expect(draft).toBeVisible();
  await expect(draft.getByRole('button', {name: 'Submit suggestion'})).toBeDisabled();
  await expect(draft.getByLabel('Affected module')).toHaveValue('My Work');
  const problem = `Local floating review ${Date.now()}: repeat weekly entry`;
  await draft.getByLabel('Current workflow or problem').fill(problem);
  await draft.getByLabel('Desired behavior').fill('Repeat a task every Monday');
  await draft.getByLabel('Employee-written summary').fill('Weekly task recurrence requested; local fixture');
  await input.fill('Keep this unfinished question');
  await panel.getByRole('button', {name: 'Minimize TenBot', exact: true}).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', {name: 'Ask TenBot', exact: true})).toBeVisible();
  await openAssistant();
  await expect(input).toHaveValue('Keep this unfinished question');
  await expect(draft.getByLabel('Current workflow or problem')).toHaveValue(problem);
  await expect(draft.getByRole('checkbox')).not.toBeChecked();
  await expect(conversation.getByText('Can I set a recurring task?', {exact: true})).toBeVisible();
  checked.push('chat, unfinished question and unconfirmed draft survive minimize/reopen');

  // Actual Next Link navigation, with the assistant open, must keep local state.
  await conversation.getByRole('link', {name: 'Open Settings', exact: true}).click();
  await expect(page).toHaveURL(`${origin}/settings`);
  await expect(panel).toBeVisible();
  await expect(workspace.getByText('Current module: Settings', {exact: true})).toBeVisible();
  await expect(input).toHaveValue('Keep this unfinished question');
  await expect(draft.getByLabel('Current workflow or problem')).toHaveValue(problem);
  await expect(draft.getByLabel('Affected module')).toHaveValue('My Work');
  // The normal shell navigation remains clickable while the panel is open.
  await page.getByRole('navigation', {name: 'Primary navigation'}).getByRole('link', {name: 'My Work', exact: true}).click();
  await expect(page).toHaveURL(url => url.origin === origin && url.pathname === '/my-work');
  await expect(panel).toBeVisible();
  await expect(workspace.getByText('Current module: My Work', {exact: true})).toBeVisible();
  await expect(draft.getByLabel('Current workflow or problem')).toHaveValue(problem);
  await page.mouse.move(50, 200);
  await draft.getByRole('heading', {name: 'Review your suggestion'}).scrollIntoViewIfNeeded();
  await page.screenshot({path: `${output}/desktop-floating-draft.png`, animations: 'disabled'});
  checked.push('conversation and draft survive real Next Link route changes', 'underlying desktop shell navigation usable with panel open');

  await draft.getByRole('checkbox').check();
  await draft.getByRole('button', {name: 'Submit suggestion'}).click();
  await expect(workspace.getByRole('status')).toContainText('Suggestion submitted');
  await workspace.getByRole('button', {name: 'Product feedback', exact: true}).click();
  const inbox = workspace.getByRole('region', {name: 'Product feedback inbox'});
  await expect(inbox.getByText(problem, {exact: false})).toBeVisible();
  const item = inbox.locator('article').filter({hasText: problem}).first();
  await item.getByLabel('Review note').fill('Local floating candidate review only');
  await item.getByRole('button', {name: 'Mark Under Consideration', exact: true}).click();
  await expect(item.getByText(/My Work · Under Consideration/)).toBeVisible();
  await item.getByText('Request history', {exact: true}).click();
  await expect(item.locator('details').getByText(/Local floating candidate review only/)).toBeVisible();
  await item.getByRole('heading').scrollIntoViewIfNeeded();
  await page.screenshot({path: `${output}/desktop-feedback.png`});
  await page.reload();
  await openAssistant();
  await workspace.getByRole('button', {name: 'Product feedback', exact: true}).click();
  await expect(inbox.locator('article').filter({hasText: problem}).getByText(/My Work · Under Consideration/)).toBeVisible();
  checked.push('explicit draft confirmation', 'administrator feedback submission, status, history and reload persistence');

  await workspace.getByRole('button', {name: 'Guide', exact: true}).click();
  await page.setViewportSize({width: 390, height: 844});
  await ask('How do I enable notifications on my phone?', 'My Work');
  await expect(conversation.getByText(/Add to Home Screen/)).toBeVisible();
  await expect(conversation.getByRole('link', {name: 'Open Settings'})).toHaveAttribute('href', '/settings');
  const mobileNav = page.getByRole('navigation', {name: 'Mobile navigation'});
  await expect(mobileNav).toBeVisible();
  let navBox = await mobileNav.boundingBox();
  await assertContained(panel, navBox.y);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal mobile page overflow');
  await mobileNav.getByRole('button', {name: 'More', exact: true}).click();
  const more = page.getByRole('dialog', {name: 'More destinations', exact: true});
  await expect(more).toBeVisible();
  await more.getByRole('link', {name: 'Settings', exact: true}).click();
  await expect(page).toHaveURL(`${origin}/settings`);
  await expect(more).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(workspace.getByText('Current module: Settings', {exact: true})).toBeVisible();
  await mobileNav.getByRole('link', {name: 'Jobs', exact: true}).click();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(panel).toBeVisible();
  await expect(workspace.getByText('Current module: Production', {exact: true})).toBeVisible();
  await expect(conversation.getByText('How do I enable notifications on my phone?', {exact: true})).toBeVisible();
  await mobileNav.getByRole('link', {name: 'My Work', exact: true}).click();
  await expect(page).toHaveURL(url => url.origin === origin && url.pathname === '/my-work');
  await panel.getByRole('button', {name: 'Minimize TenBot', exact: true}).click();
  const launcherBox = await page.getByRole('button', {name: 'Ask TenBot', exact: true}).boundingBox();
  navBox = await mobileNav.boundingBox();
  assert(launcherBox && launcherBox.y + launcherBox.height <= navBox.y, 'The compact launcher must clear mobile navigation');
  await openAssistant();
  await input.focus();
  await input.scrollIntoViewIfNeeded();
  const inputBox = await input.boundingBox();
  assert(inputBox && inputBox.y + inputBox.height < navBox.y, 'Focused question must clear bottom navigation');
  await conversation.getByText('How do I enable notifications on my phone?', {exact: true}).scrollIntoViewIfNeeded();
  await page.screenshot({path: `${output}/mobile-guide.png`});
  checked.push('mobile launcher and sheet above navigation', 'mobile Jobs/My Work/More navigation usable with sheet open', 'conversation retained through mobile route changes', 'mobile viewport containment and focused input clearance');

  // Chromium desktop automation cannot open an iPhone keyboard. Exercise the
  // VisualViewport resize event with a reduced usable height, then restore it.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', {configurable: true, value: 500});
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const box = await input.boundingBox();
    return box && box.y >= 0 && box.y + box.height <= 501;
  }, {message: 'Focused question must remain inside a reduced keyboard viewport'}).toBe(true);
  await assertContained(panel, 500);
  await page.screenshot({path: `${output}/mobile-keyboard-viewport.png`});
  await page.evaluate(() => {
    delete window.visualViewport.height;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  checked.push('simulated VisualViewport keyboard resize (physical keyboard acceptance remains manual)');

  // Explicit failure state through bounded transport failure, not model quality.
  await page.route(endpoint, route => route.fulfill({status: 429, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': origin}, body: JSON.stringify({error: 'TenBot monthly budget exhausted.'})}));
  await input.fill('group');
  await workspace.getByRole('button', {name: 'Ask TenBot', exact: true}).click();
  await expect(workspace.getByRole('alert')).toContainText('budget exhausted');
  await page.unroute(endpoint);
  await page.reload();
  await openAssistant();
  await expect(conversation).not.toContainText('Add to Home Screen');
  checked.push('budget failure UI', 'conversation remains memory-only across full reload');

  // The legacy URL opens the same shell assistant, rather than a second workspace.
  await page.goto(`${origin}/tenbot`);
  await expect(panel).toBeVisible();
  await expect(page.getByRole('region', {name: 'TenBot workspace', exact: true})).toHaveCount(1);
  checked.push('legacy /tenbot opens the shared assistant');

  // Retained adjacent local library/document smoke; no hosted writes or suites.
  await page.goto(`${origin}/samples`);
  await expect(page.getByText('Local formulation', {exact: false}).first()).toBeVisible();
  const before = await (await fetch(`${origin}/review/evidence`)).json();
  const generated = before.writes.filter(write => write.name === 'sample-pdf-rendered').length;
  await page.goto(`${origin}/samples?open=${fixture.sample}`);
  await page.getByRole('button', {name: 'Generate Sample Work Order', exact: true}).click();
  await expect.poll(async () => {
    const after = await (await fetch(`${origin}/review/evidence`)).json();
    return after.writes.filter(write => write.name === 'sample-pdf-rendered').length;
  }).toBeGreaterThan(generated);
  checked.push('existing Sample library', 'existing Sample document generation');
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/browser-results.json`, JSON.stringify({passed: true, origin, errors, networkOrigins: [...new Set(requests)], checked}, null, 2));
  console.log('TenBot floating desktop/mobile browser workflows passed at exact localhost:3000.');
} catch (error) {
  await page.screenshot({path: `${output}/failure.png`, fullPage: true}).catch(() => {});
  writeFileSync(`${output}/failure.txt`, `${await page.locator('body').innerText()}\n${error.stack}`);
  throw error;
} finally {
  await browser.close();
}
