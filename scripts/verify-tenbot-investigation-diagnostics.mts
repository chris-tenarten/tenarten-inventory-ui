import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {AgentStepError,emptyUsage,runTenbotAgent,type AgentFinal,type AgentProvider,type AgentStep,type AgentTool} from '../supabase/functions/_shared/tenbot-agent';
import {AgentToolError,emitInvestigationDiagnostic,safeInvestigationDiagnostic,type InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import {createAuthenticatedReceivalAgent,type ReceivalAgentCaller} from '../supabase/functions/_shared/tenbot-receival-runtime';

// Offline adverse-input checks only. No credentials, network, grant or write services.
const checks:string[]=[],captured:InvestigationDiagnostic[]=[];
const sensitive='synthetic_private_invoice_customer_context';
const zero=()=>emptyUsage();
const done:AgentFinal={answer:sensitive,observations:[],inferences:[],recommendations:[],questions:['Which source is intended?'],completed_actions:[]};
const call=(id:string,name:string,args:Record<string,string|string[]>={})=>({id,name,arguments:args});
const step=(calls:AgentStep['calls']=[],final?:AgentFinal):AgentStep=>({calls,continuation:[{synthetic_untrusted_context:sensitive}],usage:zero(),...(final?{final}:{})});
function provider(steps:(AgentStep|Error)[]):AgentProvider{let next=0;return {name:sensitive,model:sensitive,async step(){const value=steps[next++];if(value instanceof Error)throw value;assert(value,'No unplanned model step');return value;}};}
const parameters={type:'object',properties:{},required:[],additionalProperties:false} as const;
const tool=(execute:AgentTool['execute']=async()=>({data:{private_record:sensitive}})):AgentTool=>({name:'read_invoice',kind:'read',description:sensitive,parameters:{...parameters,required:[]},execute});
const run=(model:AgentProvider,tools:AgentTool[]=[tool()],extra:Partial<Parameters<typeof runTenbotAgent>[1]>={})=>runTenbotAgent({question:sensitive,serverContext:[{question:sensitive,answer:sensitive}]},{callerId:sensitive,provider:model,tools,authorize:async()=>true,onDiagnostic:event=>captured.push(event),...extra});
async function check(name:string,action:()=>void|Promise<void>){await action();checks.push(name);}
function assertSafe(events:InvestigationDiagnostic[]){
 assert(events.length>0);
 for(const event of events){assert.deepEqual(Object.keys(event).sort(),['durationMs','outcome','reasonCode','stage','tool']);assert(Number.isSafeInteger(event.durationMs)&&event.durationMs>=0&&event.durationMs<=90000);}
 assert(!JSON.stringify(events).includes(sensitive),'Content, identifiers, errors and context must never enter diagnostics');
}

await check('strict fresh projection removes unknown fields, names, stages, reasons and invalid durations',()=>{
 const projected=safeInvestigationDiagnostic({stage:sensitive,tool:sensitive,outcome:sensitive,durationMs:Infinity,reasonCode:sensitive,raw_invoice:sensitive,trace:[sensitive]} as unknown as InvestigationDiagnostic);
 assert.deepEqual(projected,{stage:'stop',tool:'unknown-tool',outcome:'error',durationMs:0,reasonCode:'runtime-error'});
 assert.equal(safeInvestigationDiagnostic({...projected,durationMs:-5}).durationMs,0);
 assert.equal(safeInvestigationDiagnostic({...projected,durationMs:1e20}).durationMs,90000);
 assert.equal(new AgentToolError(sensitive).code,'tool-failed');assert.equal(new AgentToolError(sensitive).message,'tool-failed');
 assert.equal(new AgentToolError('unsupported_invoice_metadata').message,'unsupported_invoice_metadata');
});
await check('Proposal categories are a closed content-free vocabulary; appended values and identifiers are discarded',()=>{
 for(const reasonCode of ['proposal_invalid_schema','proposal_invalid_identity','proposal_source_ref_unavailable','proposal_value_not_literal_source','proposal_invalid_decimal','proposal_quote_rate_unproven']){
  const event={stage:'tool',tool:'prepare_proposal_draft',outcome:'error',durationMs:1,reasonCode} as const;
  assert.equal(new AgentToolError(reasonCode).code,reasonCode);
  assert.deepEqual(safeInvestigationDiagnostic({...event,arguments:{password:sensitive},path:sensitive,source_ref:sensitive} as InvestigationDiagnostic),event);
  assert.equal(new AgentToolError(reasonCode+':'+sensitive).code,'tool-failed');
  assert.equal(safeInvestigationDiagnostic({...event,reasonCode:reasonCode+':'+sensitive}).reasonCode,'runtime-error');
 }
});
await check('normal model and tool events contain no invoice, response, result, context or owner values',async()=>{
 const start=captured.length;
 const result=await run(provider([step([call('discover','discover_capabilities',{names:['read_invoice']})]),step([call('read','read_invoice')]),step([],done)]));
 assert.equal(result.status,'completed');const events=captured.slice(start);assertSafe(events);
 assert(events.some(e=>e.stage==='model'&&e.reasonCode==='received'));assert(events.some(e=>e.stage==='tool'&&e.tool==='read_invoice'&&e.outcome==='ok'));assert.equal(events.at(-1)?.reasonCode,'completed');
});
await check('unknown model-selected tool names are redacted while the safe boundary reason survives',async()=>{
 const start=captured.length;const result=await run(provider([step([call('unknown',sensitive)]),step([],done)]));
 assert.equal(result.status,'completed');const events=captured.slice(start);assertSafe(events);
 assert(events.some(e=>e.stage==='tool'&&e.tool==='unknown-tool'&&e.reasonCode==='capability-not-discovered'));
});
await check('arbitrary exception text is discarded and typed metadata failures remain actionable',async()=>{
 const start=captured.length;let attempt=0;
 const result=await run(provider([step([call('discover','discover_capabilities',{names:['read_invoice']})]),step([call('a','read_invoice'),call('b','read_invoice'),call('c','read_invoice')])]),[tool(async()=>{if(attempt++===0)throw Error(sensitive);throw new AgentToolError('unsupported_invoice_metadata');})]);
 assert.equal(result.reason,'error-limit');const events=captured.slice(start);assertSafe(events);
 const failed=events.filter(e=>e.stage==='tool'&&e.outcome==='error');assert.equal(failed.length,3);assert.equal(failed[0].reasonCode,'tool-failed');assert.equal(failed[2].reasonCode,'unsupported_invoice_metadata');
 assert.equal(events.at(-2)?.reasonCode,'unsupported_invoice_metadata');assert.equal(events.at(-1)?.reasonCode,'error-limit');assert.equal(result.trace.filter(e=>e.event==='tool'&&e.outcome==='error').length,3);
});
await check('arbitrary provider error codes and authorization exceptions cannot leak into events',async()=>{
 let start=captured.length;const failed=await run(provider([new AgentStepError(sensitive)]));assert.equal(failed.status,'provider-unavailable');assertSafe(captured.slice(start));assert(captured.slice(start).every(e=>e.reasonCode==='runtime-error'));
 start=captured.length;const denied=await run(provider([]),[tool()],{authorize:async()=>{throw Error(sensitive);}});assert.equal(denied.reason,'authorization-denied');const events=captured.slice(start);assertSafe(events);assert(events.some(e=>e.stage==='authorization'&&e.reasonCode==='authorization-denied'));
});
await check('synchronous and asynchronous diagnostic sink failures do not alter success or failure',async()=>{
 for(const onDiagnostic of [()=>{throw Error(sensitive);},async()=>{throw Error(sensitive);}]){
  assert.equal((await run(provider([step([],done)]),[tool()],{onDiagnostic})).status,'completed');
  assert.equal((await run(provider([]),[tool()],{authorize:async()=>false,onDiagnostic})).reason,'authorization-denied');
 }
 emitInvestigationDiagnostic(undefined,{stage:'stop',tool:null,outcome:'stopped',durationMs:0,reasonCode:'runtime-error'});
 await new Promise<void>(resolve=>setImmediate(resolve));
});
await check('runtime extraction failures retain only an allowlisted stage and reason; no write service is invoked',async()=>{
 const events:InvestigationDiagnostic[]=[];
 const caller:ReceivalAgentCaller={from(){throw Error('No operational read is needed before extraction');},async rpc(name){assert.equal(name,'has_app_capability');return {data:true,error:null};}};
 const handler=createAuthenticatedReceivalAgent({model:sensitive,remainingUsd:()=>0,assertNoFatal(){},createProvider:()=>provider([]),decodeAttachment:async()=>({filename:sensitive,sha256:sensitive,bytes:new Uint8Array([1]),mediaType:'image/png'}),extractDocument:async()=>{throw new AgentStepError(sensitive);},onDiagnostic:event=>events.push(event)});
 const uploaded=await handler({action:'upload',syntheticConfirmed:true,attachment:{}},sensitive,caller);
 assert('attachmentId' in uploaded&&typeof uploaded.attachmentId==='string','Upload must return its attachment identity');
 await assert.rejects(handler({action:'ask',attachmentId:uploaded.attachmentId,question:sensitive,orderDetails:{orderedBy:'',orderDate:'',location:''}},sensitive,caller),AgentStepError);
 assertSafe(events);assert.deepEqual(events.map(e=>[e.stage,e.outcome,e.reasonCode]),[['extraction','error','runtime-error']]);
});
await check('hosted invoice sink logs only the safe projection and creates no diagnostic storage contract',async()=>{
 const hosted=await readFile(new URL('../supabase/functions/_shared/tenbot-receival-hosted.ts',import.meta.url),'utf8');
 assert(hosted.includes("onDiagnostic(event){console.info('tenbot_receival_investigation',safeInvestigationDiagnostic(event));}"));
 const diagnostics=await readFile(new URL('../supabase/functions/_shared/tenbot-investigation-diagnostics.ts',import.meta.url),'utf8');
 assert(!/console\.|\.rpc\(|fetch\(|localStorage|sessionStorage/.test(diagnostics));
});
const receipt={mode:'offline synthetic privacy/boundary checks; no model inference or database security claim',passed:checks.length,checks};
const outputIndex=process.argv.indexOf('--output');if(outputIndex>=0){assert(process.argv[outputIndex+1]);const path=resolve(process.argv[outputIndex+1]);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
