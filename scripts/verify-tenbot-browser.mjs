import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';

if (process.argv.includes('--communication-only') || process.argv.length === 2) {
  await verifyCommunication();
  process.exit(0);
}

// The actual application bundle, with the existing localhost auth/data fixture.
// Messaging uses the established groups fixture's row shapes; TenBot responses
// replay captured real evaluations. No request in this branch reaches inference.
async function verifyCommunication() {
  const origin = 'http://localhost:3000';
  const directory = '/private/tmp/tenops-tenbot-review/communication';
  const evaluation = JSON.parse(readFileSync(`${directory}/evaluation.json`, 'utf8'));
  const outputs = evaluation.outputs.filter(item => ['ai', 'verified', 'guide'].includes(item.answer?.mode));
  assert(outputs.length >= 2, 'Captured candidate answers are required');
  const group = outputs.find(item => item.answer.sources.some(source => source.id === 'group'));
  const navigation = outputs.find(item => item.answer.sources.some(source => source.route === '/contacts' || source.route === '/settings'));
  const unavailable = outputs.find(item => item.answer.sources.some(source => source.id === 'material-lead'));
  const manpowerQuestion = 'how do i filter by jobs in manpower reporting';
  const manpower = outputs.find(item => item.question === manpowerQuestion);
  assert(group && navigation && unavailable, 'Capture must include a supported workflow, another module link and unreleased Intake capability');
  assert(manpower && manpower.answer.mode === 'verified' && !manpower.answer.sources.length, 'Captured Manpower regression must have no verified guide source or model prose');
  assert.equal(group.answer.mode, 'ai', 'Supported workflow replay must come from a real conversational inference');
  assert.equal(navigation.answer.mode, 'ai', 'Supported navigation replay must come from a real conversational inference');
  mkdirSync(directory, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const checked = [], requestEvidence = [], errors = [];
  const user = '00000000-0000-0000-0000-000000000010';
  const bob = '00000000-0000-4000-8000-000000900022';
  const carol = '00000000-0000-4000-8000-000000900023';
  const groupId = '00000000-0000-4000-8000-000000930000';
  const stamp = '2026-10-15T00:00:00Z';
  const privateBody = 'Synthetic private message sentinel — never assistant context';
  const peers = [{userId: bob, name: 'Draft Review Bob', role: 'member'}, {userId: carol, name: 'Draft Review Carol', role: 'member'}];
  const initialMessages = [
    {id: '00000000-0000-4000-8000-000000910000', sender_user_id: bob, sender_name: peers[0].name, recipient_user_id: user, body: privateBody},
    {id: '00000000-0000-4000-8000-000000910001', sender_user_id: carol, sender_name: peers[1].name, group_id: groupId, recipient_user_id: null, body: 'Synthetic existing group message'},
  ].map(message => ({...message, created_at: stamp, read_at: null, attachments: []}));
  const sensitive = calls => calls.filter(call => /^(list_my_work_message_page|mark_my_work_conversation_read|send_my_work_message|save_my_work_message_group|begin_my_work_attachment)/.test(call.name));

  try {
    for (const admin of [true, false]) {
      const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
      const calls = [], assistantCalls = [], messages = structuredClone(initialMessages), blocked = [], realtime = [];
      let answer = group.answer;
      await context.routeWebSocket('**/realtime/v1/websocket*', socket => {
        socket.onMessage(raw => {
          // The installed Supabase serializer sends client broadcasts as kind-3
          // binary frames: six length/encoding bytes, then refs/topic/event/meta.
          if (Buffer.isBuffer(raw) && raw[0] === 3) {
            const topicOffset = 7 + raw[1] + raw[2];
            const payloadOffset = topicOffset + raw[3] + raw[4] + raw[5];
            const payload = raw[6] === 1 ? JSON.parse(raw.subarray(payloadOffset).toString()) : {};
            realtime.push({topic: raw.subarray(topicOffset, topicOffset + raw[3]).toString(), event: 'broadcast', typing: payload.typing === true});
            return;
          }
          const frame = JSON.parse(String(raw));
          const message = Array.isArray(frame) ? {join_ref: frame[0], ref: frame[1], topic: frame[2], event: frame[3], payload: frame[4]} : frame;
          // Retain only activity metadata, never auth tokens or message bodies.
          realtime.push({topic: message.topic, event: message.event, typing: message.payload?.payload?.typing === true});
          if (!['phx_join', 'heartbeat', 'phx_leave'].includes(message.event)) return;
          const reply = {...message, event: 'phx_reply', payload: {status: 'ok', response: {postgres_changes: []}}};
          socket.send(JSON.stringify(Array.isArray(frame) ? [reply.join_ref, reply.ref, reply.topic, reply.event, reply.payload] : reply));
        });
      });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['blob:', 'data:'].includes(url.protocol) && ![origin, 'http://localhost:55593'].includes(url.origin)) {
          blocked.push(url.origin);
          return route.abort('blockedbyclient');
        }
        const fulfill = value => route.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': origin}, body: JSON.stringify(value)});
        if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'}});
        if (url.origin === 'http://localhost:55593') {
          assert.equal(request.method(), 'POST');
          const body = request.postDataJSON(); assistantCalls.push(body);
          if (body.action === 'ask') return fulfill(answer);
          if (body.action === 'draft') return fulfill({...group.answer, summary: null});
          if (body.action === 'usage') return fulfill({usage: {sharedDayUsed: 8, sharedDayLimit: 20, sharedDayRemaining: 12, perAccountMinuteLimit: 6, monthReservedUsd: 0.08, monthlyBudgetUsd: 0.2}});
          if (body.action === 'list') return fulfill({items: []});
          throw new Error(`Unexpected assistant action: ${body.action}`);
        }
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const name = url.pathname.split('/').at(-1);
          const body = request.postDataJSON(); calls.push({name, body});
          if (!admin && name === 'get_my_app_access') return fulfill([{user_id: user, display_name: 'Local developer fixture', role: 'developer', is_active: true, read_only: false, messaging_write: true}]);
          if (name === 'list_my_work_conversations_v12') return fulfill([...peers, {userId: groupId, groupId, name: 'Existing shop group', role: 'Group', creatorUserId: user, memberIds: [user, bob, carol]}].map(peer => {
            const rows = messages.filter(message => message.group_id ? message.group_id === peer.userId : message.sender_user_id === peer.userId || message.recipient_user_id === peer.userId);
            const latest = rows.at(-1);
            return {...peer, unread: rows.filter(message => message.sender_user_id !== user && !message.read_at).length, latest: {id: latest?.id || peer.userId, createdAt: latest?.created_at || stamp, body: latest?.body || 'No messages yet'}};
          }));
          if (name === 'list_my_work_inbox_recipients') return fulfill(peers.map(peer => ({user_id: peer.userId, display_name: peer.name, role: peer.role})));
          if (name === 'list_my_work_message_page_v12') return fulfill(messages.filter(message => (message.group_id ? message.group_id === body.p_peer : message.sender_user_id === body.p_peer || message.recipient_user_id === body.p_peer) && (!body.p_ids || body.p_ids.includes(message.id))));
          if (name === 'mark_my_work_conversation_read_v12') {
            for (const message of messages) if (body.p_ids.includes(message.id)) message.read_at = stamp;
            return fulfill(null);
          }
          if (name === 'send_my_work_message_v12') {
            const id = `00000000-0000-4000-8000-${String(920000 + messages.length).padStart(12, '0')}`;
            messages.push({id, sender_user_id: user, sender_name: 'Local Admin', recipient_user_id: body.p_peer === groupId ? null : body.p_peer, group_id: body.p_peer === groupId ? groupId : null, body: body.p_body, created_at: new Date().toISOString(), read_at: stamp, attachments: []});
            return fulfill(id);
          }
          if (name === 'list_my_account_notification_history') return fulfill([{id: '00000000-0000-4000-8000-000000980001', notification_type: 'inbox_message', title: 'Synthetic notification', body: 'A synthetic private notification', created_at: stamp, read_at: null, metadata: {}}]);
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const panel = page.getByRole('dialog', {name: 'Communication', exact: true});
      const workspace = panel.getByRole('region', {name: 'TenBot workspace', exact: true});
      const conversation = workspace.getByRole('log', {name: 'TenBot conversation', exact: true});
      const input = workspace.getByLabel('Your question', {exact: true});
      const messagesPanel = panel.getByRole('tabpanel', {name: 'Messages', exact: true});
      const history = messagesPanel.locator('[data-message-history]');
      const messagingButton = page.getByRole('button', {name: 'Messaging', exact: true});
      const openAssistant = async () => {
        const menu = page.getByRole('button', {name: 'Open Messaging menu', exact: true});
        // Existing desktop navigation opens on hover/focus; clicking an already
        // hovered toggle closes it. Mobile keeps the existing click behavior.
        if (page.viewportSize().width >= 768) await menu.hover(); else await menu.click();
        await page.getByRole('menuitem', {name: 'Ask TenBot', exact: true}).click();
        await expect(panel.getByRole('tab', {name: 'Ask TenBot', exact: true})).toHaveAttribute('aria-selected', 'true');
        await expect(workspace).toBeVisible();
      };
      const ask = async (question, payload) => {
        answer = payload;
        await input.fill(question);
        await workspace.getByRole('button', {name: 'Ask TenBot', exact: true}).click();
        await expect(conversation.getByText(question, {exact: true})).toBeVisible();
        await expect(workspace.getByRole('button', {name: 'Working…', exact: true})).toHaveCount(0);
        const request = assistantCalls.filter(call => call.action === 'ask').at(-1);
        const moduleLabel = {'/my-work': 'My Work', '/settings': 'Settings', '/contacts': 'Contacts', '/manpower-reporting': 'Manpower Reporting'}[new URL(page.url()).pathname];
        assert.equal(request.context[0], `Current module: ${moduleLabel}`);
        assert(request.context.length <= 2 && Object.keys(request).every(key => ['action', 'question', 'context'].includes(key)), 'Assistant input stays limited to module label and bounded employee question context');
      };
      const contained = async () => {
        const box = await panel.boundingBox();
        assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= page.viewportSize().height + 1, `Communication fits viewport: ${JSON.stringify(box)}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal viewport overflow');
      };
      try {
        await page.goto(`${origin}/my-work?reviewRecord=synthetic-private-record`);
        await page.waitForLoadState('networkidle');
        await expect(messagingButton).toBeVisible();
        await expect(page.locator('.tenbot-launcher')).toHaveCount(0);
        await expect(messagingButton.getByLabel('2 unread messages', {exact: true})).toBeVisible();
        await openAssistant();
        await contained();
        await expect(messagesPanel).toBeHidden();
        assert.equal(sensitive(calls).length, 0, 'Opening Ask TenBot must not read or mark private conversations');
        assert.equal(realtime.filter(frame => frame.topic?.includes('my-work-typing:')).length, 0, 'Opening Ask TenBot must not subscribe to private typing');
        await expect(messagingButton.getByLabel('2 unread messages', {exact: true})).toBeVisible();
        await ask(group.question, group.answer);
        await expect(conversation.getByText(group.answer.message, {exact: true})).toBeVisible();
        await expect(conversation.getByRole('link', {name: 'Open My Work', exact: true})).toHaveAttribute('href', '/my-work');
        await expect(conversation.getByText('Source: TenOps Guide', {exact: true})).toBeVisible();
        const chat = await conversation.innerText();
        assert(!chat.includes(group.answer.snapshot.revision));
        assert(!/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|capability snapshot|AI-selected guidance|\b2026-10-27\b/i.test(chat), 'No technical metadata in employee chat');
        if (admin) await page.screenshot({path: `${directory}/desktop-natural-prose.png`});
        if (!admin) {
          await expect(workspace.getByRole('button', {name: 'Product feedback', exact: true})).toHaveCount(0);
          await expect(workspace.getByRole('region', {name: 'Shared TenBot usage', exact: true})).toHaveCount(0);
          assert(!assistantCalls.some(call => call.action === 'usage'), 'Nonadmin does not request aggregate usage');
          checked.push('authorized nonadmin can ask, with aggregate usage controls absent');
          continue;
        }
        checked.push('existing desktop Messaging menu opens dedicated assistant tab without a permanent launcher', 'opening assistant leaves private messages unread and unread badge unchanged', 'captured real conversational prose, fixed source link and clean employee attribution');
        await workspace.getByRole('button', {name: 'Product feedback', exact: true}).click();
        const usage = workspace.getByRole('region', {name: 'Shared TenBot usage', exact: true});
        await expect(usage).toContainText('8 of 20 shared attempts used today · 12 remaining.');
        await expect(usage).toContainText('6 per minute per account.');
        await expect(usage).toContainText('Monthly reservation: $0.08 of $0.20.');
        assert(!/Draft Review Bob|Draft Review Carol|Synthetic private message|[0-9a-f]{8}-[0-9a-f-]{27}/i.test(await usage.innerText()), 'Admin usage shows aggregates without account identities or private content');
        await page.screenshot({path: `${directory}/administrator-usage.png`});
        await workspace.getByRole('button', {name: 'Guide', exact: true}).click();
        checked.push('administrator sees shared aggregate usage, burst limit and monthly budget without account detail');
        await ask(navigation.question, navigation.answer);
        await workspace.getByRole('button', {name: 'Draft a feature suggestion', exact: true}).click();
        const draft = workspace.getByRole('form', {name: 'Feature suggestion draft'});
        await expect(draft).toBeVisible();
        await draft.getByLabel('Current workflow or problem').fill('Preserve this synthetic feature draft');
        await input.fill('Preserve this unfinished question');
        await panel.getByRole('tab', {name: 'Messages', exact: true}).click();
        await expect(workspace).toBeHidden();
        await messagesPanel.getByRole('button').filter({has: page.getByText('Draft Review Bob', {exact: true})}).click();
        await expect(history.getByText(privateBody, {exact: true})).toBeVisible();
        const composer = messagesPanel.getByRole('textbox', {name: 'Message', exact: true});
        await composer.fill('Synthetic DM send after assistant');
        await messagesPanel.getByRole('button', {name: 'Send', exact: true}).click();
        await expect(history.getByText('Synthetic DM send after assistant', {exact: true})).toBeVisible();
        await messagesPanel.getByRole('button').filter({has: page.getByText('Existing shop group', {exact: true})}).click();
        await expect(history.getByText('Synthetic existing group message', {exact: true})).toBeVisible();
        await expect.poll(() => messages.find(message => message.group_id === groupId).read_at).toBe(stamp);
        await composer.fill('Keep private group composer draft');
        const before = sensitive(calls).length;
        const beforeRealtime = realtime.length;
        await panel.getByRole('tab', {name: 'Ask TenBot', exact: true}).click();
        await expect(input).toHaveValue('Preserve this unfinished question');
        await expect(draft.getByLabel('Current workflow or problem')).toHaveValue('Preserve this synthetic feature draft');
        await page.evaluate(() => { window.dispatchEvent(new Event('tenops:messaging-changed')); window.dispatchEvent(new Event('tenops:notifications-changed')); });
        await page.waitForTimeout(900);
        assert.equal(sensitive(calls).length, before, 'Assistant tab suspends private message reads, read receipts and composer operations');
        assert(!realtime.slice(beforeRealtime).some(frame => frame.typing || frame.event === 'phx_join' && frame.topic?.includes('my-work-typing:')), 'Assistant tab does not broadcast typing or subscribe to private conversation channels');
        await panel.getByRole('button', {name: 'Close Inbox', exact: true}).click();
        await openAssistant();
        await expect(input).toHaveValue('Preserve this unfinished question');
        await expect(draft.getByLabel('Current workflow or problem')).toHaveValue('Preserve this synthetic feature draft');
        const destination = navigation.answer.sources.find(source => source.route === '/contacts' || source.route === '/settings').route;
        await conversation.getByRole('link', {name: destination === '/contacts' ? 'Open Contacts' : 'Open Settings', exact: true}).click();
        await expect(page).toHaveURL(`${origin}${destination}`);
        await expect(input).toHaveValue('Preserve this unfinished question');
        await expect(draft.getByLabel('Current workflow or problem')).toHaveValue('Preserve this synthetic feature draft');
        await draft.getByRole('button', {name: 'Cancel', exact: true}).click();
        checked.push('existing DM send and group history remain functional', 'assistant tab suspends private message reads and receipts', 'chat, unfinished question and unsubmitted feature draft persist across tab, close and route navigation');
        await ask(unavailable.question, unavailable.answer);
        await expect(conversation.getByText('Unreleased', {exact: true})).toBeVisible();
        await expect(conversation.getByText(unavailable.answer.message, {exact: true})).toBeVisible();
        await expect(conversation.getByRole('link', {name: /Open Intake/})).toHaveCount(0);
        await ask('How do I create a group while AI is unavailable?', {...group.answer, mode: 'guide', fallback: true});
        await expect(conversation.getByText('AI is unavailable right now. Here’s guidance from the TenOps Guide.', {exact: true}).last()).toBeVisible();
        checked.push('unreleased Intake stays unavailable with no invented navigation', 'deterministic direct-guide fallback remains usable');
        await page.screenshot({path: `${directory}/desktop-communication.png`});
        await page.setViewportSize({width: 390, height: 844});
        await contained();
        await panel.getByRole('button', {name: 'Close Inbox', exact: true}).click();
        await expect(page.getByRole('navigation', {name: 'Mobile navigation', exact: true})).toBeVisible();
        await messagingButton.click();
        await expect(panel.getByRole('tab', {name: 'Messages', exact: true})).toHaveAttribute('aria-selected', 'true');
        await expect(composer).toHaveValue('Keep private group composer draft');
        await panel.getByRole('tab', {name: 'Ask TenBot', exact: true}).click();
        await expect(conversation.getByText(group.question, {exact: true})).toBeAttached();
        await input.fill('Mobile unfinished question');
        await input.focus();
        await page.setViewportSize({width: 390, height: 500});
        await contained();
        await expect(input).toBeInViewport();
        await expect(workspace.getByRole('button', {name: 'Ask TenBot', exact: true})).toBeInViewport();
        await page.screenshot({path: `${directory}/mobile-keyboard-viewport.png`});
        await page.setViewportSize({width: 390, height: 844});
        await page.screenshot({path: `${directory}/mobile-communication.png`});
        await panel.getByRole('button', {name: 'Close Inbox', exact: true}).click();
        await expect(page.locator('.tenbot-launcher')).toHaveCount(0);
        await expect(page.getByRole('button', {name: 'Notifications', exact: true}).getByLabel('1 unread notifications', {exact: true})).toBeVisible();
        checked.push('mobile Messages entry preserves existing composer and assistant conversation', '390px and reduced keyboard viewport fit without horizontal overflow', 'Notifications unread badge remains independent');
        // Exact reported regression: a generic Jobs token must not turn an
        // unsupported Manpower question into Contacts guidance or consume AI.
        await page.setViewportSize({width: 1440, height: 1000});
        await page.goto(`${origin}/manpower-reporting?reviewRecord=synthetic-private-record`);
        await expect(messagingButton).toBeVisible();
        await openAssistant();
        await expect(workspace.getByText('Current module: Manpower Reporting', {exact: true})).toBeVisible();
        await ask(manpowerQuestion, manpower.answer);
        const unknown = conversation.locator('article').filter({hasText: manpowerQuestion});
        await expect(unknown).toContainText('I cannot verify that workflow for your account.');
        await expect(unknown.getByRole('link')).toHaveCount(0);
        await expect(unknown).not.toContainText('Contacts');
        await expect(unknown).not.toContainText('Source: TenOps Guide');
        await expect(unknown).not.toContainText('AI is unavailable');
        await expect(workspace.getByRole('button', {name: 'Draft a feature suggestion', exact: true})).toBeEnabled();
        await page.screenshot({path: `${directory}/manpower-unknown-guide.png`});
        checked.push('exact Manpower Jobs-filter question admits unverified guidance without unrelated Contacts source, link or AI claim');
        for (const call of assistantCalls) {
          const serialized = JSON.stringify(call);
          assert(!serialized.includes(privateBody) && !serialized.includes('Keep private group composer draft') && !serialized.includes('synthetic-private-record'), 'Assistant payload excludes private Messaging and route contents');
        }
        assert.equal(messages.filter(message => message.body === 'Synthetic DM send after assistant').length, 1);
        assert.equal(calls.filter(call => call.name === 'save_my_work_message_group').length, 0, 'Assistant never becomes a group participant');
      } catch (error) {
        await page.screenshot({path: `${directory}/failure.png`, fullPage: true}).catch(() => {});
        writeFileSync(`${directory}/failure.txt`, `${await page.locator('body').innerText()}\n${error.stack}`);
        writeFileSync(`${directory}/failure-requests.json`, JSON.stringify({calls, realtime, assistantCalls}, null, 2));
        throw error;
      } finally {
        requestEvidence.push({admin, calls, realtime, assistantActions: assistantCalls.map(call => call.action), blockedOrigins: [...new Set(blocked)]});
        await context.close();
      }
    }
    assert.deepEqual(errors, []);
    writeFileSync(`${directory}/browser-results.json`, JSON.stringify({passed: true, origin, inferenceCalls: 0, replaySource: 'evaluation.json', checked, errors, requestEvidence, limitation: 'Synthetic browser RPCs establish UI isolation; live authorization and physical iPhone keyboard/Web Push behavior are separate checks.'}, null, 2));
    console.log(`TenBot communication browser checks passed (${checked.length} focused assertions; zero inference calls).`);
  } finally { await browser.close(); }
}

const origin = 'http://localhost:3000';
const endpoint = 'http://localhost:55593/';
const aiPilotOnly = process.argv.includes('--ai-pilot-only');
const output = '/private/tmp/tenops-tenbot-review' + (aiPilotOnly ? '/ai-pilot' : '');
const fixture = JSON.parse(readFileSync('/private/tmp/tenops-intake-materials-review/server.json', 'utf8'));
mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const errors = [], requests = [], asks = [];
let liveAiRequests = 0;
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
    if (aiPilotOnly && route.request().url() === endpoint && route.request().method() === 'POST' && route.request().postDataJSON().action === 'ask') {
      liveAiRequests++;
      if (liveAiRequests > 1) return route.abort('blockedbyclient');
    }
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
const metadataOnly = process.argv.includes('--metadata-only');
const answerPayloads = [];

async function openAssistant() {
  // Only the launcher is visible while the workspace is minimized.
  await page.getByRole('button', {name: 'Ask TenBot', exact: true}).click();
  await expect(panel).toBeVisible();
  assert.notEqual(await panel.getAttribute('aria-modal'), 'true', 'The assistant must remain nonmodal');
}

async function ask(question, module) {
  await input.fill(question);
  const before = asks.length;
  const response = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST');
  await workspace.getByRole('button', {name: 'Ask TenBot', exact: true}).click();
  answerPayloads.push(await (await response).json());
  await expect(conversation.getByText(question, {exact: true})).toBeVisible();
  await expect(workspace.getByRole('button', {name: 'Working…', exact: true})).toHaveCount(0);
  await expect(conversation.getByText('Source: TenOps Guide', {exact: true}).last()).toBeVisible();
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
  if (aiPilotOnly) {
    assert.equal(answerPayloads[0].mode, 'ai', 'The first browser request must use real AI');
    assert.notEqual(answerPayloads[0].fallback, true, 'The live request must not fall back to guide search');
    await expect(conversation.getByText(answerPayloads[0].message, {exact: true})).toBeVisible();
  } else {
    await expect(conversation.getByText('Here’s what I found in the TenOps Guide.', {exact: true})).toBeVisible();
  }
  await conversation.getByText('How do I create a group conversation?', {exact: true}).scrollIntoViewIfNeeded();
  await page.screenshot({path: `${output}/${aiPilotOnly ? 'desktop-real-ai' : 'desktop-floating-guide'}.png`});
  checked.push('persistent launcher on My Work', 'nonmodal desktop panel containment', 'guide provenance and released workflow', 'allowlisted module context without query or record identifier');

  if (aiPilotOnly) {
    const replays = [];
    const assertCleanChat = async () => {
      const text = await conversation.innerText();
      assert(!/Deployed knowledge|AI-selected guidance|Direct guide search|capability snapshot|inference|\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text), 'Employee chat must omit technical metadata');
      for (const payload of answerPayloads) {
        assert(payload.snapshot.revision && payload.snapshot.verifiedAt, 'Internal provenance stays intact');
        assert(!text.includes(payload.snapshot.revision), 'Revision must remain internal');
        for (const source of payload.sources) assert(!text.includes(source.source), 'Verification source details stay internal');
      }
    };
    await assertCleanChat();
    await input.fill('Keep this unfinished pilot question');
    await panel.getByRole('button', {name: 'Minimize TenBot', exact: true}).click();
    await expect(panel).toBeHidden();
    await openAssistant();
    await expect(input).toHaveValue('Keep this unfinished pilot question');
    await expect(conversation.getByText('How do I create a group conversation?', {exact: true})).toBeVisible();
    checked.push('one real remote AI group response', 'simple guide attribution with internal metadata hidden', 'chat and unfinished question survive minimize/reopen');

    // Further UI checks replay captured results or a synthetic fallback. They
    // never spend another remote request; the outer route also blocks a second.
    const evaluation = JSON.parse(readFileSync(`${output}/evaluation.json`, 'utf8'));
    const customer = evaluation.outputs.find(item => item.answer?.sources.some(source => source.id === 'customer-history'));
    assert(customer && customer.answer.mode === 'ai', 'A captured real customer-history evaluation is required');
    let replay = customer.answer;
    await page.route(endpoint, route => {
      const request = route.request();
      if (request.method() !== 'POST' || request.postDataJSON().action !== 'ask') return route.continue();
      return route.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': origin}, body: JSON.stringify(replay)});
    });
    replays.push({kind: 'captured real evaluation replay', question: customer.question, source: 'evaluation.json'});
    await ask(customer.question, 'My Work');
    await expect(conversation.getByRole('link', {name: 'Open Contacts', exact: true})).toHaveAttribute('href', '/contacts');
    await conversation.getByRole('link', {name: 'Open Contacts', exact: true}).click();
    await expect(page).toHaveURL(`${origin}/contacts`);
    await expect(panel).toBeVisible();
    await expect(workspace.getByText('Current module: Contacts', {exact: true})).toBeVisible();
    await expect(conversation.getByText('How do I create a group conversation?', {exact: true})).toBeVisible();
    await assertCleanChat();
    checked.push('captured customer answer renders Contacts link', 'conversation retained through actual Contacts route change');

    await page.setViewportSize({width: 390, height: 844});
    const mobileNav = page.getByRole('navigation', {name: 'Mobile navigation'});
    await expect(mobileNav).toBeVisible();
    let navBox = await mobileNav.boundingBox();
    assert(navBox);
    await assertContained(panel, navBox.y);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal mobile overflow');
    await panel.getByRole('button', {name: 'Minimize TenBot', exact: true}).click();
    const launcherBox = await page.getByRole('button', {name: 'Ask TenBot', exact: true}).boundingBox();
    navBox = await mobileNav.boundingBox();
    assert(launcherBox && navBox && launcherBox.y + launcherBox.height <= navBox.y, 'Mobile launcher clears navigation');
    await openAssistant();
    await expect(conversation.getByText(customer.question, {exact: true})).toBeVisible();
    await conversation.locator('article').last().scrollIntoViewIfNeeded();
    await page.screenshot({path: `${output}/mobile-customer-replay.png`});

    replay = {...answerPayloads[0], mode: 'guide', fallback: true};
    replays.push({kind: 'synthetic guide fallback', question: 'Group guidance while AI is unavailable'});
    await ask('Group guidance while AI is unavailable', 'Contacts');
    await expect(conversation.getByText('AI is unavailable right now. Here’s guidance from the TenOps Guide.', {exact: true})).toBeVisible();
    await assertCleanChat();
    await assertContained(panel, navBox.y);
    await conversation.locator('article').last().scrollIntoViewIfNeeded();
    await page.screenshot({path: `${output}/mobile-guide-fallback.png`});
    checked.push('390px mobile panel and launcher containment above navigation', 'captured customer answer mobile presentation', 'synthetic fallback copy and guide attribution');
    assert.equal(liveAiRequests, 1, 'Focused pilot browser validation permits exactly one actual remote request');
    assert.deepEqual(errors, []);
    writeFileSync(`${output}/browser-results.json`, JSON.stringify({passed: true, origin, errors, liveAiRequests, liveAnswer: answerPayloads[0], replays, checked, networkOrigins: [...new Set(requests)]}, null, 2));
    console.log('TenBot AI pilot browser checks passed: one real remote request; captured customer replay and synthetic fallback clearly separated.');
  } else if (metadataOnly) {
    const assertCleanChat = async () => {
      const text = await conversation.innerText();
      assert(!/Deployed knowledge|AI-selected guidance|Direct guide search|capability snapshot|inference|\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b/i.test(text), 'Employee chat must omit technical metadata');
      for (const payload of answerPayloads) {
        assert(payload.snapshot.revision && payload.snapshot.verifiedAt, 'Internal provenance stays intact');
        assert(!text.includes(payload.snapshot.revision), 'Revision must not appear in employee chat');
        for (const source of payload.sources) assert(!text.includes(source.source), 'Internal verification source titles stay internal');
      }
    };
    await assertCleanChat();
    await page.screenshot({path: `${output}/metadata-desktop.png`});
    await ask('Can I set a recurring task?', 'My Work');
    await expect(conversation.getByText(/cannot verify recurring tasks/)).toBeVisible();
    await assertCleanChat();
    await page.setViewportSize({width: 390, height: 844});
    await ask('How do I enable notifications on my phone?', 'My Work');
    await expect(conversation.getByRole('link', {name: 'Open Settings'})).toHaveAttribute('href', '/settings');
    await assertCleanChat();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await conversation.locator('article').last().scrollIntoViewIfNeeded();
    await page.screenshot({path: `${output}/metadata-mobile.png`});
    assert.deepEqual(errors, []);
    writeFileSync(`${output}/metadata-results.json`, JSON.stringify({passed: true, origin, errors, checked: ['simple TenOps Guide attribution','no visible revisions, verification dates or technical labels','internal response provenance retained','unknown capability wording preserved','desktop and mobile rendering','module link preserved'], networkOrigins: [...new Set(requests)]}, null, 2));
    console.log('TenBot employee metadata presentation passed on desktop/mobile.');
  } else {
  await ask('Can I add someone to an existing personal DM?', 'My Work');
  await expect(conversation.getByText(/cannot add a third person/)).toBeVisible();
  await ask('Can I estimate material lead times from a blend sheet?', 'My Work');
  await expect(conversation.getByText('Unreleased', {exact: true})).toBeVisible();
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
  }
} catch (error) {
  await page.screenshot({path: `${output}/failure.png`, fullPage: true}).catch(() => {});
  writeFileSync(`${output}/failure.txt`, `${await page.locator('body').innerText()}\n${error.stack}`);
  throw error;
} finally {
  await browser.close();
}
