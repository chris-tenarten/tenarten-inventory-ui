// Actual localhost Messaging, using its existing safe review session. No Auth
// injection or request interception. The explicit server gate below prohibits
// this browser verifier from consuming model inference or paid credits.
import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

if(!process.argv.includes('--scripted-local'))throw Error('Use --scripted-local after the local scripted review server/export are ready.');
const origin='http://localhost:3000',endpoint='http://localhost:55595';
const directory='/private/tmp/tenops-tenbot-agent-poc/browser';
const server=JSON.parse(readFileSync('/private/tmp/tenops-tenbot-agent-poc/server.json','utf8'));
assert.equal(server.origin,origin);assert.equal(server.port,55595);assert.equal(server.mode,'offline-scripted');assert.equal(server.spendingAuthorized,false);assert.equal(server.databaseWrites,false);
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
const responses=[],errors=[],checks=[],requests=[],capturePromises=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
 const url=new URL(request.url());
 if(!['http://localhost:55593',endpoint].includes(url.origin)||request.method()!=='POST')return;
 const body=request.postDataJSON();requests.push({endpoint:url.origin,action:body.action});
});
page.on('response',response=>{
 if(new URL(response.url()).origin!==endpoint||response.request().method()!=='POST')return;
 capturePromises.push((async()=>{responses.push({request:response.request().postDataJSON(),status:response.status(),answer:await response.json()});})());
});
const askCount=()=>requests.filter(row=>row.endpoint===endpoint&&row.action==='ask').length;
const assertNoInference=()=>assert.equal(requests.filter(row=>row.endpoint==='http://localhost:55593'&&row.action==='ask').length,0,'The baseline Qwen adapter must never receive a question from this verifier.');
let panel;
async function openTenbot(url){
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Messaging',exact:true}).click();
 panel=page.getByRole('dialog',{name:'Inbox',exact:true});await expect(panel).toBeVisible();
 await panel.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();
 await expect(panel.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
}
async function screenshot(name){
 // Capture only the selected TenBot history pane, excluding peer and app sidebars.
 if(name.startsWith('desktop-')){
  const target=panel.locator(name.includes('invoice')?'[aria-label="Pending receival proposals"]':'[aria-label="Experimental operational answer"]').last();
  if(await target.count())await target.evaluate(element=>{const history=element.closest('[data-message-history]');if(history)history.scrollTop+=element.getBoundingClientRect().top-history.getBoundingClientRect().top-8;});
 }
 const pane=panel.locator('[data-message-history]');const box=await pane.boundingBox();assert(box);
 const viewport=page.viewportSize(),x=Math.max(0,box.x),y=Math.max(0,box.y);
 await page.screenshot({path:directory+'/'+name+'.png',clip:{x,y,width:Math.min(box.width,viewport.width-x),height:Math.min(box.height,viewport.height-y)}});
}
async function ask(question){
 const before=responses.filter(row=>row.request.action==='ask').length;
 const input=panel.getByRole('textbox',{name:'Message',exact:true});await input.fill(question);await input.press('Enter');
 await expect.poll(()=>responses.filter(row=>row.request.action==='ask').length,{timeout:90000}).toBe(before+1);await expect(input).toBeEnabled();
 const row=responses.filter(row=>row.request.action==='ask').at(-1);assert.equal(row.status,200);assert.equal(row.answer.agent?.mode,'offline-scripted');assert.equal(row.answer.agent?.status,'completed');assert.equal(row.answer.agent?.executionAvailable,false);assert.equal(row.answer.agent?.usage.costUsd,0);assert.equal(row.answer.agent?.usage.inputTokens,0);assert.equal(row.answer.agent?.usage.outputTokens,0);
 await expect(panel.locator('[data-tenbot-answer]').last()).toHaveText(row.answer.message);
 const review=panel.locator('[aria-label="Experimental operational answer"]').last();await expect(review).toBeVisible();await expect(review).toContainText('no model inference');await expect(review).toContainText('No execution capability');await expect(review).toContainText('Completed database actions: none.');assertNoInference();
 return row.answer;
}
async function clear(){
 await panel.locator('summary[aria-label="TenBot conversation actions"]').click();
 await panel.getByRole('button',{name:'Clear assistant chat',exact:true}).click();
 await expect(panel.locator('[aria-label="Experimental operational answer"]')).toHaveCount(0);
 await expect(panel.getByRole('textbox',{name:'Message',exact:true})).toBeEnabled();
}
const proposals=answer=>{assert.equal(answer.agent.proposals.length,1);return answer.agent.proposals[0].proposal;};
function verifyInvoice(proposal,confirmed){
 assert.equal(proposal.execution_available,false);assert.equal(proposal.status,'review_only_no_execution');assert.equal(proposal.ready_lines.length,2);assert.equal(proposal.held_lines.length,3);assert.equal(proposal.excluded_lines.length,1);
 assert.deepEqual(proposal.ready_lines.map(line=>[line.proposal.quantity_expected,line.proposal.unit]),[['2','Bag'],['1','Pail']]);
 assert(proposal.held_lines.some(line=>line.reasons.includes('potential_duplicate')));assert(proposal.held_lines.some(line=>line.reasons.includes('ambiguous_catalog_match')));assert(proposal.held_lines.some(line=>line.reasons.includes('unmatched_material')));
 for(const line of proposal.held_lines)assert(!line.reasons.includes('invoice_catalog_package_conflict'),'The synthetic invoice states order counts in bags; it does not contradict catalog package sizes.');
 assert.deepEqual(proposal.missing_employee_confirmations,confirmed?[]:['ordered_by','order_date','location']);
 for(const line of proposal.ready_lines){assert.equal(line.proposal.order_date,confirmed?'2026-10-26':null);assert.equal(line.proposal.ordered_by,confirmed?'Synthetic Employee':null);assert.equal(line.proposal.location,confirmed?'Denton':null);}
}
try{
 await openTenbot(origin+'/my-work');
 await expect(panel.locator('[aria-label="Local agent experiment controls"]')).toHaveCount(0);assertNoInference();
 checks.push('Default actual Messaging loads with no experimental controls and no Qwen questions');

 await openTenbot(origin+'/my-work?tenbotExperiment=1');
 const controls=panel.locator('[aria-label="Local agent experiment controls"]');await expect(controls).toBeVisible();await controls.locator('summary').click();
 await controls.getByRole('combobox',{name:'Scripted test scenario'}).selectOption('job-investigation');
 const job=await ask('Investigate Job TB-2801: summarize its recorded status, saved schedule and labor, and explain what remains unknown.');
 for(const tool of ['find_jobs','get_job_summary','get_job_planning','get_job_labor_summary'])assert(job.agent.evidence.some(item=>item.tool===tool));
 assert.equal(job.agent.final.observations.length,3);assert.equal(job.agent.final.completed_actions.length,0);
 await panel.locator('[aria-label="Experimental operational answer"]').last().locator('summary').filter({hasText:'Experiment evidence and measurements'}).click();await screenshot('desktop-job');
 checks.push('Desktop actual Messaging shows model-independent multi-tool Job evidence with explicit scripted/no-execution labels');

 // Ordinary in-app navigation may remove the activation query. The mounted
 // conversation must retain its local route instead of falling through to Qwen.
 await page.evaluate(()=>history.replaceState({},'', '/my-work'));assert.equal(page.url(),origin+'/my-work');await expect(controls).toBeVisible();

 await clear();await controls.getByRole('combobox',{name:'Scripted test scenario'}).selectOption('invoice-preparation');await controls.getByRole('button',{name:'Attach synthetic invoice',exact:true}).click();
 await expect(controls).toContainText('Text fixture only; no photo/PDF interpretation is claimed.');
 const invoice=await ask("Here's the synthetic invoice. Create pending receivals for the materials listed.");verifyInvoice(proposals(invoice),false);
 const draft=panel.locator('[aria-label="Pending receival proposals"]').last();await expect(draft).toContainText('2 matched lines · 3 held · 1 excluded');await expect(draft).toContainText('Missing employee order details');await expect(draft).toContainText('No rows created.');
 assert(invoice.agent.final.questions.some(question=>question.includes('order date')));assert(!invoice.agent.trace.some(item=>/^(?:execute|create|save)_/.test(item.name??'')));await screenshot('desktop-invoice-incomplete');
 checks.push('Synthetic attachment produces two canonical draft quantities, three held lines, freight exclusion and missing-information questions');

 await controls.getByRole('textbox',{name:'Ordered by',exact:true}).fill('Synthetic Employee');await controls.getByLabel('Order date',{exact:true}).fill('2026-10-26');await controls.getByRole('textbox',{name:'Destination location',exact:true}).fill('Denton');
 const confirmed=await ask('Use the reviewed order details above and prepare the same invoice again for review. Do not execute any changes.');verifyInvoice(proposals(confirmed),true);assert.equal(confirmed.conversationId,invoice.conversationId);
 await expect(panel.locator('[aria-label="Pending receival proposals"]').last()).toContainText('Synthetic Employee · 2026-10-26 · Denton');await screenshot('desktop-invoice-reviewed');
 checks.push('Follow-up retains owner session context and uses explicitly reviewed order metadata without approving writes');
 assert(responses.filter(row=>row.request.action==='ask').every(row=>!Object.hasOwn(row.request,'localAgentExperiment')));assertNoInference();
 checks.push('Removing the URL activation query preserves the mounted local agent route; its internal marker never enters requests or Qwen');

 await page.setViewportSize({width:390,height:844});
 await panel.locator('[aria-label="Pending receival proposals"]').last().scrollIntoViewIfNeeded();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const bounds=await panel.boundingBox();assert(bounds&&bounds.x>=-1&&bounds.width<=391);await screenshot('mobile-invoice');
 const beforeBlur=askCount();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(panel.locator('[aria-label="Experimental operational answer"]')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(500);
 assert.equal(askCount(),beforeBlur);await expect(panel.locator('[aria-label="Experimental operational answer"]')).toHaveCount(0);assertNoInference();
 checks.push('390×844 contains the actual panel; blur removes live agent facts and focus neither restores stale facts nor starts inference');

 await Promise.all(capturePromises);assert.equal(errors.length,0);assertNoInference();
 writeFileSync(directory+'/report.json',JSON.stringify({passed:true,at:new Date().toISOString(),origin,endpoint,mode:'offline-scripted; no model-quality result',checks,responses,requests,errors,authFixturesInjectedByVerifier:false,requestInterceptions:0,modelInferenceCalls:0,databaseWrites:false},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,experimentalQuestions:askCount(),modelInferenceCalls:0,directory}));
}catch(error){
 await Promise.allSettled(capturePromises);if(panel)await screenshot('failure').catch(()=>{});
 writeFileSync(directory+'/failure.json',JSON.stringify({error:error.message,responses,requests,errors,authFixturesInjectedByVerifier:false,requestInterceptions:0},null,2));throw error;
}finally{await browser.close();}
