import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';

const privacyOnly=process.argv.includes('--privacy-only');
const presentationOnly=process.argv.includes('--presentation-only');
const iconOnly=process.argv.includes('--icon-only');
const conversationOnly = process.argv.includes('--conversation-only') || process.argv.length === 2;
const refinementOnly = process.argv.includes('--refinement-only');
const liveInferenceOnce = refinementOnly && process.argv.includes('--live-inference-once');
const knowledgeCoverageOnly = process.argv.includes('--knowledge-coverage-only') || refinementOnly;
if (iconOnly || presentationOnly || privacyOnly || conversationOnly || knowledgeCoverageOnly || process.argv.includes('--contacts-coverage-only') || process.argv.includes('--communication-only')) {
  await verifyConversation();
  process.exit(0);
}

// Exercise the actual localhost application using the established Messaging
// fixture shapes and captured answers. Only the explicit refinement flag may
// pass one ordinary Messaging Send through the existing actual local adapter.
async function verifyConversation() {
  const origin = 'http://localhost:3000', endpoint = 'http://localhost:55593';
  const directory = `/private/tmp/tenops-tenbot-review/${iconOnly ? 'icon/browser' : presentationOnly ? 'polish/browser' : privacyOnly ? 'privacy/browser' : refinementOnly ? 'refinement/browser' : knowledgeCoverageOnly ? 'coverage/browser' : 'conversation'}`;
  const captured = JSON.parse(readFileSync('/private/tmp/tenops-tenbot-review/communication/evaluation.json', 'utf8')).outputs;
  const coverage = JSON.parse(readFileSync('/private/tmp/tenops-tenbot-review/contacts-coverage/evaluation.json', 'utf8')).outputs;
  const workflowCoverageFile = `/private/tmp/tenops-tenbot-review/${refinementOnly ? 'refinement/browser-fixtures.json' : 'coverage/evaluation.json'}`;
  const workflowCoverage = knowledgeCoverageOnly ? JSON.parse(readFileSync(workflowCoverageFile, 'utf8')).outputs : [];
  const actualConversationsFile = `/private/tmp/tenops-tenbot-review/${refinementOnly ? 'refinement/selected-model.json' : 'coverage/conversations.json'}`;
  const actualConversations = knowledgeCoverageOnly && existsSync(actualConversationsFile) ? JSON.parse(readFileSync(actualConversationsFile, 'utf8')).outputs : [];
  const replayActualConversations = actualConversations.length === (refinementOnly ? 9 : 4);
  const workflowCase = id => {
    const item = workflowCoverage.find(candidate => candidate.id === id);
    assert(item?.question && item.answer, `Captured workflow coverage case ${id} is required`);
    return item;
  };
  const group = captured.find(item => item.answer?.mode === 'ai' && item.answer.sources.some(source => source.id === 'group'));
  const unavailable = refinementOnly ? workflowCase('unsupported-feature-request') : captured.find(item => item.answer?.sources.some(source => source.id === 'material-lead'));
  const customer = coverage.find(item => item.id === 'customer-edit');
  const deniedCustomers = coverage.filter(item => ['customer-denied-write', 'customer-denied-edit'].includes(item.id));
  const manpower = knowledgeCoverageOnly ? workflowCase('manpower') : coverage.find(item => item.id === 'manpower');
  assert(group && unavailable && customer && manpower && deniedCustomers.length === 2, 'Existing conversational and Contacts fixtures are required');
  mkdirSync(directory, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const checked = [], requestEvidence = [], errors = [];
  const liveFile = `${directory}/live-ui-answer.json`;
  let liveRecord = liveInferenceOnce && existsSync(liveFile) ? JSON.parse(readFileSync(liveFile,'utf8')) : null;
  if (liveInferenceOnce && liveRecord && !liveRecord.answer) throw Error('A live UI request was already attempted; inspect its receipt before any further inference.');
  let liveInferenceCalls = 0;
  const user = '00000000-0000-0000-0000-000000000010';
  const system = '00000000-0000-0000-0000-000000000001';
  const bob = '00000000-0000-4000-8000-000000900022';
  const carol = '00000000-0000-4000-8000-000000900023';
  const groupId = '00000000-0000-4000-8000-000000930000';
  const officialId = '00000000-0000-4000-8000-000000910002';
  const stamp = '2026-10-15T00:00:00Z';
  const privateBody = 'Synthetic private message sentinel — never assistant context';
  const officialBody = 'Synthetic official system notice — never assistant context';
  const groupBody = 'Synthetic private group message — never assistant context';
  const officialFilename = 'Synthetic official attachment sentinel.pdf', officialStorage = 'synthetic-official-storage-sentinel';
  const peers = [{userId: bob, name: 'Draft Review Bob', role: 'member'}, {userId: carol, name: 'Draft Review Carol', role: 'member'}];
  const initialMessages = [
    {id: '00000000-0000-4000-8000-000000910000', sender_user_id: bob, sender_name: peers[0].name, recipient_user_id: user, body: privateBody},
    {id: '00000000-0000-4000-8000-000000910001', sender_user_id: carol, sender_name: peers[1].name, group_id: groupId, recipient_user_id: null, body: groupBody},
    {id: officialId, sender_user_id: system, sender_name: 'TenOps', recipient_user_id: user, body: officialBody},
  ].map(message => ({...message, created_at: stamp, read_at: null, attachments: message.id === officialId ? [{id: '00000000-0000-4000-8000-000000910003', message_id: officialId, storage_path: officialStorage, original_filename: officialFilename, content_type: 'application/pdf', byte_size: 128, created_at: stamp, preview: null}] : []}));
  const rowsFor = (messages, peer) => messages.filter(message => message.group_id ? message.group_id === peer : message.sender_user_id === peer || message.recipient_user_id === peer);
  try {
    for (const admin of iconOnly?[true]:[true, false]) {
      const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
      const calls = [], assistantCalls = [], messages = structuredClone(initialMessages), realtime = [], blocked = [];
      let answer = group.answer, holdNextAsk = false, failNextAsk = false, releasePending, activeUserId = user, authUserOverride, releaseProfile, switchedProfileSeen = false, nextAskLive = false;
      await context.routeWebSocket('**/realtime/v1/websocket*', socket => {
        socket.onMessage(raw => {
          if (Buffer.isBuffer(raw) && raw[0] === 3) {
            const topicOffset = 7 + raw[1] + raw[2], payloadOffset = topicOffset + raw[3] + raw[4] + raw[5];
            const payload = raw[6] === 1 ? JSON.parse(raw.subarray(payloadOffset).toString()) : {};
            realtime.push({topic: raw.subarray(topicOffset, topicOffset + raw[3]).toString(), event: 'broadcast', typing: payload.typing === true});
            return;
          }
          const frame = JSON.parse(String(raw));
          const message = Array.isArray(frame) ? {join_ref: frame[0], ref: frame[1], topic: frame[2], event: frame[3], payload: frame[4]} : frame;
          realtime.push({topic: message.topic, event: message.event, typing: message.payload?.payload?.typing === true});
          if (!['phx_join', 'heartbeat', 'phx_leave'].includes(message.event)) return;
          const reply = {...message, event: 'phx_reply', payload: {status: 'ok', response: {postgres_changes: []}}};
          socket.send(JSON.stringify(Array.isArray(frame) ? [reply.join_ref, reply.ref, reply.topic, reply.event, reply.payload] : reply));
        });
      });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['blob:', 'data:'].includes(url.protocol) && ![origin, endpoint].includes(url.origin)) {blocked.push(url.origin);return route.abort('blockedbyclient');}
        const fulfill = value => route.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': origin}, body: JSON.stringify(value)});
        if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS'}});
        if (url.origin === endpoint) {
          const body = request.postDataJSON();assistantCalls.push(body);
          if (body.action === 'ask') {
            if (nextAskLive) {
              nextAskLive = false;assert(admin && liveInferenceOnce,'Only explicit administrator refinement review may reach actual inference');
              if (!liveRecord) {
                liveRecord = {startedAt:new Date().toISOString(),request:body,status:'started'};
                writeFileSync(liveFile,JSON.stringify(liveRecord,null,2));
                liveInferenceCalls++;
                const actual = await route.fetch({maxRetries:0,maxRedirects:0,timeout:35000});
                const actualAnswer = await actual.json();
                liveRecord = {...liveRecord,status:actual.status(),answer:actualAnswer,completedAt:new Date().toISOString()};
                writeFileSync(liveFile,JSON.stringify(liveRecord,null,2));
              }
              return fulfill(liveRecord.answer);
            }
            if (failNextAsk) {failNextAsk = false;return route.fulfill({status: 503, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': origin}, body: JSON.stringify({error: 'Synthetic temporary assistant failure.'})});}
            const response = privacyOnly?{...answer,conversationId:'00000000-0000-4000-8000-000000000777'}:answer;
            if (holdNextAsk) {holdNextAsk = false;await new Promise(resolve => {releasePending = resolve;});}
            return fulfill(response);
          }
          if (body.action === 'clear') return fulfill({cleared:true});
          if (body.action === 'draft') return fulfill({...unavailable.answer, summary: null});
          if (body.action === 'submit') return fulfill({id: 'synthetic-confirmed-feedback'});
          if (body.action === 'usage') return fulfill({usage: {sharedDayUsed: 47, sharedDayLimit: 300, sharedDayRemaining: 253, sharedMonthUsed: 47, sharedMonthLimit: 6000, sharedMonthRemaining: 5953, perAccountMinuteLimit: 6, dayNeuronLimit: 8000, dayAccountedNeurons: 4750.5, monthNeuronLimit: 240000, monthAccountedNeurons: 4750.5, dayMeasuredInputTokens: 27000, dayMeasuredOutputTokens: 4300, dayUnmeasuredAttempts: 20}});
          if (body.action === 'list') return fulfill({items: []});
          throw new Error(`Unexpected assistant action: ${body.action}`);
        }
        if (url.pathname === '/auth/v1/user' && authUserOverride) return fulfill(authUserOverride);
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const name = url.pathname.split('/').at(-1), body = request.postDataJSON();calls.push({name, body});
          if (activeUserId !== user && name === 'get_my_app_access') {
            if (!switchedProfileSeen) {switchedProfileSeen = true;await new Promise(resolve => {releaseProfile = resolve;});}
            return fulfill([{user_id: activeUserId, display_name: 'Switched synthetic account', role: 'admin', is_active: true, read_only: false, messaging_write: true}]);
          }
          if (activeUserId !== user && ['list_my_work_conversations_v12', 'list_my_work_message_page_v12'].includes(name)) return fulfill([]);
          if (!admin && name === 'get_my_app_access') return fulfill([{user_id: user, display_name: 'Local developer fixture', role: 'developer', is_active: true, read_only: true, messaging_write: false}]);
          if (name === 'list_my_work_conversations_v12') return fulfill([...peers, {userId: system, name: 'TenOps', role: 'System'}, {userId: groupId, groupId, name: 'Existing shop group', role: 'Group', creatorUserId: user, memberIds: [user, bob, carol]}].map(peer => {
            const rows = rowsFor(messages, peer.userId), latest = rows.at(-1);
            return {...peer, unread: rows.filter(message => message.sender_user_id !== user && !message.read_at).length, latest: {id: latest?.id || peer.userId, createdAt: latest?.created_at || stamp, body: latest?.body || 'No messages yet'}};
          }));
          if (name === 'list_my_work_inbox_recipients') return fulfill(peers.map(peer => ({user_id: peer.userId, display_name: peer.name, role: peer.role})));
          if (name === 'list_my_work_message_page_v12') return fulfill(rowsFor(messages, body.p_peer).filter(message => !body.p_ids || body.p_ids.includes(message.id)));
          if (name === 'mark_my_work_conversation_read_v12') {for (const message of messages) if (body.p_ids.includes(message.id)) message.read_at = stamp;return fulfill(null);}
          if (name === 'send_my_work_message_v12') {
            assert.notEqual(body.p_peer, system, 'Assistant questions never use the employee-message RPC');
            const id = `00000000-0000-4000-8000-${String(920000 + messages.length).padStart(12, '0')}`;
            messages.push({id, sender_user_id: user, sender_name: 'Local Admin', recipient_user_id: body.p_peer === groupId ? null : body.p_peer, group_id: body.p_peer === groupId ? groupId : null, body: body.p_body, created_at: new Date().toISOString(), read_at: stamp, attachments: []});
            return fulfill(id);
          }
          if (name === 'list_my_account_notification_history') return fulfill([{id: '00000000-0000-4000-8000-000000980001', notification_type: 'inbox_message', title: 'Synthetic notification', body: 'A synthetic private notification', created_at: stamp, read_at: null, metadata: {}}]);
        }
        return route.continue();
      });
      const page = await context.newPage();page.on('pageerror', error => errors.push(error.message));
      const panel = page.getByRole('dialog', {name: 'Inbox', exact: true});
      const history = panel.locator('[data-message-history]');
      const conversation = history.getByRole('log', {name: 'TenBot conversation', exact: true});
      const input = panel.getByRole('textbox', {name: 'Message', exact: true});
      const messagingButton = page.getByRole('button', {name: 'Messaging', exact: true});
      const choose = async name => {
        await panel.locator('aside').getByRole('button').filter({has: page.getByText(name, {exact: true})}).click();
        await expect(input).toBeVisible();
        await expect(panel.getByText('Loading recent messages…', {exact: true})).toHaveCount(0);
        await expect(panel.getByText('Updating conversation…', {exact: true})).toHaveCount(0);
      };
      const askCount = () => assistantCalls.filter(call => call.action === 'ask').length;
      const ask = async (question, payload, keyboard = true) => {
        answer = payload;const before = askCount();await input.fill(question);
        if (keyboard) await input.press('Enter');else await panel.getByRole('button', {name: 'Send', exact: true}).click();
        await expect.poll(askCount).toBe(before + 1);
        await expect(conversation.getByText(question, {exact: true}).last()).toBeVisible();
        await expect(input).toHaveValue('');
        const request = assistantCalls.filter(call => call.action === 'ask').at(-1);
        const moduleLabel = {'/my-work': 'My Work', '/settings': 'Settings', '/contacts': 'Contacts', '/manpower-reporting': 'Manpower Reporting'}[new URL(page.url()).pathname];
        assert.equal(request.context[0], `Current module: ${moduleLabel}`);
        assert(request.context.length === 1 && Object.keys(request).every(key => ['action', 'question', 'context','conversationId'].includes(key)), 'Assistant input stays limited to module label and bounded employee question context');
        assert(request.context.join('').length <= 1200, 'Module and own assistant follow-up context remain bounded together');
      };
      const contained = async () => {
        await expect.poll(async () => {const box = await panel.boundingBox();return Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= page.viewportSize().height + 1);}).toBe(true);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal viewport overflow');
      };
      try {
        await page.goto(`${origin}/my-work?reviewRecord=synthetic-private-record`);await page.waitForLoadState('networkidle');
        await expect(messagingButton.getByLabel('3 unread messages', {exact: true})).toBeVisible();
        await messagingButton.click();await expect(panel).toBeVisible();await contained();
        await expect(panel.getByRole('tablist')).toHaveCount(0);
        await expect(page.getByRole('menuitem', {name: 'Ask TenBot', exact: true})).toHaveCount(0);
        await expect(page.getByRole('region', {name: 'TenBot workspace', exact: true})).toHaveCount(0);
        await expect(page.locator('.tenbot-launcher')).toHaveCount(0);
        await choose('TenBot');
        if(iconOnly){
          const avatar=async(locator,size)=>{
            await expect(locator).toHaveCount(1);await expect(locator).toBeVisible();
            await expect(locator).toHaveAttribute('aria-hidden','true');await expect(locator).toHaveAttribute('focusable','false');
            const box=await locator.boundingBox();assert.equal(box.width,size);assert.equal(box.height,size);
            const drawing=await locator.evaluate(el=>({viewBox:el.getAttribute('viewBox'),circle:getComputedStyle(el.querySelector('circle')).fill,strokes:Array.from(el.querySelectorAll('[stroke]')).map(path=>getComputedStyle(path).stroke)}));
            assert(drawing.viewBox&&drawing.circle!=='none'&&drawing.strokes.includes('rgb(255, 255, 255)'),'Scalable navy badge retains white outline');
            return drawing;
          };
          const captureThemes=async(name,check)=>{
            let previous;
            for(const appearance of ['light','dark']){
              await page.evaluate(value=>document.documentElement.dataset.appearance=value,appearance);
              const drawing=await check();if(previous&&drawing)assert.deepEqual(drawing,previous,'TenBot icon contrast stays stable across appearances');previous=drawing;
              if(await panel.isVisible())await contained();
              assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Icon surface has no viewport overflow');
              await page.screenshot({path:`${directory}/${name}-${appearance}.png`,animations:'disabled'});
            }
          };
          const row=panel.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})});
          const headerAvatar=panel.locator('[data-tenbot-avatar]').last();
          await captureThemes('desktop-conversation',async()=>{
            await avatar(row.locator('[data-tenbot-avatar]'),36);
            await expect(panel.locator('[data-tenbot-avatar]')).toHaveCount(2);
            await expect(panel.locator('.lucide-sparkles')).toHaveCount(0);
            return avatar(headerAvatar,32);
          });
          const svg=await headerAvatar.evaluate(el=>el.outerHTML);
          await panel.getByRole('button',{name:'Close Inbox',exact:true}).click();
          await messagingButton.hover();const menu=page.getByRole('menu',{name:'Messaging menu',exact:true});await expect(menu).toBeVisible();await expect(menu.locator('..')).toHaveCSS('opacity','1');
          await captureThemes('desktop-recent-menu',()=>avatar(menu.locator('[data-tenbot-avatar]'),32));
          await menu.getByRole('switch',{name:'Message sidebar',exact:true}).click();
          await page.getByRole('button',{name:'Expand message sidebar',exact:true}).click();await expect(panel).toBeVisible();await choose('TenBot');
          await captureThemes('desktop-sidebar',()=>avatar(headerAvatar,32));
          await panel.getByRole('button',{name:'Close Inbox',exact:true}).click();
          await page.setViewportSize({width:390,height:844});await messagingButton.click();await expect(panel).toBeVisible();await expect(input).toBeVisible();
          await expect(panel.getByText('Updating conversation…',{exact:true})).toHaveCount(0);
          await captureThemes('mobile-conversation',()=>avatar(headerAvatar,32));
          await panel.getByRole('button',{name:'Back to conversations',exact:true}).click();
          await captureThemes('mobile-conversation-list',()=>avatar(row.locator('[data-tenbot-avatar]'),36));
          await choose('Draft Review Bob');await expect(panel.locator('[data-tenbot-avatar]')).toHaveCount(1);
          await expect(panel.locator('[data-tenbot-avatar]').last()).not.toBeVisible();
          await expect(history.getByText(privateBody,{exact:true})).toBeVisible();
          assert.equal(assistantCalls.length,0,'Icon rendering makes no assistant service calls');
          assert(!calls.some(call=>call.name==='send_my_work_message_v12'),'Icon rendering sends no employee messages');
          await page.setViewportSize({width:600,height:360});
          await page.setContent(`<main style="display:flex;gap:24px;padding:24px;font:14px system-ui">${['#fff','#172033'].map(background=>`<section style="background:${background};color:${background==='#fff'?'#172033':'#fff'};padding:24px;display:flex;gap:16px">${[24,32,36].map(size=>`<figure style="margin:0;text-align:center">${svg.replace(/class="[^"]*"/,'').replace(/\s(?:width|height)="[^"]*"/g,'').replace('<svg ',`<svg width="${size}" height="${size}" `)}<figcaption>${size}px</figcaption></figure>`).join('')}</section>`).join('')}</main>`);
          await page.screenshot({path:`${directory}/avatar-sizes.png`});
          checked.push('approved rotary-tool avatar in desktop recent menu, full conversation row/header and sidebar','mobile conversation/list retain 32px/36px avatar sizing and viewport containment','navy/white contrast survives existing light/dark appearance','actual SVG renders at 24px/32px/36px; ordinary employee avatar remains initials','zero assistant calls or employee sends');
          continue;
        }
        if(presentationOnly){
          const actionMenu=panel.getByLabel('TenBot conversation actions',{exact:true});
          const action=async name=>{await actionMenu.click();await panel.getByRole('button',{name,exact:true}).click();};
          const privacy=panel.locator('[data-messaging-composer] details');
          const privacyText='When AI is available, text you submit and recent private TenBot turns are processed by the configured AI provider. TenBot does not independently read messages, tasks or restricted records. Private TenBot history expires after eight hours without a new turn.';
          await expect(privacy.locator('p')).not.toBeVisible();await privacy.locator('summary').press('Enter');
          await expect(privacy.locator('p')).toHaveText(privacyText);await expect(privacy.locator('p')).toBeVisible();
          if(admin)await page.screenshot({path:`${directory}/desktop-privacy-details.png`});
          await privacy.locator('summary').press('Enter');await expect(privacy.locator('p')).not.toBeVisible();
          await expect(input).toHaveAttribute('rows','1');await expect(input).toHaveAttribute('enterkeyhint','send');
          const compactHeight=await input.evaluate(el=>el.getBoundingClientRect().height);assert(compactHeight>=44&&compactHeight<60);
          await input.fill('First line');for(const line of ['Second line','Third line','Fourth line']){await input.press('Shift+Enter');await input.type(line);}
          await expect(input).toHaveValue('First line\nSecond line\nThird line\nFourth line');
          assert(await input.evaluate(el=>el.getBoundingClientRect().height)>compactHeight,'TenBot multiline draft grows');
          if(admin)await page.screenshot({path:`${directory}/desktop-multiline-composer.png`});
          await input.fill(Array.from({length:20},(_,i)=>`Line ${i}`).join('\n'));assert(await input.evaluate(el=>el.getBoundingClientRect().height)<=161,'Autogrow stays bounded');
          await input.fill('');await expect.poll(()=>input.evaluate(el=>el.getBoundingClientRect().height)).toBe(compactHeight);
          const beforeEmpty=askCount();await input.press('Enter');await input.fill('   ');await input.press('Enter');assert.equal(askCount(),beforeEmpty);await input.fill('');
          await input.fill('IME draft');await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',keyCode:229});await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',repeat:true});await expect(input).toHaveValue('IME draft');assert.equal(askCount(),beforeEmpty);await input.fill('');
          if(!admin){
            await ask(customer.question,deniedCustomers[0].answer);
            const denied=conversation.getByRole('article',{name:'TenBot assistant reply',exact:true}).last();
            await expect(denied.locator('[data-tenbot-answer]')).toContainText('does not have permission');
            await expect(denied.locator('[data-tenbot-sources]')).toHaveCount(0);await expect(denied.getByRole('link')).toHaveCount(0);
            await actionMenu.click();await expect(panel.getByRole('button',{name:'Product feedback',exact:true})).toHaveCount(0);
            await expect(panel.getByRole('button',{name:'Draft a feature suggestion',exact:true})).toHaveCount(0);await actionMenu.press('Escape');
            checked.push('permission denial remains primary, without source instructions or contextual suggestion; restricted account has no Product feedback action');
            continue;
          }
          const selected=JSON.parse(readFileSync('/private/tmp/tenops-tenbot-review/refinement/selected-model.json','utf8')).outputs;
          const capturedGroup=selected.find(item=>item.id==='group');
          assert(capturedGroup?.answer.mode==='ai'&&capturedGroup.answer.sources.length>1,'Existing multi-source Qwen capture is required');
          const authoritativeNotice=group.answer.sources[0].constraints[0];
          const payload={...capturedGroup.answer,notices:[authoritativeNotice,authoritativeNotice]};
          await ask(capturedGroup.question,payload);
          let response=conversation.getByRole('article',{name:'TenBot assistant reply',exact:true}).last();
          const sourceControl=response.locator('[data-tenbot-sources]');
          await expect(response.locator('[data-tenbot-answer]')).toHaveText(payload.message);await expect(response.getByText(authoritativeNotice,{exact:true})).toBeVisible();
          await expect(sourceControl).toHaveCount(1);await expect(sourceControl).not.toHaveAttribute('open');
          await expect(sourceControl.locator('summary')).toHaveText(`Sources (${payload.sources.length}) · TenOps Guide`);
          await expect(sourceControl.locator('[data-tenbot-source]')).toHaveCount(payload.sources.length);
          for(const source of payload.sources)await expect(sourceControl.getByText(source.title,{exact:true})).not.toBeVisible();
          assert(await response.evaluate(element=>Boolean(element.querySelector('[data-tenbot-answer]').compareDocumentPosition(element.querySelector('[data-tenbot-sources]'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Conversation prose precedes one compact provenance control');
          await response.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/desktop-compact-sources.png`});
          await sourceControl.locator('summary').press('Enter');await expect(sourceControl).toHaveAttribute('open','');
          for(const source of payload.sources){const entry=sourceControl.locator('[data-tenbot-source]').filter({has:page.getByText(source.title,{exact:true})});await expect(entry.locator('p').nth(1)).toHaveText(source.guidance);await expect(entry).toContainText('Available');if(source.route)await expect(entry.getByRole('link')).toHaveAttribute('href',source.route);}
          await sourceControl.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/desktop-source-detail.png`});await sourceControl.locator('summary').click();
          await expect(panel.getByRole('button',{name:'Product feedback',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Clear assistant chat',exact:true})).toHaveCount(0);
          await actionMenu.press('Enter');await expect(panel.getByRole('button',{name:'Product feedback',exact:true})).toBeVisible();await page.screenshot({path:`${directory}/desktop-conversation-menu.png`});await actionMenu.press('Escape');
          await expect(panel).toBeVisible();await expect(actionMenu).toBeFocused();
          await action('Product feedback');await expect(panel.getByRole('region',{name:'Shared TenBot usage',exact:true})).toContainText('47 of 300 shared attempts');
          await expect(actionMenu.locator('..')).not.toHaveAttribute('open');await action('Product feedback');
          await action('Draft a feature suggestion');const form=panel.getByRole('form',{name:'Feature suggestion draft',exact:true});await expect(form).toBeVisible();await expect(form.getByRole('button',{name:'Submit suggestion',exact:true})).toBeDisabled();await form.getByRole('button',{name:'Cancel',exact:true}).click();
          answer=payload;holdNextAsk=true;const pendingBefore=askCount();await input.fill('How do I create a group while an answer is pending?');await input.press('Enter');await expect.poll(askCount).toBe(pendingBefore+1);await expect(input).toBeDisabled();await expect(panel.getByRole('button',{name:'Sending…',exact:true})).toBeDisabled();await input.dispatchEvent('keydown',{key:'Enter',code:'Enter'});assert.equal(askCount(),pendingBefore+1);releasePending();await expect(input).toHaveValue('');await expect(input).toBeEnabled();
          checked.push('answer is primary with one collapsed Sources control; expansion reveals all relevant guides/status/navigation; authoritative notices remain visible; secondary header menu retains feedback, clear and confirmed drafting with Escape/focus behavior');
          await page.setViewportSize({width:390,height:844});await contained();await sourceControl.scrollIntoViewIfNeeded();
          await page.screenshot({path:`${directory}/mobile-compact-sources.png`});await sourceControl.locator('summary').click();await contained();
          await sourceControl.locator('[data-tenbot-source]').last().scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/mobile-source-detail.png`});await sourceControl.locator('summary').press('Enter');
          await ask('How do I create a group while AI is unavailable?',{...group.answer,mode:'guide',fallback:true});
          response=conversation.getByRole('article',{name:'TenBot assistant reply',exact:true}).last();
          await expect(response.locator('[data-tenbot-answer]')).toHaveText(group.answer.sources[0].guidance);await expect(response).toContainText('AI is unavailable right now.');await expect(response.locator('[data-tenbot-sources][open]')).toHaveCount(0);
          const rework=selected.find(item=>item.id==='rework'),reworkSource=rework?.answer.sources.find(source=>source.id==='production-rework-create');assert(reworkSource,'Existing verified Rework source is required');
          await ask('How do I initiate Rework?',rework.answer);
          const eligibility={...rework.answer,mode:'verified',fallback:false,notices:[],sources:[reworkSource],message:'No. Rework requires the Job to be complete, unarchived, and have no active Rework cycle. You cannot initiate Rework before the Job is complete.'};
          await ask('Can I do that before the Job is complete?',eligibility);response=conversation.getByRole('article',{name:'TenBot assistant reply',exact:true}).last();
          await expect(response.locator('[data-tenbot-answer]')).toHaveText(eligibility.message);await expect(response.locator('[data-tenbot-sources]')).toHaveCount(1);await expect(response.locator('[data-tenbot-sources][open]')).toHaveCount(0);
          await response.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/mobile-verified-rework-eligibility.png`});
          await input.focus();await page.setViewportSize({width:390,height:500});await contained();await expect(input).toBeInViewport();await expect(panel.getByRole('button',{name:'Send',exact:true})).toBeInViewport();await page.setViewportSize({width:390,height:844});
          checked.push('mobile one-control provenance fits existing history; deterministic Rework eligibility remains primary; useful direct fallback and compact multiline composer preserve reduced-keyboard viewport (no-call UI fixtures)');
          await action('Clear assistant chat');await expect(conversation.getByRole('article',{name:'TenBot assistant reply',exact:true})).toHaveCount(0);
          await panel.getByRole('button',{name:'Back to conversations',exact:true}).click();await choose('Draft Review Bob');await expect(history.getByText(privateBody,{exact:true})).toBeVisible();
          await expect(input).toHaveAttribute('rows','3');assert(await input.evaluate(el=>el.style.height)==='','Normal Messaging composer does not retain TenBot sizing');await expect(actionMenu).toHaveCount(0);
          await input.fill('DM first');await input.press('Shift+Enter');await input.type('DM second');await expect(input).toHaveValue('DM first\nDM second');
          const dmBefore=calls.filter(call=>call.name==='send_my_work_message_v12').length,assistantBefore=askCount();await input.press('Enter');await expect(history.getByText('DM first\nDM second',{exact:true})).toBeVisible();assert.equal(calls.filter(call=>call.name==='send_my_work_message_v12').length,dmBefore+1);assert.equal(askCount(),assistantBefore);
          assert(!assistantCalls.some(call=>JSON.stringify(call).includes(privateBody)),'Employee-message content stays outside assistant requests');
          checked.push('clear uses existing assistant action; normal DM composer sizing/multiline behavior and private content stay separate');
          continue;
        }
        if(privacyOnly){
          await panel.locator('[data-messaging-composer] details summary').press('Enter');
          await expect(panel.getByText(/text you submit.*configured AI provider/)).toBeVisible();
          await panel.locator('[data-messaging-composer] details summary').press('Enter');
          const pasted='Customer: Synthetic customer\nMessage excerpt: the customer is not ready and the job is complete';
          await ask(pasted,group.answer);
          assert.equal(assistantCalls.filter(c=>c.action==='ask').at(-1).conversationId,undefined);
          await ask('What if that group button is missing?',group.answer);
          assert.equal(assistantCalls.filter(c=>c.action==='ask').at(-1).conversationId,'00000000-0000-4000-8000-000000000777');
          assert(assistantCalls.filter(c=>c.action==='ask').every(c=>c.context.length===1&&!c.context[0].includes(pasted)));
          await panel.getByLabel('TenBot conversation actions',{exact:true}).click();await panel.getByRole('button',{name:'Draft a feature suggestion',exact:true}).click();
          const form=panel.getByRole('form',{name:'Feature suggestion draft',exact:true});
          await expect(form.getByLabel('Requested capability',{exact:true})).toHaveValue('');
          await expect(form.getByLabel('Request wording to share',{exact:true})).toHaveValue('');
          await expect(form.getByLabel('Optional context and frequency',{exact:true})).toHaveValue('');
          await expect(form.getByRole('button',{name:'Submit suggestion',exact:true})).toBeDisabled();
          await form.getByLabel('Requested capability',{exact:true}).fill('Clearer group entry');
          await form.getByLabel('Current workflow or problem',{exact:true}).fill('Hard to find');
          await form.getByLabel('Desired behavior',{exact:true}).fill('Clearer entry');
          await form.getByLabel('Request wording to share',{exact:true}).fill('Make group entry easier to find');
          await form.getByRole('checkbox').check();await form.getByLabel(/^Desired behavior/).fill('Clearer confirmed entry');
          await expect(form.getByRole('button',{name:'Submit suggestion',exact:true})).toBeDisabled();
          await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Submit suggestion',exact:true}).click();
          await expect(form).toHaveCount(0);
          const submitted=assistantCalls.find(c=>c.action==='submit');assert(submitted.confirmed);assert(!JSON.stringify(submitted).includes(pasted));
          await panel.getByLabel('TenBot conversation actions',{exact:true}).click();await panel.getByRole('button',{name:'Clear assistant chat',exact:true}).click();
          await expect(conversation.getByText(pasted,{exact:true})).toHaveCount(0);
          assert.equal(assistantCalls.find(c=>c.action==='clear').conversationId,'00000000-0000-4000-8000-000000000777');
          await ask('How do I create a group conversation?',group.answer);
          assert.equal(assistantCalls.filter(c=>c.action==='ask').at(-1).conversationId,undefined);
          for(const call of assistantCalls)assert(!JSON.stringify(call).includes(privateBody)&&!JSON.stringify(call).includes(groupBody));
          await page.setViewportSize({width:390,height:844});await contained();
          await page.screenshot({path:`${directory}/privacy-${admin?'admin':'restricted'}-mobile.png`});
          checked.push('provider disclosure visible; explicit pasted text sends without automatic employee-message retrieval','follow-up sends only conversation ID and fixed module label','feedback fields do not inherit private chat; deliberate confirmation required','Clear assistant chat clears server handle and display; next ask starts fresh','mobile controls remain usable and private Messaging content stays out of requests');
          await page.setViewportSize({width:1440,height:1000});
          await panel.getByRole('button',{name:'Close Inbox',exact:true}).click();
        // Change only this browser's synthetic auth session. A result started by
        // the old owner must not reappear after the account controller resets.
        await messagingButton.click();await choose('TenBot');
        const ownerQuestion = 'How do I create a group before an account switch?';
        answer = group.answer;holdNextAsk = true;const beforeOwner = askCount();
        const ownerResponse = page.waitForResponse(response => response.url().startsWith(endpoint) && response.request().postDataJSON()?.question === ownerQuestion);
        await input.fill(ownerQuestion);await input.press('Enter');await expect.poll(askCount).toBe(beforeOwner + 1);
        activeUserId = '00000000-0000-0000-0000-000000000011';
        authUserOverride = await page.evaluate(nextId => ({...JSON.parse(localStorage.getItem('sb-localhost-auth-token')).user, id: nextId, email: 'switched-fixture@example.invalid'}), activeUserId);
        await page.evaluate(nextUser => {
          sessionStorage.setItem('tenops.welcomeHeroPlayed:'+nextUser.id,'true');
          const key = 'sb-localhost-auth-token', previous = localStorage.getItem(key), next = JSON.parse(previous);
          const parts = next.access_token.split('.'), claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          claims.sub = nextUser.id;next.user = nextUser;parts[1] = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');next.access_token = parts.join('.');
          const value = JSON.stringify(next);localStorage.setItem(key, value);
          // Supabase's existing cross-tab mechanism uses BroadcastChannel.
          const channel = new BroadcastChannel(key);channel.postMessage({event: 'SIGNED_IN', session: next});channel.close();
        }, authUserOverride);
        await expect.poll(() => switchedProfileSeen).toBe(true);await expect(conversation.getByText(ownerQuestion, {exact: true})).toHaveCount(0);
        releasePending();await (await ownerResponse).json();releaseProfile();
        await expect(messagingButton).toBeVisible();await messagingButton.click();await expect(panel).toBeVisible();await choose('TenBot');
        await expect(conversation.getByText(ownerQuestion, {exact: true})).toHaveCount(0);await expect(conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true})).toHaveCount(0);
        await expect(input).toBeEnabled();
        checked.push('synthetic account switch discards the previous owner conversation and its pending response');
          continue;
        }
        const official = history.locator(`#message-${officialId}`);
        await expect(official.getByText(officialBody, {exact: true})).toBeVisible();
        await expect(official).toContainText('TenOps system message');
        await expect(official.getByText(officialFilename, {exact: true})).toBeVisible();
        await expect(official.getByRole('button', {name: 'Download', exact: true})).toBeVisible();
        await expect(official.getByRole('button', {name: 'Message actions', exact: true})).toHaveCount(0);
        await expect(input).toHaveAttribute('enterkeyhint', 'send');
        await expect(panel.getByLabel('Attach files', {exact: true})).toHaveCount(0);
        assert(calls.filter(call => call.name === 'list_my_work_message_page_v12').every(call => call.body.p_peer === system), 'Opening TenBot reads only its existing official system history');
        assert(!realtime.some(frame => frame.topic?.includes('my-work-typing:')), 'TenBot does not subscribe to employee typing');
        checked.push('TenBot appears in ordinary Inbox without separate tab, menu action, launcher or workspace', 'official system notice and attachment are preserved with explicit label and no employee message actions');
        await ask(group.question, group.answer);
        await expect(conversation.getByText(group.answer.message, {exact: true})).toBeVisible();
        await expect(conversation.getByRole('link', {name: 'Open My Work', exact: true})).toHaveAttribute('href', '/my-work');
        await expect(conversation.getByText('Source: TenOps Guide', {exact: true})).toBeVisible();
        const chat = await conversation.innerText();
        assert(!chat.includes(group.answer.snapshot.revision) && !/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|capability snapshot|AI-selected guidance|\b2026-10-27\b/i.test(chat), 'Employee chat omits diagnostic metadata');
        const sentBefore = askCount();await input.press('Enter');await input.fill('   ');await input.press('Enter');await input.fill('IME draft');
        await input.dispatchEvent('keydown', {key: 'Enter', code: 'Enter', isComposing: true});
        await input.dispatchEvent('keydown', {key: 'Enter', code: 'Enter', keyCode: 229});
        await input.dispatchEvent('keydown', {key: 'Enter', code: 'Enter', repeat: true});
        await expect(input).toHaveValue('IME draft');assert.equal(askCount(), sentBefore);
        await input.fill('First line');await input.press('Shift+Enter');await input.type('Second line');await expect(input).toHaveValue('First line\nSecond line');assert.equal(askCount(), sentBefore);await input.fill('');
        checked.push('Enter sends one assistant request; empty, composing and repeated Enter do not send; Shift+Enter preserves a newline');
        if (!admin) {
          await expect(panel.getByRole('button', {name: 'Product feedback', exact: true})).toHaveCount(0);
          if (knowledgeCoverageOnly) {
            for (const id of ['rework-denied', 'manpower-denied', 'proposal-denied']) {
              const denied = workflowCase(id);await ask(denied.question, denied.answer);
              const response = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
              await expect(response).toContainText('does not have permission');await expect(response.getByRole('link')).toHaveCount(0);
              await expect(response).not.toContainText('Source: TenOps Guide');
              await expect(panel.getByRole('button', {name: 'Draft a feature suggestion', exact: true})).toHaveCount(0);
            }
            checked.push('read-only Rework, Manpower filtering and Proposal permission denials show no workflow link, instructions or contextual feature suggestion');
          }
          assert(!assistantCalls.some(call => call.action === 'usage'));await choose('Draft Review Bob');await expect(input).toBeDisabled();checked.push('authorized read-only account can ask TenBot without Messaging write or administrator usage access');continue;
        }
        await page.screenshot({path: `${directory}/desktop-tenbot-conversation.png`});
        const retryQuestion = 'How do I create a group after a temporary service failure?';
        failNextAsk = true;await input.fill(retryQuestion);await input.press('Enter');
        await expect(conversation.getByRole('alert')).toContainText('TenBot could not answer. Use Send to retry.');await expect(input).toHaveValue(retryQuestion);
        const ownContext = assistantCalls.filter(call => call.action === 'ask').at(-1).context;
        assert(ownContext[1]?.startsWith('Conversation context:\n') && ownContext[1].includes(`Employee: ${group.question}`) && ownContext[1].includes(`TenBot: ${group.answer.message.slice(0,650)}`), 'Follow-up context includes the employee’s own previous question and assistant prose');
        await ask(retryQuestion, group.answer);await expect(conversation.getByText(retryQuestion, {exact: true})).toHaveCount(1);await expect(conversation.getByRole('alert')).toHaveCount(0);
        checked.push('failed assistant send preserves its question and Send retry updates one conversation turn with bounded own-exchange follow-up context');
        await ask(unavailable.question, unavailable.answer, false);
        if (unavailable.answer.mode === 'guide') await expect(conversation.getByText('Here’s what I found in the TenOps Guide.', {exact: true}).last()).toBeVisible();
        else await expect(conversation.getByText(unavailable.answer.message, {exact: true})).toBeVisible();
        await expect(conversation.getByRole('link', {name: /Open Intake/})).toHaveCount(0);
        await panel.getByRole('button', {name: 'Draft a feature suggestion', exact: true}).click();
        const draft = panel.getByRole('form', {name: 'Feature suggestion draft', exact: true});
        await draft.getByLabel('Current workflow or problem').fill('Preserve this synthetic feature draft');
        await draft.getByLabel('Desired behavior').fill('Describe verified functionality clearly');
        await expect(draft.getByRole('button', {name: 'Submit suggestion', exact: true})).toBeDisabled();
        await input.fill('Retained TenBot composer draft');
        await choose('Draft Review Bob');await expect(history.getByText(privateBody, {exact: true})).toBeVisible();
        const dmBefore = calls.filter(call => call.name === 'send_my_work_message_v12').length;
        await input.fill('Synthetic DM send after assistant');await input.press('Enter');
        await expect(history.getByText('Synthetic DM send after assistant', {exact: true})).toBeVisible();
        assert.equal(calls.filter(call => call.name === 'send_my_work_message_v12').length, dmBefore + 1);
        await input.fill('DM first');await input.press('Shift+Enter');await input.type('DM second');await expect(input).toHaveValue('DM first\nDM second');
        await choose('Existing shop group');await expect(history.getByText(groupBody, {exact: true})).toBeVisible();
        await panel.getByRole('button', {name: 'View group participants', exact: true}).click();
        const members = page.getByRole('dialog', {name: 'Group participants', exact: true});
        await expect(members).not.toContainText('TenBot');await members.getByRole('button', {name: 'Close', exact: true}).click();
        await choose('TenBot');await expect(input).toHaveValue('Retained TenBot composer draft');await expect(draft.getByLabel('Current workflow or problem')).toHaveValue('Preserve this synthetic feature draft');
        await panel.getByRole('button', {name: 'Close Inbox', exact: true}).click();await messagingButton.click();await expect(panel).toBeVisible();
        await expect(draft.getByLabel('Current workflow or problem')).toHaveValue('Preserve this synthetic feature draft');
        await draft.getByRole('checkbox').check();await draft.getByRole('button', {name: 'Submit suggestion', exact: true}).click();
        await expect(panel.getByText('Suggestion submitted to Product. It has not been approved or added to the roadmap.', {exact: true})).toBeVisible();
        assert.equal(assistantCalls.filter(call => call.action === 'submit').length, 1);
        await input.fill('');checked.push('DM Enter and Shift+Enter behavior, group history and membership remain separate', 'assistant composer and confirmed feature draft persist across thread changes and close/reopen');
        await panel.getByRole('button', {name: 'Product feedback', exact: true}).click();
        const usage = panel.getByRole('region', {name: 'Shared TenBot usage', exact: true});
        await expect(usage).toContainText('47 of 300 shared attempts used today · 253 remaining.');await expect(usage).toContainText('47 of 6000 shared attempts used this month.');await expect(usage).toContainText('6 per minute per account.');await expect(usage).toContainText('4,750.5 of 8,000 Neurons');await expect(usage).toContainText('Monthly: 4,750.5 of 240,000');await expect(usage).toContainText('27,000 input / 4,300 output');await expect(usage).toContainText('20 unmeasured attempts retain conservative reservations');await expect(usage).toContainText('separate from Cloudflare’s actual account usage');await expect(usage).not.toContainText('$0.20');
        assert(!/Draft Review Bob|Draft Review Carol|Synthetic private message|[0-9a-f]{8}-[0-9a-f-]{27}/i.test(await usage.innerText()));
        await panel.getByRole('button', {name: 'Product feedback', exact: true}).click();checked.push('administrator usage remains aggregate and inline');
        await ask('How do I create a group while AI is unavailable?', {...group.answer, mode: 'guide', fallback: true});
        await expect(conversation.getByText('AI is unavailable right now. Here’s guidance from the TenOps Guide.', {exact: true})).toBeVisible();
        await ask(customer.question, customer.answer);
        let customerResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
        await expect(customerResponse).toContainText('Customer Inspector');await expect(customerResponse).toContainText('Save Changes');
        await expect(customerResponse.getByRole('link', {name: 'Open Contacts', exact: true})).toHaveAttribute('href', '/contacts');
        await customerResponse.getByRole('link', {name: 'Open Contacts', exact: true}).click();await expect(page).toHaveURL(`${origin}/contacts`);
        await expect(conversation.getByText(customer.question, {exact: true})).toBeAttached();
        for (const denied of deniedCustomers) {
          await ask(customer.question, denied.answer);const response = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
          await expect(response).toContainText('does not have permission');await expect(response.getByRole('link')).toHaveCount(0);await expect(response).not.toContainText('Customer Inspector');
          await expect(panel.getByRole('button', {name: 'Draft a feature suggestion', exact: true})).toHaveCount(0);
        }
        checked.push('source attribution, direct-guide fallback, Contacts navigation and permission-specific guidance remain intact');
        // A pending assistant response belongs to TenBot even if another thread
        // is selected while the request is outstanding.
        answer = group.answer;holdNextAsk = true;const beforePending = askCount(), pendingQuestion = 'How do I create a group while a response is pending?';
        const pendingResponse = page.waitForResponse(response => response.url().startsWith(endpoint) && response.request().postDataJSON()?.question === pendingQuestion);
        await input.fill(pendingQuestion);await input.press('Enter');await expect.poll(askCount).toBe(beforePending + 1);
        await input.dispatchEvent('keydown', {key: 'Enter', code: 'Enter'});assert.equal(askCount(), beforePending + 1);
        await choose('Draft Review Bob');await expect(input).toHaveValue('DM first\nDM second');
        releasePending();await (await pendingResponse).json();await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));await expect(history.getByText(privateBody, {exact: true})).toBeVisible();await expect(history.getByText(group.answer.message, {exact: true})).toHaveCount(0);
        await choose('TenBot');await expect(conversation.getByText(pendingQuestion, {exact: true})).toBeVisible();await expect(conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last()).toContainText(group.answer.message);
        checked.push('a duplicate submit during inference is ignored and late prose never renders in a private thread');
        await page.setViewportSize({width: 390, height: 844});await contained();
        await panel.getByRole('button', {name: 'Back to conversations', exact: true}).click();await choose('TenBot');
        await ask(customer.question, customer.answer);customerResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
        await expect(customerResponse.getByRole('link', {name: 'Open Contacts', exact: true})).toBeVisible();
        await input.fill('Mobile unfinished question');await input.focus();await page.setViewportSize({width: 390, height: 500});await contained();await expect(input).toBeInViewport();await expect(panel.getByRole('button', {name: 'Send', exact: true})).toBeInViewport();
        await page.screenshot({path: `${directory}/mobile-keyboard-conversation.png`});await page.setViewportSize({width: 390, height: 844});
        await panel.getByRole('button', {name: 'Back to conversations', exact: true}).click();await choose('Draft Review Bob');await expect(input).toHaveValue('DM first\nDM second');
        await panel.getByRole('button', {name: 'Back to conversations', exact: true}).click();await choose('TenBot');await expect(input).toHaveValue('Mobile unfinished question');
        await page.screenshot({path: `${directory}/mobile-tenbot-conversation.png`});
        checked.push('mobile conversation selection/back, separate drafts and reduced keyboard viewport stay usable');
        await page.setViewportSize({width: 1440, height: 1000});await page.goto(`${origin}/manpower-reporting?reviewRecord=synthetic-private-record`);await messagingButton.click();await choose('TenBot');
        await ask(manpower.question, manpower.answer);const manpowerResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
        if (knowledgeCoverageOnly) {
          assert.equal(manpower.question, 'how do i filter by jobs in manpower reporting');
          await expect(manpowerResponse).toContainText('Job labor review');await expect(manpowerResponse).toContainText('Clear job filter');
          await expect(manpowerResponse).toContainText('Source: TenOps Guide');await expect(manpowerResponse).not.toContainText('Contacts');
          await expect(manpowerResponse.getByRole('link', {name: 'Open Manpower Reporting', exact: true})).toHaveAttribute('href', '/manpower-reporting');
          checked.push('exact Manpower Job filtering question shows its released selector, reset steps and source link');
          const rework = workflowCase('rework');assert.equal(rework.question, 'how do i initiate a rework for a job?');
          await ask(rework.question, rework.answer);const reworkResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
          for (const text of ['Create Rework', 'Rework Scope / Work Required', 'Intake / Return Date', 'complete, unarchived', 'no active Rework cycle', 'Source: TenOps Guide']) await expect(reworkResponse).toContainText(text);
          await expect(reworkResponse.getByRole('link', {name: 'Open Production', exact: true})).toHaveAttribute('href', '/production');
          checked.push('exact Rework initiation question shows released creation steps, completed/unarchived/no-active-cycle prerequisites and Production link');
          const planning = workflowCase('planning-unavailable');await ask(planning.question, planning.answer);
          const planningResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
          await expect(planningResponse.getByText(planning.answer.message, {exact: true})).toBeVisible();
          await expect(planningResponse.getByRole('link')).toHaveCount(0);await expect(planningResponse).not.toContainText('Add Phase');
          checked.push('Planning deployment availability is explained without a live route or unreleased workflow instructions');
          const stock = workflowCase('inventory-stock');await ask(stock.question, stock.answer);
          const stockResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
          for (const text of ['Record Stock', 'Record Intake', 'Inventory Intake means a stock movement', 'Source: TenOps Guide']) await expect(stockResponse).toContainText(text);
          await expect(stockResponse.getByRole('link', {name: 'Open Inventory', exact: true})).toHaveAttribute('href', '/inventory');
          await expect(stockResponse.getByRole('link', {name: /Intake/})).toHaveCount(0);
          checked.push('Inventory stock Intake resolves to stock movements rather than the Pre-Production Intake workspace');
          await page.setViewportSize({width: 390, height: 844});await contained();
          const sample = workflowCase('sample-create');await ask(sample.question, sample.answer, false);
          const sampleResponse = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
          for (const text of ['New Sample', 'Save Sample', 'Source: TenOps Guide']) await expect(sampleResponse).toContainText(text);
          await expect(sampleResponse.getByRole('link', {name: 'Open Samples', exact: true})).toHaveAttribute('href', '/samples');
          await expect(input).toBeInViewport();await expect(panel.getByRole('button', {name: 'Send', exact: true})).toBeInViewport();
          await page.screenshot({path: `${directory}/mobile-workflow-guidance.png`});await page.setViewportSize({width: 1440, height: 1000});
          checked.push('released Sample creation guidance and source navigation fit the existing mobile conversation');
          if (replayActualConversations) {
            const renderedAnswers = new Map();
            for (const [index, item] of actualConversations.entries()) {
              if (refinementOnly ? !item.prior : index % 2 === 0) await panel.getByRole('button', {name: 'Clear assistant chat', exact: true}).click();
              const useLive = liveInferenceOnce && item.id === 'rework';
              if (useLive) nextAskLive = true;
              await ask(item.question, item.answer);
              if (useLive) {
                await expect.poll(()=>Boolean(liveRecord?.answer),{timeout:35000}).toBe(true);
                assert.equal(liveRecord.status,200,'Actual local assistant request succeeds');
                assert.equal(liveRecord.answer.mode,'ai','Actual ordinary Messaging Send reaches working inference');
                assert.notEqual(liveRecord.answer.fallback,true,'Live inference is distinguished from direct-search fallback');
                assert.equal(liveRecord.request.question,item.question);
              }
              const displayed = useLive ? liveRecord.answer : item.answer;
              renderedAnswers.set(item.id,displayed);
              const response = conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last();
              if (displayed.mode === 'guide') await expect(response).toContainText(displayed.fallback ? 'AI is unavailable right now.' : 'Here’s what I found in the TenOps Guide.');
              else await expect(response.getByText(displayed.message, {exact: true})).toBeVisible();
              for (const source of displayed.sources) {
                await expect(response.getByText(source.title, {exact: true})).toBeVisible();
                if (source.route) await expect(response.locator(`a[href="${source.route}"]`).first()).toBeVisible();
              }
              if (displayed.sources.length) await expect(response).toContainText('Source: TenOps Guide');
              if (refinementOnly ? Boolean(item.prior) : index % 2 === 1) {
                const previous = refinementOnly ? actualConversations.find(previous => previous.id === item.prior) : actualConversations[index - 1], request = assistantCalls.filter(call => call.action === 'ask').at(-1);
                const previousAnswer = renderedAnswers.get(previous.id) || previous.answer;
                const prose = previousAnswer.mode === 'guide' ? previousAnswer.sources.map(source => source.guidance).join(' ') || previousAnswer.message : previousAnswer.message;
                assert(request.context[1]?.includes(`Employee: ${previous.question.slice(0,450)}`) && request.context[1].includes(`TenBot: ${prose.slice(0,650)}`), 'Actual evaluation follow-up replays retain their own previous question and answer');
              }
              if (index === 0) {
                await response.getByText('TenBot · Assistant', {exact: true}).scrollIntoViewIfNeeded();
                await page.screenshot({path: `${directory}/desktop-conversational-sources.png`});
              }
            }
            const actualChat = await conversation.innerText();
            assert(!/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|capability snapshot|AI-selected guidance|\b2026-10-27\b/i.test(actualChat));
            await page.setViewportSize({width: 390, height: 844});await contained();await expect(input).toBeInViewport();
            await expect(panel.getByRole('button', {name: 'Send', exact: true})).toBeInViewport();
            await conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true}).last().getByText('TenBot · Assistant', {exact: true}).scrollIntoViewIfNeeded();
            await page.screenshot({path: `${directory}/mobile-conversational-followup.png`});await page.setViewportSize({width: 1440, height: 1000});
            if (liveInferenceOnce) checked.push('one ordinary Messaging Enter/Send uses actual local adapter inference, renders its actual answer and supplies actual own-answer follow-up context');
            checked.push(`${actualConversations.length} captured conversation evaluation turns, including recorded failures and fallbacks, replay with source links and own-dialogue follow-ups without new inference`);
          }
        } else {
          await expect(manpowerResponse.getByText(manpower.answer.message, {exact: true})).toBeVisible();await expect(manpowerResponse.getByRole('link')).toHaveCount(0);await expect(manpowerResponse).not.toContainText('Contacts');await expect(manpowerResponse).not.toContainText('Source: TenOps Guide');await expect(panel.getByRole('button', {name: 'Draft a feature suggestion', exact: true})).toHaveCount(0);
          checked.push('historical exact Manpower question remains a documentation gap in the Contacts correction replay');
        }
        for (const call of assistantCalls) {
          const serialized = JSON.stringify(call);assert(![privateBody, officialBody, officialFilename, officialStorage, groupBody, 'DM first', 'synthetic-private-record'].some(secret => serialized.includes(secret)), 'Assistant context excludes private employee/group messages, official rows and route record contents');
        }
        assert.equal(calls.filter(call => call.name === 'save_my_work_message_group').length, 0);
        assert(!calls.some(call => call.name === 'send_my_work_message_v12' && call.body.p_peer === system));
        await panel.getByRole('button', {name: 'Close Inbox', exact: true}).click();await expect(page.getByRole('button', {name: 'Notifications', exact: true}).getByLabel('1 unread notifications', {exact: true})).toBeVisible();
        checked.push('TenBot questions use only the assistant service and no private Messaging or official notice context', 'notification unread count remains independent');
        // Change only this browser's synthetic auth session. A result started by
        // the old owner must not reappear after the account controller resets.
        await messagingButton.click();await choose('TenBot');
        const ownerQuestion = 'How do I create a group before an account switch?';
        answer = group.answer;holdNextAsk = true;const beforeOwner = askCount();
        const ownerResponse = page.waitForResponse(response => response.url().startsWith(endpoint) && response.request().postDataJSON()?.question === ownerQuestion);
        await input.fill(ownerQuestion);await input.press('Enter');await expect.poll(askCount).toBe(beforeOwner + 1);
        activeUserId = '00000000-0000-0000-0000-000000000011';
        authUserOverride = await page.evaluate(nextId => ({...JSON.parse(localStorage.getItem('sb-localhost-auth-token')).user, id: nextId, email: 'switched-fixture@example.invalid'}), activeUserId);
        await page.evaluate(nextUser => {
          sessionStorage.setItem('tenops.welcomeHeroPlayed:'+nextUser.id,'true');
          const key = 'sb-localhost-auth-token', previous = localStorage.getItem(key), next = JSON.parse(previous);
          const parts = next.access_token.split('.'), claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          claims.sub = nextUser.id;next.user = nextUser;parts[1] = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');next.access_token = parts.join('.');
          const value = JSON.stringify(next);localStorage.setItem(key, value);
          // Supabase's existing cross-tab mechanism uses BroadcastChannel.
          const channel = new BroadcastChannel(key);channel.postMessage({event: 'SIGNED_IN', session: next});channel.close();
        }, authUserOverride);
        await expect.poll(() => switchedProfileSeen).toBe(true);await expect(conversation.getByText(ownerQuestion, {exact: true})).toHaveCount(0);
        releasePending();await (await ownerResponse).json();releaseProfile();
        await expect(messagingButton).toBeVisible();await messagingButton.click();await expect(panel).toBeVisible();await choose('TenBot');
        await expect(conversation.getByText(ownerQuestion, {exact: true})).toHaveCount(0);await expect(conversation.getByRole('article', {name: 'TenBot assistant reply', exact: true})).toHaveCount(0);
        await expect(input).toBeEnabled();
        checked.push('synthetic account switch discards the previous owner conversation and its pending response');
      } catch (error) {
        await page.screenshot({path: `${directory}/failure.png`, fullPage: true}).catch(() => {});
        writeFileSync(`${directory}/failure.txt`, `${await page.locator('body').innerText()}\n${error.stack}`);
        writeFileSync(`${directory}/failure-requests.json`, JSON.stringify({calls, realtime, assistantCalls}, null, 2));throw error;
      } finally {
        releasePending?.();releaseProfile?.();requestEvidence.push({admin, calls, realtime, assistantActions: assistantCalls.map(call => call.action), blockedOrigins: [...new Set(blocked)]});await context.close();
      }
    }
    assert.deepEqual(errors, []);
    assert(liveInferenceCalls <= 1,'At most one real UI inference per run');
    if (liveInferenceOnce) assert(liveRecord?.answer?.mode === 'ai','Live UI review must produce actual inference evidence');
    writeFileSync(`${directory}/browser-results.json`, JSON.stringify({passed: true, origin, iconOnly, presentationOnly, inferenceCalls: liveInferenceCalls, liveInferenceReceipt:liveInferenceOnce?'live-ui-answer.json':null, actualConversationalReplays: replayActualConversations ? actualConversations.length : 0, actualReplayModes: replayActualConversations ? actualConversations.map(item => ({id: item.id, mode: item.answer.mode, fallback: item.answer.fallback === true, evaluationError: Boolean(item.error)})) : [], replaySource: ['communication/evaluation.json', 'contacts-coverage/evaluation.json', ...(presentationOnly?['refinement/selected-model.json']:[]), ...(knowledgeCoverageOnly ? [refinementOnly ? 'refinement/browser-fixtures.json' : 'coverage/evaluation.json'] : []), ...(replayActualConversations ? [refinementOnly ? 'refinement/selected-model.json' : 'coverage/conversations.json'] : [])], checked, errors, requestEvidence, limitation: 'Synthetic browser RPCs establish UI isolation; recorded model failures/fallbacks remain distinct from accepted AI prose. Live authorization and physical iPhone keyboard/Web Push behavior are separate checks.'}, null, 2));
    console.log(`TenBot Inbox conversation browser checks passed (${checked.length} focused assertions; ${liveInferenceCalls} real inference calls).`);
  } finally {await browser.close();}
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
