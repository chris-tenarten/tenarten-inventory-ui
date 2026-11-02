/** Focused Qwen adapter contract: scripted HTTP/provider responses only.
 * No live inference, credentials, hosted data, RLS claims or spending changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cloudflareProvider,inferenceRequest,type InferenceInput,type InferenceProvider} from '../supabase/functions/_shared/tenbot-core';
import {createQwenAgentProvider} from '../supabase/functions/_shared/tenbot-qwen-agent';
import {AGENT_FINAL_SCHEMA,AgentStepError,runTenbotAgent,type AgentStepRequest,type AgentTool,type JsonValue} from '../supabase/functions/_shared/tenbot-agent';
import {defaultModel,maxOutputTokens} from '../supabase/functions/_shared/tenbot-models';
const checks:string[]=[],owner='11111111-1111-4111-8111-111111111111',reservation='22222222-2222-4222-8222-222222222222';
const request=(signal=new AbortController().signal):AgentStepRequest=>({instructions:'Read-only registered capabilities. Interpret the employee goal.',history:[{kind:'user',content:'Compare saved dates and reported labor for the named Job.'}],tools:[{name:'discover_capabilities',description:'Discover authorized schemas.',parameters:{type:'object',properties:{names:{type:'array',items:{type:'string'},maxItems:8}},required:['names'],additionalProperties:false}}],finalSchema:AGENT_FINAL_SCHEMA,signal,maxOutputTokens:640,remainingUsd:0.25,onReserve(){throw Error('Qwen must not reserve a paid-provider budget.');}});
const discovery={calls:[{id:'d1',name:'discover_capabilities',arguments:{names:['get_job_planning','get_job_labor_summary']}}],final:null};
const fixture=(options:{raw?:unknown;responses?:unknown[];invalidJson?:boolean;unmeasured?:boolean;denied?:boolean;settlementFails?:boolean;reserveValue?:unknown;onFetch?():void;can?():Promise<boolean>}={})=>{
 const events:string[]=[],rpcCalls:{name:string;args:Record<string,unknown>}[]=[],sent:Record<string,unknown>[]=[],inputs:InferenceInput[]=[];let network=0;
 const real=cloudflareProvider('synthetic-account','synthetic-never-real',async(_url,init)=>{events.push('infer');network++;sent.push(JSON.parse(String(init?.body)));options.onFetch?.();return Response.json({success:true,result:{response:options.invalidJson?'{':JSON.stringify(options.responses?.[network-1]??options.raw??discovery),...(options.unmeasured?{}:{usage:{prompt_tokens:111,completion_tokens:44}})}});});
 const provider:InferenceProvider={name:real.name,reserveEstimate(input){events.push('estimate');inputs.push(input);return real.reserveEstimate!(input);},async infer(input,signal){inputs.push(input);return real.infer(input,signal);},usage(input){inputs.push(input);return real.usage!(input);}};
 const adapter=createQwenAgentProvider({provider,owner,can:options.can??(async()=>true),async rpc(name,args){events.push(name);rpcCalls.push({name,args});if(name==='tenbot_reserve_usage')return{data:options.reserveValue??reservation,error:options.denied?{message:'Synthetic quota rejection'}:null};if(name==='tenbot_finish_usage')return{data:null,error:options.settlementFails?{message:'Synthetic settlement failure'}:null};throw Error('Unexpected meter RPC.');}});
 return {adapter,events,rpcCalls,sent,inputs,network:()=>network};
};
async function test(name:string,fn:()=>Promise<void>){await fn();checks.push(name);}
const selection=(calls:{name:string;arguments:unknown}[])=>calls.map(({name,arguments:args})=>({name,arguments:args}));
await test('Existing Cloudflare transport receives callable schemas and same-input metering; paid allowance remains unused',async()=>{
 const f=fixture(),step=await f.adapter.step(request());assert.deepEqual(selection(step.calls),selection(discovery.calls));assert.match(step.calls[0].id,/^qwen_[a-f0-9]{32}_1_1$/);assert.equal(step.final,undefined);assert.equal(step.usage.inputTokens,111);assert.equal(step.usage.outputTokens,44);assert.equal(step.usage.costUsd,0);assert.equal(step.usage.reservedUsd,0);assert.equal(f.network(),1);
 assert.deepEqual(f.events.slice(0,3),['estimate','tenbot_reserve_usage','infer']);assert.equal(f.rpcCalls.at(-1)!.name,'tenbot_finish_usage');assert.equal(f.rpcCalls.at(-1)!.args.p_outcome,'completed');assert.equal(f.rpcCalls.at(-1)!.args.p_input_tokens,111);assert(f.inputs.every(input=>input===f.inputs[0]));
 const wire=f.sent[0] as {max_tokens:number;messages:{content:string}[]};assert.equal(wire.max_tokens,maxOutputTokens);assert.match(wire.messages[0].content,/sequence calls yourself/);assert.match(wire.messages[0].content,/tools array is the complete set/);assert.match(wire.messages[0].content,/Wait for the discovery result/);const payload=JSON.parse(wire.messages[1].content);assert.deepEqual(payload.tools,request().tools);assert.deepEqual(payload.final_schema,AGENT_FINAL_SCHEMA);assert.match(JSON.stringify(payload.history),/Compare saved dates/);assert.equal(f.rpcCalls[0].args.p_model,defaultModel);
});
await test('Model-selected parallel call ordering and arguments are preserved with matching server-owned continuation IDs',async()=>{
 const raw={calls:[{id:'plan',name:'get_job_planning',arguments:{job_id:owner}},{id:'hours',name:'get_job_labor_summary',arguments:{job_id:owner,start_date:'2026-10-26',end_date:'2026-11-01'}}],final:null};
 const f=fixture({raw}),step=await f.adapter.step(request());assert.deepEqual(selection(step.calls),selection(raw.calls));assert.notEqual(step.calls[0].id,step.calls[1].id);assert.match(step.calls[0].id,/_1_1$/);assert.match(step.calls[1].id,/_1_2$/);assert.deepEqual(step.continuation,[{calls:step.calls,final:null}]);assert.deepEqual(raw.calls.map(c=>c.id),['plan','hours'],'Provider output must remain unchanged');
});
await test('Repeated provider labels across rounds receive distinct IDs and tool results remain paired after continuation',async()=>{
 const first={calls:[{id:'call_1',name:'discover_capabilities',arguments:{names:['get_job_planning']}}],final:null},second={calls:[{id:'call_1',name:'get_job_planning',arguments:{job_id:owner}}],final:null};
 const f=fixture({responses:[first,second]}),a=await f.adapter.step(request()),next=request();next.history.push({kind:'provider',items:a.continuation},{kind:'tool_result',callId:a.calls[0].id,name:a.calls[0].name,output:'{"loaded":["get_job_planning"]}'});
 const b=await f.adapter.step(next);assert.notEqual(a.calls[0].id,b.calls[0].id);assert.match(b.calls[0].id,/_2_1$/);assert.deepEqual(b.continuation,[{calls:b.calls,final:null}]);
 const payload=JSON.parse((f.sent[1] as {messages:{content:string}[]}).messages[1].content),prior=payload.history.find((h:{kind:string})=>h.kind==='provider'),result=payload.history.find((h:{kind:string})=>h.kind==='tool_result');assert.equal(prior.items[0].calls[0].id,result.callId);assert.equal(result.callId,a.calls[0].id);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_reserve_usage').length,2);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_finish_usage').length,2);assert.equal(f.network(),2);
});
await test('Duplicate provider labels within one batch remain ambiguous and fail after exactly one measured settlement',async()=>{
 const f=fixture({raw:{calls:[{id:'call_1',name:'get_job_planning',arguments:{job_id:owner}},{id:'call_1',name:'get_job_labor_summary',arguments:{job_id:owner}}],final:null}});await assert.rejects(f.adapter.step(request()),(e:unknown)=>e instanceof AgentStepError&&e.code==='invalid-provider-step');assert.equal(f.network(),1);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_finish_usage').length,1);assert.equal(f.rpcCalls[1].args.p_outcome,'failed');assert.equal(f.rpcCalls[1].args.p_input_tokens,111);
});
await test('Exact two-round live protocol failure reproduces without ID collision while undiscovered tools still cannot execute',async()=>{
 const raw=[{calls:[{id:'call_1',name:'describe_assistant_scope',arguments:{}}],final:null},{calls:[{id:'call_1',name:'search_workflow_knowledge',arguments:{query:'How to count Jobs currently In Production'}}],final:null}];
 const f=fixture({responses:raw}),reasonCodes:string[]=[];let executed=0;
 const tools:AgentTool[]=[{name:'describe_assistant_scope',description:'Describe registered capabilities.',kind:'read',parameters:{type:'object',properties:{},required:[],additionalProperties:false},async execute(){executed++;return{data:{scope:'read-only'}};}},{name:'search_workflow_knowledge',description:'Search authorized workflow knowledge.',kind:'read',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},async execute(){executed++;return{data:{guide:'Synthetic'}};}}];
 const result=await runTenbotAgent({question:'How many Jobs are currently In Production?'},{callerId:owner,provider:f.adapter,tools,authorize:async()=>true,limits:{maxRounds:2,maxOutputTokens:640},onDiagnostic:event=>reasonCodes.push(event.reasonCode)});
 assert.equal(result.reason,'round-limit');assert.equal(result.trace.filter(t=>t.event==='tool'&&t.outcome==='error').length,2);assert.equal(executed,0);assert.equal(reasonCodes.filter(c=>c==='capability-not-discovered').length,2);assert.equal(f.network(),2);
 const secondPayload=JSON.parse((f.sent[1] as {messages:{content:string}[]}).messages[1].content);assert.deepEqual(secondPayload.tools.map((t:{name:string})=>t.name),['discover_capabilities']);const prior=secondPayload.history.find((h:{kind:string})=>h.kind==='provider'),toolResult=secondPayload.history.find((h:{kind:string})=>h.kind==='tool_result');assert.equal(prior.items[0].calls[0].id,toolResult.callId);assert.notEqual(toolResult.callId,'call_1');assert.equal(result.evidence.length,0);
});
await test('Existing loop completes discovered parallel reads with repeated cross-round labels, correct pairing and unchanged authorization/metering',async()=>{
 const final={answer:'The saved start is 2026-11-02; recorded labor is 5 hours.',observations:[{text:'The saved start is 2026-11-02.',evidence_ids:['e1']},{text:'Recorded labor is 5 hours.',evidence_ids:['e2']}],inferences:[],recommendations:[],questions:[],completed_actions:[]};
 const raw=[{calls:[{id:'call_1',name:'discover_capabilities',arguments:{names:['get_job_planning','get_job_labor_summary']}}],final:null},{calls:[{id:'call_1',name:'get_job_planning',arguments:{job_id:owner}},{id:'call_2',name:'get_job_labor_summary',arguments:{job_id:owner}}],final:null},{calls:[],final}];
 const f=fixture({responses:raw}),executed:string[]=[],authorization:string[]=[];
 const parameters={type:'object' as const,properties:{job_id:{type:'string' as const}},required:['job_id'],additionalProperties:false as const};
 const tools:AgentTool[]=['get_job_planning','get_job_labor_summary'].map(name=>({name,description:'Synthetic authorized read result for protocol verification.',kind:'read',parameters,async execute(args):Promise<{data:JsonValue}>{assert.equal(args.job_id,owner);executed.push(name);return{data:name==='get_job_planning'?{job_id:owner,planned_start:'2026-11-02'}:{job_id:owner,total_hours:5}};}}));
 const result=await runTenbotAgent({question:'Give me the saved start and recorded labor for the identified Job.'},{callerId:owner,provider:f.adapter,tools,authorize:async check=>{authorization.push(check.phase);return true;},limits:{maxRounds:3,maxOutputTokens:640}});
 assert.equal(result.status,'completed');assert.deepEqual(result.final,final);assert.deepEqual(executed,['get_job_planning','get_job_labor_summary']);assert.equal(result.evidence.length,2);assert.equal(result.usage.inputTokens,333);assert.equal(result.usage.outputTokens,132);assert.equal(result.usage.costUsd,0);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_reserve_usage').length,3);assert.equal(f.rpcCalls.filter(c=>c.name==='tenbot_finish_usage').length,3);assert.equal(authorization.filter(p=>p==='before_tool').length,3);assert(authorization.includes('publish'));
 const payload=JSON.parse((f.sent[2] as {messages:{content:string}[]}).messages[1].content),calls=payload.history.filter((h:{kind:string})=>h.kind==='provider').flatMap((h:{items:{calls:{id:string;name:string}[]}[]})=>h.items.flatMap(i=>i.calls)),results=payload.history.filter((h:{kind:string})=>h.kind==='tool_result');assert.equal(new Set(calls.map((c:{id:string})=>c.id)).size,3);assert.equal(results.length,3);for(const result of results){const call=calls.find((c:{id:string})=>c.id===result.callId);assert(call);assert.equal(call.name,result.name);}assert.deepEqual(payload.tools.map((t:{name:string})=>t.name),['discover_capabilities','get_job_planning','get_job_labor_summary']);
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
