/** Actual source hook/review controls with synthetic Auth + intercepted SDK HTTP.
 * No hosted request, model inference, real grant, approval or Inventory write. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {session} from './support/wave4-fixture.mjs';

const root=process.cwd(),directory='/private/tmp/tenops-tenbot-prepared-resume-20261030/browser';
const origin='https://tendev.pages.dev',transport='https://tenbot-resume-fixture.supabase.invalid';
const owner='3785f6b9-742e-452f-af6c-31613a983633',sourceId='1423d4e0-1a4a-48bd-af79-28e623102da4';
const stranger='11111111-1111-4111-8111-111111111111',catalogId='standard:ba6a3690-0886-4f72-9f86-581bcc1f3b44';
const previewHash='7b63a8b55d2d496c2e15d0d5f2af81fb8da06f81109c4da1dfeed89e0c8e7594',secret='SECRET_MARKER_DO_NOT_DISPLAY';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),checks=[],errors=[],blocked=[],traces=[];
const sourcePaths=['src/modules/tenbot/TenbotWorkspace.tsx','src/modules/tenbot/ReceivalDraftReview.tsx','src/modules/tenbot/prepared-draft-resume.ts','src/modules/tenbot/live-review.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(file=>[file,hash(readFileSync(file))]));
const blank={orderedBy:'',orderDate:'',location:''};
const baseDraft=()=>({id:sourceId,revision:1,hash:previewHash,status:'review_required',simulation:false,attachmentId:sourceId,orderDetails:{...blank},missingFields:Object.keys(blank),canApprove:false,executionEnabled:false,rows:[{lineId:sourceId+':L8',sourceText:'Alaska White | #0 | 1 Bag',sourceQuantity:{quantity:'1',unit:'Bag'},materialId:catalogId,materialName:'Alaska White',size:'#0',quantity:'1',unit:'Bag',jobId:null,excluded:false,reasons:[]}],provenance:{supplier:'T&M Supply',documentReference:'SYN-TENDEV-RECEIVAL-20261030-01',attachmentSha256:'c66a0eb7a0512b40df092a7852fbbeaded6664b97b2f2df2153487441124ba2a'}});
const profile=id=>({userId:id,displayName:'Synthetic resume owner',role:'developer',isActive:true,readOnly:false,messagingWrite:true});
const auth=id=>({ready:true,accessStatus:'allowed',isAuthenticated:true,accessAllowed:true,user:{id},profile:profile(id),session:session(id)});
const authSource=`export function useAuth(){return {...window.__resumeAuth,can:capability=>['readOperationalData','writeBusinessData','messaging.write'].includes(capability)}}`;
const sdkSource=`import {createClient} from '@supabase/supabase-js';export const supabase=createClient('${transport}','synthetic-public-anon-key',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'tenbot-resume-synthetic',storage:{getItem:()=>JSON.stringify(window.__resumeAuth.session),setItem:()=>{},removeItem:()=>{}}}});`;
const harness=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useTenbotConversation} from '${path.join(root,'src/modules/tenbot/TenbotWorkspace.tsx')}';function Harness(){const chat=useTenbotConversation(),[text,setText]=useState('');return <main className="mx-auto max-w-2xl space-y-4 px-4 py-6"><h1>Synthetic prepared-draft UI regression</h1><p role="status">{chat.restoring?'Restoring':'Ready'}</p>{chat.history}{chat.controls('')}{chat.attachmentControl}<form onSubmit={event=>{event.preventDefault();void chat.send(text)}}><label>Message<textarea aria-label="Message" value={text} disabled={!chat.available||chat.busy} onChange={event=>setText(event.target.value)}/></label><button type="submit" disabled={!chat.available||chat.busy}>Send</button></form></main>}createRoot(document.getElementById('root')).render(<Harness/>);`;
mkdirSync(directory,{recursive:true});
const bundled=await build({stdin:{contents:harness,loader:'tsx',resolveDir:root,sourcefile:'tenbot-prepared-resume-harness.tsx'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL':'""'},plugins:[{name:'synthetic-context',setup(builder){builder.onResolve({filter:/^(?:@\/lib\/(?:auth|supabase)|next\/(?:link|navigation)|pdfjs-dist\/)/},args=>({path:args.path,namespace:'resume-fixture'}));builder.onLoad({filter:/.*/,namespace:'resume-fixture'},args=>({contents:args.path==='@/lib/auth'?authSource:args.path==='@/lib/supabase'?sdkSource:args.path==='next/navigation'?"export const usePathname=()=>'/inventory';":args.path==='next/link'?"import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}":"export const GlobalWorkerOptions={};export function getDocument(){throw Error('No extraction is allowed in the resume fixture')}",loader:'tsx',resolveDir:root}));}}]});
const bundle=Buffer.from(bundled.outputFiles[0].contents);writeFileSync(directory+'/harness.js',bundle);
const cssDir=existsSync('.next/static/css')?'.next/static/css':'out/_next/static/css',css=Buffer.concat(readdirSync(cssDir).filter(file=>file.endsWith('.css')).sort().map(file=>readFileSync(path.join(cssDir,file))));
const html='<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
let browser,lastPage;const deadline=setTimeout(()=>{console.error('Prepared-resume browser check exceeded 90 seconds');void browser?.close();process.exitCode=1;},90000);
async function open({mode='execution',denial=0,viewer=owner,mobile=false,creation=false}={}){
 const state={mode,denial,viewer,creation,draft:baseDraft(),calls:[]},context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();lastPage=page;page.setDefaultTimeout(8000);
 page.on('pageerror',error=>errors.push(error.message));await context.addInitScript(({value,owner,sourceId})=>{window.__resumeAuth=value;sessionStorage.setItem('tenops.tenbot.prepared-source.v1:'+owner,JSON.stringify({owner,sourceId}));},{value:auth(viewer),owner,sourceId});
 await context.routeWebSocket('**/*',route=>{blocked.push('websocket');route.close();});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),reply=value=>route.fulfill({headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'},...value});
  try{
   if(url.origin===origin&&request.method()==='GET'){
    if(url.pathname==='/resume-fixture')return reply({body:html,contentType:'text/html'});
    if(url.pathname==='/fixture.js')return reply({body:bundle,contentType:'application/javascript'});
    if(url.pathname==='/fixture.css')return reply({body:css,contentType:'text/css'});
    if(url.pathname==='/favicon.ico')return reply({status:204});
   }
   if(url.origin===transport&&url.pathname==='/functions/v1/tenbot'){
    if(request.method()==='OPTIONS')return reply({status:204});assert.equal(request.method(),'POST');const body=request.postDataJSON();state.calls.push(body);traces.push({action:body.action,workspace:body.workspace??null});
    if(body.action==='status'&&!body.workspace)return reply({json:{mode:'assistant',historyAvailable:true,receivalPilotAvailable:true}});
    if(body.action==='status'&&body.workspace){const now=Date.now();return reply({json:{mode:'authenticated-receivals',simulation:false,requiresPrivateOriginal:true,preparationOnly:state.mode==='preparation',executionOnly:state.mode==='execution',canPrepare:true,executionEnabled:state.creation,...(state.viewer===owner?{resumableSourceId:sourceId}:{}),...(state.mode==='execution'&&state.viewer===owner?{canaryAccess:{active:true,grantId:'10302026-0000-4000-8000-000000000001',ownerId:owner,startsAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+14*60000).toISOString(),serverNow:new Date(now).toISOString(),documentSha256:baseDraft().provenance.attachmentSha256,documentReference:baseDraft().provenance.documentReference,supplier:'T&M Supply',catalogSource:'standard',catalogId:catalogId.split(':')[1],quantityExpected:'1',unit:'Bag'}}:{}),catalog:[{id:catalogId,materialName:'Alaska White',size:'#0',unit:'Bag',supplier:'T&M Supply',packageLabel:'50lb bag',packageQuantity:'50',packageMeasure:'LB',containerType:'Bag'}],jobs:[],maxAttachmentBytes:90000,mediaTypes:['image/png']}});}
    if(body.action==='resume'){
     assert.equal(body.workspace,'invoice-receivals.v1');assert.equal(body.sourceId,sourceId);assert.equal(state.viewer,owner);
     if(state.denial)return reply({status:state.denial,json:{error:secret}});
     return reply({json:{simulation:false,attachment:{attachmentId:sourceId,sourceId,filename:'synthetic-tendev-receival-20261030-01.pdf',mediaType:'application/pdf',expiresAt:new Date(Date.now()+3600000).toISOString(),simulation:false},draft:state.draft}});
    }
    if(body.action==='review'){
     assert.equal(body.workspace,'invoice-receivals.v1');assert.equal(body.draftId,sourceId);assert.equal(body.revision,state.draft.revision);assert.equal(body.edits.length,1);assert.equal(body.edits[0].quantity,'1');assert.equal(body.edits[0].unit,'Bag');
     state.draft={...state.draft,orderDetails:body.orderDetails,missingFields:[],revision:state.draft.revision+1,hash:'b'.repeat(64),canApprove:true,reviewed:true,durableDraftId:'10302026-0000-4000-8000-000000000002',durableHash:'c'.repeat(64)};
     return reply({json:{draft:state.draft,simulation:false}});
    }
    if(body.action==='ask'){
     assert.equal(body.workspace,undefined);assert.equal(body.attachmentId,undefined);assert.equal(body.orderDetails,undefined);
     return reply({json:{mode:'assistant',contentScope:'workflow',message:'Synthetic ordinary help stays separate from the prepared invoice.',sources:[],snapshot:{revision:'synthetic',verifiedAt:'2026-10-30'},summary:null}});
    }
    throw Error('Unexpected action: '+body.action);
   }
   blocked.push({method:request.method(),path:url.pathname,origin:url.origin});return route.abort();
  }catch(error){errors.push(error.message);return route.abort();}
 });
 await page.goto(origin+'/resume-fixture',{waitUntil:'domcontentloaded'});await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeEnabled();return {state,page,context};
}
try{
 browser=await chromium.launch({headless:true,env:{PATH:process.env.PATH??'',HOME:process.env.HOME??'',TMPDIR:process.env.TMPDIR??'/tmp'}});
 const test=await open({mode:'preparation'});
 try{
  const {page,state}=test;await expect(page.getByRole('region',{name:'Editable pending receival draft'})).toBeVisible();await expect(page.getByRole('button',{name:'Save changes for review'})).toHaveCount(0);assert.deepEqual(state.calls.map(x=>x.action),['status','status','resume']);
  state.mode='execution';await page.reload();await expect(page.getByRole('button',{name:'Save changes for review'})).toBeEnabled();await expect(page.getByLabel('Draft ordered by',{exact:true})).toHaveValue('chris developer');await expect(page.getByLabel('Draft order date',{exact:true})).toHaveValue('2026-10-30');await expect(page.getByLabel('Draft destination location',{exact:true})).toHaveValue('Denton');await expect(page.getByText('They have not been saved or approved.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Attach PDF or image',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Approve and create pending receivals',exact:true})).toBeDisabled();assert.equal(state.calls.filter(x=>x.action==='resume').length,2);assert.deepEqual(state.draft.orderDetails,blank);assert.equal(state.draft.hash,previewHash);assert.equal(state.draft.revision,1);
  await page.getByLabel('Draft destination location',{exact:true}).fill('Denton reviewed');await page.getByRole('button',{name:'Save changes for review'}).click();await expect.poll(()=>state.draft.revision).toBe(2);await expect(page.getByRole('button',{name:'Save changes for review'})).toBeDisabled();await expect(page.getByLabel('Draft destination location',{exact:true})).toHaveValue('Denton reviewed');assert.equal(state.draft.rows[0].quantity,'1');assert.deepEqual(state.draft.rows[0].sourceQuantity,{quantity:'1',unit:'Bag'});assert.equal(state.draft.revision,2);
  await page.reload();await expect(page.getByLabel('Draft destination location',{exact:true})).toHaveValue('Denton reviewed');await expect(page.getByRole('button',{name:'Approve and create pending receivals',exact:true})).toBeDisabled();await page.getByLabel('Draft destination location',{exact:true}).fill('Denton corrected again');await expect(page.getByText('Unsaved changes · Save for server review before approving. Previous approval is cleared.',{exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Message',exact:true}).fill('How do I open Inventory?');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Synthetic ordinary help stays separate from the prepared invoice.',{exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Editable pending receival draft'})).toBeVisible();
  assert.equal(state.calls.filter(x=>x.action==='review').length,1);assert(state.calls.every(x=>['status','resume','review','ask'].includes(x.action)));await page.screenshot({path:directory+'/resumed-review-desktop.png',fullPage:true});
  checks.push('Preparation to execution remount resumes exact preview with no ask/upload; proposed order metadata is editable/unsaved; server review retains one-Bag evidence; reviewed state resumes and edits invalidate approval; ordinary help omits invoice context');
 }catch(error){await test.page.screenshot({path:directory+'/transition-failure.png',fullPage:true});writeFileSync(directory+'/transition-failure-body.txt',await test.page.locator('body').innerText());throw error;}finally{await test.context.close();}
 for(const denial of [403,410]){
  const view=await open({denial,mobile:denial===410});try{await expect(view.page.getByRole('alert')).toContainText(denial===403?'current permissions':'expired, changed or unavailable');await expect(view.page.getByRole('region',{name:'Editable pending receival draft'})).toHaveCount(0);assert.equal(view.state.calls.filter(x=>x.action==='resume').length,1);assert(view.state.calls.every(x=>['status','resume'].includes(x.action)));assert(!(await view.page.locator('body').innerText()).includes(secret));if(denial===410){assert(await view.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await view.page.screenshot({path:directory+'/expired-review-mobile.png',fullPage:true});}}finally{await view.context.close();}
 }checks.push('Fresh permission and expiry rejection never display the private preview or retry as inference');
 const enabled=await open({creation:true});try{await expect(enabled.page.getByText('Prepared invoice · Model inference is off. Review the form; explicit approval creates the pending receival.',{exact:true})).toBeVisible();await expect(enabled.page.getByRole('button',{name:'Approve and create pending receivals',exact:true})).toBeDisabled();assert(enabled.state.calls.every(x=>['status','resume'].includes(x.action)));}finally{await enabled.context.close();}checks.push('An enabled synthetic execution status describes approval/create accurately without auto-reviewing or approving');
 const other=await open({viewer:stranger});try{await expect(other.page.getByRole('region',{name:'Editable pending receival draft'})).toHaveCount(0);assert.deepEqual(other.state.calls.map(x=>x.action),['status','status']);}finally{await other.context.close();}checks.push('Another owner cannot reuse the original owner locator');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);for(const [file,expected]of Object.entries(sourceHashes))assert.equal(hash(readFileSync(file)),expected,'Source changed during UI regression');
 const report={passed:true,groups:checks.length,checks,sourceHashes,bundleSha256:hash(bundle),mode:'Actual source hook, review component and SDK with synthetic Auth/intercepted HTTP only; not real JWT/RLS, database, hosted or model validation.',inferenceCalls:0,approvalsSubmitted:0,grantMutations:0,operationalWrites:0,externalRequestsForwarded:0,portsUsed:[],traces,errors,blocked};writeFileSync(directory+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:directory+'/report.json',inferenceCalls:0,operationalWrites:0,externalRequestsForwarded:0}));
}catch(error){await lastPage?.screenshot({path:directory+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(directory+'/failure.json',JSON.stringify({passed:false,message:error.message,checks,traces,errors,blocked,inferenceCalls:0,operationalWrites:0},null,2)+'\n');throw error;}
finally{clearTimeout(deadline);await browser?.close();}
