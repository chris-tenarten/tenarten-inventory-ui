/** Execute the actual Edge entry point in-process with closed dependency stubs.
 * No network, real JWT/Auth, database, provider, credentials or business proof. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {TenbotError} from '../supabase/functions/_shared/tenbot-core';

const root=fileURLToPath(new URL('..',import.meta.url));
const directory=resolve(process.argv[2]??'/private/tmp/tenops-tenbot-invoice-init-fix-20261030');
const entry='supabase/functions/tenbot/index.ts',core='supabase/functions/_shared/tenbot-core.ts';
const source=readFileSync(resolve(root,entry),'utf8');
const origin='https://tendev.pages.dev',workspace='invoice-receivals.v1';
const token='synthetic-offline-token-not-a-jwt',anon='synthetic-offline-anon',service='synthetic-offline-service';
const markers=['RAW_DB_EXCEPTION_SECRET','service-role-private-marker','RAW_REQUEST_DOCUMENT_SECRET','UNKNOWN_CODE_SECRET'];
const raw=markers.join(' ')+' SELECT private_document FROM private_table';
const env:Record<string,string>={TENBOT_ALLOWED_ORIGINS:origin,SUPABASE_URL:'https://offline-auth.invalid',SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service};
type Counts={clients:number;auth:number;runtime:number;contract:number;invocations:number;rpc:number;fetch:number;provider:number;otherHosted:number;logs:number};
const counts=():Counts=>({clients:0,auth:0,runtime:0,contract:0,invocations:0,rpc:0,fetch:0,provider:0,otherHosted:0,logs:0});
const total=counts();let current=counts(),authMode:'valid'|'invalid'|'missing'='valid',failure:unknown;
const checks:string[]=[],cases:{name:string;status:number;body:unknown}[]=[];
let activeCheck='handler load';
function count(key:keyof Counts){current[key]++;total[key]++;}
function forbidden(key:keyof Counts):never{count(key);throw new Error('Unexpected offline dependency invocation.');}
const client=(url:string,key:string,options:{global:{headers?:{Authorization?:string};fetch:typeof fetch};auth:{persistSession:boolean}})=>{
 count('clients');assert.equal(url,env.SUPABASE_URL);assert([anon,service].includes(key));assert.equal(options.auth.persistSession,false);assert.equal(typeof options.global.fetch,'function');
 if(key===anon)assert.equal(options.global.headers?.Authorization,authMode==='missing'?'':`Bearer ${token}`);
 return {auth:{async getUser(value:string){count('auth');assert.equal(key,anon);assert.equal(value,authMode==='missing'?'':token);return authMode==='valid'?{data:{user:{id:'10302026-0000-4000-8000-000000000001'}},error:null}:{data:{user:null},error:{message:raw}};}},rpc(){return forbidden('rpc');}};
};
const imports:Record<string,unknown>={
 'npm:@supabase/supabase-js@2.101.1':{createClient:client},
 '../_shared/tenbot-core.ts':{TenbotError,MODEL:'OFFLINE_NO_MODEL',cloudflareProvider:()=>forbidden('provider')},
 '../_shared/tenbot-models.ts':{isAllowedModel:()=>forbidden('provider')},
 '../_shared/tenbot-job-tools.ts':{createTenbotJobTools:()=>forbidden('otherHosted')},
 '../_shared/tenbot-hosted.ts':{createHostedTenbot:()=>forbidden('otherHosted'),TENBOT_HOSTED_SERVICE_RPCS:new Set()},
 '../_shared/tenbot-receival-hosted.ts':{
  TENBOT_RECEIVAL_WORKSPACE:workspace,TENBOT_RECEIVAL_SERVICE_RPCS:new Set(),hostedReceivalPilotEnabled:()=>forbidden('otherHosted'),
  createHostedReceivalRuntime:()=>{count('runtime');return {};},
  createHostedReceivalContract:()=>{count('contract');return async(body:Record<string,unknown>)=>{count('invocations');assert.equal(body.workspace,workspace);assert.equal(body.action,'status');throw failure;};},
 },
};
let handler:((request:Request)=>Promise<Response>)|undefined;
const loaded={exports:{}};
const compiled=ts.transpileModule(source,{fileName:entry,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compiled,{
 module:loaded,exports:loaded.exports,
 require:(name:string)=>{assert(Object.hasOwn(imports,name),`Unexpected Edge import: ${name}`);return imports[name];},
 Deno:{env:{get:(key:string)=>env[key]},serve:(value:typeof handler)=>{assert.equal(handler,undefined);handler=value;}},
 Request,Response,Headers,TextDecoder,AbortSignal,
 fetch:()=>forbidden('fetch'),
 console:{log:()=>forbidden('logs'),warn:()=>forbidden('logs'),error:()=>forbidden('logs')},
},{filename:entry,timeout:1000});
assert.equal(typeof handler,'function');

function clean(value:unknown){const text=JSON.stringify(value);for(const marker of markers)assert(!text.includes(marker));assert(!text.includes('private_table'));}
async function check(name:string,run:()=>Promise<void>){activeCheck=name;await run();checks.push(name);}
async function invoke(name:string,options:{error?:unknown;auth?:typeof authMode;origin?:string;method?:string;rawBody?:string}={}){
 current=counts();authMode=options.auth??'valid';failure=options.error;
 const method=options.method??'POST',headers:Record<string,string>={origin:options.origin??origin,'content-type':'application/json'};
 if(authMode!=='missing')headers.authorization=`Bearer ${token}`;
 const request=new Request('https://offline-edge.invalid/functions/v1/tenbot',{method,headers,...(method==='POST'?{body:options.rawBody??JSON.stringify({workspace,action:'status',document:markers[2]})}:{})});
 const response=await handler!(request),text=await response.text(),body=text?JSON.parse(text):null;
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('vary'),'Origin');assert.equal(response.headers.get('access-control-allow-origin'),headers.origin===origin?origin:'null');
 clean(body);cases.push({name,status:response.status,body});return {response,body,current:{...current}};
}
function reachedContract(value:Counts){assert.deepEqual(value,{...counts(),clients:2,auth:1,runtime:1,contract:1,invocations:1});}
const safeMessages={invoice_catalog_unavailable:'Authorized material catalog choices are unavailable. Please try again.',invoice_jobs_unavailable:'Authorized Job choices are unavailable. Please try again.'};

try{
 await check('actual Edge serializes both fixed setup codes with safe 503 messages despite raw exception fields',async()=>{
  for(const [code,message] of Object.entries(safeMessages)){
   const error=Object.assign(new TenbotError(raw,503),{code,details:raw,hint:raw,query:raw,cause:new Error(raw),body:{document:raw}});
   const result=await invoke(code,{error});assert.equal(result.response.status,503);assert.deepEqual(result.body,{error:message,code});reachedContract(result.current);
  }
 });
 await check('unknown or malformed codes on controlled business errors are omitted without changing safe legacy messages',async()=>{
  for(const code of [markers[3],'invoice_read_incomplete','invoice_configuration_unavailable',{},[],null,1]){
   const error=Object.assign(new TenbotError('Existing safe business guidance.',409),{code,details:raw});
   const result=await invoke('unknown-code-'+cases.length,{error});assert.equal(result.response.status,409);assert.deepEqual(result.body,{error:'Existing safe business guidance.'});reachedContract(result.current);
  }
 });
 await check('raw Error and non-Tenbot objects cannot serialize messages, known-looking codes, SQL or document data',async()=>{
  for(const error of [Object.assign(new Error(raw),{code:'invoice_catalog_unavailable',status:403,details:raw}),{message:raw,code:'invoice_jobs_unavailable',status:401,body:{document:raw}},raw,null]){
   const result=await invoke('raw-error-'+cases.length,{error});assert.equal(result.response.status,503);assert.deepEqual(result.body,{error:'TenBot is temporarily unavailable.'});reachedContract(result.current);
  }
 });
 await check('invalid and missing authentication retain 401 and never construct the service or receival contract',async()=>{
  for(const auth of ['invalid','missing'] as const){const result=await invoke(auth,{auth,error:new Error(raw)});assert.equal(result.response.status,401);assert.deepEqual(result.body,{error:'Sign in required.'});assert.deepEqual(result.current,{...counts(),clients:1,auth:1});}
 });
 await check('disallowed origin retains 403 before authentication or body processing',async()=>{
  const result=await invoke('disallowed-origin',{origin:'https://not-allowed.invalid',rawBody:raw,error:new Error(raw)});assert.equal(result.response.status,403);assert.deepEqual(result.body,{error:'Origin not allowed.'});assert.deepEqual(result.current,counts());
 });
 await check('authenticated controlled permission denial retains 403 without adding an arbitrary code',async()=>{
  const result=await invoke('permission-denial',{error:Object.assign(new TenbotError('You cannot use this workspace.',403),{code:markers[3],details:raw})});assert.equal(result.response.status,403);assert.deepEqual(result.body,{error:'You cannot use this workspace.'});reachedContract(result.current);
 });
 await check('malformed JSON remains a generic 503 without echoing the request',async()=>{
  const result=await invoke('malformed-json',{rawBody:'{"document":"'+raw+'"'});assert.equal(result.response.status,503);assert.deepEqual(result.body,{error:'TenBot is temporarily unavailable.'});assert.deepEqual(result.current,{...counts(),clients:1,auth:1});
 });
 await check('OPTIONS and unsupported methods preserve pre-auth transport behavior',async()=>{
  const options=await invoke('options',{method:'OPTIONS'});assert.equal(options.response.status,204);assert.equal(options.body,null);assert.deepEqual(options.current,counts());
  const get=await invoke('get',{method:'GET'});assert.equal(get.response.status,405);assert.deepEqual(get.body,{error:'POST required.'});assert.deepEqual(get.current,counts());
 });
 assert.equal(total.fetch,0);assert.equal(total.rpc,0);assert.equal(total.provider,0);assert.equal(total.otherHosted,0);assert.equal(total.logs,0);
 const receipt={passed:true,recordedAt:new Date().toISOString(),groups:checks.length,checks,cases,
  method:'Actual index.ts transpiled unchanged to a closed Node VM; captured Deno.serve handler invoked with synthetic Request/Response; real TenbotError class, stub SDK/Auth and receival contract.',
  sources:[entry,core].map(path=>({path,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')})),
  verifierSha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  counts:total,networkCalls:0,externalRequestsForwarded:0,inferenceCalls:0,operationalWrites:0,actualAuth:false,actualDatabase:false,hostedHTTP:false,
  limits:['Proves actual entry-point serialization only; authentication and contract behavior are synthetic stubs.','Does not prove deployed Edge behavior, genuine JWT authorization, RLS, business lifecycle or hosted error provenance.','Other controlled TenbotError messages intentionally preserve existing compatibility.']};
 mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'http-boundary.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({passed:true,groups:checks.length,cases:cases.length,receipt:resolve(directory,'http-boundary.json'),networkCalls:0,inferenceCalls:0,operationalWrites:0}));
}catch(error){
 mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'http-boundary-failure.json'),JSON.stringify({passed:false,recordedAt:new Date().toISOString(),check:activeCheck,groupsPassed:checks.length,errorKind:error instanceof Error?error.name:'unknown',networkCalls:total.fetch,operationalWrites:0},null,2)+'\n',{mode:0o600});
 console.error(JSON.stringify({passed:false,check:activeCheck,errorKind:error instanceof Error?error.name:'unknown'}));process.exitCode=1;
}
