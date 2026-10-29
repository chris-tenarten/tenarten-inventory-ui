// Local review only: reuse the existing app/Job fixture. No setup migrations,
// hosted forwarding, business mutations or credential changes occur here.
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {handleTenbot} from '../supabase/functions/_shared/tenbot-handler';
import {TenbotError} from '../supabase/functions/_shared/tenbot-core';
import {createTenbotAgentSessions} from '../supabase/functions/_shared/tenbot-agent-session';
import {createTenbotJobTools} from '../supabase/functions/_shared/tenbot-job-tools';
import {createOpenAIProvider,OPENAI_EXPERIMENT_PRICING,type OpenAIModel} from '../supabase/functions/_shared/tenbot-openai';
import type {TenbotInvoiceDocument} from '../supabase/functions/_shared/tenbot-invoice';
import {createScriptedTenbotAgentProvider} from './support/tenbot-agent-scripted.mjs';
import {CAPABILITIES} from '../src/lib/rbac';

if(process.argv.includes('--synthetic-live'))await startSyntheticLive();else await startExisting();

async function startExisting(){
const {TENBOT_JOB_DATABASE,jobFixture,createTenbotJobCaller}=await import('./support/tenbot-job-database.mjs');
const {literal,admin}=await import('./support/intake-materials-database.mjs');
const {sql,assertTenbotFixtureReady}=await import('./support/tenbot-fixture-health.mjs');
const port=55595,origin='http://localhost:3000',directory='/private/tmp/tenops-tenbot-agent-poc';
// Reuse only. A daemon/fixture failure must never trigger setup, reseeding or inference.
assertTenbotFixtureReady();
mkdirSync(directory,{recursive:true});
const useOpenAI=process.argv.includes('--openai');
const selected=process.argv.find(arg=>arg.startsWith('--model='))?.slice(8)??'gpt-6.1-sol';
if(!['gpt-6.1-sol','gpt-6.1-terra'].includes(selected))throw Error('Model is outside the experimental allowlist.');
const model=selected as OpenAIModel;
const requested=Number(process.argv.find(arg=>arg.startsWith('--authorized-budget-usd='))?.slice(24)??'0');
const key=useOpenAI?(process.env.TENBOT_OPENAI_API_KEY||process.env.OPENAI_API_KEY||''):'';
const spendingAuthorized=useOpenAI&&process.env.TENBOT_OPENAI_SPEND_AUTHORIZED==='true'&&requested>0&&requested<=5;
// This file is local operational accounting, not credentials or a Production ledger.
const journalPath=directory+'/openai-budget.json';
type Journal={reservedOrSpentUsd:number;attempts:number;settled:number};
const journal:Journal=existsSync(journalPath)?JSON.parse(readFileSync(journalPath,'utf8')):{reservedOrSpentUsd:0,attempts:0,settled:0};
if(!Number.isFinite(journal.reservedOrSpentUsd)||journal.reservedOrSpentUsd<0||!Number.isSafeInteger(journal.attempts)||journal.attempts<0||!Number.isSafeInteger(journal.settled)||journal.settled<0||journal.settled>journal.attempts)throw Error('Local budget journal is invalid; inspect rather than reset it.');
const save=()=>{const temporary=journalPath+'.next';writeFileSync(temporary,JSON.stringify(journal,null,2),{mode:0o600});renameSync(temporary,journalPath);};
const reserveBudget=async(usd:number)=>{
 if(!spendingAuthorized||!Number.isFinite(usd)||usd<=0||journal.reservedOrSpentUsd+usd>requested)throw Error('Authorized local benchmark budget unavailable.');
 journal.reservedOrSpentUsd+=usd;journal.attempts++;save();let finished=false;
 return {settle(actual?:number){
  if(finished)return;
  if(actual!==undefined){if(!Number.isFinite(actual)||actual<0)throw Error('Invalid usage settlement.');journal.reservedOrSpentUsd+=actual-usd;journal.settled++;}
  finished=true;save();
 }};
};
const fixture=JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json','utf8')) as {synthetic:true;document:TenbotInvoiceDocument;catalog:{complete:boolean;standard:Record<string,unknown>[];specialty:Record<string,unknown>[]};receivals:{complete:boolean;rows:Record<string,unknown>[]}};
if(fixture.synthetic!==true)throw Error('Synthetic fixture required.');
const caps=new Set(['readOperationalData','writeBusinessData','adjustInventory','manageUsers']);
const capability=async(owner:string,name:string)=>{
 if(owner!==admin)return false;
 // Knowledge permissions are static server metadata, never SQL or caller input.
 if(!/^[a-zA-Z][a-zA-Z0-9._]{0,79}$/.test(name))return false;
 const expression=name==='proposal.access'?'public.has_proposal_access()':`public.has_app_capability(${literal(name)})`;
 try{return sql(TENBOT_JOB_DATABASE,`begin;set local role authenticated;set local request.jwt.claim.sub=${literal(owner)};set local statement_timeout='3s';select ${expression};commit;`)==='t';}catch{return false;}
};
const sessions=createTenbotAgentSessions({mode:useOpenAI?'openai':'offline-scripted',can:capability,
 jobTools:owner=>createTenbotJobTools(createTenbotJobCaller(TENBOT_JOB_DATABASE,owner),{now:()=>new Date(jobFixture.now)}),
 invoice:{document:fixture.document,reader:()=>({async searchCatalog(query){const term=query.toLocaleLowerCase('en-US');return {complete:true,standard:fixture.catalog.standard.filter(row=>[row.vendor_sku,row.item_name,row.vendor,row.size].some(value=>String(value??'').toLocaleLowerCase('en-US').includes(term))),specialty:fixture.catalog.specialty};},async readReceivals(){return fixture.receivals;}})},
 provider:scenario=>useOpenAI?createOpenAIProvider({model,apiKey:key,spendingAuthorized,pricing:OPENAI_EXPERIMENT_PRICING[model],reserveBudget}):createScriptedTenbotAgentProvider(scenario),
});
const server=createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(status:number,body:unknown)=>res.writeHead(status,headers).end(JSON.stringify(body));
 if(req.headers.origin!==origin)return send(403,{error:'Exact local review origin required.'});
 if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
 if(req.method!=='POST')return send(405,{error:'POST required.'});
 // Existing synthetic session only; this loopback fixture is not hosted Auth.
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 try{const parts=token.split('.');if(parts.length!==3||parts[2]!=='local'||JSON.parse(Buffer.from(parts[1],'base64url').toString()).sub!==admin)throw Error();}catch{return send(401,{error:'Existing local fixture session required.'});}
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)return send(413,{error:'Request too large.'});}
  const body:unknown=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid request.');
  if(!['ask','clear','history'].includes(String((body as Record<string,unknown>).action)))throw new TenbotError('Only local experimental questions, history and clearing are available. No execution action exists.');
  const caller=async(name:string,args:Record<string,unknown>={})=>name==='has_app_capability'&&caps.has(String(args.p_capability))?{data:await capability(admin,String(args.p_capability)),error:null}:{data:null,error:{message:'Not allowed'}};
  const noService=async()=>({data:null,error:{message:'The experiment has no privileged writes.'}});
  return send(200,await handleTenbot(body as Record<string,unknown>,admin,caller,noService,null,undefined,undefined,sessions));
 }catch(error){return send(error instanceof TenbotError?error.status:503,{error:error instanceof TenbotError?error.message:'Local agent experiment unavailable. No database changes were made.'});}
});
const sourceHashes=['supabase/functions/_shared/tenbot-agent.ts','supabase/functions/_shared/tenbot-openai.ts','supabase/functions/_shared/tenbot-agent-operations.ts','supabase/functions/_shared/tenbot-agent-session.ts','supabase/functions/_shared/tenbot-invoice.ts','supabase/functions/_shared/tenbot-handler.ts','scripts/support/tenbot-agent-scripted.mts','scripts/start-tenbot-agent-review.mts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
server.listen(port,'::1',()=>{
 writeFileSync(directory+'/server.json',JSON.stringify({pid:process.pid,port,origin,container:TENBOT_JOB_DATABASE,mode:useOpenAI?'openai':'offline-scripted',model:useOpenAI?model:'scripted-fixture',keyConfigured:Boolean(key),spendingAuthorized,authorizedBudgetUsd:spendingAuthorized?requested:0,existingPortsPreserved:[3000,55593,55594],databaseWrites:false,sourceHashes},null,2));
 console.log('Local TenBot agent experiment ready at '+origin+'/my-work?tenbotExperiment=1; '+(useOpenAI?'OpenAI configured; spending gate '+String(spendingAuthorized):'SCRIPTED transport only; no inference calls.'));
});
}

async function startSyntheticLive(){
 const model=(process.argv.find(arg=>arg.startsWith('--model='))?.slice(8)??'gpt-6.1-sol') as OpenAIModel;
 const requested=Number(process.argv.find(arg=>arg.startsWith('--authorized-budget-usd='))?.slice(24)??'0');
 if(!['gpt-6.1-sol','gpt-6.1-terra'].includes(model)||requested<=0||requested>5||!Number.isFinite(requested)||!(process.env.TENBOT_OPENAI_API_KEY||'').trim()||process.env.TENBOT_OPENAI_SPEND_AUTHORIZED!=='true')throw Error('Explicit local model, server credential and authorized spending gate are required.');
 // This branch imports no Docker fixture helper and constructs no database client.
 const provider=await import('./support/tenbot-live-provider.mjs');
 const {createTenbotLiveDemo}=await import('./support/tenbot-live-demo.mjs');
 const {default:sharp}=await import('sharp');
 const directory='/private/tmp/tenops-tenbot-agent-poc',origin='http://localhost:3000',port=55595;
 const fixture=JSON.parse(readFileSync('scripts/fixtures/tenbot-invoice.synthetic.json','utf8'));
 if(fixture.synthetic!==true||fixture.catalog.complete!==true||fixture.receivals.complete!==true)throw Error('Approved complete simulated catalog and receival fixtures required.');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 // Explicit synthetic admin role mirrors the local application's advertised role.
 // These are fixture grants, never a hosted permission bypass.
 const capabilities=new Set<string>([...CAPABILITIES,'proposal.access']);
 const handler=createTenbotLiveDemo({model,catalog:fixture.catalog,receivals:fixture.receivals,can:async(owner,capability)=>uuid.test(owner)&&capabilities.has(capability),createProvider:(label,attachment)=>provider.createMeasuredProvider(model,label,attachment),remainingUsd:()=>Math.max(0,Math.min(requested,5)-provider.getJournal().reservedOrSpentUsd),assertNoFatal:provider.assertNoFatal,async validateAttachment(attachment){
  try{const metadata=await sharp(attachment.bytes,{limitInputPixels:1048576}).metadata();if(!metadata.width||!metadata.height||metadata.width>1024||metadata.height>1024||metadata.pages&&metadata.pages>1||metadata.format!==(attachment.mediaType==='image/png'?'png':'jpeg'))throw Error();}catch{throw new TenbotError('Use a valid single-frame PNG or JPEG image within the displayed limits.');}
 }});
 const server=createServer(async(req,res)=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const send=(status:number,body:unknown)=>res.writeHead(status,headers).end(JSON.stringify(body));
  if(req.headers.origin!==origin)return send(403,{error:'Exact localhost review origin required.'});
  if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
  if(req.method!=='POST')return send(405,{error:'POST required.'});
  let owner='';try{const token=(req.headers.authorization||'').replace(/^Bearer /,'');const parts=token.split('.');const claims=JSON.parse(Buffer.from(parts[1]??'','base64url').toString());if(parts.length!==3||parts[2]!=='local'||!uuid.test(claims.sub))throw Error();owner=claims.sub;}catch{return send(401,{error:'Existing simulated localhost session required; no hosted authentication is claimed.'});}
  try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>145000)return send(413,{error:'Local attachment/request limit exceeded.'});}const body:unknown=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid local simulation request.');return send(200,await handler(body as Record<string,unknown>,owner));}
  catch(error){return send(error instanceof TenbotError?error.status:503,{error:error instanceof TenbotError?error.message:'Local simulation stopped safely. No hosted records or on-hand stock were changed.'});}
 });
 const sourceHashes=['scripts/start-tenbot-agent-review.mts','scripts/support/tenbot-live-demo.mts','scripts/support/tenbot-live-provider.mts','src/modules/inventory/pending-receival-contract.ts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
 const shutdown=()=>server.close(()=>{provider.closeBudget();process.exit(0);});
 process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
 mkdirSync(directory,{recursive:true});server.listen(port,'::1',()=>{writeFileSync(directory+'/server.json',JSON.stringify({pid:process.pid,port,origin,mode:'synthetic-live',model,keyConfigured:true,spendingAuthorized:true,authorizedBudgetUsd:requested,simulation:true,recordSource:'SIMULATED local memory only',databaseWrites:false,dockerRequired:false,approvalScope:'In-memory simulated catalog additions and dependent pending rows only; no on-hand changes',sourceHashes},null,2));console.log('TenBot actual OpenAI / SIMULATED local records demo at '+origin+'/my-work?tenbotExperiment=1');});
}
