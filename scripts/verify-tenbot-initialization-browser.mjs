/** Source-hook browser check with synthetic Auth and intercepted HTTP only.
 * No actual session, model, database, grant or deployed-route proof. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {session} from './support/wave4-fixture.mjs';
const directory='/private/tmp/tenops-tenbot-write-canary-20261030/startup-correction/browser',root=process.cwd(),origin='https://tendev.pages.dev',transport='https://tenbot-init-fixture.supabase.invalid';
const owner='3785f6b9-742e-452f-af6c-31613a983633',conversationId='10302026-0000-4000-8000-000000000001',requestId='10302026-0000-4000-8000-000000000002',secret='SECRET_MARKER_private_database_credential_document';
const now=Date.now(),hash=value=>createHash('sha256').update(value).digest('hex'),checks=[],errors=[],blocked=[],traces=[];
const profile={userId:owner,displayName:'Synthetic owner',role:'developer',isActive:true,readOnly:false,messagingWrite:true,productionBlendManage:false,sampleLabelsGenerate:false,jobUpdatesPost:false};
const auth={ready:true,accessStatus:'allowed',isAuthenticated:true,accessAllowed:true,user:{id:owner},profile,session:session(owner)};
const sourcePaths=['src/modules/tenbot/TenbotWorkspace.tsx','src/modules/tenbot/initialization-failure.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(file=>[file,hash(readFileSync(file))]));
mkdirSync(directory,{recursive:true});
const authSource=`export function useAuth(){return {...window.__initAuth,can:capability=>['readOperationalData','writeBusinessData','messaging.write'].includes(capability)}}`;
// Timeout is a synthetic FunctionsFetchError with the same bounded context
// shape consumed by the real hook; no hanging request or clock workaround.
const sdkSource=`import {createClient} from '@supabase/supabase-js';const sdk=createClient('${transport}','synthetic-public-anon-key',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'tenbot-init-synthetic',storage:{getItem:()=>JSON.stringify(window.__initAuth.session),setItem:()=>{},removeItem:()=>{}}}});export const supabase={auth:sdk.auth,storage:sdk.storage,rpc:sdk.rpc.bind(sdk),functions:{invoke:(name,options)=>new URLSearchParams(location.search).get('case')==='timeout'&&options.body.workspace==='invoice-receivals.v1'?Promise.resolve({data:null,error:{name:'FunctionsFetchError',context:new DOMException('${secret}','TimeoutError')}}):sdk.functions.invoke(name,options)}};`;
const harness=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useTenbotConversation} from '${path.join(root,'src/modules/tenbot/TenbotWorkspace.tsx')}';function Harness(){const chat=useTenbotConversation(),[text,setText]=useState('');return <main className="mx-auto max-w-2xl space-y-4 px-4 py-6"><h1>TenBot synthetic startup check</h1><p role="status">{chat.restoring?'Restoring':'Ready'}</p>{chat.history}{chat.controls('')}{chat.attachmentControl}<form onSubmit={event=>{event.preventDefault();void chat.send(text)}}><label>Message<textarea aria-label="Message" value={text} disabled={!chat.available||chat.busy} onChange={event=>setText(event.target.value)}/></label><button type="submit" disabled={!chat.available||chat.busy}>Send</button></form></main>}createRoot(document.getElementById('root')).render(<Harness/>);`;
writeFileSync(directory+'/harness.tsx',harness);writeFileSync(directory+'/auth-fixture.ts',authSource);writeFileSync(directory+'/sdk-fixture.ts',sdkSource);
const bundled=await build({stdin:{contents:harness,loader:'tsx',resolveDir:root,sourcefile:'tenbot-initialization-harness.tsx'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL':'""'},plugins:[{name:'synthetic-context',setup(builder){builder.onResolve({filter:/^(?:@\/lib\/(?:auth|supabase)|next\/(?:link|navigation)|pdfjs-dist\/)/},args=>({path:args.path,namespace:'init-fixture'}));builder.onLoad({filter:/.*/,namespace:'init-fixture'},args=>({contents:args.path==='@/lib/auth'?authSource:args.path==='@/lib/supabase'?sdkSource:args.path==='next/navigation'?"export const usePathname=()=>'/inventory';":args.path==='next/link'?"import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}":"export const GlobalWorkerOptions={};export function getDocument(){throw Error('PDF is outside this startup-only fixture')}",loader:'tsx',resolveDir:root}));}}]});
const bundle=Buffer.from(bundled.outputFiles[0].contents);writeFileSync(directory+'/harness.js',bundle);
const cssDir=existsSync('.next/static/css')?'.next/static/css':'out/_next/static/css',cssFiles=readdirSync(cssDir).filter(file=>file.endsWith('.css')).sort(),css=Buffer.concat(cssFiles.map(file=>readFileSync(path.join(cssDir,file))));
const html='<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
const answer=message=>({mode:'assistant',contentScope:'workflow',message,sources:[],snapshot:{revision:'synthetic-startup',verifiedAt:'2026-10-30'},summary:null,suggestionAllowed:false});
let browser,lastPage;const deadline=setTimeout(()=>{console.error('Startup browser verifier exceeded 120 seconds');void browser?.close();process.exitCode=1;},120000);
async function scenario(name,expected,{send=false,mobile=false}={}){
 const calls=[],diagnostics=[],consoleRows=[],pendingConsole=[],context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();lastPage=page;page.setDefaultTimeout(8000);
 page.on('pageerror',error=>errors.push({scenario:name,message:error.message}));
 page.on('console',message=>{consoleRows.push(message.text());if(message.text().startsWith('TenBot workspace initialization failed'))pendingConsole.push(Promise.all(message.args().map(arg=>arg.jsonValue())).then(args=>diagnostics.push(args[1])));});
 await context.addInitScript(({auth,locator})=>{window.__initAuth=auth;sessionStorage.setItem('tenops.tenbot.experimental-conversation.v1',JSON.stringify(locator));},{auth,locator:{version:1,owner,accessHash:hash(JSON.stringify(profile)),mode:'hosted',conversationId,expiresAt:now+3600000}});
 await context.routeWebSocket('**/*',route=>{blocked.push({scenario:name,kind:'websocket'});route.close();});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),reply=value=>route.fulfill({headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Expose-Headers':'sb-request-id','sb-request-id':requestId},...value});
  try{
   if(url.origin===origin&&req.method()==='GET'){
    if(url.pathname==='/startup-fixture')return reply({body:html,contentType:'text/html'});
    if(url.pathname==='/fixture.js')return reply({body:bundle,contentType:'application/javascript'});
    if(url.pathname==='/fixture.css')return reply({body:css,contentType:'text/css'});
    if(url.pathname==='/favicon.ico')return reply({status:204});
   }
   if(url.origin===transport&&url.pathname==='/functions/v1/tenbot'){
    if(req.method()==='OPTIONS')return reply({status:204});assert.equal(req.method(),'POST');const body=req.postDataJSON();calls.push(body);traces.push({scenario:name,action:body.action,workspace:body.workspace??null});
    if(body.action==='status'&&body.workspace===undefined)return reply({json:{mode:'assistant',historyAvailable:true,receivalPilotAvailable:true}});
    if(body.action==='status'&&body.workspace==='invoice-receivals.v1'){
     if(name==='projection')return reply({json:{mode:'authenticated-receivals',simulation:false,requiresPrivateOriginal:true,canaryAccess:{active:true,ownerId:secret}}});
     const status=name==='auth401'?401:name==='auth403'?403:name==='unknown-code'?500:503,code=name==='catalog503'?'invoice_catalog_unavailable':name==='jobs503'?'invoice_jobs_unavailable':name==='unknown-code'?secret:undefined;
     return reply({status,json:{error:secret,code,records:[secret],credentials:secret}});
    }
    if(body.action==='history'){assert.equal(body.workspace,undefined);assert.equal(body.conversationId,conversationId);return reply({json:{conversationId,mode:'assistant',turns:[{id:'saved-turn',question:'Where do I review materials?',createdAt:new Date(now-30000).toISOString(),answeredAt:new Date(now-29000).toISOString(),answer:answer('Synthetic saved help restored after invoice startup failure.')} ]}});}
    if(body.action==='ask'){assert(send,'No automatic ask is permitted');assert.equal(body.workspace,undefined);assert.equal(body.attachmentId,undefined);assert.equal(body.conversationId,conversationId);assert.deepEqual(body.context,['Current module: Inventory']);return reply({json:{...answer('Synthetic ordinary help remains usable.'),conversationId,historyTurnId:'explicit-help-turn'}});}
    throw Error('Unexpected startup fixture action '+body.action);
   }
   blocked.push({scenario:name,method:req.method(),path:url.pathname,origin:url.origin});return route.abort();
  }catch(error){errors.push({scenario:name,message:error.message});return route.abort();}
 });
 try{
  await page.goto(origin+'/startup-fixture?case='+name,{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Synthetic saved help restored after invoice startup failure.',{exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeEnabled();await expect(page.getByRole('alert')).toContainText(expected);
  assert(!await page.locator('body').innerText().then(text=>text.includes(secret)||text.includes('local experiment')));
  await expect(page.getByRole('button',{name:'Attach PDF or image',exact:true})).toHaveCount(0);
  assert.deepEqual(calls.map(call=>call.action),name==='timeout'?['status','history']:['status','status','history']);
  if(send){await page.getByRole('textbox',{name:'Message',exact:true}).fill('How do I review pending receivals?');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Synthetic ordinary help remains usable.',{exact:true})).toBeVisible();assert.equal(calls.filter(call=>call.action==='ask').length,1);}
  await Promise.all(pendingConsole);assert.equal(diagnostics.length,1);assert.deepEqual(Object.keys(diagnostics[0]).sort(),['code','requestId','stage','status']);assert.equal(diagnostics[0].stage,'hosted-invoice-status');
  assert(!JSON.stringify({diagnostics,consoleRows}).includes(secret));assert(calls.every(call=>['status','history','ask'].includes(call.action)));
  if(name==='catalog503'){assert.deepEqual(diagnostics[0],{stage:'hosted-invoice-status',status:503,code:'invoice_catalog_unavailable',requestId});await page.screenshot({path:directory+'/catalog-failure-restored-desktop.png',fullPage:true});}
  if(mobile){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:directory+'/safe-startup-failure-mobile.png',fullPage:true});}
  return {scenario:name,calls:calls.map(call=>({action:call.action,workspace:call.workspace??null})),diagnostics};
 }finally{await context.close();}
}
const cases=[];
try{
 browser=await chromium.launch({headless:true,env:{PATH:process.env.PATH??'',HOME:process.env.HOME??'',TMPDIR:process.env.TMPDIR??'/tmp'}});
 cases.push(await scenario('catalog503','material catalog',{send:true}));cases.push(await scenario('jobs503','Production Job choices'));checks.push('Catalog/Jobs 503 failures preserve history hydration; explicit ordinary Send retains the owner conversation and sends no invoice context');
 cases.push(await scenario('auth401','verify your sign-in'));cases.push(await scenario('auth403','current account cannot'));checks.push('401/403 display sign-in/permission guidance, restore normal history, and never enable attachments or repeat AI requests');
 cases.push(await scenario('service503','temporarily unavailable'));cases.push(await scenario('timeout','temporarily unavailable'));checks.push('503 and synthetic transport timeout remain safely classified with no raw error/body logging');
 cases.push(await scenario('projection','could not be started',{mobile:true}));cases.push(await scenario('unknown-code','could not be started'));checks.push('Malformed projection and unknown structured code fail closed with generic guidance; secret markers never reach employee text or diagnostics');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);for(const [file,expected]of Object.entries(sourceHashes))assert.equal(hash(readFileSync(file)),expected,'Source changed during verification: '+file);
 const report={passed:true,groups:checks.length,checks,cases,sourceHashes,bundleSha256:hash(bundle),cssSha256:hash(css),mode:'Real source hook and Supabase SDK with synthetic Auth/intercepted HTTP; timeout injected as a synthetic SDK error. Not hosted Auth/RPC/RLS/deployment evidence.',actualInference:false,operationalWrites:0,grantMutations:0,externalRequestsForwarded:0,portsUsed:[],errors,blocked,traces};writeFileSync(directory+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,groups:checks.length,report:directory+'/report.json',operationalWrites:0,externalRequestsForwarded:0}));
}catch(error){await lastPage?.screenshot({path:directory+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(directory+'/failure.json',JSON.stringify({passed:false,message:error.message,checks,cases,errors,blocked,traces,actualInference:false,operationalWrites:0,externalRequestsForwarded:0},null,2)+'\n');throw error;}
finally{clearTimeout(deadline);await browser?.close();}
