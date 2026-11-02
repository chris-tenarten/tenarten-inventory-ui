/** Actual application -> loopback transport -> existing isolated Supabase.
 * Provider planning is explicitly scripted. Auth/history/Storage/canonical
 * Proposal and Pending receipts are real. No request/response tracing or secrets
 * are persisted; screenshots are taken only after credential UI is gone.
 */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium,expect,type Locator} from '@playwright/test';
import {INTEGRATED_REVIEW_API,INTEGRATED_REVIEW_DIRECTORY} from './support/tenbot-actions-isolated-review.mjs';

const origin=process.env.TENBOT_INTEGRATED_REVIEW_ORIGIN??'http://localhost:3000';
assert(['http://localhost:3000','http://localhost:3100'].includes(origin));
assert(process.argv.includes('--authorized-isolated-fixture'),'Explicit existing-isolate browser validation required');
const privateConfig=JSON.parse(readFileSync('/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json','utf8'));
assert.equal(privateConfig.projectRef,'jltgxcfiprocydhbrahz');
const secret=String(privateConfig.actors.admin.password);
const directory=INTEGRATED_REVIEW_DIRECTORY+'/browser';mkdirSync(directory,{recursive:true});
const resumePending=process.argv.includes('--resume-pending')?JSON.parse(readFileSync(directory+'/pending-stage-passed.json','utf8')):null;
const pendingOnly=process.argv.includes('--pending-only');
const resumeProposal=process.argv.includes('--resume-proposal')||pendingOnly?JSON.parse(readFileSync(directory+'/proposal-stage-passed.json','utf8')):null;
const prePendingCheckpoint=pendingOnly?JSON.parse(readFileSync(directory+'/pre-pending-stage-passed.json','utf8')):null;
const seedResponse=await fetch(INTEGRATED_REVIEW_API+'/review/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
assert(seedResponse.ok,'Existing synthetic Auth session unavailable');
const seed=await seedResponse.json();assert(seed.session?.user.id===privateConfig.actors.admin.id);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const checks:string[]=[],errors:string[]=[],blockedOrigins:string[]=[],apiCalls:Array<{workspace?:string;action:string}>=[],created:{proposal?:string;pending?:string[]}={};
const references:unknown[]=[],confirmationOutcomes:Array<{status:unknown;operation:unknown;result:unknown}>=[];
let credentialInChat=false,confirmed=0;
await context.addInitScript(session=>{
 const storage='sb-localhost-auth-token';
 if(!localStorage.getItem(storage))localStorage.setItem(storage,JSON.stringify(session));
 sessionStorage.setItem('tenops.welcomeHeroPlayed:'+session.user.id,'true');
},seed.session);
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin&&url.origin!==INTEGRATED_REVIEW_API){blockedOrigins.push(url.origin);await route.abort();return;}
 if(url.pathname==='/functions/v1/tenbot'&&request.method()==='POST'){
  const body=request.postDataJSON();
  apiCalls.push({action:String(body.action),...(typeof body.workspace==='string'?{workspace:body.workspace}:{})});
  if(body.workspace==='tenbot.actions.v1'&&body.action==='confirm')confirmed++;
  else if(request.postData()?.includes(secret))credentialInChat=true;
 }
 await route.continue();
});
// This bridge deliberately has no Realtime listener. Do not fabricate Messaging
// websocket success; ordinary Inbox read/render reuse is the adjacent UI check.
await context.routeWebSocket('**/realtime/v1/websocket*',socket=>socket.close());
const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
const panel=()=>page.locator('[data-tenbot-global-workspace]');
const cards=()=>panel().getByRole('region',{name:'Proposed TenOps action'});
const composer=()=>panel().getByRole('textbox',{name:'Message',exact:true});
const launcher=()=>page.getByRole('button',{name:'Open TenBot',exact:true});
const token=async()=>page.evaluate(()=>{const raw=localStorage.getItem('sb-localhost-auth-token');if(!raw)throw Error('Standard Auth session unavailable');return JSON.parse(raw).access_token as string;});
async function api(path:string,body?:unknown){const response=await fetch(INTEGRATED_REVIEW_API+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer '+await token(),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert(response.ok,'Isolated request rejected '+path+' '+response.status);return response;}
async function noPassword(){const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert(!storage.includes(secret),'Password reached browser storage');assert(!(await page.locator('body').innerText()).includes(secret));assert(!credentialInChat,'Password reached ordinary chat');}
async function open(){await expect(launcher()).toBeVisible({timeout:30000});if(await launcher().getAttribute('aria-expanded')!=='true')await launcher().click();await expect(panel()).toBeVisible({timeout:30000});await expect(composer()).toBeEnabled({timeout:30000});}
async function ask(question:string){
 await composer().fill(question);const send=panel().getByRole('button',{name:'Send',exact:true});await expect(send).toBeEnabled();
 const [answer]=await Promise.all([page.waitForResponse(response=>response.url()===INTEGRATED_REVIEW_API+'/functions/v1/tenbot'&&response.request().method()==='POST'&&response.request().postDataJSON()?.action==='ask',{timeout:125000}),send.click()]);
 assert.equal(answer.status(),200,'Actual hosted constructor ask failed');
 const value=await answer.json();assert(value.actionStatuses?.length===1,'Trusted host action publication missing');
 references.push(value.actionStatuses[0].card.reference);
 await expect(cards().last()).toBeVisible();await expect(cards().last().getByRole('button',{name:'Review and confirm',exact:true})).toBeEnabled();
 return value;
}
async function confirm(card:Locator,password:string){
 const response=page.waitForResponse(response=>response.url()===INTEGRATED_REVIEW_API+'/functions/v1/tenbot'&&response.request().method()==='POST'&&response.request().postDataJSON()?.workspace==='tenbot.actions.v1'&&response.request().postDataJSON()?.action==='confirm');
 const profile=password===secret?page.waitForResponse(response=>response.url().includes('/rest/v1/rpc/get_my_app_access')).then(response=>response.finished()):null;
 void response.catch(()=>{});if(profile)void profile.catch(()=>{});
 await card.getByRole('button',{name:'Review and confirm',exact:true}).click();
 const input=card.getByLabel('Your TenOps password',{exact:true});await input.waitFor({state:'visible'});
 // Uncontrolled credential input: avoid a Playwright fill call log containing
 // the private synthetic account password if a later browser assertion fails.
 await input.evaluate((element,value)=>{(element as HTMLInputElement).value=value;},password);await noPassword();
 await card.getByRole('button',{name:'Confirm action',exact:true}).click();
 await expect(page.getByLabel('Your TenOps password',{exact:true})).toHaveCount(0);
 const confirmation=await response;await confirmation.finished();
 const outcome=await confirmation.json();confirmationOutcomes.push({status:outcome.status??'rejected',operation:outcome.receipt?.operation??null,result:outcome.receipt?.result??null});
 if(outcome.session){outcome.session.access_token='';outcome.session.refresh_token='';delete outcome.session;}
 if(profile)await profile;
}
async function waitForCompletion(text:string){await expect(panel()).toBeVisible({timeout:45000});await expect(cards().last()).toContainText(text,{timeout:45000});}
try{
 if(resumePending){
  const prior=resumePending.confirmationOutcomes.find((outcome:{status:string;operation:string})=>outcome.status==='completed'&&outcome.operation==='inventory.create_pending_receivals');assert(prior&&prior.result.createdRecordIds.length===1,'A real completed Pending checkpoint is required');
  const reference=resumePending.references.at(-1);assert(reference);
  await page.goto(origin+'/inventory',{waitUntil:'domcontentloaded'});await open();
  const status=await (await api('/functions/v1/tenbot',{workspace:'tenbot.actions.v1',action:'status',reference})).json();assert.equal(status.state,'completed');assert.deepEqual(status.receipt.result.createdRecordIds,prior.result.createdRecordIds);assert.equal(status.receipt.result.onHandChangedByCreation,false);
  await page.setViewportSize({width:390,height:844});await expect(cards().last()).toContainText('Items added to Pending Receivals. Inventory quantities have not increased.');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await noPassword();await page.screenshot({path:directory+'/pending-mobile-completed.png'});
  checks.push('Reauthorized the exact previously committed Pending receipt in the actual mobile UI without an ask, password resubmission or execution');
  await page.reload({waitUntil:'domcontentloaded'});await open();await expect(cards().last()).toContainText('Items added to Pending Receivals. Inventory quantities have not increased.');assert.equal(confirmed,0);
  checks.push('Reload restores the real private durable Pending receipt with zero confirmation calls');
  await page.setViewportSize({width:1440,height:1000});await cards().last().getByRole('link',{name:'Open Pending Receivals'}).click();await expect(page).toHaveURL(origin+'/inventory#pending-receivals');if(await panel().isVisible())await panel().getByRole('button',{name:'Close TenBot',exact:true}).click();
  const rows=await (await api('/rest/v1/pending_receivals?select=id,status,quantity_expected,quantity_received,unit,material_name,ordered_by&id=eq.'+prior.result.createdRecordIds[0])).json();assert.equal(rows.length,1);assert.equal(Number(rows[0].quantity_expected),2);assert.equal(Number(rows[0].quantity_received),0);assert.equal(rows[0].unit,'Bag');
  const queue=page.locator('#pending-receivals');await expect(queue).toHaveAttribute('aria-hidden','false');const row=queue.locator('tbody tr').filter({hasText:rows[0].material_name}).filter({hasText:'Synthetic Integration Employee'}).last();await expect(row).toBeVisible({timeout:30000});await expect(row.getByRole('button',{name:'Receive',exact:true})).toBeVisible();await page.screenshot({path:directory+'/pending-queue.png'});
  checks.push('Actual committed-record queue link expands Inventory and visibly loads the canonical Pending row with the separate Receive action: expected 2 Bag, received 0');
  assert.deepEqual(errors,[]);assert.deepEqual(blockedOrigins,[]);assert(!credentialInChat);
  const report={passed:true,origin,checks,actualApplicationUi:true,actualSupabaseAuth:true,authEntry:'Genuine synthetic Auth session seeded through existing standard SDK storage; UI sign-in itself was not exercised',actualPrivateStorage:true,actualCanonicalPersistence:true,scriptedProviderTransport:true,modelInference:false,providerCalls:0,paidCostUsd:0,sharedProjectWrites:0,created:{proposals:['523b2402-59f5-4b0c-a012-07486bb5ef41','672adc49-7976-46a6-92b3-d88124307c31'],pending:prior.result.createdRecordIds},reference,confirmationCallsThisReadOnlyResume:confirmed,apiCalls,errors,blockedOrigins,passwordInChatOrDraftStorage:false,proposalCheckpoint:directory+'/proposal-stage-passed.json',prePendingCheckpoint:directory+'/pre-pending-stage-passed.json',pendingCheckpoint:directory+'/pending-stage-passed.json',invariants:INTEGRATED_REVIEW_DIRECTORY+'/final-invariants.json',screenAccess:'Headless isolated browser screenshots only; no macOS screen capture',pdfLimit:'Existing renderer and embedded valid exact-reference bytes verified; native PDF plugin visual fidelity is not certified'};
  writeFileSync(directory+'/results.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
 }else{
 await page.goto(origin+(pendingOnly?'/inventory':'/proposals'),{waitUntil:'domcontentloaded'});await open();
 await expect(page.locator('[data-tenbot-isolated-review]')).toContainText('Scripted conversation transport');
 await expect(page).toHaveTitle(/TenDev/);
 checks.push('Actual TenDev UI initializes genuine synthetic Auth, current account access and persistent private history at '+origin);

 const selection=seed.selection;
 let firstReference:unknown,proposalLink:Locator;
 if(resumeProposal){
  assert(typeof resumeProposal.created?.proposal==='string'&&resumeProposal.confirmationOutcomes?.some((outcome:{status:unknown;operation:unknown})=>outcome.status==='completed'&&outcome.operation==='proposal.save_draft'),'A real completed Proposal checkpoint is required; no simulated resume');
  const history=await (await api('/functions/v1/tenbot',{action:'history'})).json();
  const saved=history.turns.flatMap((turn:{answer?:{actionStatuses?:Array<{state:string;card:{reference:unknown};receipt?:{result?:{proposalId?:string}}}>}})=>turn.answer?.actionStatuses??[]).find((status:{state:string;receipt?:{result?:{proposalId?:string}}})=>status.state==='completed'&&status.receipt?.result?.proposalId===resumeProposal.created.proposal);
  assert(saved,'The previous canonical receipt must be reauthorized by the real host');firstReference=saved.card.reference;created.proposal=resumeProposal.created.proposal;references.push(firstReference);
  proposalLink=cards().filter({has:page.locator(`a[href="/proposals?open=${created.proposal}"]`)}).getByRole('link',{name:'Open Proposal draft'});
  if(!pendingOnly)await expect(proposalLink).toBeVisible();
  checks.push('Reused prior same-candidate real browser Proposal checkpoint: exact preview, wrong-password denial, status recovery, genuine fresh-session handoff and canonical $25 draft; current host reauthorizes the durable receipt without another write');
 }else{
 const answer=await ask(selection.question);firstReference=answer.actionStatuses[0].card.reference;
 await expect(cards().last()).toContainText('Synthetic white terrazzo tread');
 await cards().last().getByRole('button',{name:'Preview Proposal',exact:true}).click();
 await expect(cards().last().locator('iframe')).toBeVisible();
 assert((await cards().last().locator('iframe').getAttribute('src'))?.startsWith('blob:'));
 await page.screenshot({path:directory+'/proposal-preview.png'});
 await cards().last().getByRole('button',{name:'Close attachment preview'}).click();
 await cards().last().getByRole('button',{name:'Check status',exact:true}).click();
 await expect(cards().last().getByRole('button',{name:'Review and confirm',exact:true})).toBeEnabled();
 checks.push('Ordinary composer reaches real hosted discovery/preparation/publication; exact saved-reference PDF uses the unchanged renderer');

 await confirm(cards().last(),'wrong-isolated-password');
 await expect(cards().last().getByRole('alert')).toContainText('could not be verified');
 await expect(cards().last().getByRole('button',{name:'Review and confirm',exact:true})).toBeDisabled();
 await cards().last().getByRole('button',{name:'Check status',exact:true}).click();
 await expect(cards().last().getByRole('button',{name:'Review and confirm',exact:true})).toBeEnabled();
 const oldSession=await page.evaluate(()=>JSON.parse(atob(JSON.parse(localStorage.getItem('sb-localhost-auth-token')!).access_token.split('.')[1])).session_id);
 await confirm(cards().last(),secret);
 await waitForCompletion('Proposal draft saved. It has not been issued.');
 const freshSession=await page.evaluate(()=>JSON.parse(atob(JSON.parse(localStorage.getItem('sb-localhost-auth-token')!).access_token.split('.')[1])).session_id);
 assert.notEqual(freshSession,oldSession,'Password confirmation must install its new real Auth session');
 proposalLink=cards().last().getByRole('link',{name:'Open Proposal draft'});const href=await proposalLink.getAttribute('href');assert(href);
 const proposalId=new URL(href,origin).searchParams.get('open');assert(proposalId);created.proposal=proposalId;
 const proposalRows=await (await api('/rest/v1/proposals?select=id,status,job_id,total,project_name&id=eq.'+proposalId)).json();
 assert.equal(proposalRows.length,1);assert.equal(proposalRows[0].status,'draft');assert.equal(proposalRows[0].job_id,null);assert.equal(Number(proposalRows[0].total),25);
 await noPassword();await page.screenshot({path:directory+'/proposal-completed.png'});
 checks.push('Wrong password fails closed; explicit status recovers; genuine existing-account confirmation installs a fresh same-owner session and saves one actual standalone $25 Proposal draft');
 }

 if(pendingOnly){
  assert(prePendingCheckpoint?.checks?.length>=5,'Actual pre-Pending checkpoint required');
  checks.push('Reused completed actual library, receipt reload, expanded Workspace, Messaging draft, cancellation and server revision/supersession checkpoint; no operations were repeated');
 }else{
 await proposalLink.click();await expect(page).toHaveURL(new RegExp('/proposals\\?'));
 const proposalEditor=page.getByRole('dialog',{name:'Proposal Generator',exact:true});await proposalEditor.getByRole('button',{name:'Customer Proposal',exact:true}).click();
 await expect(proposalEditor.getByLabel('Project',{exact:true})).toHaveValue('Synthetic Integration Lobby',{timeout:30000});
 await open();await expect(cards().last()).toContainText('Proposal draft saved. It has not been issued.');
 await page.reload({waitUntil:'domcontentloaded'});await open();await expect(cards().last()).toContainText('Proposal draft saved. It has not been issued.');
 checks.push('Created-record link loads the actual Proposal library/draft; reload restores the committed read-only receipt through real private history');

 await panel().getByRole('button',{name:'Expand TenBot workspace'}).click();await expect(panel()).toHaveAttribute('aria-modal','true');
 await panel().getByRole('button',{name:'Collapse TenBot workspace'}).click();
 await composer().fill('Shared ordinary draft');await panel().getByRole('button',{name:'Close TenBot',exact:true}).click();
 await page.getByRole('button',{name:'Messaging',exact:true}).click();const inbox=page.getByRole('dialog',{name:'Inbox',exact:true});
 await inbox.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();
 await expect(inbox.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Shared ordinary draft');
 await inbox.getByRole('button',{name:'Close Inbox',exact:true}).click();await open();
 checks.push('Expanded Workspace and transitional Messaging preserve the same real owner conversation and ordinary unsent draft; no Realtime delivery claim');

 const cancel=await ask(selection.question);await cards().last().getByRole('button',{name:'Cancel action',exact:true}).click();await expect(cards().last()).toContainText('cancelled or replaced');
 const cancelledStatus=await (await api('/functions/v1/tenbot',{workspace:'tenbot.actions.v1',action:'status',reference:cancel.actionStatuses[0].card.reference})).json();assert.equal(cancelledStatus.state,'revoked');
 const correction=await ask(selection.question);await cards().last().getByRole('button',{name:'Ask TenBot to change these details'}).click();
 const replacement=await ask(selection.question+' Please replace the previous review with these details.');
 assert.equal(replacement.actionStatuses[0].card.reference.revision,correction.actionStatuses[0].card.reference.revision+1);
 assert.notEqual(replacement.actionStatuses[0].card.reference.id,correction.actionStatuses[0].card.reference.id);
 await cards().last().getByRole('button',{name:'Cancel action',exact:true}).click();await expect(cards().last()).toContainText('cancelled or replaced');
 checks.push('Cancellation reaches durable revoked status; ordinary correction publishes a new server revision and immutable reference rather than editing the old review');
 }

 const pendingSelection=await (await api('/review/scenario',{scenario:'pending'})).json();
 const original=Buffer.from(await (await api('/review/document.pdf')).arrayBuffer());
 await panel().getByLabel('TenBot attachment file',{exact:true}).setInputFiles({name:'synthetic-integration-invoice.pdf',mimeType:'application/pdf',buffer:original});
 await expect(panel()).toContainText(pendingSelection.reference+'.pdf',{timeout:30000});
 const pending=await ask(pendingSelection.question);assert.equal(pending.actionStatuses[0].card.operation,'inventory.create_pending_receivals');
 await expect(cards().last()).toContainText('Inventory quantities will not increase');
 await page.setViewportSize({width:390,height:844});await expect(panel()).toHaveAttribute('aria-modal','true');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await confirm(cards().last(),secret);await waitForCompletion('Items added to Pending Receivals. Inventory quantities have not increased.');
 const pendingStatus=await (await api('/functions/v1/tenbot',{workspace:'tenbot.actions.v1',action:'status',reference:pending.actionStatuses[0].card.reference})).json();
 assert.equal(pendingStatus.state,'completed');assert.equal(pendingStatus.receipt.result.onHandChangedByCreation,false);
 created.pending=pendingStatus.receipt.result.createdRecordIds;assert.equal(created.pending?.length,1);
 const pendingRows=await (await api('/rest/v1/pending_receivals?select=id,status,quantity_expected,quantity_received,unit&id=eq.'+created.pending![0])).json();
 assert.equal(pendingRows.length,1);assert.equal(pendingRows[0].status,'pending');assert.equal(Number(pendingRows[0].quantity_expected),2);assert.equal(Number(pendingRows[0].quantity_received),0);assert.equal(pendingRows[0].unit,'Bag');
 await noPassword();await page.screenshot({path:directory+'/pending-mobile-completed.png'});
 const beforeConfirmCount=confirmed;await page.reload({waitUntil:'domcontentloaded'});await open();await expect(cards().last()).toContainText('Items added to Pending Receivals. Inventory quantities have not increased.');assert.equal(confirmed,beforeConfirmCount,'History restoration must not replay a confirmation');
 checks.push('Actual composer uploads the exact owner-private attested original; real document/catalog/Pending preparation and mobile password confirmation create exactly one canonical queue entry: expected 2 Bag, received 0; reload rehydrates its receipt without resubmission');
 await page.setViewportSize({width:1440,height:1000});await cards().last().getByRole('link',{name:'Open Pending Receivals'}).click();await expect(page).toHaveURL(origin+'/inventory#pending-receivals');
 if(await panel().isVisible())await panel().getByRole('button',{name:'Close TenBot',exact:true}).click();
 const queue=page.locator('#pending-receivals');await expect(queue).toHaveAttribute('aria-hidden','false');
 const row=queue.locator('tbody tr').filter({hasText:pendingSelection.catalog.item_name}).filter({hasText:'Synthetic Integration Employee'}).last();
 await expect(row).toBeVisible();await expect(row).toContainText('2');await expect(row).toContainText('0');await expect(row.getByRole('button',{name:'Receive',exact:true})).toBeVisible();
 await page.screenshot({path:directory+'/pending-queue.png'});
 await api('/review/scenario',{scenario:'proposal'});
 checks.push('Committed Pending queue link opens the actual Inventory library and expands the visible canonical row with a separate Receive action; manual review returns to the Proposal scripted example');

 assert.deepEqual(errors,[]);assert.deepEqual(blockedOrigins,[]);assert(!credentialInChat);
 const report={passed:true,origin,checks,actualApplicationUi:true,actualSupabaseAuth:true,actualPrivateStorage:true,actualCanonicalPersistence:true,scriptedProviderTransport:true,modelInference:false,providerCalls:0,paidCostUsd:0,sharedProjectWrites:0,created,firstReference,references,confirmationOutcomes,apiCalls,errors,blockedOrigins,passwordInChatOrDraftStorage:false,inventoryInvariant:'Final server closure verifies unchanged stock fingerprint and transaction count',reusedEvidence:'Accepted backend expiry/replay/concurrency/rollback/privacy proofs and accepted Workspace synthetic account-switch tests',...(resumeProposal?{proposalCheckpoint:directory+'/proposal-stage-passed.json'}:{}),...(pendingOnly?{prePendingCheckpoint:directory+'/pre-pending-stage-passed.json'}:{})};
 writeFileSync(directory+'/results.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
 }
}catch(error){
 await page.locator('input[type="password"]').evaluateAll(inputs=>inputs.forEach(input=>{(input as HTMLInputElement).value='';})).catch(()=>{});
 await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});
 writeFileSync(directory+'/failure.json',JSON.stringify({passed:false,message:error instanceof Error?error.message:'Browser validation failed',checks,errors,apiCalls,created,references,confirmationOutcomes},null,2)+'\n',{mode:0o600});throw error;
}finally{await context.close();await browser.close();}
