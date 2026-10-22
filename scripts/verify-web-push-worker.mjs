import assert from 'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';
import{endpointAllowed,clean,payloadFor,providerOutcome,retryDelay,verifyWake,wakeText,createHandler}from'../supabase/functions/send-web-push/core.mjs';
import{createClient}from'@supabase/supabase-js';
import{createDiagnosticRpc}from'../supabase/functions/send-web-push/diagnostics.mjs';
const checks=[];const run=async(name,work)=>{await work();checks.push(name);console.log('PASS '+name);};
const secret='synthetic-wake-key-'.repeat(3),environment='prod',id='00000000-0000-4000-8000-000000000010';
const data={v:1,environment,run_id:id,exp:Math.floor(Date.now()/1000)+60};
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
data.sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(wakeText(data)))).toString('hex');
const row={id,notification_id:id,environment,endpoint:'https://web.push.apple.com/synthetic',keys:{},previews:true,source:{kind:'dm',sender:'Alex Operator',text:'Can you check the revised color plate before tomorrow?'},expires_at:new Date(Date.now()+3600000).toISOString(),attempts:1};
await run('informative and generic payloads, HTML/control/markup stripping',()=>{
 assert.equal(clean('<b>Please</b>\n**verify** [readiness](https://example.invalid)\u202e'),'Please verify readiness');
 assert.equal(Array.from(clean('💠'.repeat(200))).length,140);
 assert.equal(payloadFor({...row,source:{...row.source,kind:'group',group_name:'Shop team'}}).title,'Shop team · Alex Operator');
 assert.equal(payloadFor({...row,previews:false,source:{...row.source,kind:'group',group_name:'Private group'}}).title,'New TenOps message');
 assert.equal(payloadFor(row).title,'Alex Operator · Direct Message');assert(!payloadFor({...row,previews:false}).body.includes('plate'));
 assert.equal(payloadFor({...row,source:{kind:'mention',sender:'Blair Lead',job:'26-1042',text:'Please verify material readiness.'}}).title,'Mentioned by Blair Lead · 26-1042');
 assert.equal(payloadFor({...row,source:{...row.source,attachment_only:true}}).body,'Sent an attachment');
 assert(!payloadFor(row).url.includes('plate'));
});
await run('SSRF/redirect destination registry and retry policy',()=>{
 for(const url of ['http://web.push.apple.com/x','https://web.push.apple.com.evil.test/x','https://127.0.0.1/x','https://user@web.push.apple.com/x','https://web.push.apple.com/x#secret','https://web.push.apple.com:444/x'])assert.equal(endpointAllowed(url),false,url);
 assert(endpointAllowed(row.endpoint));assert.equal(providerOutcome(201),'accepted');for(const s of[404,410])assert.equal(providerOutcome(s),'invalid_subscription');for(const s of[0,429,500,503])assert.equal(providerOutcome(s),'retryable');assert.equal(providerOutcome(302),'provider_rejected');assert.equal(providerOutcome(403),'provider_auth');assert.equal(retryDelay(6,'999999'),900);
});
await run('signed wake tamper, environment, expiry and malformed body rejected',async()=>{
 assert(await verifyWake(data,secret,environment));for(const bad of[{...data,exp:1},{...data,environment:'dev'},{...data,sig:'0'.repeat(64)},{...data,exp:data.exp+1000}])assert.equal(await verifyWake(bad,secret,environment),false);
});
const req=()=>new Request('http://localhost/worker',{method:'POST',body:JSON.stringify(data)});
await run('disabled worker never touches database or endpoint',async()=>{const handler=createHandler({enabled:false,rpc:()=>{throw Error('unexpected');}});assert.equal((await handler(req())).status,503);});
for(const status of [201,404,410,429,500,403,302])await run('provider status '+status+' maps to sanitized durable outcome',async()=>{
 let finished,submitted=0;const handler=createHandler({enabled:true,environment,secret,
 rpc:async(name,args)=>name==='consume_web_push_run'?true:name==='claim_web_push_deliveries'?[{id,lease_token:id}]:name==='prepare_web_push_delivery'?row:name==='finish_web_push_delivery'?(finished=args):null,
 encrypt:async()=>({body:new Uint8Array([1]),headers:{}}),submit:async()=>{submitted++;return new Response(null,{status,headers:{'retry-after':'45'}});},
 });assert.equal((await handler(req())).status,200);assert.equal(submitted,1);assert.equal(finished.p_outcome,providerOutcome(status));assert(finished.p_delay<=900);
});
await run('device disable during encryption skips submission',async()=>{
 let prepares=0,submits=0;const h=createHandler({enabled:true,environment,secret,rpc:async n=>n==='consume_web_push_run'?true:n==='claim_web_push_deliveries'?[{id,lease_token:id}]:n==='prepare_web_push_delivery'?(++prepares===1?row:null):null,encrypt:async()=>({}),submit:async()=>{submits++;}});
 assert.equal((await h(req())).status,200);assert.equal(submits,0);
});
await run('replayed wake never claims another delivery',async()=>{
 let claims=0;const h=createHandler({enabled:true,environment,secret,rpc:async n=>{if(n==='consume_web_push_run')return false;if(n==='claim_web_push_deliveries')claims++;}});assert.equal((await h(req())).status,409);assert.equal(claims,0);
});
await run('invalid endpoint and unavailable source never reach submit',async()=>{
 for(const source of[null,{...row,endpoint:'https://127.0.0.1/x'}]){let submits=0;const h=createHandler({enabled:true,environment,secret,rpc:async n=>n==='consume_web_push_run'?true:n==='claim_web_push_deliveries'?[{id,lease_token:id}]:n==='prepare_web_push_delivery'?source:null,encrypt:()=>{throw Error('unexpected');},submit:()=>submits++});assert.equal((await h(req())).status,200);assert.equal(submits,0);}
});
const canary='PRIVATE_PAYLOAD_DO_NOT_LOG';
const makeRpc=(options={})=>createDiagnosticRpc({environment:'tenops',
 connect:transportFetch=>createClient('https://database.invalid','synthetic-service-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transportFetch}}),...options});
const context={run_id:id,delivery_id:id,stage:'recheck',private:canary};
await run('RPC diagnostics: successes silent; HTTP/SQL failures redacted with correlation and elapsed time',async()=>{
 const records=[];let time=0;
 const rpc=makeRpc({clock:()=>time,emit:r=>records.push(r),transport:async(_input,init)=>{
  assert.equal(init.redirect,'error');assert(init.signal instanceof AbortSignal);time=4123;
  return Response.json({code:'42501',message:canary,details:canary,hint:canary},{status:403});
 }});
 await assert.rejects(rpc('prepare_web_push_delivery',{p_lease:canary,endpoint:canary},context),/Transport database unavailable/);
 assert.deepEqual(records,[{event:'web_push_rpc_failed',environment:'tenops',rpc:'prepare_web_push_delivery',stage:'recheck',run_id:id,delivery_id:id,deployment_id:null,execution_id:null,elapsed_ms:4123,http_status:403,abort_reason:'none',error_kind:null,sql_code:'42501'}]);
 assert(!JSON.stringify(records).includes(canary));
 const good=makeRpc({emit:()=>assert.fail('success logged'),transport:async()=>Response.json(true)});
 const originalTimeout=AbortSignal.timeout;let milliseconds;
 try{AbortSignal.timeout=value=>{milliseconds=value;return originalTimeout(value);};assert.equal(await good('consume_web_push_run',{},context),true);assert.equal(milliseconds,4000);}finally{AbortSignal.timeout=originalTimeout;}
});
await run('RPC diagnostics: timeout, abort, network and response-body timeout classification',async()=>{
 for(const reason of [new DOMException(canary,'TimeoutError'),new DOMException(canary,'AbortError'),null]){
  const controller=new AbortController(),records=[];
  const rpc=makeRpc({timeout:()=>controller.signal,emit:r=>records.push(r),transport:async()=>{if(reason)controller.abort(reason);throw reason||new TypeError(canary);}});
  await assert.rejects(rpc('claim_web_push_deliveries',{},context));
  assert.equal(records[0].abort_reason,reason?.name==='TimeoutError'?'timeout':reason?'aborted':'none');
  assert.equal(records[0].http_status,null);assert.equal(records[0].error_kind,reason?.name||'TypeError');assert(!JSON.stringify(records).includes(canary));
 }
 const controller=new AbortController(),records=[];
 const rpc=makeRpc({timeout:()=>controller.signal,emit:r=>records.push(r),transport:async()=>({status:200,ok:true,headers:new Headers(),text:async()=>{controller.abort(new DOMException(canary,'TimeoutError'));throw controller.signal.reason;}})});
 await assert.rejects(rpc('claim_web_push_deliveries',{},context));assert.equal(records[0].abort_reason,'timeout');assert.equal(records[0].http_status,200);
});
await run('RPC diagnostics: concurrent invocations isolated; logging failure cannot affect recovery',async()=>{
 const records=[];const other='00000000-0000-4000-8000-000000000011';
 const calls=[id,other].map((run_id,index)=>makeRpc({emit:r=>records.push(r),transport:async()=>{await new Promise(resolve=>setTimeout(resolve,index?1:10));return Response.json({code:'PGRST202',message:canary},{status:404});}})('consume_web_push_run',{}, {run_id}));
 await Promise.all(calls.map(call=>assert.rejects(call)));assert.deepEqual(records.map(r=>r.run_id),[other,id]);
 const broken=makeRpc({emit:()=>{throw Error(canary);},transport:async()=>Response.json({code:canary},{status:500})});
 await assert.rejects(broken('consume_web_push_run'),{message:'Transport database unavailable'});
 const invalid=[];await assert.rejects(makeRpc({emit:r=>invalid.push(r),transport:async()=>Response.json({code:canary},{status:500})})('private-stage',{}, {run_id:canary,delivery_id:canary,stage:canary}));
 assert.equal(invalid[0].stage,null);assert.equal(invalid[0].run_id,null);assert.equal(invalid[0].delivery_id,null);assert.equal(invalid[0].sql_code,null);
});
await run('all RPC failure stages retain worker response and retry behavior',async()=>{
 for(const stage of ['consume_web_push_run','claim_web_push_deliveries','prepare','recheck','finish_web_push_delivery','prune_web_push_transport']){
  let prepares=0,finished,submits=0;
  const h=createHandler({enabled:true,environment,secret,rpc:async(name,args,trace)=>{
   assert.equal(trace.run_id,id);const actual=trace.stage||name;
   if(name==='prepare_web_push_delivery'){prepares++;assert.equal(trace.delivery_id,id);assert.equal(trace.stage,prepares===1?'prepare':'recheck');}
   if(actual===stage)throw Error('Transport database unavailable');
   if(name==='consume_web_push_run')return true;if(name==='claim_web_push_deliveries')return [{id,lease_token:id}];
   if(name==='prepare_web_push_delivery')return row;if(name==='finish_web_push_delivery')finished=args;
  },encrypt:async()=>({}),submit:async()=>{submits++;return new Response(null,{status:201});}});
  const response=await h(req());
  assert.equal(response.status,['prepare','recheck'].includes(stage)?200:503);
  if(['prepare','recheck'].includes(stage)){assert.equal(finished.p_outcome,'retryable');assert.equal(finished.p_delay,30);assert.equal(submits,0);}
  else assert.deepEqual(await response.json(),{status:'worker_failed'});
 }
});
const evidenceDir=process.env.WEB_PUSH_EVIDENCE_DIR||'docs/project-memory/evidence/web-push-stage-b';
mkdirSync(evidenceDir,{recursive:true});writeFileSync(evidenceDir+'/worker.json',JSON.stringify({checks,realPushRequests:0,payloadExamples:[payloadFor(row),payloadFor({...row,source:{kind:'mention',sender:'Blair Lead',job:'26-1042',text:'Please verify material readiness.'}}),payloadFor({...row,previews:false})]},null,2));
