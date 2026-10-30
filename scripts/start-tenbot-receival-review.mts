// LOCAL ONLY. Exact standalone synthetic Supabase fixture, caller-scoped writes.
// No Production client, service-role business client or original-ledger unfreeze.
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,lstatSync,readdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createAuthenticatedReceivalAgent} from './support/tenbot-receival-agent.mjs';
import {createReceivalLiveProviders} from './support/tenbot-receival-provider.mjs';
import {TenbotError} from '../supabase/functions/_shared/tenbot-core';

const origin='http://localhost:3000',port=55596,fixtureRef='jltgxcfiprocydhbrahz';
const directory='/private/tmp/tenops-tenbot-receival-execution-20261030';
const configPath='/private/tmp/tenops-tenbot-hosted-adapter-20261029/free-project-credentials.private.json';
const model='gpt-6.1-terra';
if(process.argv.slice(2).some(arg=>!['--enable-isolated-execution','--live-inference','--check-config'].includes(arg)&&!arg.startsWith('--database-validation=')))throw Error('Use only the reviewed isolated execution, validation-receipt and live-inference flags.');
function owned(file:string){const info=lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.uid!==process.getuid?.()||(info.mode&0o077)!==0)throw Error('Existing owner-only isolated configuration required.');return readFileSync(file,'utf8');}
// Select only public URL/key. Never construct a client with setup-only Auth or
// service-role credentials from this existing private configuration file.
const config=JSON.parse(owned(configPath));
const url=config.url,key=config.anonKey;
if(config.projectRef!==fixtureRef||url!==`https://${fixtureRef}.supabase.co`||typeof key!=='string')throw Error('Only the existing reviewed standalone Free fixture is allowed.');
try{const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());if(claims.role!=='anon'||claims.ref!==fixtureRef)throw Error();}catch{throw Error('Only the existing fixture public anonymous key is allowed.');}

const enabled=process.argv.includes('--enable-isolated-execution'),live=process.argv.includes('--live-inference');
const receiptPath=process.argv.find(a=>a.startsWith('--database-validation='))?.slice('--database-validation='.length)??directory+'/database-validation.json';
const sha256=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
let validatedMigrations:{path:string;sha256:string}[]=[];
if(enabled){
 const r=JSON.parse(readFileSync(receiptPath,'utf8'));
 if(r.passed!==true||r.fixtureRef!==fixtureRef||!Number.isSafeInteger(r.groupsPassed)||r.groupsPassed<1||r.productionMutations!==0||!Array.isArray(r.migrations))throw Error('Passed real isolated database validation receipt required.');
 // Include every same-day catalog/receival correction, not just the first two
 // files. A later unvalidated security fix must keep this host gate closed.
 const required=['20261029210000_invoice_pending_receival_approval.sql',...readdirSync('supabase/migrations').filter(name=>/^20261030\d{6}_(?=.*(?:catalog|receival))[a-z0-9_]+\.sql$/.test(name))];
 for(const expected of ['20261030110000_catalog_write_authorization.sql','20261030120000_invoice_dependent_pending_receivals.sql'])if(!required.includes(expected))throw Error('Required isolated migration source unavailable.');
 validatedMigrations=required.map(name=>{const path='supabase/migrations/'+name,expected=sha256(readFileSync(path)),evidence=r.migrations.find((entry:unknown)=>entry&&typeof entry==='object'&&'path' in entry&&entry.path===path);if(!evidence||evidence.sha256!==expected)throw Error('Database validation does not match every current receival migration.');return {path,sha256:expected};});
}
const provider=createReceivalLiveProviders({authorized:live,directory});
const handler=createAuthenticatedReceivalAgent({model,createProvider:provider.createProvider,remainingUsd:provider.remainingUsd,assertNoFatal:provider.assertNoFatal,execution:{enabled,databaseEnvironment:'isolated-test'}});
if(process.argv.includes('--check-config')){
 console.log(JSON.stringify({passed:true,fixtureRef,origin,port,model,executionEnabled:enabled,databaseBackedTestsPassed:enabled,liveInferenceAuthorized:live,additionalInferenceMaximumUsd:.1,originalLedgerFrozen:true,hostedAllowanceChanged:false,productionRequests:0,validatedMigrations}));process.exit(0);
}

const server=createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(status:number,value:unknown)=>{if(!res.destroyed&&!res.writableEnded)res.writeHead(status,headers).end(JSON.stringify(value));};
 if(req.headers.origin!==origin)return send(403,{error:'Exact localhost review origin required.'});
 if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
 if(req.method!=='POST')return send(405,{error:'POST required.'});
 const authorization=req.headers.authorization??'',token=authorization.replace(/^Bearer\s+/i,'');
 if(!authorization.startsWith('Bearer ')||token.length>8000||token.split('.').length!==3||token.endsWith('.local')||token.endsWith('.local-only'))return send(401,{error:'A real authenticated isolated TenOps session is required.'});
 const started=Date.now();
 try{
  const caller=createClient(url,key,{global:{headers:{Authorization:authorization},fetch:async(input,init)=>{
   const destination=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(!destination.startsWith(url+'/'))throw Error('Only the fixed isolated database endpoint is allowed.');
   return fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(4000),...(init?.signal?[init.signal]:[])])});
  }},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const authenticated=await caller.auth.getUser(token);
  if(authenticated.error||!authenticated.data.user)return send(401,{error:'Isolated TenOps authentication is unavailable or rejected.'});
  let bytes=0,raw='';for await(const chunk of req){bytes+=chunk.length;if(bytes>145000)return send(413,{error:'Invoice request is too large.'});if(Date.now()-started>100000)return send(408,{error:'Local request deadline reached. Reopen the exact draft before retrying.'});raw+=chunk;}
  const body:unknown=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new TenbotError('Invalid invoice request.');
  const deadline=setTimeout(()=>send(504,{error:'The isolated operation did not finish within 100 seconds. Retry the same immutable approval to reconcile; do not create a new request.'}),Math.max(1,100000-(Date.now()-started)));
  try{return send(200,await handler(body as Record<string,unknown>,authenticated.data.user.id,caller));}finally{clearTimeout(deadline);}
 }catch(error){return send(error instanceof TenbotError?error.status:503,{error:error instanceof TenbotError?error.message:'Authenticated isolated operation is unavailable. No simulation or scripted model fallback was substituted. Retry the exact approved draft if the outcome is uncertain.'});}
});
server.requestTimeout=100000;server.headersTimeout=10000;
const shutdown=()=>server.close(()=>{provider.close();process.exit(0);});process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
server.once('error',()=>{provider.close();console.error('The local receival adapter could not bind its reserved port.');process.exitCode=1;});
mkdirSync(directory,{recursive:true});server.listen(port,'::1',()=>{
 writeFileSync(directory+'/server.json',JSON.stringify({pid:process.pid,port,origin,mode:'authenticated-receivals',model,target:fixtureRef,callerAuth:'getUser on every request; caller JWT/anon key only; no privileged business client',executionEnabled:enabled,databaseBackedTestsPassed:enabled,databaseValidationReceipt:enabled?receiptPath:null,validatedMigrations,liveInferenceAuthorized:live,additionalInferenceMaximumUsd:.1,originalLedgerFrozen:true,hostedAllowanceChanged:false,productionRequests:0,budgetJournal:directory+'/inference-budget.json'},null,2)+'\n');
 console.log('Authenticated isolated TenBot candidate at '+origin+'/my-work?tenbotExperiment=1&tenbotReceivals=1; execution '+(enabled?'enabled only for reviewed synthetic fixture':'disabled pending matching database validation')+'.');
});
