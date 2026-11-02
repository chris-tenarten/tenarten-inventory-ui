/** Local integration harness, never imported by the application or Edge.
 * Real Auth, owner-private history and canonical business operations use only
 * the existing standalone synthetic fixture. The provider transport is scripted:
 * no model inference, paid authorization or historical usage-ledger changes.
 */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {RECEIVAL_FIXTURE_REF,receivalFixtureConfig,fixtureClient,fixtureSql} from './tenbot-receival-fixture.mjs';
import {createHostedTenbot,TENBOT_HOSTED_SERVICE_RPCS,type HostedRpc} from '../../supabase/functions/_shared/tenbot-hosted';
import {createTenbotJobTools} from '../../supabase/functions/_shared/tenbot-job-tools';
import {createReviewedActionTransport} from '../../supabase/functions/_shared/tenbot-action-transport';
import {createReviewedActionService,type ActionRpc} from '../../supabase/functions/_shared/tenbot-actions';
import {buildProposalPreview} from '../../supabase/functions/_shared/tenbot-proposal-operations';
import {mintHostedReceivalExecutionPermit} from '../../supabase/functions/_shared/tenbot-receival-hosted';
import {createInvoiceReceivalAttachmentService,createInvoiceReceivalSourceStateWriter} from '../../src/modules/inventory/invoice-receival-attachments';
import {defaultModel} from '../../supabase/functions/_shared/tenbot-models';
import {TenbotError,type InferenceProvider,type InferenceInput} from '../../supabase/functions/_shared/tenbot-core';

export const INTEGRATED_REVIEW_PORT=55598;
export const INTEGRATED_REVIEW_DIRECTORY='/private/tmp/tenops-tenbot-integrated-review-20261102';
export const INTEGRATED_REVIEW_API='http://localhost:'+INTEGRATED_REVIEW_PORT;
export const INTEGRATED_REVIEW_PUBLIC_KEY='isolated-loopback-review-public';
const INTERNAL_ORIGIN='https://tendev.pages.dev';
const BASE_CONFIG='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
type Row=Record<string,unknown>;
type Scenario='proposal'|'pending'|'clarify';
type Catalog={id:string;vendor:string;vendor_sku:string;item_name:string;size:string;unit:string};
type Selection={scenario:Scenario;question:string;documentIds:string[];catalog?:Catalog;sourceId?:string;reference?:string};
const require=createRequire(import.meta.url);
const object=(value:unknown):value is Row=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key=(token:string)=>{try{return String(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).session_id??'');}catch{return '';}};
const privateRead=(path:string)=>{const info=lstatSync(path);assert(info.isFile()&&!info.isSymbolicLink()&&info.uid===process.getuid?.()&&(info.mode&0o077)===0,'Existing owner-only fixture configuration required');return JSON.parse(readFileSync(path,'utf8'));};
const save=(name:string,value:unknown)=>writeFileSync(INTEGRATED_REVIEW_DIRECTORY+'/'+name+'.json',JSON.stringify(value,null,2)+'\n',{mode:0o600});
const readRpcs=new Set(['ensure_my_welcome_notification','get_my_app_access','get_my_account_preferences','has_app_capability','has_proposal_access','get_tenbot_reviewed_action','get_invoice_receival_source','tenbot_authorize_history_jobs']);
const originalRpcs=new Set(['begin_invoice_receival_source','prepare_invoice_receival_source_removal','finish_invoice_receival_source_removal','list_expired_invoice_receival_sources']);
const metadataRpcs=new Set([...TENBOT_HOSTED_SERVICE_RPCS,'stamp_tenbot_action_password','tenbot_receival_mint_execution_permit','record_invoice_receival_source_state']);

function fingerprint(){return fixtureSql('integrated-review-fingerprint-'+randomUUID().slice(0,8),"begin read only;select jsonb_build_object('stock',(select md5(coalesce(string_agg(to_jsonb(i)::text,',' order by id),'')) from public.inventory_items i),'transactions',(select count(*) from public.inventory_transactions),'caps',(select md5(coalesce(string_agg(to_jsonb(c)::text,',' order by role,capability),'')) from public.app_role_capabilities c),'profiles',(select md5(coalesce(string_agg((to_jsonb(u)-array['updated_at','updated_by_user_id'])::text,',' order by user_id),'')) from public.app_users u),'action',(select to_jsonb(c) from public.tenbot_action_control c),'execution',(select to_jsonb(c) from public.tenbot_receival_execution_control c),'pilot',(select to_jsonb(c) from public.tenbot_receival_pilot_policy c),'enrollment',(select coalesce(jsonb_agg(to_jsonb(e) order by user_id),'[]') from public.tenbot_receival_pilot_employees e),'proposalAccess',(select coalesce(jsonb_agg(user_id order by user_id),'[]') from public.proposal_access_users)) as state;commit;")[0].state as Row;}

/** Import the exact existing renderer; only Node/Deno loading glue changes.
 * Never create a second PDF template or deploy a fixture Edge function. */
async function proposalRenderer(){
 const sourcePath=resolve('supabase/functions/generate-proposal-pdf/index.ts'),source=readFileSync(sourcePath,'utf8');
 let nodeSource=source.slice(0,source.indexOf("if (typeof Deno !== 'undefined') Deno.serve"));
 assert(nodeSource.includes('export async function render('));
 nodeSource=nodeSource.replace("import { createClient } from 'npm:@supabase/supabase-js@2.101.1';",'')
  .replace("from 'npm:pdf-lib@1.17.1'","from "+JSON.stringify(pathToFileURL(require.resolve('pdf-lib')).href))
  .replace("from './proposal-pdf-model.ts'","from "+JSON.stringify(pathToFileURL(resolve('supabase/functions/generate-proposal-pdf/proposal-pdf-model.ts')).href))
  .replace("from './tenarten-logo.ts'","from "+JSON.stringify(pathToFileURL(resolve('supabase/functions/generate-proposal-pdf/tenarten-logo.ts')).href))
  .replace("from '../_shared/pdf-text.mjs'","from "+JSON.stringify(pathToFileURL(resolve('supabase/functions/_shared/pdf-text.mjs')).href))
  .replace("const allowed = (Deno.env.get('TENOPS_ALLOWED_ORIGINS') || 'http://localhost:3000').split(',').map((entry) => entry.trim()).filter(Boolean);","const allowed = ['http://localhost:3000'];");
 const path=INTEGRATED_REVIEW_DIRECTORY+'/proposal-renderer.mts';writeFileSync(path,nodeSource,{mode:0o600});
 const loadedRenderer=await import(pathToFileURL(path).href) as {render(snapshot:Row):Promise<Uint8Array>};
 return {render:loadedRenderer.render,sourceSha256:sha(source)};
}

function scriptedProvider(selection:Selection,steps:{name:string}[]):InferenceProvider{
 let round=0;
 const field=(path:string,value:string,source_ref='employee')=>({path,value,source_ref});
 const calls: Array<{name:string;arguments:Row}>=selection.scenario==='proposal'?[{name:'prepare_proposal_draft',arguments:{customer_company_id:null,customer_contact_id:null,fields:[field('customer_name','Synthetic Integration Customer'),field('project_name','Synthetic Integration Lobby')],lines:[{line_type:'product',fields:[field('description','Synthetic white terrazzo tread'),field('quantity','2'),field('unit','Each'),field('rate','12.50')]}]}}]:selection.scenario==='pending'&&selection.sourceId&&selection.catalog?[
  {name:'read_supplied_document',arguments:{source_id:selection.sourceId}},
  {name:'search_material_catalog',arguments:{query:selection.catalog.item_name}},
  {name:'prepare_pending_receivals',arguments:{source_id:selection.sourceId,supplier_source_ref:selection.sourceId+':L1',document_reference_source_ref:selection.sourceId+':L2',ordered_by:'Synthetic Integration Employee',order_date:new Date().toISOString().slice(0,10),location:'Denton',lines:[{source_ref:selection.sourceId+':L3',catalog_source:'standard',catalog_id:selection.catalog.id,source_quantity:'100',source_unit:'LB',quantity_expected:'2',unit:'Bag',production_job_id:null}]}},
 ]:[];
 return {
  name:'Offline scripted integration transport — no model inference',
  reserveEstimate:()=>({model:defaultModel,neurons:1}),
  usage:()=>({model:defaultModel,inputTokens:0,outputTokens:0,estimatedNeurons:0}),
  async infer(input:InferenceInput){
   assert(input.agent,'Only the ordinary bounded agent protocol is allowed');round++;
   if(calls.length&&round===1){steps.push({name:'discover_capabilities'});return {calls:[{id:'discover',name:'discover_capabilities',arguments:{names:calls.map(call=>call.name)}}],final:null};}
   if(calls.length&&round<=calls.length+1){const call=calls[round-2];assert(input.agent.tools.some(tool=>tool.name===call.name),'Discovery must load the operation before execution');steps.push({name:call.name});return {calls:[{id:'operation_'+round,...call}],final:null};}
   const last=[...input.agent.history].reverse().find(item=>item.kind==='tool_result');
   const output=last&&last.kind==='tool_result'?JSON.parse(last.output):null;
   const facts=object(output)&&object(output.data)&&Array.isArray(output.data.answer_facts)?output.data.answer_facts.filter(object):[];
   const text=facts.length&&typeof facts[0].text==='string'?facts[0].text:'This local review uses a scripted preparation transport. Choose a review scenario to exercise the connected action controls. No AI inference is running.';
   steps.push({name:'final'});
   return {calls:[],final:{answer:text,observations:facts.length?[{text,evidence_ids:[output.evidence_id]}]:[],inferences:[],recommendations:[],questions:facts.length?[]:['Choose a local review scenario before preparing an action.'],completed_actions:[]}};
  },
 };
}

export async function startIntegratedReview(options:{enableExecution:boolean;internalOrigin?:string;minutes?:number}){
 assert.equal(RECEIVAL_FIXTURE_REF,'jltgxcfiprocydhbrahz');
 const config=receivalFixtureConfig(),base=privateRead(BASE_CONFIG);
 assert.equal(base.projectRef,RECEIVAL_FIXTURE_REF);assert.equal(base.url,config.url);
 assert(base.actors.admin?.id&&base.actors.admin?.email&&base.actors.admin?.password,'Existing synthetic Admin required');
 const actorIds=new Set<string>(Object.values(base.actors as Record<string,{id:string}>).map(actor=>actor.id));
 const origins=new Set(['http://localhost:3000',INTEGRATED_REVIEW_API,...(options.internalOrigin?[options.internalOrigin]:[])]);
 for(const origin of origins){const parsed=new URL(origin);assert.equal(parsed.hostname,'localhost');assert.equal(parsed.protocol,'http:');assert(!parsed.pathname.slice(1)&&!parsed.search&&!parsed.hash);}
 const minutes=options.minutes??30;assert(Number.isSafeInteger(minutes)&&minutes>=1&&minutes<=60);
 mkdirSync(INTEGRATED_REVIEW_DIRECTORY,{recursive:true});
 save('review-login.private',{email:base.actors.admin.email,password:base.actors.admin.password,notice:'Existing synthetic fixture account only. Use at http://localhost:3000; never enter a real TenOps password in this fixture.'});
 writeFileSync(INTEGRATED_REVIEW_DIRECTORY+'/review-guide.txt','Open http://localhost:55598/review to choose the scripted Proposal or Pending fixture and obtain its exact question and synthetic PDF. Then open http://localhost:3000, sign in with the owner-only review-login.private.json in this directory, open TenBot and paste the selected question. For Pending, attach the downloaded identical PDF before Send. Preparation uses a scripted transport; existing-account Auth, private Storage/history and canonical saved records are real in isolated jltgxcfiprocydhbrahz. No AI inference runs. Controls expire automatically and are restored on bridge shutdown. Use synthetic data only.\n',{mode:0o600});
 const before=fingerprint();save('baseline',{at:new Date().toISOString(),fixtureRef:RECEIVAL_FIXTURE_REF,state:before});
 assert(object(before.action)&&before.action.proposal_enabled===false&&before.action.receivals_enabled===false);
 assert(object(before.pilot)&&before.pilot.enabled===false);assert(object(before.execution)&&before.execution.execution_enabled===false);
 assert(Array.isArray(before.enrollment)&&before.enrollment.length===0,'Preserve existing pilot enrollment');
 const adminId=String(base.actors.admin.id),until=Date.now()+minutes*60000;
 const renderer=await proposalRenderer();
 const selections=new Map<string,Selection>(),documents=new Map<string,Uint8Array>(),steps:Array<{name:string}>=[],created:{sources:string[];actions:string[];proposals:string[];pending:string[]}={sources:[],actions:[],proposals:[],pending:[]};
 let apiRequests=0,restProxyRequests=0,authRequests=0,stopping=false;
 const metadata:ActionRpc={async rpc(name,args){
  assert(metadataRpcs.has(name),'Unreviewed privileged metadata RPC rejected');
  assert(!name.startsWith('tenbot_openai_'),'No paid accounting in offline integration review');
  const response=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:base.serviceRoleKey,Authorization:'Bearer '+base.serviceRoleKey,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
  const value=await response.json();return response.ok?{data:value,error:null}:{data:null,error:{code:object(value)&&typeof value.code==='string'?value.code:'unavailable'}};
 }};
 const service:HostedRpc=async(name,args={})=>{
  // The offline transport incurs zero usage. Keep all historical accounting
  // untouched rather than recording fictitious inference measurements.
  if(name==='tenbot_reserve_usage')return {data:randomUUID(),error:null};
  if(name==='tenbot_finish_usage')return {data:null,error:null};
  if(name.startsWith('tenbot_openai_'))return {data:null,error:{code:'42501'}};
  return metadata.rpc(name,args);
 };
 async function signed(token:string){
  assert(token.length>20&&token.length<16384);
  const caller=fixtureClient(token),result=await caller.auth.getUser(token);
  assert(!result.error&&result.data.user&&actorIds.has(result.data.user.id),'Existing synthetic fixture account required');
  assert(uuid.test(key(token)),'Real Auth session required');
  return {caller,user:result.data.user};
 }
 async function select(caller:SupabaseClient,owner:string,scenario:Scenario):Promise<Selection>{
  if(scenario==='clarify')return {scenario,question:'Help me with an operational task.',documentIds:[]};
  if(scenario==='proposal')return {scenario,question:'Prepare a Proposal for Synthetic Integration Customer at Synthetic Integration Lobby: quantity 2 Each of Synthetic white terrazzo tread, quote unit price $12.50.',documentIds:[]};
  const existing=await caller.from('vendor_catalog').select('id,vendor,vendor_sku,item_name,size,unit').ilike('item_name','Action Material %').eq('unit','50 LB Bag').order('id').limit(1);
  assert(!existing.error&&existing.data?.length===1,'Reuse the existing synthetic canonical catalog material');
  const catalog=existing.data[0] as Catalog,reference='SYN-INTEGRATION-'+randomUUID().slice(0,8);
  const raw=['Supplier: '+catalog.vendor,'Invoice: '+reference,`${catalog.vendor_sku} | ${catalog.item_name} | ${catalog.size} | 100 LB (50 LB Bag)`];
  const pdf=await PDFDocument.create(),page=pdf.addPage([612,792]),font=await pdf.embedFont(StandardFonts.Helvetica);
  raw.forEach((line,index)=>page.drawText(line,{x:30,y:750-index*25,size:12,font}));
  const bytes=new Uint8Array(await pdf.save()),blob=new Blob([bytes],{type:'application/pdf'}),upload=await createInvoiceReceivalAttachmentService(caller).upload(blob,reference+'.pdf');created.sources.push(upload.id);documents.set(owner,bytes);writeFileSync(INTEGRATED_REVIEW_DIRECTORY+'/synthetic-review-invoice.pdf',bytes,{mode:0o600});
  const source=await createInvoiceReceivalSourceStateWriter(metadata).record({actorId:owner,sourceId:upload.id,expectedVersion:upload.version,verifiedSha256:upload.sha256,state:{version:'invoice-receival-state.v1',originalSha256:upload.sha256,visionSha256:upload.sha256,rawLines:raw,sourceRows:[{lineId:upload.id+':L3',sourceText:raw[2],sourceQuantity:{quantity:'100',unit:'LB'}}],draft:null,traceHash:null}});
  return {scenario,question:'Use the supplied invoice to prepare 2 Bag of '+catalog.item_name+' as Pending Receivals for Denton, ordered by Synthetic Integration Employee. Adding it to the queue must not increase stock.',documentIds:[source.id],sourceId:source.id,catalog,reference};
 }
 function remember(value:unknown){
  if(!object(value))return;
  if(Array.isArray(value.actionStatuses))for(const status of value.actionStatuses)if(object(status)&&object(status.card)&&object(status.card.reference)&&typeof status.card.reference.id==='string'&&!created.actions.includes(status.card.reference.id))created.actions.push(status.card.reference.id);
  const receipt=object(value.receipt)?value.receipt:null,result=receipt&&object(receipt.result)?receipt.result:null;
  if(result&&typeof result.proposalId==='string'&&!created.proposals.includes(result.proposalId))created.proposals.push(result.proposalId);
  if(result&&Array.isArray(result.createdRecordIds))for(const id of result.createdRecordIds)if(typeof id==='string'&&!created.pending.includes(id))created.pending.push(id);
 }
 const headers=(origin:string)=>({'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,range-unit','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Access-Control-Expose-Headers':'content-range'});
 const send=(res:ServerResponse,origin:string,status:number,value:unknown)=>{res.writeHead(status,{...headers(origin),'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 const readBody=async(req:IncomingMessage,max=16000)=>{let bytes=0,raw='';for await(const part of req){bytes+=part.length;assert(bytes<=max,'Request exceeds local review bound');raw+=part.toString();}return raw?JSON.parse(raw):{};};
 const server=createServer(async(req,res)=>{
  const origin=req.headers.origin??'';
  if(!['localhost:'+INTEGRATED_REVIEW_PORT,'127.0.0.1:'+INTEGRATED_REVIEW_PORT].includes(req.headers.host??'')||origin&&!origins.has(origin))return send(res,'',403,{error:'Exact loopback review origin required.'});
  const corsOrigin=origins.has(origin)?origin:'http://localhost:3000';
  if(req.method==='OPTIONS'){res.writeHead(204,headers(corsOrigin));res.end();return;}
  const url=new URL(req.url??'/',INTEGRATED_REVIEW_API);
  try{
   if(url.pathname==='/review'&&req.method==='GET'){
    const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated TenDev review controls</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.5}button,a{display:inline-block;margin:8px 8px 8px 0;padding:10px}pre{white-space:pre-wrap;background:#f4f4f4;padding:16px}#error{color:#a00}</style><h1>Isolated TenDev functional review</h1><p>This control page chooses the <strong>scripted preparation fixture</strong>. Account confirmation, private documents, history and saved business records use the existing synthetic isolated database. No AI inference runs.</p><p>Use the synthetic account in the owner-only <code>review-login.private.json</code> file. Enter that password only in the application sign-in or action confirmation controls. Do not use your real TenOps password.</p><button data-scenario="proposal">Choose Proposal example</button><button data-scenario="pending">Choose Pending Receivals example</button><a href="http://localhost:3000" target="_blank" rel="noopener">Open TenDev application</a><p id="error" role="alert"></p><pre id="question">Choose an example. Then paste its exact question into TenBot in the application.</pre><button id="download" hidden>Download the exact synthetic invoice PDF</button><p>For Pending Receivals, attach that identical PDF using TenBot's paperclip before sending the question. Its text is explicitly attested fixture evidence, not live OCR. Each selection creates a new synthetic invoice. Completed Pending entries have expected quantity only; they do not increase stock.</p><script>let token='';async function request(path,body){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),cache:'no-store'});if(!response.ok)throw Error('The isolated fixture could not be prepared. Check the local review bridge.');return response.json()}for(const button of document.querySelectorAll('[data-scenario]'))button.onclick=async()=>{document.querySelector('#error').textContent='';button.disabled=true;try{const seed=await request('/review/session',{});token=seed.session.access_token;delete seed.session;const selected=await request('/review/scenario',{scenario:button.dataset.scenario});document.querySelector('#question').textContent=selected.question;document.querySelector('#download').hidden=selected.scenario!=='pending'}catch(error){document.querySelector('#error').textContent=error.message}finally{button.disabled=false}};document.querySelector('#download').onclick=async()=>{try{const response=await fetch('/review/document.pdf',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!response.ok)throw Error('Select the Pending example again.');const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='synthetic-integration-invoice.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){document.querySelector('#error').textContent=error.message}};</script></html>`;
    res.writeHead(200,{...headers(corsOrigin),'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"});res.end(html);return;
   }
   if(url.pathname==='/review/status'&&req.method==='GET')return send(res,corsOrigin,200,{mode:'real-isolated-auth-and-canonical-operations',fixtureRef:RECEIVAL_FIXTURE_REF,scriptedTransport:true,modelInference:false,paidSpending:false,sharedProjectWrites:0,executionEnabled:options.enableExecution&&Date.now()<until,expiresAt:new Date(until).toISOString(),providerSteps:steps.map(step=>step.name),created,apiRequests,restProxyRequests,authRequests});
   if(url.pathname==='/review/session'&&req.method==='POST'){
    assert(origins.has(origin),'Exact browser review origin required');await readBody(req);
    const client=fixtureClient(),result=await client.auth.signInWithPassword({email:base.actors.admin.email,password:base.actors.admin.password});
    assert(!result.error&&result.data.user?.id===adminId&&result.data.session,'Existing synthetic Admin sign-in failed');authRequests++;
    selections.set(adminId,await select(fixtureClient(result.data.session.access_token),adminId,'proposal'));
    return send(res,corsOrigin,200,{session:result.data.session,selection:selections.get(adminId),notice:'Isolated synthetic account; real Auth and business operations, scripted preparation, no AI inference.'});
   }
   const token=(req.headers.authorization??'').replace(/^Bearer\s+/i,'');
   if(url.pathname.startsWith('/auth/v1/')){
    const authBody=req.method==='POST'?await readBody(req):undefined;
    if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='password')assert(object(authBody)&&Object.values(base.actors as Record<string,{email:string}>).some(actor=>actor.email===authBody.email),'Existing synthetic accounts only');
    else if(url.pathname==='/auth/v1/token')assert(url.searchParams.get('grant_type')==='refresh_token','No Auth account administration');
    else assert(['/auth/v1/user','/auth/v1/logout'].includes(url.pathname),'No Auth account administration');
    if(url.pathname==='/auth/v1/user')assert(req.method==='GET','No account mutation');
    const authHeaders:Record<string,string>={apikey:config.anonKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
    const response=await fetch(config.url+url.pathname+url.search,{method:req.method,headers:authHeaders,...(authBody?{body:JSON.stringify(authBody)}:{}),signal:AbortSignal.timeout(15000)});authRequests++;
    res.writeHead(response.status,{...headers(corsOrigin),'Content-Type':response.headers.get('content-type')??'application/json'});res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   const {caller,user}=await signed(token);
   if(url.pathname==='/review/document.pdf'&&req.method==='GET'){
    const bytes=documents.get(user.id);assert(bytes,'Select the Pending scenario first');
    res.writeHead(200,{...headers(corsOrigin),'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="synthetic-integration-invoice.pdf"'});res.end(bytes);return;
   }
   if(url.pathname==='/review/scenario'&&req.method==='POST'){
    const body=await readBody(req);assert(object(body)&&Object.keys(body).length===1&&['proposal','pending','clarify'].includes(String(body.scenario)));
    const selection=await select(caller,user.id,body.scenario as Scenario);selections.set(user.id,selection);return send(res,corsOrigin,200,selection);
   }
   if(url.pathname==='/functions/v1/tenbot'&&req.method==='POST'){
    const body=await readBody(req);assert(object(body));apiRequests++;
    if(body.workspace==='tenbot.actions.v1'){
     const actionMetadata:ActionRpc={rpc:(name,args)=>['stamp_tenbot_action_password','tenbot_receival_mint_execution_permit'].includes(name)?metadata.rpc(name,args):Promise.resolve({data:null,error:{code:'42501'}})};
     const trusted=createReviewedActionTransport({enabled:options.enableExecution&&Date.now()<until,origin:INTERNAL_ORIGIN,caller,password:{authenticate:async()=>({user,token,caller}),createPasswordClient:()=>fixtureClient(),callerForToken:fixtureClient,service:actionMetadata,async beforeExecute(input){
      if(input.operation!=='inventory.create_pending_receivals')return;
      assert(options.enableExecution&&Date.now()<until&&input.ownerId===adminId,'Finite isolated pilot only');
      const stage=await createReviewedActionService(input.caller).stageReceivals(input.reference);
      await mintHostedReceivalExecutionPermit({owner:input.ownerId,draftId:stage.draftId,hash:stage.hash,approvalId:stage.approvalId,origin:INTERNAL_ORIGIN,service:actionMetadata.rpc});
     }},async preview(reference){const saved=await createReviewedActionService(caller).preview(reference);return renderer.render(buildProposalPreview(saved.parameters) as Row);}});
     const result=await trusted(body);remember(result.body);
     if(result.pdf){res.writeHead(200,{...headers(corsOrigin),'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Proposal-Preview.pdf"'});res.end(result.pdf);return;}
     return send(res,corsOrigin,result.status,result.body);
    }
    assert(!Object.hasOwn(body,'password'),'Use the trusted password control');
    const selection=selections.get(user.id)??{scenario:'clarify' as const,question:'',documentIds:[]};
    const hosted=createHostedTenbot({owner:user.id,origin:INTERNAL_ORIGIN,config:{enabled:true,origins:[INTERNAL_ORIGIN],persistentHistory:true,modelDirectedReads:true,reviewedOperationsEnabled:true,apiKey:'',keyExpiresAt:'',spendingAuthorized:false},caller:async(name,args)=>{const result=await caller.rpc(name,args);return {data:result.data,error:result.error};},service,reviewedCaller:caller,actionSessionId:key(token),qwen:scriptedProvider(selection,steps),jobTools:createTenbotJobTools(caller)});
    const result=await hosted(body);remember(result);return send(res,corsOrigin,200,result);
   }
   if(url.pathname==='/functions/v1/generate-proposal-pdf'&&req.method==='POST'){
    const access=await caller.rpc('has_proposal_access',{});assert(!access.error&&access.data===true);
    const body=await readBody(req,250000);assert(object(body)&&body.action==='preview'&&object(body.snapshot),'Preview only; no issuance or document Storage mutation');
    const bytes=await renderer.render(body.snapshot);res.writeHead(200,{...headers(corsOrigin),'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Proposal-Preview.pdf"'});res.end(bytes);return;
   }
   if(url.pathname.startsWith('/rest/v1/')||url.pathname.startsWith('/storage/v1/')){
    const rpc=url.pathname.startsWith('/rest/v1/rpc/')?url.pathname.split('/').at(-1):undefined;
    const originalUpload=req.method==='POST'&&url.pathname.startsWith('/storage/v1/object/invoice-receival-originals/'+user.id+'/');
    const originalDelete=req.method==='DELETE'&&url.pathname==='/storage/v1/object/invoice-receival-originals';
    assert(req.method==='GET'||req.method==='HEAD'||req.method==='POST'&&rpc&&(readRpcs.has(rpc)||originalRpcs.has(rpc)||/^(get_|list_|search_)/.test(rpc))||originalUpload||originalDelete,'Only caller reads and owner-private original upload/removal pass through the local proxy');
    let requestBody:string|Uint8Array|undefined;
    if(originalUpload){const parts:Buffer[]=[];let bytes=0;for await(const part of req){bytes+=part.length;assert(bytes<=12002000);parts.push(Buffer.from(part));}requestBody=Buffer.concat(parts);}
    else if(req.method==='POST'||originalDelete)requestBody=JSON.stringify(await readBody(req,250000));
    const proxyHeaders:Record<string,string>={apikey:config.anonKey,Authorization:'Bearer '+token};
    for(const name of ['content-type','prefer','range','range-unit','accept'])if(typeof req.headers[name]==='string')proxyHeaders[name]=req.headers[name];
    const response=await fetch(config.url+url.pathname+url.search,{method:req.method,headers:proxyHeaders,...(requestBody?{body:requestBody as BodyInit}:{}),signal:AbortSignal.timeout(15000)});restProxyRequests++;
    const responseHeaders:Record<string,string>={...headers(corsOrigin)};for(const name of ['content-type','content-range','range-unit']){const value=response.headers.get(name);if(value)responseHeaders[name]=value;}
    res.writeHead(response.status,responseHeaders);res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));return;
   }
   return send(res,corsOrigin,403,{error:'This local integration endpoint is unavailable.'});
  }catch(error){return send(res,corsOrigin,error instanceof TenbotError?error.status:503,{error:error instanceof TenbotError?error.message:'The isolated review request is unavailable. Check the saved action status before retrying.'});}
 });
 server.requestTimeout=100000;server.headersTimeout=10000;
 // Bind before changing controls: a busy port can never leave an enabled pilot.
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(INTEGRATED_REVIEW_PORT,'localhost',resolve);});
 try{
  if(options.enableExecution)fixtureSql('integrated-review-enable',`begin;update public.tenbot_action_control set proposal_enabled=true,receivals_enabled=true where singleton;insert into public.tenbot_receival_pilot_employees(user_id) values(${quote(adminId)});update public.tenbot_receival_pilot_policy set enabled=true,starts_at=clock_timestamp()-interval '1 minute',expires_at=${quote(new Date(until).toISOString())}::timestamptz,validation_receipt_sha256=${quote(sha('local integrated review '+new Date().toISOString()))} where singleton;update public.tenbot_receival_execution_control set execution_enabled=true,validated_at=clock_timestamp(),isolated_validation_receipt='SYN-INTEGRATION-LOCAL' where singleton;commit;`);
 }catch(error){server.close();throw error;}
 const restore=async()=>{
  if(stopping)return;stopping=true;
  const action=before.action as Row,pilot=before.pilot as Row,execution=before.execution as Row,literal=(value:unknown)=>value===null||value===undefined?'null':quote(String(value));
  if(options.enableExecution)fixtureSql('integrated-review-restore',`begin;update public.tenbot_action_control set proposal_enabled=${action.proposal_enabled===true},receivals_enabled=${action.receivals_enabled===true} where singleton;delete from public.tenbot_receival_pilot_employees where user_id=${quote(adminId)};update public.tenbot_receival_pilot_policy set enabled=false,starts_at=${literal(pilot.starts_at)}::timestamptz,expires_at=${literal(pilot.expires_at)}::timestamptz,validation_receipt_sha256=${literal(pilot.validation_receipt_sha256)} where singleton;update public.tenbot_receival_execution_control set execution_enabled=false,validated_at=${literal(execution.validated_at)}::timestamptz,isolated_validation_receipt=${literal(execution.isolated_validation_receipt)} where singleton;commit;`);
  const after=fingerprint();
  for(const invariant of ['stock','transactions','caps','profiles','proposalAccess','enrollment'])assert.deepEqual(after[invariant],before[invariant],'Review changed protected baseline: '+invariant);
  assert(object(after.action)&&after.action.proposal_enabled===false&&after.action.receivals_enabled===false);assert(object(after.pilot)&&after.pilot.enabled===false);assert(object(after.execution)&&after.execution.execution_enabled===false);
  save('closure',{at:new Date().toISOString(),fixtureRef:RECEIVAL_FIXTURE_REF,protectedStatePreserved:true,allWriteControlsOff:true,created,steps,providerCalls:0,paidCostUsd:0,sharedWrites:0,state:after});
 };
 const expiry=setTimeout(()=>{void restore().catch(()=>{console.error('Isolated review control restoration failed; inspect the fixed fixture control state.');process.exitCode=1;});},minutes*60000);expiry.unref();
 const close=async()=>{clearTimeout(expiry);await new Promise<void>(resolve=>server.close(()=>resolve()));await restore();};
 save('server',{pid:process.pid,port:INTEGRATED_REVIEW_PORT,apiUrl:INTEGRATED_REVIEW_API,origins:[...origins],fixtureRef:RECEIVAL_FIXTURE_REF,expiresAt:new Date(until).toISOString(),executionEnabled:options.enableExecution,modelInference:false,scriptedTransport:true,providerCalls:0,paidCostUsd:0,sharedWrites:0,pdfRendererSha256:renderer.sourceSha256,agentRuntimeBaseline:process.env.TENBOT_REVIEW_AGENT_BASELINE??null,baselinePath:INTEGRATED_REVIEW_DIRECTORY+'/baseline.json'});
 return {server,close,config:{apiUrl:INTEGRATED_REVIEW_API,publicKey:INTEGRATED_REVIEW_PUBLIC_KEY,fixtureRef:RECEIVAL_FIXTURE_REF},directory:INTEGRATED_REVIEW_DIRECTORY};
}
