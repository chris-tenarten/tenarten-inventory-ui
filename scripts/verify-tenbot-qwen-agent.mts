/** Focused Qwen adapter contract: scripted HTTP/provider responses only.
 * No live inference, credentials, hosted data, RLS claims or spending changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cloudflareProvider,inferenceRequest,type InferenceInput,type InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import {createQwenAgentProvider} from '../supabase/functions/_shared/tenbot-qwen-agent';
import {AGENT_FINAL_SCHEMA,AgentStepError,type AgentStepRequest} from '../supabase/functions/_shared/tenbot-agent';
import {defaultModel,maxOutputTokens} from '../supabase/functions/_shared/tenbot-models';
const checks:string[]=[],owner='11111111-1111-4111-8111-111111111111',reservation='22222222-2222-4222-8222-222222222222';
const request=(signal=new AbortController().signal):AgentStepRequest=>({instructions:'Read-only registered capabilities. Interpret the employee goal.',history:[{kind:'user',content:'Compare saved dates and reported labor for the named Job.'}],tools:[{name:'discover_capabilities',description:'Discover authorized schemas.',parameters:{type:'object',properties:{names:{type:'array',items:{type:'string'},maxItems:8}},required:['names'],additionalProperties:false}}],finalSchema:AGENT_FINAL_SCHEMA,signal,maxOutputTokens:640,remainingUsd:0.25,onReserve(){throw Error('Qwen must not reserve a paid-provider budget.');}});
const discovery={calls:[{id:'d1',name:'discover_capabilities',arguments:{names:['get_job_planning','get_job_labor_summary']}}],final:null};
const fixture=(options:{raw?:unknown;invalidJson?:boolean;unmeasured?:boolean;denied?:boolean;settlementFails?:boolean;reserveValue?:unknown;onFetch?():void;can?():Promise<boolean>}={})=>{
 const events:string[]=[],rpcCalls:{name:string;args:Record<string,unknown>}[]=[],sent:Record<string,unknown>[]=[],inputs:InferenceInput[]=[];let network=0;
 const real=cloudflareProvider('synthetic-account','synthetic-never-real',async(_url,init)=>{events.push('infer');network++;sent.push(JSON.parse(String(init?.body)));options.onFetch?.();return Response.json({success:true,result:{response:options.invalidJson?'{':JSON.stringify(options.raw??discovery),...(options.unmeasured?{}:{usage:{prompt_tokens:111,completion_tokens:44}})}});});
 const provider:InferenceProvider={name:real.name,reserveEstimate(input){events.push('estimate');inputs.push(input);return real.reserveEstimate!(input);},async infer(input,signal){inputs.push(input);return real.infer(input,signal);},usage(input){inputs.push(input);return real.usage!(input);}};
 const adapter=createQwenAgentProvider({provider,owner,can:options.can??(async()=>true),async rpc(name,args){events.push(name);rpcCalls.push({name,args});if(name==='tenbot_reserve_usage')return{data:options.reserveValue??reservation,error:options.denied?{message:'Synthetic quota rejection'}:null};if(name==='tenbot_finish_usage')return{data:null,error:options.settlementFails?{message:'Synthetic settlement failure'}:null};throw Error('Unexpected meter RPC.');}});
 return {adapter,events,rpcCalls,sent,inputs,network:()=>network};
};
async function test(name:string,fn:()=>Promise<void>){await fn();checks.push(name);}
await test('Existing Cloudflare transport receives callable schemas and same-input metering; paid allowance remains unused',async()=>{
 const f=fixture(),step=await f.adapter.step(request());assert.deepEqual(step.calls,discovery.calls);assert.equal(step.final,undefined);assert.equal(step.usage.inputTokens,111);assert.equal(step.usage.outputTokens,44);assert.equal(step.usage.costUsd,0);assert.equal(step.usage.reservedUsd,0);assert.equal(f.network(),1);
 assert.deepEqual(f.events.slice(0,3),['estimate','tenbot_reserve_usage','infer']);assert.equal(f.rpcCalls.at(-1)!.name,'tenbot_finish_usage');assert.equal(f.rpcCalls.at(-1)!.args.p_outcome,'completed');assert.equal(f.rpcCalls.at(-1)!.args.p_input_tokens,111);assert(f.inputs.every(input=>input===f.inputs[0]));
 const wire=f.sent[0] as {max_tokens:number;messages:{content:string}[]};assert.equal(wire.max_tokens,maxOutputTokens);assert.match(wire.messages[0].content,/sequence calls yourself/);const payload=JSON.parse(wire.messages[1].content);assert.deepEqual(payload.tools,request().tools);assert.deepEqual(payload.final_schema,AGENT_FINAL_SCHEMA);assert.match(JSON.stringify(payload.history),/Compare saved dates/);assert.equal(f.rpcCalls[0].args.p_model,defaultModel);
});
await test('Model-selected call arguments are preserved for the existing loop to validate, not rewritten by intent routing',async()=>{
 const raw={calls:[{id:'plan',name:'get_job_planning',arguments:{job_id:owner}},{id:'hours',name:'get_job_labor_summary',arguments:{job_id:owner,start_date:'2026-10-26',end_date:'2026-11-01'}}],final:null};
 const f=fixture({raw}),step=await f.adapter.step(request());assert.deepEqual(step.calls,raw.calls);assert.deepEqual(step.continuation,[raw]);
});
await test('Existing shared quota rejection dispatches no inference and creates no settlement retry',async()=>{
 const f=fixture({denied:true});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.code==='request-budget-unavailable');assert.equal(f.network(),0);assert.equal(f.rpcCalls.length,1);
});
await test('Authorization revoked after admission prevents dispatch and closes the reservation conservatively',async()=>{
 let calls=0;const f=fixture({can:async()=>++calls===1});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.code==='authorization-denied');assert.equal(f.network(),0);assert.equal(f.rpcCalls.length,2);assert.equal(f.rpcCalls[1].args.p_outcome,'failed');assert.equal(f.rpcCalls[1].args.p_input_tokens,null);
});
await test('Malformed model JSON preserves measured consumption and finishes failed exactly once',async()=>{
 const f=fixture({invalidJson:true});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.usage.inputTokens===111);assert.equal(f.network(),1);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_finish_usage').length,1);assert.equal(f.rpcCalls[1].args.p_outcome,'failed');assert.equal(f.rpcCalls[1].args.p_output_tokens,44);
});
await test('Mixed calls/final and malformed call envelopes are rejected after measured usage',async()=>{
 for(const raw of [{...discovery,final:{answer:'Unsafe mixed output'}},{calls:[{...discovery.calls[0],extra:'unapproved'}],final:null},{calls:[],final:null},{calls:[],final:{},extra:'unapproved'}]){
  const f=fixture({raw});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.code==='invalid-provider-step');assert.equal(f.rpcCalls[1].args.p_outcome,'failed');assert.equal(f.rpcCalls[1].args.p_input_tokens,111);
 }
});
await test('Missing provider usage is not reported as measured zero and leaves conservative reservation accounting',async()=>{
 const f=fixture({unmeasured:true});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.code==='missing-provider-usage');assert.equal(f.rpcCalls[1].args.p_input_tokens,null);assert.equal(f.rpcCalls[1].args.p_output_tokens,null);assert.equal(f.rpcCalls[1].args.p_estimated_neurons,null);
});
await test('Settlement failure never retries accounting or the provider',async()=>{
 const f=fixture({settlementFails:true});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.code==='request-budget-unavailable');assert.equal(f.network(),1);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_finish_usage').length,1);
});
await test('Abort and smaller output budgets reach transport without enabling extra output or calls',async()=>{
 const controller=new AbortController(),before=fixture();controller.abort();await assert.rejects(before.adapter.step(request(controller.signal)),(e:unknown)=>e instanceof AgentStepError&&e.code==='provider-cancelled');assert.equal(before.rpcCalls.length,0);
 const during=new AbortController(),f=fixture({onFetch:()=>during.abort()});await assert.rejects(f.adapter.step(request(during.signal)),(e:unknown)=>e instanceof AgentStepError&&e.code==='provider-cancelled');assert.equal(f.rpcCalls[1].args.p_outcome,'failed');assert.equal(f.network(),1);
 const bounded=fixture(),r=request();r.maxOutputTokens=100;await bounded.adapter.step(r);assert.equal(bounded.sent[0].max_tokens,100);
});
await test('Existing knowledge and operational prose transports retain their prior wire shape and640-token bound',async()=>{
 const input:InferenceInput={question:'How does Inventory work?',context:[],excerpts:[],draft:false};const knowledge=inferenceRequest(input),operational=inferenceRequest({...input,operational:{facts:[{id:'count',text:'Recorded hours:0.'}]}});assert.equal(knowledge.max_tokens,640);assert.equal(operational.max_tokens,640);assert(!JSON.stringify(knowledge).includes('final_schema'));assert(!JSON.stringify(operational).includes('final_schema'));assert.match(operational.messages[0].content,/facts/);
});
const result={passed:true,groups:checks.length,checks,actualProviderAdapter:true,scriptedHttpResponses:true,actualInference:false,networkRequests:0,operationalWrites:0};
if(process.env.TENBOT_QWEN_AGENT_EVIDENCE)fs.writeFileSync(process.env.TENBOT_QWEN_AGENT_EVIDENCE,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
