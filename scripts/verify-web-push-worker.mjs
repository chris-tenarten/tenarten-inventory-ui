import assert from 'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';
import{endpointAllowed,clean,payloadFor,providerOutcome,retryDelay,verifyWake,wakeText,createHandler}from'../supabase/functions/send-web-push/core.mjs';
const checks=[];const run=async(name,work)=>{await work();checks.push(name);console.log('PASS '+name);};
const secret='synthetic-wake-key-'.repeat(3),environment='prod',id='00000000-0000-4000-8000-000000000010';
const data={v:1,environment,run_id:id,exp:Math.floor(Date.now()/1000)+60};
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
data.sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(wakeText(data)))).toString('hex');
const row={id,notification_id:id,environment,endpoint:'https://web.push.apple.com/synthetic',keys:{},previews:true,source:{kind:'dm',sender:'Alex Operator',text:'Can you check the revised color plate before tomorrow?'},expires_at:new Date(Date.now()+3600000).toISOString(),attempts:1};
await run('informative and generic payloads, HTML/control/markup stripping',()=>{
 assert.equal(clean('<b>Please</b>\n**verify** [readiness](https://example.invalid)\u202e'),'Please verify readiness');
 assert.equal(Array.from(clean('💠'.repeat(200))).length,140);
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
mkdirSync('docs/project-memory/evidence/web-push-stage-b',{recursive:true});writeFileSync('docs/project-memory/evidence/web-push-stage-b/worker.json',JSON.stringify({checks,realPushRequests:0,payloadExamples:[payloadFor(row),payloadFor({...row,source:{kind:'mention',sender:'Blair Lead',job:'26-1042',text:'Please verify material readiness.'}}),payloadFor({...row,previews:false})]},null,2));
