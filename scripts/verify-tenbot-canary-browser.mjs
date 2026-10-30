// Narrow compiled-UI check only. Every Auth/data/model response is synthetic;
// no JWT/RLS, real grant activation, inference or database validation is claimed.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {chromium,expect} from '@playwright/test';
import {tsImport} from 'tsx/esm/api';
import {session} from './support/wave4-fixture.mjs';

const origin='http://localhost:3014',directory='/private/tmp/tenops-tenbot-chris-dev-grant-20261030/browser';
const pdfPath='docs/project-memory/evidence/2026-10-30-tenbot-receival-readiness/tendev-staging/canary-preparation/output/pdf/synthetic-tendev-receival-20261030-01.pdf',original=readFileSync(pdfPath);
const {TENBOT_CANARY_OWNER:owner,TENBOT_CANARY_DOCUMENT_SHA256:documentSha256,TENBOT_CANARY_DOCUMENT_REFERENCE:documentReference,TENBOT_CANARY_CATALOG_ID:catalogId}=await tsImport('../src/modules/inventory/tenbot-canary-access.ts',import.meta.url);
const {deriveInvoiceQuantity}=await tsImport('../src/modules/inventory/invoice-quantity.ts',import.meta.url);
const {accountHasCapability}=await tsImport('../src/lib/rbac.ts',import.meta.url);
assert.equal(createHash('sha256').update(original).digest('hex'),documentSha256,'Frozen synthetic invoice bytes changed.');
const id=n=>`10302026-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=value=>structuredClone(value),checks=[],errors=[],traces=[],blockedNetwork=[];
const profile={user_id:owner,display_name:'Synthetic Developer UI fixture',role:'developer',is_active:true,read_only:false,messaging_write:true,production_blend_manage:false,sample_labels_generate:false,job_updates_post:false};
const syntheticSession={...session(owner),user:{...session(owner).user,email:'canary-ui@example.invalid'}};
const staticHosts=new Set(['localhost']);
function findStaticHosts(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const location=path.join(directory,entry.name);if(entry.isDirectory())findStaticHosts(location);else if(entry.name.endsWith('.js'))for(const match of readFileSync(location,'utf8').matchAll(/https:\/\/([a-z0-9-]+)\.supabase\.co/g))staticHosts.add(match[1]);}}
// Only public compiled hostnames are read, never .env or saved credentials.
findStaticHosts('out/_next/static/chunks');
mkdirSync(directory,{recursive:true});
let child,browser,lastPage;
const deadline=setTimeout(()=>{console.error('Bounded canary UI verifier exceeded 120 seconds.');void browser?.close();child?.kill('SIGTERM');process.exitCode=1;},120000);
async function start(){
 await new Promise((resolve,reject)=>{const check=createServer();check.once('error',error=>reject(Error(`Port 3014 is not free; no existing server will be adopted or stopped: ${error.code}`)));check.listen(3014,'localhost',()=>check.close(resolve));});
 child=spawn(process.execPath,['tests/support/static-server.mjs'],{cwd:process.cwd(),env:{PORT:'3014'},stdio:['ignore','ignore','pipe']});
 let startupError='';child.stderr.on('data',value=>{startupError+=String(value).slice(0,1000);});
 const until=Date.now()+8000;
 while(Date.now()<until){if(child.exitCode!==null)throw Error(`Private static server exited before startup: ${startupError}`);try{const response=await fetch(origin+'/my-work',{signal:AbortSignal.timeout(500)});if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 throw Error('Private static server did not become ready within 8 seconds.');
}
const answer=message=>({mode:'assistant',message,contentScope:'workflow',sources:[],snapshot:{revision:'synthetic-ui-only',verifiedAt:'2026-10-30'},summary:null,suggestionAllowed:false});
function projection(){const now=Date.now();return {active:true,grantId:id(1),ownerId:owner,startsAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+14*60*1000).toISOString(),serverNow:new Date(now).toISOString(),documentSha256,documentReference,supplier:'T&M Supply',catalogSource:'standard',catalogId,quantityExpected:'1',unit:'Bag'};}
function initialDraft(){
 const sourceQuantity={quantity:'1',unit:'Bag'},sourceText='Alaska White | #0 | 1 Bag';
 return {id:id(2),revision:1,hash:'a'.repeat(64),status:'review_required',simulation:false,attachmentId:id(3),orderDetails:{orderedBy:'Synthetic canary owner',orderDate:'2026-10-30',location:'Denton'},missingFields:[],canApprove:false,durableDraftId:id(4),durableHash:'b'.repeat(64),executionEnabled:true,reviewed:true,provenance:{supplier:'T&M Supply',documentReference,attachmentSha256:documentSha256},rows:[{lineId:'L1',sourceText,sourceQuantity,quantityBasis:deriveInvoiceQuantity(sourceQuantity,{orderUnit:'Bag',packageQuantity:'50',packageMeasure:'LB',containerType:'Bag'},sourceText),materialId:'standard:'+catalogId,materialName:'Alaska White',size:'#0',quantity:'1',unit:'Bag',jobId:null,excluded:false,reasons:['potential_duplicate'],duplicateAcknowledgement:null,duplicateReview:{fingerprint:'c'.repeat(64),matches:[{recordId:id(8),source:'database',supplier:'T&M Supply',status:'pending',materialName:'Alaska White',size:'#0',quantityExpected:'1',quantityReceived:'0',unit:'Bag',documentReference:null,classification:'possible',reason:'Synthetic existing-receival UI evidence; invoice identity is not confirmed.'}],canAcknowledge:true,acknowledged:false}}]};
}
async function open(name,mobile=false){
 const access=projection(),state={active:true,draft:initialDraft(),calls:[],rpc:[],realWrites:0};
 const source={id:id(3),ownerId:owner,filename:path.basename(pdfPath),mediaType:'application/pdf',byteSize:original.byteLength,sha256:documentSha256,storageBucket:'invoice-receival-originals',storagePath:`${owner}/${id(3)}/original`,state:'ready',createdAt:access.serverNow,expiresAt:new Date(Date.parse(access.serverNow)+60*60*1000).toISOString(),version:1,verifiedAt:access.serverNow,retainedAt:null,retainedDraftId:null,evidenceSha256:null,agentState:null};
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();lastPage=page;page.setDefaultTimeout(10000);
 await page.clock.install({time:Date.now()});
 page.on('pageerror',error=>errors.push({name,message:error.message}));
 await context.addInitScript(({keys,value,owner})=>{for(const key of keys)localStorage.setItem('sb-'+key+'-auth-token',JSON.stringify(value));sessionStorage.setItem('tenops.welcomeHeroPlayed:'+owner,'true');sessionStorage.setItem('tenops.welcomeHeroPlayed:'+owner+':v1','true');},{keys:[...staticHosts],value:syntheticSession,owner});
 await context.routeWebSocket('**/*',route=>{blockedNetwork.push({name,kind:'websocket'});route.close();});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  const reply=options=>route.fulfill({headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'},...options});
  if(request.method()==='OPTIONS'&&/^\/(?:auth|rest|functions|storage)\/v1\//.test(url.pathname))return reply({status:204});
  if(url.pathname==='/functions/v1/tenbot'){
   const body=request.postDataJSON();state.calls.push(body.action);traces.push({scenario:name,action:body.action,workspace:body.workspace??null});
   if(body.action==='ask'&&body.question!=='Prepare synthetic review'){assert.equal(body.workspace,undefined,'Ordinary help must use the normal assistant workspace.');assert.equal(body.attachmentId,undefined,'Expired source must not accompany ordinary help.');}
   if(body.action==='status'&&body.workspace!=='invoice-receivals.v1')return reply({json:{mode:'assistant',historyAvailable:true,receivalPilotAvailable:true}});
   if(body.action==='status')return reply({json:{mode:'authenticated-receivals',simulation:false,databaseEnvironment:'restricted-tendev',requiresPrivateOriginal:true,canPrepare:true,canCreateCatalog:false,canAcknowledgeDuplicates:true,canaryAccess:access,executionEnabled:true,maxAttachmentBytes:90000,mediaTypes:['image/png','image/jpeg','application/pdf'],catalog:[{id:'standard:'+catalogId,materialName:'Alaska White',size:'#0',unit:'Bag',supplier:'T&M Supply',packageLabel:'50 LB Bag',packageQuantity:'50',packageMeasure:'LB',containerType:'Bag'}],jobs:[]}});
   if(body.action==='upload'){assert.equal(body.sourceId,source.id);return reply({json:{attachmentId:source.id,sourceId:source.id,filename:source.filename,mediaType:'application/pdf',simulation:false,expiresAt:source.expiresAt}});}
   if(body.action==='ask')return reply({json:body.question==='Prepare synthetic review'?{...answer('Synthetic prepared draft for UI-only validation. No model or database was called.'),localDemo:{simulation:false,draft:state.draft}}:answer('Open Inventory to review pending receivals. This is guidance; no action was performed.')});
   if(body.action==='review'){
    assert(state.active);assert.equal(body.edits.length,1);assert.equal(body.edits[0].duplicateAcknowledgement,'c'.repeat(64));
    state.draft={...state.draft,revision:2,hash:'d'.repeat(64),canApprove:true,rows:state.draft.rows.map(row=>({...row,reasons:[],duplicateAcknowledgement:'c'.repeat(64),duplicateReview:{...row.duplicateReview,acknowledged:true}}))};
    return reply({json:{draft:clone(state.draft)}});
   }
   if(body.action==='approve'){
    assert(state.active);state.draft={...state.draft,status:'created',canApprove:false};
    // UI transport only: this response does not create any database record.
    return reply({json:{draft:clone(state.draft),simulation:false,idempotent:false,createdCount:1,createdRecordIds:[id(7)],receivals:[{id:id(7),quantity_expected:1,quantity_received:0,status:'pending'}]}});
   }
   return reply({status:403,json:{error:'Synthetic UI verifier permits only its fixed status/help/review/approval transports.'}});
  }
  if(url.pathname.startsWith('/auth/v1/'))return reply({json:syntheticSession.user});
  if(url.pathname.startsWith('/storage/v1/object/')&&url.pathname.endsWith(`/invoice-receival-originals/${source.storagePath}`)){
   if(request.method()==='GET')return reply({body:original,contentType:'application/pdf'});
   if(request.method()==='POST'){assert(state.active);return reply({json:{Key:`invoice-receival-originals/${source.storagePath}`}});}
   return reply({status:403,json:{error:'Synthetic original transport permits only its fixed upload/download.'}});
  }
  if(url.pathname.startsWith('/rest/v1/')){
   const rpc=url.pathname.split('/').at(-1);state.rpc.push(rpc);
   if(rpc==='get_my_tenbot_receival_canary_access')return reply({json:state.active?{...access,serverNow:new Date(Date.now()).toISOString()}:{active:false,serverNow:new Date().toISOString()}});
   if(rpc==='begin_invoice_receival_source'){assert.equal(request.postDataJSON().p_sha256,documentSha256);return reply({json:{...source,state:'uploading'}});}
   if(rpc==='get_invoice_receival_source')return reply({json:source});
   const json=rpc==='get_my_app_access'?[profile]:rpc==='has_app_capability'||rpc==='has_proposal_access'?false:[];
   return reply({json,headers:{'Access-Control-Allow-Origin':origin,'content-range':'0-0/0'}});
  }
  if(url.origin===origin&&request.method()==='GET'&&!/^\/(?:storage|realtime|functions)\//.test(url.pathname))return route.continue();
  if(['data:','blob:'].includes(url.protocol))return route.continue();
  blockedNetwork.push({scenario:name,kind:'http',method:request.method(),path:url.pathname});return route.abort();
 });
 await page.goto(origin+'/my-work',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Messaging',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Inbox',exact:true});await expect(panel).toBeVisible();
 await panel.locator('aside').getByRole('button').filter({has:page.getByText('TenBot',{exact:true})}).click();
 const box=panel.getByRole('textbox',{name:'Message',exact:true});await expect(box).toBeEnabled();
 await expect(panel.getByRole('button',{name:'Attach PDF or image',exact:true})).toBeEnabled();
 return {context,page,panel,box,state,access,async send(question){await box.fill(question);await panel.getByRole('button',{name:'Send',exact:true}).click();},draft:()=>panel.getByRole('region',{name:'Editable pending receival draft',exact:true})};
}
async function ready(view){
 await view.panel.getByLabel('TenBot attachment file',{exact:true}).setInputFiles(pdfPath);
 await view.panel.getByRole('checkbox',{name:'I confirm this attachment contains approved synthetic test data.',exact:true}).check();
 await view.send('Prepare synthetic review');const draft=view.draft();await expect(draft).toBeVisible();
 await expect(view.panel.getByLabel('TenBot attachment',{exact:true})).toContainText(path.basename(pdfPath));
 const acknowledgement=draft.getByRole('checkbox',{name:'I checked the matching receival and confirm this is a separate order for approval.',exact:true});
 await expect(acknowledgement).toBeEnabled();await acknowledgement.check();
 await draft.getByRole('button',{name:'Save changes for review',exact:true}).click();
 const checked=draft.getByRole('checkbox',{name:'I reviewed these exact lines and approve pending receivals.',exact:true});await expect(checked).toBeEnabled();await checked.check();
 const approve=draft.getByRole('button',{name:'Approve and create pending receivals',exact:true});await expect(approve).toBeEnabled();
 return {draft,checked,approve};
}
try{
 await start();browser=await chromium.launch({headless:true,env:{PATH:process.env.PATH??'',HOME:process.env.HOME??'',TMPDIR:process.env.TMPDIR??'/tmp'}});
 assert.equal(accountHasCapability('developer','adjustInventory',false,true),false);assert.equal(accountHasCapability('developer','manageVendorsCatalog',false,true),false);assert.equal(accountHasCapability('developer','writeBusinessData',false,true),true);
 const revoked=await open('focus-revocation');
 try{
  const review=await ready(revoked);await expect(revoked.panel.getByRole('button',{name:'Request new catalog material',exact:true})).toHaveCount(0);
  checks.push('Unchanged Developer role cannot adjust Inventory or manage catalog globally; owner-scoped active projection enables the one-line duplicate review and exact approval controls.');
  revoked.state.active=false;await revoked.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(review.approve).toBeDisabled();await expect(review.checked).toBeDisabled();await expect(review.checked).not.toBeChecked();await expect(revoked.panel.getByRole('button',{name:'Attach PDF or image',exact:true})).toBeDisabled();await expect(revoked.panel.getByLabel('TenBot attachment',{exact:true})).toHaveCount(0);
  assert.equal(revoked.state.calls.filter(action=>action==='approve').length,0);assert(revoked.state.rpc.includes('get_my_tenbot_receival_canary_access'));
  await revoked.page.screenshot({path:directory+'/focus-revoked-desktop.png',fullPage:true});
  await revoked.send('How do I review pending receivals?');await expect(revoked.panel.locator('[data-tenbot-answer]').last()).toContainText('This is guidance; no action was performed.');
  assert(!revoked.state.calls.includes('clear'));assert(!revoked.state.rpc.some(name=>/removal|cleanup/.test(name)));
  checks.push('Focus refresh of revoked owner scope unchecks/disables pending approval and detaches only the browser attachment; no source cleanup is attempted and normal text-only TenBot guidance remains usable.');
 }finally{await revoked.context.close();}
 const expired=await open('server-duration-expiry',true);
 try{
  const review=await ready(expired);await expired.page.clock.fastForward(14*60*1000+50);
  await expect(review.approve).toBeDisabled();await expect(review.checked).toBeDisabled();await expect(review.checked).not.toBeChecked();await expect(expired.panel.getByRole('button',{name:'Attach PDF or image',exact:true})).toBeDisabled();await expect(expired.panel.getByLabel('TenBot attachment',{exact:true})).toHaveCount(0);
  await expect(expired.box).toBeEnabled();assert.equal(expired.state.calls.filter(action=>action==='approve').length,0);
  assert(await expired.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await expired.page.screenshot({path:directory+'/expired-mobile.png',fullPage:true});checks.push('Server-reported remaining lifetime expires the open 390px UI without an approval request; normal composer and mobile containment remain intact.');
 }finally{await expired.context.close();}
 const completed=await open('completed-receipt');
 try{
  const review=await ready(completed);await review.approve.click();await expect(review.draft).toContainText('Created pending-receival IDs: '+id(7));
  await completed.page.clock.fastForward(14*60*1000+50);completed.state.active=false;await completed.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(review.draft).toContainText('Created pending-receival IDs: '+id(7));await expect(review.draft).toContainText('Creation did not increase on-hand inventory.');await expect(review.draft.getByRole('link',{name:'Open pending receivals in Inventory',exact:true})).toBeVisible();
  assert.equal(completed.state.calls.filter(action=>action==='approve').length,1);await completed.page.screenshot({path:directory+'/completed-receipt-after-expiry.png',fullPage:true});checks.push('A synthetic successful receipt retains its returned ID and Inventory link after expiration/revocation; no approval replay or inference occurs.');
 }finally{await completed.context.close();}
 assert.deepEqual(errors,[]);
 const result={passed:true,checks,groups:checks.length,mode:'Compiled normal Messaging; intercepted synthetic Auth/status/draft/approval only. Not database security or inference evidence.',actualInference:false,actualDatabase:false,grantActivations:0,operationalWrites:0,externalRequestsForwarded:0,blockedNetwork,traces,errors,port:3014};
 writeFileSync(directory+'/report.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:directory+'/report.json',actualInference:false,actualDatabase:false,operationalWrites:0}));
}catch(error){await lastPage?.screenshot({path:directory+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(directory+'/failure.json',JSON.stringify({passed:false,message:error instanceof Error?error.message:String(error),checks,errors,traces,blockedNetwork,actualInference:false,actualDatabase:false,operationalWrites:0},null,2)+'\n');throw error;}
finally{clearTimeout(deadline);await browser?.close();if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);if(child.exitCode===null)child.kill('SIGKILL');}}
