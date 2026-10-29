// Actual hosted constructor/provider transport with synthetic RPC and API responses.
// No actual inference, authentication, RLS or database validation is claimed.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHostedTenbotFixture} from './support/tenbot-hosted-fixture.mjs';
const checks:string[]=[];
async function check(name:string,fn:()=>Promise<void>){await fn();checks.push(name);}
await check('Origin rollout keeps TenOps on Qwen while TenDev has the read-only agent',async()=>{
 const f=createHostedTenbotFixture();assert.deepEqual(await f.handler()({action:'status'}),{mode:'assistant',historyAvailable:true,readOnly:true});
 assert.deepEqual(await f.handler('https://tenops.pages.dev')({action:'status'}),{mode:'qwen',historyAvailable:false,readOnly:true});assert.equal(f.state.providerCalls,0);
});
await check('Terra transport reserves before every call, settles actual usage and restores across new instances without inference',async()=>{
 const f=createHostedTenbotFixture(),r=await f.handler()({action:'ask',question:f.archived.question}) as {conversationId:string;mode:string;message:string;agent?:unknown;contentScope:string};
 assert.equal(r.mode,'assistant');assert.equal(r.contentScope,'scope');assert.equal(r.message,f.archived.expectedMessage);assert.equal(r.agent,undefined);assert.equal(f.state.providerCalls,3);assert.equal(f.reservations.size,3);assert([...f.reservations.values()].every(x=>x.actual===200));
 const before=f.state.providerCalls,h=await f.handler()({action:'history',conversationId:r.conversationId}) as {turns:{answer:{message:string}}[]};assert.equal(h.turns[0].answer.message,r.message);assert.equal(f.state.providerCalls,before);assert.equal(f.rows.get(r.conversationId)?.claim,null);
});
await check('Spending denial invokes Qwen without any paid dispatch and uses the same authorized conversation',async()=>{
 const f=createHostedTenbotFixture();f.state.budget=false;
 const r=await f.handler()({action:'ask',question:'How do I create a group conversation?'}) as {conversationId:string;fallback:boolean;contentScope:string};
 assert(r.fallback);assert.equal(r.contentScope,'volatile');assert.equal(f.state.providerCalls,0);assert.equal(f.state.qwenCalls,1);assert.equal(f.rows.size,1);assert.equal(f.rows.get(r.conversationId)?.turns.length,1);assert.equal(f.rows.get(r.conversationId)?.claim,null);
});
await check('Provider outage retains uncertain reservations and falls back without copying native context',async()=>{
 const f=createHostedTenbotFixture();f.state.providerFailure=true;
 const r=await f.handler()({action:'ask',question:'How do I create a group conversation?'}) as {fallback:boolean};assert(r.fallback);assert.equal(f.state.qwenCalls,1);assert(f.reservations.size>0);assert([...f.reservations.values()].every(x=>x.actual===undefined));
});
await check('Qwen fallback holds the conversation lease against concurrent hydration/ask and releases after legacy append',async()=>{
 const f=createHostedTenbotFixture();f.state.budget=false;
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;}),wait=new Promise<void>(resolve=>{release=resolve;});
 f.state.qwenPause=async()=>{entered();await wait;};
 const pending=f.handler()({action:'ask',question:'How do I create a group conversation?'});await started;
 const id=[...f.rows.keys()][0];await assert.rejects(f.handler()({action:'history',conversationId:id}),error=>error instanceof Error&&'status'in error&&error.status===409);
 await assert.rejects(f.handler()({action:'ask',question:'Hello',conversationId:id}));release();await pending;assert.equal(f.rows.get(id)?.claim,null);assert.equal(f.state.qwenCalls,1);
});
await check('Missing/expired key and disabled spend cannot dispatch OpenAI; Qwen remains functional',async()=>{
 for(const config of [{apiKey:''},{keyExpiresAt:'invalid'},{keyExpiresAt:new Date(0).toISOString()},{spendingAuthorized:false}]){
  const f=createHostedTenbotFixture(),r=await f.handler(undefined,config)({action:'ask',question:'How do I create a group conversation?'}) as {fallback:boolean};assert(r.fallback);assert.equal(f.state.providerCalls,0);assert.equal(f.reservations.size,0);assert.equal(f.state.qwenCalls,1);
 }
});
await check('Unexpected model/tier metadata retains full reservation and falls back rather than underpricing the response',async()=>{
 for(const change of [{apiModel:'unexpected-model'},{serviceTier:'priority'}]){
  const f=createHostedTenbotFixture();Object.assign(f.state,change);const r=await f.handler()({action:'ask',question:'How do I create a group conversation?'}) as {fallback:boolean};assert(r.fallback);assert.equal(f.state.providerCalls,1);assert([...f.reservations.values()].every(x=>x.actual===undefined));assert.equal(f.state.qwenCalls,1);
 }
});
await check('Input, access and persistence failures never become provider fallback or paid inference',async()=>{
 for(const body of [{action:'ask',question:'Hello',invoiceId:'forged'},{action:'ask',question:'Hello',history:[]},{action:'history',conversationId:'forged'},{action:'execute'},{action:'approve'}]){const f=createHostedTenbotFixture();await assert.rejects(f.handler()(body));assert.equal(f.state.providerCalls,0);assert.equal(f.state.qwenCalls,0);}
 const denied=createHostedTenbotFixture();denied.state.allowed=false;await assert.rejects(denied.handler()({action:'ask',question:'Hello'}));assert.equal(denied.state.providerCalls,0);assert.equal(denied.state.qwenCalls,0);
 const conflict=createHostedTenbotFixture();conflict.state.commitFailure=true;await assert.rejects(conflict.handler()({action:'ask',question:conflict.archived.question}));assert.equal(conflict.state.qwenCalls,0);
});
await check('Read-only tool discovery cannot expose invoice, catalog preparation, execute, SQL or shell',async()=>{
 const f=createHostedTenbotFixture();await f.handler()({action:'ask',question:f.archived.question});
 const text=JSON.stringify(f.state.context);for(const name of ['prepare_pending_receivals','search_catalog','read_invoice','execute_sql','shell'])assert(!text.includes('"name":"'+name+'"'));
 assert.equal(f.state.jobCalls,0);assert(!JSON.stringify([...f.rows.values()]).includes('encrypted_content'));
});
await check('Clear deletes durable context and rejects subsequent history without replaying inference',async()=>{
 const f=createHostedTenbotFixture(),r=await f.handler()({action:'ask',question:f.archived.question}) as {conversationId:string};
 await f.handler()({action:'clear',conversationId:r.conversationId});await assert.rejects(f.handler()({action:'history',conversationId:r.conversationId}));assert.equal(f.state.providerCalls,3);
});
const report={passed:true,checks,groups:checks.length,mode:'Offline hosted construction/Responses transport/RPC doubles',actualInference:false,actualDatabase:false};
mkdirSync('/private/tmp/tenops-tenbot-hosted-adapter-20261029',{recursive:true});writeFileSync('/private/tmp/tenops-tenbot-hosted-adapter-20261029/adapter-tests.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
