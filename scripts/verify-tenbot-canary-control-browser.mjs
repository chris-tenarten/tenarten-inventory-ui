/** Bounded source-component browser evidence only. The real component, caller
 * service, validators and Supabase SDK run against intercepted synthetic Auth /
 * REST transport. Nothing is forwarded to a server. This is not hosted RPC,
 * JWT, RLS, grant, database, inference or deployed-route validation. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {tsImport} from 'tsx/esm/api';
import {session} from './support/wave4-fixture.mjs';

const root=process.cwd(),directory='/private/tmp/tenops-tenbot-chris-dev-staging-20261030/canary-preparation/application-controls/browser';
const fixtureOrigin='https://canary-ui-fixture.supabase.invalid',enabledOrigin='https://tendev.pages.dev',reviewOrigin='http://localhost:3000';
const now=Date.parse('2026-10-30T19:00:00Z'),iso=value=>new Date(value).toISOString(),clone=value=>structuredClone(value);
const id=number=>`10302026-0000-4000-8000-${String(number).padStart(12,'0')}`;
const admin=id(1),grantId=id(2),draftId=id(3),recordId=id(4),approvalId=id(5),sourceId=id(6),hash='a'.repeat(64);
const {TENBOT_CANARY_OWNER:owner,TENBOT_CANARY_CATALOG_ID:catalog,TENBOT_CANARY_DOCUMENT_SHA256:sha,TENBOT_CANARY_DOCUMENT_REFERENCE:reference}=await tsImport('../src/modules/inventory/tenbot-canary-access.ts',import.meta.url);
const checks=[],errors=[],traces=[],blockedNetwork=[],unexpectedNetwork=[],mutationRequests=[];
const digest=value=>createHash('sha256').update(value).digest('hex');
mkdirSync(directory,{recursive:true});
const sourcePaths=['src/modules/tenbot/TenbotCanaryControl.tsx','src/modules/inventory/tenbot-canary-control.ts','src/modules/inventory/tenbot-canary-access.ts','src/modules/inventory/invoice-receival-service.ts','src/modules/inventory/invoice-receival-attachments.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(file=>[file,digest(readFileSync(file))]));

// Test-only adapters never read the application's Auth storage, .env or profile.
const authSource=`import {useSyncExternalStore} from 'react';
let snapshot=window.__canaryFixtureAuth; const listeners=new Set();
window.addEventListener('tenops-canary-fixture:auth',event=>{snapshot=event.detail;window.__canaryFixtureAuth=snapshot;for(const listener of listeners)listener();});
export function useAuth(){const value=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>snapshot);return {...value,can:capability=>value.capabilities[capability]===true};}`;
const supabaseSource=`import {createClient} from '@supabase/supabase-js';
export const supabase=createClient('${fixtureOrigin}','synthetic-public-anon-key',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'canary-synthetic-only',storage:{getItem:()=>JSON.stringify(window.__canaryFixtureAuth.session),setItem:()=>{},removeItem:()=>{}}}});`;
const harnessSource=`import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import TenbotCanaryControl from '${path.join(root,'src/modules/tenbot/TenbotCanaryControl.tsx')}';
function Harness(){const [revision,setRevision]=useState(0);useEffect(()=>{document.documentElement.dataset.canaryFixtureReady='true';const remount=()=>setRevision(value=>value+1);window.addEventListener('tenops-canary-fixture:remount',remount);return()=>window.removeEventListener('tenops-canary-fixture:remount',remount)},[]);return <TenbotCanaryControl key={revision} mode={new URLSearchParams(location.search).get('mode')??'off'}/>;}createRoot(document.getElementById('root')).render(<Harness/>);`;
writeFileSync(directory+'/auth-fixture.ts',authSource);writeFileSync(directory+'/supabase-fixture.ts',supabaseSource);writeFileSync(directory+'/harness.tsx',harnessSource);
const bundled=await build({stdin:{contents:harnessSource,resolveDir:root,sourcefile:'canary-control-browser-harness.tsx',loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-auth-only',setup(builder){builder.onResolve({filter:/^@\/lib\/(auth|supabase)$/},args=>({path:args.path,namespace:'canary-fixture'}));builder.onLoad({filter:/.*/,namespace:'canary-fixture'},args=>({contents:args.path.endsWith('/auth')?authSource:supabaseSource,loader:'ts',resolveDir:root}));}}],metafile:true});
const bundle=Buffer.from(bundled.outputFiles[0].contents);writeFileSync(directory+'/harness.js',bundle);writeFileSync(directory+'/bundle-inputs.json',JSON.stringify(bundled.metafile,null,2)+'\n');
const staticDirectory=existsSync(path.join(root,'.next/static/css'))?'.next/static':'out/_next/static';
const cssDirectory=path.join(root,staticDirectory,'css');
const cssFiles=readdirSync(cssDirectory).filter(file=>file.endsWith('.css')).sort();
assert(cssFiles.length,'An existing production CSS export is required for visual containment checks; do not substitute unstyled evidence.');
const css=Buffer.concat(cssFiles.map(file=>readFileSync(path.join(cssDirectory,file))));
const assets=new Map([['/fixture.js',{body:bundle,contentType:'application/javascript'}],['/fixture.css',{body:css,contentType:'text/css'}]]);
const mediaDirectory=path.join(root,staticDirectory,'media');
for(const file of readdirSync(mediaDirectory))if(file.endsWith('.woff2'))assets.set('/_next/static/media/'+file,{body:readFileSync(path.join(mediaDirectory,file)),contentType:'font/woff2'});
// Exported CSS has /_next/static/media or ../media URLs; both are local buffers.
for(const [url,asset]of [...assets])if(url.startsWith('/_next/static/media/'))assets.set('/media/'+path.basename(url),asset);
const html='<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0;background:white"><div id="root"></div><script src="/fixture.js"></script></body></html>';

function authFixture(kind='admin'){
 const uid=kind==='owner'?owner:kind==='other'?id(99):admin,role=kind==='owner'||kind==='other'?'developer':kind==='member'?'staff':'admin';
 const authenticated=kind!=='anonymous',readOnly=kind==='readonly';
 return {ready:true,accessAllowed:authenticated,isAuthenticated:authenticated,user:authenticated?{id:uid}:null,profile:authenticated?{userId:uid,role,isActive:true,readOnly}:null,session:authenticated?session(uid):null,capabilities:{readOperationalData:true,writeBusinessData:true,manageRolesPermissions:role==='admin'&&!readOnly}};
}
function statusFor(viewer='admin',grant=false){return {schemaVersion:'tenbot-canary-control.v1',serverNow:iso(now),viewer,ownerId:owner,subjectEligible:true,completedCanary:viewer==='owner'&&grant,grantConflict:false,grant:grant?{id:grantId,startsAt:iso(now-60000),expiresAt:iso(now+600000),revokedAt:null,active:true,hasApproval:viewer==='owner',hasExecution:viewer==='owner',...(viewer==='admin'?{activatedBy:admin}:{executedDraftId:draftId})}:null,database:{pilotEnabled:false,executionEnabled:false,subjectEnrolled:false,enrollmentCount:0},activationBlock:viewer==='owner'?'admin-required':grant?'existing-grant':null};}
const sourceQuantity={quantity:'1',unit:'Bag'},basis={sourceKind:'package_count',packageCount:'1',perPackage:{quantity:'50',unit:'LB',container:'Bag'},totalMaterial:{quantity:'50',unit:'LB'},receivalQuantity:'1',receivalUnit:'Bag',inventoryStockingUnit:null,calculation:'source_package_count',reasons:[]};
function execution(state){return {draft_id:draftId,owner_user_id:owner,content_hash:hash,created_record_ids:[recordId],created_catalog_records:[],approval_id:approvalId,executed_at:iso(state.wrongExecutionTime?now-120000:now-30000)};}
function pendingRow(state){return {id:recordId,vendor:'T&M Supply',material_name:'Alaska White',size:'#0',quantity_expected:1,quantity_received:state.received?1:0,unit:'Bag',status:state.pendingStatus,production_job_id:null,temporary_job_label:null,is_earmarked:false,earmarked_job_name:null,receipt_inventory_item_id:null,receipt_transaction_id:null,received_at:null,received_by:null};}
function canonicalDraft(state){return {schemaVersion:'invoice-receivals.v2',authorizationVersion:'b'.repeat(64),id:draftId,hash,ownerId:owner,expiresAt:iso(now+1200000),document:{sha256:sha,supplier:'T&M Supply',reference,documentDate:null},metadata:{orderedBy:'Synthetic',orderDate:'2026-10-30',location:'Denton'},provenance:{model:'OFFLINE',sourceMediaType:'application/pdf',extractionSha256:sha,toolTraceSha256:'c'.repeat(64)},lines:[{sourceLineId:'L1',catalogSource:'standard',catalogId:catalog,quantityExpected:'1',unit:'Bag',productionJobId:null,sourceQuantity,sourceText:'Alaska White | #0 | 1 Bag',newMaterial:null,duplicateAcknowledgement:null,vendor:'T&M Supply',material:'Alaska White',size:'#0',category:'marble',jobLabel:null,catalogSnapshot:{id:catalog},vendorSnapshot:null,quantityBasis:basis,duplicateReview:null}],superseded:false,revoked:false,execution:{draftId,hash,createdRecordIds:[recordId],createdCatalogRecords:[],idempotent:true,executedAt:execution(state).executed_at}};}
function canonicalSource(state){const uid=state.wrongSource?admin:owner;return {id:sourceId,ownerId:uid,filename:'synthetic.pdf',mediaType:'application/pdf',byteSize:2877,sha256:sha,storageBucket:'invoice-receival-originals',storagePath:`${uid}/${sourceId}/original`,state:'retained',createdAt:iso(now-60000),expiresAt:iso(now+86400000),version:1,verifiedAt:iso(now-45000),retainedAt:iso(now-29000),retainedDraftId:draftId,evidenceSha256:sha,agentState:null};}
let browser,lastPage;
const deadline=setTimeout(()=>{console.error('Bounded canary control browser verifier exceeded 120 seconds.');void browser?.close();process.exitCode=1;},120000);
async function open(name,options={}){
 const auth=authFixture(options.kind??'admin'),viewer=options.kind==='owner'?'owner':'admin';
 const state={auth,status:statusFor(viewer,options.grant??viewer==='owner'),calls:[],mutations:[],pendingStatus:'pending',capabilityRevoked:false,malformedActivation:false,wrongSource:false,received:false,statusCalls:0,revokeOnStatus:0};
 if(options.expired&&state.status.grant){state.status.grant.active=false;state.status.grant.startsAt=iso(now-900000);state.status.grant.expiresAt=iso(now-1000);}
 const origin=options.origin??enabledOrigin,mode=options.mode??'enabled';
 const context=await browser.newContext({viewport:options.mobile?{width:390,height:844}:{width:1440,height:1000},timezoneId:'UTC',serviceWorkers:'block'}),page=await context.newPage();lastPage=page;page.setDefaultTimeout(6500);
 await page.clock.install({time:now});
 page.on('pageerror',error=>errors.push({scenario:name,message:error.message}));
 await context.addInitScript(value=>{window.__canaryFixtureAuth=value;},auth);
 await context.routeWebSocket('**/*',route=>{blockedNetwork.push({scenario:name,kind:'websocket'});route.close();});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  const reply=value=>route.fulfill({headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'},...value});
  try{
   if(url.origin===origin&&method==='GET'){
    const asset=assets.get(url.pathname);if(asset)return reply(asset);
    if(url.pathname==='/tenbot/canary')return reply({body:html,contentType:'text/html'});
    if(url.pathname==='/favicon.ico')return reply({status:204});
   }
   if(url.origin===fixtureOrigin){
    if(method==='OPTIONS')return reply({status:204});
    if(url.pathname==='/auth/v1/user'&&method==='GET'){state.calls.push({kind:'auth',method});traces.push({scenario:name,kind:'auth'});return reply({json:state.auth.session.user});}
    if(url.pathname.startsWith('/rest/v1/rpc/')&&method==='POST'){
     const rpc=url.pathname.split('/').at(-1),args=request.postDataJSON();state.calls.push({kind:'rpc',rpc,args});traces.push({scenario:name,kind:'rpc',rpc,args});let data;
     if(rpc==='get_my_app_access')data=[{user_id:state.auth.user?.id,role:state.auth.profile?.role,is_active:true,read_only:state.auth.profile?.readOnly??false}];
     else if(rpc==='has_app_capability')data=!(state.capabilityRevoked&&args.p_capability==='manageRolesPermissions');
     else if(rpc==='get_tenbot_chris_dev_canary_control_status'){state.statusCalls++;if(state.revokeOnStatus===state.statusCalls&&state.status.grant){state.status.grant.active=false;state.status.grant.revokedAt=iso(now);}data=clone(state.status);}
     else if(rpc==='activate_tenbot_chris_dev_canary_grant'){
      assert.deepEqual(Object.keys(args).sort(),['p_expires_at','p_reason']);assert.equal(args.p_expires_at,iso(now+600000));assert.equal(args.p_reason,'Synthetic reviewed canary');
      state.mutations.push({rpc,args});mutationRequests.push({scenario:name,rpc,args});state.status=statusFor('admin',true);state.status.grant.startsAt=iso(now);state.status.grant.expiresAt=args.p_expires_at;data=state.malformedActivation?'unknown-synthetic-outcome':grantId;
     }else if(rpc==='revoke_tenbot_chris_dev_canary_grant'){
      assert.equal(args.p_grant_id,grantId);assert.deepEqual(Object.keys(args).sort(),['p_grant_id','p_reason']);state.mutations.push({rpc,args});mutationRequests.push({scenario:name,rpc,args});state.status.grant.active=false;state.status.grant.revokedAt=iso(now);data={grantId,revoked:true,alreadyRevoked:false};
     }else if(rpc==='get_invoice_receival_draft'){assert.equal(args.p_draft_id,draftId);data=canonicalDraft(state);}
     else if(rpc==='get_invoice_receival_source_for_draft'){assert.equal(args.p_draft_id,draftId);data=canonicalSource(state);}
     else throw Error('Unexpected synthetic RPC '+rpc);
     return reply({json:data});
    }
    if(url.pathname.startsWith('/rest/v1/')&&!url.pathname.includes('/rpc/')){
     const table=url.pathname.split('/').at(-1),query=Object.fromEntries(url.searchParams);state.calls.push({kind:'table',table,method,query});traces.push({scenario:name,kind:'table',table,method,query});
     assert.equal(state.status.viewer,'owner','Admin must never retrieve invoice tables.');
     if(method==='PATCH'){
      assert.equal(table,'pending_receivals');const body=request.postDataJSON();assert.deepEqual(body,{status:'cancelled'});
      for(const [key,value]of Object.entries({id:recordId,status:'pending',quantity_expected:1,quantity_received:0,unit:'Bag',vendor:'T&M Supply',material_name:'Alaska White',size:'#0',is_earmarked:false}))assert.equal(query[key],'eq.'+value,key);
      for(const key of ['production_job_id','temporary_job_label','earmarked_job_name','receipt_inventory_item_id','receipt_transaction_id','received_at','received_by'])assert.equal(query[key],'is.null',key);
      state.mutations.push({table,method,query,body});mutationRequests.push({scenario:name,table,method,query,body});state.pendingStatus='cancelled';return reply({json:[pendingRow(state)]});
     }
     assert.equal(method,'GET');let rows;
     if(table==='invoice_receival_executions'){assert.equal(query.owner_user_id,'eq.'+owner);assert.equal(query.draft_id,'eq.'+draftId);rows=[execution(state)];}
     else if(table==='pending_receivals'){assert.equal(query.id,'eq.'+recordId);rows=[pendingRow(state)];}
     else if(table==='invoice_receival_approvals'){assert.equal(query.id,'eq.'+approvalId);rows=[{id:approvalId,draft_id:draftId,owner_user_id:owner,content_hash:hash,confirmation:'CREATE_REVIEWED_PENDING_RECEIVALS',approved_at:iso(now-40000)}];}
     else if(table==='invoice_receival_audit')rows=[{id:id(7),event:'approved',content_hash:hash},{id:id(8),event:'executed',content_hash:hash}];
     else throw Error('Unexpected synthetic table '+table);
     return reply({json:rows});
    }
   }
   unexpectedNetwork.push({scenario:name,origin:url.origin,path:url.pathname,method});blockedNetwork.push({scenario:name,kind:'http',origin:url.origin,path:url.pathname,method});return route.abort();
  }catch(error){errors.push({scenario:name,message:error.message});await route.abort();}
 });
 await page.goto(origin+'/tenbot/canary'+(options.defaultMode?'':'?mode='+mode),{waitUntil:'domcontentloaded',timeout:15000});
 await expect(page.locator('html')).toHaveAttribute('data-canary-fixture-ready','true');
 return {state,page,context,origin,async switchAuth(kind){state.auth=authFixture(kind);await page.evaluate(value=>window.dispatchEvent(new CustomEvent('tenops-canary-fixture:auth',{detail:value})),state.auth);},async remount(){await page.evaluate(()=>window.dispatchEvent(new Event('tenops-canary-fixture:remount')));}};
}
const activationCheck=page=>page.getByRole('checkbox',{name:'I approve this exact temporary access and expiration.',exact:true});
const revokeCheck=page=>page.getByRole('checkbox',{name:'I approve revoking this exact grant, including after expiry.',exact:true});
const cancelCheck=page=>page.getByRole('checkbox',{name:'I reviewed this exact synthetic receival and request cancellation.',exact:true});
async function ready(view){await expect(view.page.getByRole('button',{name:'Refresh durable status',exact:true})).toBeEnabled();await expect(view.page.getByText('Developer baseline verified.',{exact:false})).toBeVisible();}
async function activationForm(view){await ready(view);await view.page.getByLabel('Canary reason',{exact:true}).fill('Synthetic reviewed canary');await view.page.getByLabel('Canary expiration',{exact:true}).fill('2026-10-30T19:10');await activationCheck(view.page).check();}
async function contained(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'The control overflows the viewport.');}
async function check(name,run){await run();checks.push(name);}
async function using(name,options,run){const view=await open(name,options);try{await run(view);}finally{await view.context.close();}}

try{
 browser=await chromium.launch({headless:true,env:{PATH:process.env.PATH??'',HOME:process.env.HOME??'',TMPDIR:process.env.TMPDIR??'/tmp'}});
 await check('Default OFF, wrong origins and unauthorized accounts make no Auth/REST requests or mutations',async()=>{
  for(const [name,options]of [['default-off',{defaultMode:true}],['production-origin',{origin:'https://tenops.pages.dev'}],['enabled-localhost',{origin:reviewOrigin}],['preview-origin',{origin:'https://preview.tendev.pages.dev'}]])await using(name,options,async view=>{await expect(view.page.getByRole('main',{name:'TenBot canary control'})).toHaveCount(0);assert.deepEqual(view.state.calls,[]);assert.deepEqual(view.state.mutations,[]);});
  for(const kind of ['anonymous','member','readonly','other'])await using('unauthorized-'+kind,{kind},async view=>{await expect(view.page.getByRole('status')).toContainText('Sign in with the authorized Admin or chris_dev');assert.deepEqual(view.state.calls,[]);assert.deepEqual(view.state.mutations,[]);});
 });
 await check('localhost:3000 review mode loads durable status and keeps every action disabled; mobile containment',async()=>using('review-localhost',{mode:'review',origin:reviewOrigin,mobile:true},async view=>{
  await ready(view);await expect(view.page.getByText('Review only. Actions are disabled.',{exact:true})).toBeVisible();await expect(activationCheck(view.page)).toBeDisabled();await expect(view.page.getByRole('button',{name:'Activate temporary access',exact:true})).toBeDisabled();await view.page.getByRole('button',{name:'Refresh durable status',exact:true}).click();await ready(view);assert.equal(view.state.mutations.length,0);assert(view.state.calls.some(call=>call.rpc==='get_tenbot_chris_dev_canary_control_status'));await contained(view.page);await view.page.screenshot({path:directory+'/review-mobile.png',fullPage:true});
 }));
 await check('Admin explicit activation uses only fixed expiry/reason; reload and remount recover the exact durable grant with no invoice queries',async()=>using('admin-activation',{},async view=>{
  await ready(view);assert.equal(view.state.mutations.length,0);const button=view.page.getByRole('button',{name:'Activate temporary access',exact:true});await expect(button).toBeDisabled();await activationForm(view);await expect(button).toBeEnabled();assert.equal(view.state.mutations.length,0);const statusBefore=view.state.statusCalls;await button.click();await expect(view.page.getByRole('status').filter({hasText:'Temporary access activated.'})).toBeVisible();assert(view.state.statusCalls>=statusBefore+2);assert.equal(view.state.mutations.length,1);await view.page.reload({waitUntil:'load'});await ready(view);await expect(view.page.getByText('Grant: '+grantId,{exact:true})).toBeVisible();await view.remount();await ready(view);await expect(view.page.getByText('Grant: '+grantId,{exact:true})).toBeVisible();await expect(revokeCheck(view.page)).not.toBeChecked();await expect(view.page.getByText('Grant state: Active',{exact:true})).toBeVisible();assert.equal(view.state.mutations.length,1);assert(!view.state.calls.some(call=>call.kind==='table'||call.rpc?.includes('invoice_receival')));await contained(view.page);await view.page.screenshot({path:directory+'/admin-recovered-desktop.png',fullPage:true});
 }));
 await check('Grant state is explicit for Active, Inactive, Expired and Revoked; expired exact-ID revocation and changed-grant confirmation binding remain guarded',async()=>{
  await using('admin-expired-revoke',{grant:true,expired:true},async view=>{await ready(view);await expect(view.page.getByText('Expired. No new write is authorized.',{exact:true})).toBeVisible();await expect(view.page.getByText('Grant state: Expired',{exact:true})).toBeVisible();await view.page.getByLabel('Canary reason',{exact:true}).fill('Close exact synthetic expired grant');await revokeCheck(view.page).check();assert.equal(view.state.mutations.length,0);await view.page.getByRole('button',{name:'Revoke exact grant',exact:true}).click();await expect(view.page.getByText('Revocation recorded.',{exact:true})).toBeVisible();await expect(view.page.getByText('Grant state: Revoked',{exact:true})).toBeVisible();assert.equal(view.state.mutations.length,1);assert.equal(view.state.mutations[0].args.p_grant_id,grantId);assert(!view.state.calls.some(call=>call.kind==='table'||call.rpc?.includes('invoice_receival')));});
  await using('admin-revoke-no-retarget',{grant:true},async view=>{await ready(view);view.state.status.grant.active=false;await view.page.getByRole('button',{name:'Refresh durable status',exact:true}).click();await ready(view);await expect(view.page.getByText('Grant state: Inactive',{exact:true})).toBeVisible();await view.page.getByLabel('Canary reason',{exact:true}).fill('Revoke only the displayed grant');await revokeCheck(view.page).check();view.state.status.grant.id=id(88);await view.page.getByRole('button',{name:'Revoke exact grant',exact:true}).click();await expect(view.page.getByRole('alert')).toBeVisible();assert.equal(view.state.mutations.length,0);});
 });
 await check('Unknown activation outcome offers no blind retry; explicit durable reconciliation recovers the already persisted grant',async()=>using('admin-uncertain-outcome',{},async view=>{
  view.state.malformedActivation=true;await activationForm(view);await view.page.getByRole('button',{name:'Activate temporary access',exact:true}).click();await expect(view.page.getByRole('alert')).toBeVisible();await expect(view.page.getByRole('button',{name:'Activate temporary access',exact:true})).toHaveCount(0);assert.equal(view.state.mutations.length,1);await view.page.getByRole('button',{name:'Refresh durable status',exact:true}).click();await ready(view);await expect(view.page.getByText('Grant: '+grantId,{exact:true})).toBeVisible();await expect(activationCheck(view.page)).toBeDisabled();await expect(view.page.getByRole('button',{name:'Activate temporary access',exact:true})).toBeDisabled();assert.equal(view.state.mutations.length,1);
 }));
 await check('Exact owner recovers the returned receipt and cancels only after SQL OFF plus canonical draft/source/approval/audit checks; one guarded PATCH persists across reload',async()=>using('owner-cancel',{kind:'owner',mobile:true},async view=>{
  view.state.status.database.executionEnabled=true;await view.page.getByRole('button',{name:'Refresh durable status',exact:true}).click();await ready(view);await expect(view.page.getByText('Receival: '+recordId,{exact:true})).toBeVisible();await expect(cancelCheck(view.page)).toBeDisabled();assert.equal(view.state.mutations.length,0);view.state.status.database.executionEnabled=false;await view.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await ready(view);await expect(cancelCheck(view.page)).toBeEnabled();await cancelCheck(view.page).check();await view.page.getByRole('button',{name:'Cancel exact synthetic receival',exact:true}).click();await expect(view.page.getByRole('status').filter({hasText:'The verified synthetic receival was cancelled.'})).toBeVisible();await expect(view.page.getByText('Expected 1 Bag · Received 0 · cancelled',{exact:true})).toBeVisible();assert.equal(view.state.mutations.length,1);assert.equal(view.state.mutations[0].table,'pending_receivals');for(const rpc of ['get_invoice_receival_draft','get_invoice_receival_source_for_draft'])assert(view.state.calls.some(call=>call.rpc===rpc));for(const table of ['invoice_receival_approvals','invoice_receival_audit'])assert(view.state.calls.some(call=>call.table===table));assert(!view.state.calls.some(call=>/approve_|execute_|begin_|activate_|revoke_/.test(call.rpc??'')));await view.page.reload({waitUntil:'load'});await ready(view);await expect(view.page.getByText('Receival: '+recordId,{exact:true})).toBeVisible();await expect(cancelCheck(view.page)).toBeDisabled();assert.equal(view.state.mutations.length,1);await contained(view.page);await view.page.screenshot({path:directory+'/owner-cancelled-mobile.png',fullPage:true});
 }));
 await check('Foreign retained source and final-preflight revocation deny cancellation; changed received rows retain their identity with cancellation disabled',async()=>{
  for(const kind of ['foreign-source','pre-CAS-revocation'])await using(kind,{kind:'owner'},async view=>{await ready(view);if(kind==='foreign-source')view.state.wrongSource=true;else view.state.revokeOnStatus=view.state.statusCalls+2;await cancelCheck(view.page).check();await view.page.getByRole('button',{name:'Cancel exact synthetic receival',exact:true}).click();await expect(view.page.getByRole('alert')).toBeVisible();assert.equal(view.state.mutations.length,0);});
  await using('owner-received-recovery',{kind:'owner'},async view=>{await ready(view);view.state.received=true;view.state.pendingStatus='received';await view.page.getByRole('button',{name:'Refresh durable status',exact:true}).click();await ready(view);await expect(view.page.getByText('Receival: '+recordId,{exact:true})).toBeVisible();await expect(view.page.getByText(/Received 1.*received/)).toBeVisible();await expect(view.page.getByRole('button',{name:'Cancel exact synthetic receival',exact:true})).toBeDisabled();assert.equal(view.state.mutations.length,0);});
 });
 await check('Fresh permission checks, role/account changes, focus revocation and server-duration expiry clear stale controls and confirmations',async()=>{
  await using('admin-permission-switch',{},async view=>{await activationForm(view);view.state.capabilityRevoked=true;await view.page.getByRole('button',{name:'Activate temporary access',exact:true}).click();await expect(view.page.getByRole('alert')).toContainText('not authorized');assert.equal(view.state.mutations.length,0);await view.switchAuth('other');await expect(view.page.getByRole('status')).toContainText('Sign in with the authorized Admin or chris_dev');await expect(view.page.getByRole('region',{name:'Admin canary access'})).toHaveCount(0);assert.equal(view.state.mutations.length,0);});
  await using('admin-role-account-change',{},async view=>{await activationForm(view);await view.switchAuth('member');await expect(view.page.getByRole('status')).toContainText('Sign in with the authorized Admin or chris_dev');await expect(view.page.getByRole('region',{name:'Admin canary access'})).toHaveCount(0);await view.switchAuth('admin');await ready(view);await expect(activationCheck(view.page)).not.toBeChecked();await view.switchAuth('other');await expect(view.page.getByRole('region',{name:'Admin canary access'})).toHaveCount(0);assert.equal(view.state.mutations.length,0);});
  await using('owner-focus-revocation',{kind:'owner'},async view=>{await ready(view);await cancelCheck(view.page).check();view.state.status.grant.active=false;view.state.status.grant.revokedAt=iso(now);await view.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await ready(view);await expect(cancelCheck(view.page)).not.toBeChecked();await expect(cancelCheck(view.page)).toBeDisabled();assert.equal(view.state.mutations.length,0);await contained(view.page);await view.page.screenshot({path:directory+'/owner-revoked-desktop.png',fullPage:true});});
  await using('owner-server-duration-expiry',{kind:'owner'},async view=>{await ready(view);await cancelCheck(view.page).check();await view.page.clock.fastForward(571000);await expect(cancelCheck(view.page)).not.toBeChecked();await expect(cancelCheck(view.page)).toBeDisabled();await expect(view.page.getByText('Receival: '+recordId,{exact:true})).toBeVisible();assert.equal(view.state.mutations.length,0);});
 });
 assert.deepEqual(errors,[]);assert.deepEqual(unexpectedNetwork,[]);
 for(const [file,expected]of Object.entries(sourceHashes))assert.equal(digest(readFileSync(file)),expected,'Source changed during this browser run: '+file);
 const report={passed:true,groups:checks.length,checks,mode:'Source component and actual client service + Supabase SDK, synthetic Auth/REST responses only; not app-route, hosted RPC/JWT/RLS, grants, database or inference proof.',sourceHashes,bundleSha256:digest(bundle),css:{directory:path.relative(root,cssDirectory),files:cssFiles,sha256:digest(css)},actualDatabase:false,actualInference:false,realGrantMutations:0,operationalWrites:0,externalRequestsForwarded:0,portsUsed:[],mutationRequests,traces,errors,blockedNetwork,unexpectedNetwork};
 writeFileSync(directory+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:directory+'/report.json',actualDatabase:false,operationalWrites:0,realGrantMutations:0,externalRequestsForwarded:0}));
}catch(error){await lastPage?.screenshot({path:directory+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(directory+'/failure.json',JSON.stringify({passed:false,message:error instanceof Error?error.message:String(error),checks,errors,traces,blockedNetwork,unexpectedNetwork,actualDatabase:false,operationalWrites:0,externalRequestsForwarded:0},null,2)+'\n');throw error;}
finally{clearTimeout(deadline);await browser?.close();}
