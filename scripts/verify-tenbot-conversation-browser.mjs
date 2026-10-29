// One authorized real-Terra correction check in existing Messaging. No attachment,
// operational record lookup, database mutation or model-response substitution.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
if(!process.argv.includes('--authorized-live-help'))throw Error('Explicit authorized live-help flag required; uses preserved cumulative $5 ledger.');
const root='/private/tmp/tenops-tenbot-agent-poc',directory='/private/tmp/tenops-tenbot-live-2026-10-29/'+(process.argv.includes('--retry-cleanup')?'conversation-browser-retry':'conversation-browser'),origin='http://localhost:3000',endpoint='http://localhost:55595';
mkdirSync(directory,{recursive:true});if(existsSync(directory+'/report.json'))throw Error('Prior live help receipt exists; inspect rather than repeating inference.');
const server=JSON.parse(readFileSync(root+'/server.json','utf8'));assert.equal(server.model,'gpt-6.1-terra');assert.equal(server.mode,'synthetic-live');
const before=JSON.parse(readFileSync(root+'/openai-budget.json','utf8')),networkPath=`/private/tmp/tenops-tenbot-live-2026-10-29/network-live-${server.pid}.json`,networkBefore=existsSync(networkPath)?JSON.parse(readFileSync(networkPath,'utf8')).receipts.length:0,requests=[],errors=[],pending=[];
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',error=>errors.push(error.message));
page.on('request',r=>{if([endpoint,'http://localhost:55593','http://localhost:55596'].includes(new URL(r.url()).origin)&&r.method()==='POST')requests.push({origin:new URL(r.url()).origin,action:r.postDataJSON().action});});
let answer;page.on('response',r=>{if(new URL(r.url()).origin===endpoint&&r.request().method()==='POST'&&r.request().postDataJSON().action==='ask')pending.push((async()=>{answer={status:r.status(),body:await r.json()};})());});
const question='I opened Review changes on Production Timeline and the proposed dates look right. What do I choose next? Please do not save anything for me.';
const start=performance.now();
try{
 await page.goto(origin+'/my-work?tenbotExperiment=1',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Messaging',exact:true}).click();const panel=page.getByRole('dialog',{name:'Inbox',exact:true});await panel.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();
 const controls=panel.getByLabel('Local agent experiment controls',{exact:true});await expect(controls).not.toHaveAttribute('open','');
 const input=panel.getByRole('textbox',{name:'Message',exact:true});await expect(input).toBeEnabled();await input.fill(question);const sent=performance.now();await input.press('Enter');
 await expect.poll(()=>Boolean(answer),{timeout:100000}).toBe(true);await Promise.all(pending);assert.equal(answer.status,200);const result=answer.body;assert.equal(result.agent.status,'completed');assert.equal(result.agent.model,'gpt-6.1-terra');assert.equal(result.agent.invoiceAttached,false);assert.equal(result.localDemo.draft,null);assert.deepEqual(result.agent.final.completed_actions,[]);
 const actual=result.message;assert(/Save all changes/.test(actual));assert(/confirm/i.test(actual));assert(!actual.includes('**'));
 const calls=result.agent.trace.filter(t=>t.event==='tool').map(t=>t.name);assert(calls.includes('search_workflow_knowledge'));assert(calls.every(name=>['discover_capabilities','search_workflow_knowledge'].includes(name)));
 await expect(panel.locator('[data-tenbot-answer]')).toContainText(actual);await page.screenshot({path:directory+'/desktop-conversation.png'});await page.setViewportSize({width:390,height:844});await panel.locator('[data-tenbot-answer]').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:directory+'/mobile-conversation.png'});
 writeFileSync(directory+'/core-result.json',JSON.stringify({actualAnswer:actual,response:result,requests,journalBefore:before},null,2));
 const fixtureToken='fixture.'+Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000900021'})).toString('base64url')+'.local';
 const headers={Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+fixtureToken};
 const cleared=await page.request.post(endpoint,{headers,data:{action:'clear',conversationId:result.conversationId},timeout:3000});
 const replayed=await page.request.post(endpoint,{headers,data:{action:'ask',conversationId:result.conversationId,question:'What next?'},timeout:3000});
 const cleanup={cleared:cleared.status(),replayed:replayed.status()};assert.equal(cleanup.cleared,200);assert.equal(cleanup.replayed,403);

 const after=JSON.parse(readFileSync(root+'/openai-budget.json','utf8'));assert(after.reservedOrSpentUsd<=5);assert.equal(after.attempts,after.settled);assert.equal(errors.length,0);assert(requests.every(r=>r.origin===endpoint));
 const allNetwork=JSON.parse(readFileSync(networkPath,'utf8')),network={...allNetwork,receipts:allNetwork.receipts.slice(networkBefore)};assert.equal(network.fatalReason,null);assert(network.receipts.every(r=>r.httpStatus===200&&r.costMeasured));
 const receipt={passed:true,mode:'REAL Terra inference through actual localhost Messaging; verified workflow knowledge only, synthetic caller grants, no database/attachment or operational writes',question,actualAnswer:actual,response:result,latencyMs:result.agent.durationMs,browserAnswerAndChecksMs:Math.round(performance.now()-sent),totalBrowserMs:Math.round(performance.now()-start),journalBefore:before,journalAfter:after,costUsd:after.reservedOrSpentUsd-before.reservedOrSpentUsd,network,requests,errors,cleanup,checks:['Conversational composer is primary; optional invoice controls remain closed','Actual model independently discovers and retrieves verified workflow knowledge','Correct Save all changes plus explicit confirmation; no claimed execution','Plain-text answer renders in desktop and contained mobile Messaging','Clear destroys owner conversation; replay rejected before inference'],sourcePins:['supabase/functions/_shared/tenbot-agent.ts','supabase/functions/_shared/tenbot-agent-session.ts','supabase/functions/_shared/tenbot-agent-operations.ts','scripts/support/tenbot-live-demo.mts','src/modules/tenbot/TenbotWorkspace.tsx'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),databaseSecurityVerified:false,productionWrites:0};
 writeFileSync(directory+'/report.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({passed:true,actualAnswer:actual,apiCalls:network.receipts.length,costUsd:receipt.costUsd,report:directory+'/report.json'}));
}catch(error){await Promise.allSettled(pending);writeFileSync(directory+'/report.json',JSON.stringify({passed:false,failure:error.message,question,answer,requests,errors,journalBefore:before,journalAfter:JSON.parse(readFileSync(root+'/openai-budget.json','utf8'))},null,2));throw error;}
finally{await browser.close();}
