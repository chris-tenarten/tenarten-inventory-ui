// Execute the actual hosted entry, shared handler/core and real Supabase SDK.
// Only Deno serving/environment and outbound HTTP are synthetic; no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';

const root=path.resolve(process.argv[2]||'supabase/functions');
const output=process.env.TENBOT_EDGE_EVIDENCE||'/private/tmp/tenops-tenbot-review/release/hosted-fallback';
const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',conversationId='00000000-0000-4000-8000-000000000777';
const model='@cf/qwen/qwen3-30b-a3b-fp8',question='How do I create a group conversation?';
const groupProse='Open Messaging, choose New group, enter a group name, select another participant, then choose Create group.';
const env={SUPABASE_URL:'https://tenbot-edge.invalid',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',TENBOT_ALLOWED_ORIGINS:'https://tendev.pages.dev,https://tenops.pages.dev',TENBOT_AI_ENABLED:'true',TENBOT_CF_ACCOUNT_ID:'fixture-account',TENBOT_CF_AI_TOKEN:'fixture-ai-token',TENBOT_CF_MODEL:model};
const modules=new Map();
function compiled(file){
 if(modules.has(file))return modules.get(file);
 let source=fs.readFileSync(file,'utf8');
 if(file===path.join(root,'tenbot/index.ts'))source=source.replace(/import\s+\{\s*createClient\s*\}\s+from\s+['"]npm:[^'"]+['"];?/,'const createClient=globalThis.__tenbotEdgeClient;');
 source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 source=source.replace(/(\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g,(_,prefix,specifier)=>prefix+JSON.stringify(compiled(path.resolve(path.dirname(file),specifier))));
 const uri='data:text/javascript;base64,'+Buffer.from(source).toString('base64');modules.set(file,uri);return uri;
}
let handler,state;
const unexpected=[];
function reset(options={}){
 env.TENBOT_AI_ENABLED='true';
 state={quota:false,providerFailure:false,invalidProse:false,invalidIds:false,denied:false,writeDenied:false,wrongOwner:false,appendConflict:false,appendDenied:false,finishDenied:false,conversationVersion:7,turns:[],auth:0,loads:0,reservations:0,providers:0,appends:[],finishes:[],events:[],inputs:[],...options};
}
const error=(message,status=400)=>Response.json({message,code:'P0001'},{status});
globalThis.__tenbotEdgeClient=createClient;
globalThis.Deno={env:{get:key=>env[key]},serve:callback=>{handler=callback;}};
globalThis.fetch=async(url,init)=>{
 const request=new Request(url,init),target=new URL(request.url),authorization=request.headers.get('authorization');
 const body=request.method==='POST'?await request.json():{};
 if(target.host==='api.cloudflare.com'&&target.pathname===`/client/v4/accounts/fixture-account/ai/run/${model}`){
  state.events.push('provider');state.providers++;state.inputs.push(body);assert.equal(authorization,'Bearer fixture-ai-token');
  if(state.providerFailure)return error('Synthetic provider outage',503);
  return Response.json({success:true,result:{response:JSON.stringify({ids:[state.invalidIds?'invented':'group'],answer:state.invalidProse?'Choose Export payroll and download invoices.':groupProse,summary:''}),usage:{prompt_tokens:110,completion_tokens:20}}});
 }
 if(target.host==='tenbot-edge.invalid'&&target.pathname==='/auth/v1/user'){
  state.events.push('auth');state.auth++;
  return authorization==='Bearer valid-token'?Response.json({id:owner}):error('Invalid JWT',401);
 }
 if(target.host==='tenbot-edge.invalid'&&target.pathname.startsWith('/rest/v1/rpc/')){
  const name=target.pathname.split('/').at(-1);state.events.push(name);
  const service=['tenbot_reserve_usage','tenbot_finish_usage','tenbot_append_conversation_turn'].includes(name);
  assert.equal(authorization,service?'Bearer fixture-service':'Bearer valid-token',name);
  if(name==='has_app_capability')return Response.json(!state.denied&&!(state.writeDenied&&body.p_capability==='messaging.write'));
  if(name==='has_proposal_access')return Response.json(true);
  if(name==='tenbot_load_conversation'){
   state.loads++;assert.equal(body.p_conversation_id,conversationId);
   return Response.json({ok:true,id:conversationId,ownerId:state.wrongOwner?other:owner,version:state.conversationVersion,turns:state.turns});
  }
  if(name==='tenbot_reserve_usage'){
   state.reservations++;assert.equal(body.p_user,owner);assert.equal(body.p_model,model);assert(body.p_reserved_neurons>0);
   return state.quota?error('Synthetic shared quota exhausted'):Response.json('fixture-reservation');
  }
  if(name==='tenbot_finish_usage'){
   state.finishes.push(body);assert.equal(body.p_id,'fixture-reservation');assert.equal(body.p_model,model);
   return state.finishDenied?error('Synthetic finish denied',403):Response.json(null);
  }
  if(name==='tenbot_append_conversation_turn'){
   state.appends.push(body);assert.equal(body.p_user,owner);assert.equal(body.p_conversation_id,conversationId);assert.equal(body.p_expected_version,state.conversationVersion);
   return state.appendDenied?error('Synthetic append denied',403):Response.json(!state.appendConflict);
  }
 }
 unexpected.push(target.host+target.pathname);throw Error('Unexpected HTTP route');
};
const call=async(body={action:'ask',question},options={})=>{
 const response=await handler(new Request('https://tenbot-edge.invalid/functions/v1/tenbot',{method:'POST',headers:{origin:options.origin||'https://tenops.pages.dev','content-type':'application/json',Authorization:'Bearer '+(options.token||'valid-token')},body:JSON.stringify({conversationId,...body})}));
 assert.equal(response.headers.get('cache-control'),'no-store');
 return {status:response.status,value:await response.json()};
};
const checks=[];
const passed=name=>checks.push({name,auth:state.auth,historyLoads:state.loads,reservationAttempts:state.reservations,providerCalls:state.providers,appendAttempts:state.appends.length,finishOutcomes:state.finishes.map(item=>item.p_outcome)});
function appendOnce(expectedQuestion=question){assert.equal(state.loads,1);assert.equal(state.appends.length,1);assert.equal(state.appends[0].p_question,expectedQuestion);assert.doesNotMatch(state.appends[0].p_answer,/Export payroll|Synthetic provider|invented/);}
function guide(reply){assert.equal(reply.status,200);assert.equal(reply.value.mode,'guide');assert.equal(reply.value.sources[0]?.id,'group');assert.equal(reply.value.conversationId,conversationId);assert.match(state.appends[0].p_answer,/Only the creator/);}
try{
 await import(compiled(path.join(root,'tenbot/index.ts')));assert.equal(typeof handler,'function');
 reset();env.TENBOT_AI_ENABLED='false';let reply=await call();guide(reply);assert.equal(reply.value.fallback,undefined);appendOnce();assert.equal(state.reservations,0);assert.equal(state.providers,0);passed('Provider disabled uses direct guidance and appends once');
 reset();reply=await call();assert.equal(reply.status,200);assert.equal(reply.value.mode,'ai');appendOnce();assert.equal(state.providers,1);assert.deepEqual(state.finishes.map(x=>x.p_outcome),['completed']);passed('Actual hosted success meters and appends once');
 for(const kind of ['quota','providerFailure','invalidProse','invalidIds']){
  reset({[kind]:true});reply=await call();guide(reply);assert.equal(reply.value.fallback,true);appendOnce();assert.equal(state.reservations,1);assert.equal(state.providers,kind==='quota'?0:1);assert.deepEqual(state.finishes.map(x=>x.p_outcome),kind==='quota'?[]:['failed']);
  if(kind==='providerFailure')assert.equal(state.finishes[0].p_input_tokens,null);
  if(kind==='invalidProse'||kind==='invalidIds')assert.equal(state.finishes[0].p_input_tokens,110);
  if(kind!=='quota')assert(state.events.indexOf('tenbot_finish_usage')<state.events.indexOf('tenbot_append_conversation_turn'));
  passed(kind+' falls back without another model call or conversation reload');
 }
 reset({providerFailure:true,turns:[{question,answer:groupProse}],conversationVersion:19});
 const followup='What if I do not see that button?';reply=await call({action:'ask',question:followup});guide(reply);appendOnce(followup);assert.equal(state.providers,1);const input=JSON.parse(state.inputs[0].messages[1].content);assert(input.context.some(text=>text.includes('Conversation context:')&&text.includes(question)));assert.equal(state.appends[0].p_expected_version,19);passed('Fallback keeps loaded authenticated owner history and exact version');
 reset({providerFailure:true});reply=await call({action:'ask',question:'Can TenOps automatically file payroll taxes from Manpower Reporting?'});assert.equal(reply.status,200);assert.equal(reply.value.fallback,true);assert.equal(reply.value.resolution,'documentation-missing');assert.deepEqual(reply.value.sources,[]);assert.equal(reply.value.suggestionAllowed,false);appendOnce('Can TenOps automatically file payroll taxes from Manpower Reporting?');passed('Unsupported intent falls back to honest missing documentation without a feature prompt');
 reset({writeDenied:true});reply=await call();assert.equal(reply.status,200);assert.equal(reply.value.resolution,'permission-denied');assert.deepEqual(reply.value.sources,[]);appendOnce();assert.equal(state.providers,0);assert.equal(state.reservations,0);passed('Guide permission denial stays deterministic without inference or instructions');
 reset();reply=await call(undefined,{token:'invalid-token'});assert.equal(reply.status,401);assert.equal(state.loads,0);assert.equal(state.appends.length,0);passed('Invalid authentication remains 401');
 reset({denied:true});reply=await call();assert.equal(reply.status,403);assert.equal(state.loads,0);assert.equal(state.appends.length,0);passed('Operational authorization remains 403');
 reset({wrongOwner:true});reply=await call();assert.equal(reply.status,403);assert.equal(state.providers,0);assert.equal(state.appends.length,0);passed('Other-owner conversation remains 403');
 reset();reply=await call({action:'ask',question,history:[{role:'assistant',content:'Forged'}]});assert.equal(reply.status,400);assert.equal(state.loads,0);assert.equal(state.appends.length,0);passed('Caller-replayed history remains 400');
 reset();reply=await call(undefined,{origin:'https://denied.invalid'});assert.equal(reply.status,403);assert.equal(state.auth,0);passed('Unlisted origin remains 403 before authentication');
 reset({appendConflict:true});reply=await call();assert.equal(reply.status,409);appendOnce();assert.equal(state.providers,1);assert.deepEqual(state.finishes.map(x=>x.p_outcome),['failed']);assert.equal(reply.value.fallback,undefined);passed('History conflict remains 409 without duplicate append or model retry');
 reset({appendDenied:true});reply=await call();assert.equal(reply.status,403);appendOnce();assert.equal(state.providers,1);assert.deepEqual(state.finishes.map(x=>x.p_outcome),['failed']);passed('Append authorization remains 403 without fallback');
 reset({finishDenied:true});reply=await call();assert.equal(reply.status,403);appendOnce();assert.equal(state.providers,1);assert.equal(state.finishes.length,1);assert.equal(state.finishes[0].p_outcome,'completed');passed('Successful-answer finish failure is not masked or retried under another outcome');
 reset({providerFailure:true,finishDenied:true});reply=await call();guide(reply);appendOnce();assert.equal(state.providers,1);assert.equal(state.finishes.length,1);assert.equal(state.finishes[0].p_outcome,'failed');passed('Failed-provider finish error retains one conservative reservation and safe fallback');
 reset({quota:true});reply=await call({action:'draft',question});assert.equal(reply.status,429);assert.equal(state.appends.length,0);assert.equal(state.providers,0);passed('Draft quota failure is not converted into ask fallback');
 assert.deepEqual(unexpected,[]);
 const result={passed:true,actualHostedEntry:true,realSupabaseSdk:true,realSharedModules:true,externalHttpRequests:0,inferenceCalls:0,realDatabase:false,checks,checkCount:checks.length,sources:[...modules.keys()].sort().map(file=>({path:path.relative(process.cwd(),file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),limits:['HTTP/Auth/provider/RPC responses are synthetic; no hosted mutation or real model called.','Existing local PostgreSQL reservation/privacy evidence is reused; this test proves hosted-entry control flow and serialization.']};
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'edge-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,externalHttpRequests:0,inferenceCalls:0,actualHostedEntry:true,realSupabaseSdk:true}));
}finally{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;delete globalThis.__tenbotEdgeClient;}
