/** Offline gate/hosted transport checks only; no credentials, live inference or hosted mutation. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHostedTenbot,type HostedRpc} from '../supabase/functions/_shared/tenbot-hosted';
import {terraAcceptanceSpendingAuthorized,type TerraAcceptanceConfig,type TerraAcceptanceScope} from '../supabase/functions/_shared/tenbot-terra-acceptance';
import {safeInvestigationDiagnostic,type InvestigationDiagnostic} from '../supabase/functions/_shared/tenbot-investigation-diagnostics';
import {ordinaryTenbotSpendingAuthorized,hostedInvoicePreparationEnabled,hostedReceivalPilotEnabled} from '../supabase/functions/_shared/tenbot-receival-hosted';
import {createHostedTenbotFixture} from './support/tenbot-hosted-fixture.mjs';
import {safeOpenAIResponseMetadata,type OpenAIResponseMetadata} from '../supabase/functions/_shared/tenbot-openai';
const owner='11111111-1111-4111-8111-111111111111',other='33333333-3333-4333-8333-333333333333';
const requestId='22222222-2222-4222-8222-222222222222',origin='https://tendev.pages.dev';
const starts=Date.parse('2026-11-02T16:00:00Z'),expires=starts+3_600_000;
const config:TerraAcceptanceConfig={enabled:true,ownerIds:[owner],startsAt:new Date(starts).toISOString(),expiresAt:new Date(expires).toISOString()};
const scope:TerraAcceptanceScope={owner,origin,hostedEnabled:true,modelDirectedReads:true};
const checks:string[]=[];
async function check(name:string,fn:()=>void|Promise<void>){await fn();checks.push(name);}
const fact='This assistant has no execution tool. It cannot save schedule changes or send messages; an employee must use the authorized TenOps workflows.';
function fixture(changes:Partial<TerraAcceptanceScope>={},configChanges:Partial<TerraAcceptanceConfig>={}){
 const archived=JSON.parse(readFileSync(new URL('./fixtures/tenbot-capability-history.synthetic.json',import.meta.url),'utf8'));
 archived.modelSteps[2].final={answer:fact,observations:[{text:fact,evidence_ids:['e1']}],inferences:[],recommendations:[],questions:[],completed_actions:[]};
 const f=createHostedTenbotFixture(owner,archived);f.state.now=starts+1000;
 const currentScope={...scope,...changes},currentConfig={...config,...configChanges};
 const allowed=()=>terraAcceptanceSpendingAuthorized(currentConfig,currentScope,f.state.now);
 const diagnostics:{requestId:string;event:InvestigationDiagnostic}[]=[],responseMetadata:OpenAIResponseMetadata[]=[],reserveRequests:string[]=[];
 let afterReserve:(()=>void)|undefined,afterFetch:(()=>void)|undefined;
 let observeThrows=false,transformResponse:((response:Response)=>Promise<Response>)|undefined;
 const service:HostedRpc=async(name,args)=>{
  const result=await f.service(name,args);
  if(name==='tenbot_openai_reserve'){reserveRequests.push(String(args?.p_request_id));afterReserve?.();}
  return result;
 };
 const handler=()=>createHostedTenbot({owner:currentScope.owner,origin:currentScope.origin,
  config:{persistentHistory:false,enabled:true,origins:[origin,'https://tenops.pages.dev'],apiKey:'synthetic-never-a-real-key',keyExpiresAt:new Date(expires+3_600_000).toISOString(),spendingAuthorized:false,modelDirectedReads:currentScope.modelDirectedReads},
  acceptanceSpendingAuthorized:allowed,requestId,onDiagnostic:event=>{if(allowed())diagnostics.push({requestId,event:safeInvestigationDiagnostic(event)});},
  onResponseMetadata:event=>{if(allowed())responseMetadata.push(safeOpenAIResponseMetadata(event));if(observeThrows)throw Error('Synthetic metadata observer unavailable');},
  caller:f.caller,service,qwen:null,jobTools:{async execute(){throw Error('Unexpected operational read');}},now:()=>f.state.now,
  async fetcher(url,init){const result=await f.fetcher(url,init);afterFetch?.();return transformResponse?transformResponse(result):result;},
 });
 return {...f,handler,allowed,diagnostics,responseMetadata,reserveRequests,afterReserve(fn:()=>void){afterReserve=fn;},afterFetch(fn:()=>void){afterFetch=fn;},metadataObserverThrows(){observeThrows=true;},respond(fn:(response:Response)=>Promise<Response>){transformResponse=fn;}};
}

await check('Only the exact enabled TenDev owner/model-read lane inside the finite server window is authorized',()=>{
 assert(terraAcceptanceSpendingAuthorized(config,scope,starts));
 assert(terraAcceptanceSpendingAuthorized(config,scope,expires-1));
 for(const candidate of [{...scope,origin:'https://tenops.pages.dev'},{...scope,origin:'https://tendev.pages.dev.evil.test'},{...scope,origin:'https://tendev.pages.dev/'},{...scope,origin:'http://localhost:3000'},{...scope,origin:''},{...scope,owner:other},{...scope,owner:'not-an-authenticated-uuid'},{...scope,hostedEnabled:false},{...scope,modelDirectedReads:false}])assert(!terraAcceptanceSpendingAuthorized(config,candidate,starts));
 for(const change of [{enabled:false},{ownerIds:[]},{startsAt:''},{expiresAt:''},{startsAt:'invalid'},{expiresAt:'invalid'},{startsAt:new Date(expires).toISOString()},{expiresAt:new Date(starts).toISOString()},{expiresAt:new Date(starts+86_400_001).toISOString()}])assert(!terraAcceptanceSpendingAuthorized({...config,...change},scope,starts));
 for(const now of [starts-1,expires,Infinity,NaN])assert(!terraAcceptanceSpendingAuthorized(config,scope,now));
});
await check('Temporary acceptance leaves ordinary spending, invoice preparation and operational execution gates disabled',()=>{
 const preparation={enabled:false,spendingAuthorized:false,startsAt:config.startsAt,expiresAt:config.expiresAt};
 assert(terraAcceptanceSpendingAuthorized(config,scope,starts));
 assert.equal(ordinaryTenbotSpendingAuthorized(false,preparation),false);
 assert.equal(hostedInvoicePreparationEnabled(preparation,owner,origin,starts),false);
 assert.equal(hostedReceivalPilotEnabled({enabled:false,executionEnabled:false,origins:[origin],employeeIds:[owner],expiresAt:config.expiresAt},owner,origin,starts),false);
});
await check('Accepted server gate reuses the existing atomic reserve/settle meter and server correlation UUID for model/tool diagnostics',async()=>{
 const f=fixture();await f.handler()({action:'ask',question:f.archived.question});
 assert.equal(f.state.providerCalls,3);assert.equal(f.reservations.size,3);assert(f.reserveRequests.every(id=>id===requestId));
 assert([...f.reservations.values()].every(reservation=>reservation.actual===200));
 assert(f.diagnostics.some(({event})=>event.stage==='model'&&event.outcome==='ok'));
 assert(f.diagnostics.some(({event})=>event.stage==='tool'&&event.tool==='describe_assistant_scope'&&event.outcome==='ok'));
 const serialized=JSON.stringify(f.diagnostics);for(const secret of [owner,f.archived.question,'synthetic-never-a-real-key','evidence_ids','arguments','answer_facts'])assert(!serialized.includes(secret));
 for(const diagnostic of f.diagnostics){assert.equal(diagnostic.requestId,requestId);assert.deepEqual(Object.keys(diagnostic.event).sort(),['durationMs','outcome','reasonCode','stage','tool']);}
});
await check('Production, different owner, disabled lane, expired window and disabled acceptance cannot reserve or dispatch Terra',async()=>{
 for(const [scopeChanges,configChanges] of [[{origin:'https://tenops.pages.dev'},{}],[{owner:other},{}],[{modelDirectedReads:false},{}],[{hostedEnabled:false},{}],[{},{enabled:false}],[{},{expiresAt:new Date(starts).toISOString()}]] as [Partial<TerraAcceptanceScope>,Partial<TerraAcceptanceConfig>][]){
  const f=fixture(scopeChanges,configChanges);try{await f.handler()({action:'ask',question:f.archived.question});}catch{/* A denied synthetic owner cannot claim the original owner's history. */}
  assert.equal(f.state.providerCalls,0);assert.equal(f.reservations.size,0);assert.equal(f.diagnostics.length,0);assert.equal(f.responseMetadata.length,0);
 }
});
await check('Caller-forged acceptance, correlation, provider, history and write fields are rejected before inference',async()=>{
 for(const fields of [{acceptanceSpendingAuthorized:true},{spendingAuthorized:true},{requestId},{ownerIds:[owner]},{origin},{provider:'gpt-6.1-terra'},{history:[]},{invoiceId:other},{execute:true}]){
  const f=fixture();await assert.rejects(f.handler()({action:'ask',question:f.archived.question,...fields}));assert.equal(f.state.providerCalls,0);assert.equal(f.reservations.size,0);
 }
 for(const action of ['execute','approve','prepare']){const f=fixture();await assert.rejects(f.handler()({action}));assert.equal(f.state.providerCalls,0);assert.equal(f.reservations.size,0);}
});
await check('Expiry after an earlier model round blocks the next atomic reservation and network dispatch',async()=>{
 const f=fixture();f.afterFetch(()=>{f.state.now=expires;});
 await f.handler()({action:'ask',question:f.archived.question});
 assert.equal(f.state.providerCalls,1);assert.equal(f.reservations.size,1);assert.equal(f.reserveRequests.length,1);
});
await check('Expiry between an atomic reserve and dispatch cannot reach the provider and conservatively retains accounting',async()=>{
 const f=fixture();f.afterReserve(()=>{f.state.now=expires;});
 await f.handler()({action:'ask',question:f.archived.question});
 assert.equal(f.state.providerCalls,0);assert.equal(f.reservations.size,1);assert([...f.reservations.values()].every(value=>value.actual===undefined));
});
await check('Deployed Production persistent-history integration is preserved and acceptance is outside receival routing',()=>{
 const hosted=readFileSync(new URL('../supabase/functions/_shared/tenbot-hosted.ts',import.meta.url),'utf8');
 assert(hosted.includes("options.origin==='https://tenops.pages.dev'||options.origin==='https://tendev.pages.dev'"));
 const edge=readFileSync(new URL('../supabase/functions/tenbot/index.ts',import.meta.url),'utf8');
 assert(edge.indexOf('return reply(await receivals(body));')<edge.indexOf('const acceptance='));
 assert(edge.includes("ordinaryTenbotSpendingAuthorized(Deno.env.get('TENBOT_OPENAI_SPEND_AUTHORIZED')==='true',preparation)"));
 assert(!edge.includes('body.acceptance')&&!edge.includes('body.requestId'));
});
await check('Provider metadata projects only finite enums, status and presence booleans with no raw response content',()=>{
 const unknown='SECRET customer text';
 const metadata=safeOpenAIResponseMetadata({httpStatus:NaN,errorCode:unknown,errorType:unknown,errorParameter:unknown,completionStatus:unknown,incompleteReason:unknown,usagePresent:unknown,inputTokensPresent:1,outputTokensPresent:{secret:unknown},cachedTokensPresent:false,cacheWriteTokensPresent:true,modelMatches:unknown,serviceTierMatches:true,message:unknown,payload:{output:unknown},id:owner});
 assert.deepEqual(metadata,{httpStatus:null,errorCode:'other',errorType:'other',errorParameter:'other',completionStatus:'other',incompleteReason:'other',usagePresent:false,inputTokensPresent:false,outputTokensPresent:false,cachedTokensPresent:false,cacheWriteTokensPresent:true,inputTokens:null,outputTokens:null,cachedInputTokens:null,cacheWriteTokens:null,modelMatches:false,serviceTierMatches:true});
 assert(!JSON.stringify(metadata).includes(unknown)&&!JSON.stringify(metadata).includes(owner));
 assert.deepEqual(safeOpenAIResponseMetadata(metadata),metadata);
});
await check('Optional provider metadata does not alter successful calls, accounting or outcomes even when its observer throws',async()=>{
 for(const throws of [false,true]){
  const f=fixture();if(throws)f.metadataObserverThrows();const result=await f.handler()({action:'ask',question:f.archived.question}) as {message:string};
  assert.equal(result.message,fact);assert.equal(f.state.providerCalls,3);assert.equal(f.reservations.size,3);assert([...f.reservations.values()].every(value=>value.actual===200));assert.equal(f.responseMetadata.length,3);
  for(const metadata of f.responseMetadata){assert.equal(metadata.httpStatus,200);assert.equal(metadata.errorCode,'none');assert.equal(metadata.completionStatus,'completed');assert.equal(metadata.usagePresent,true);assert.equal(metadata.inputTokensPresent,true);assert.equal(metadata.outputTokensPresent,true);assert.equal(metadata.cachedTokensPresent,true);assert.equal(metadata.cacheWriteTokensPresent,true);assert.equal(metadata.inputTokens,100);assert.equal(metadata.outputTokens,20);assert.equal(metadata.cachedInputTokens,0);assert.equal(metadata.cacheWriteTokens,0);assert(metadata.modelMatches&&metadata.serviceTierMatches);}
  for(const secret of [owner,f.archived.question,'synthetic-never-a-real-key','evidence_ids','arguments','answer_facts'])assert(!JSON.stringify(f.responseMetadata).includes(secret));
 }
});
await check('HTTP error metadata identifies only allowed API configuration fields and preserves the original unknown-cost hold',async()=>{
 const f=fixture();f.respond(async()=>Response.json({error:{code:'unknown_parameter',type:'invalid_request_error',param:'prompt_cache_options',message:'SECRET provider error with customer content'},id:owner},{status:400}));
 await f.handler()({action:'ask',question:f.archived.question});
 assert.equal(f.state.providerCalls,1);assert.equal(f.reservations.size,1);assert([...f.reservations.values()].every(value=>value.actual===undefined));
 assert(f.diagnostics.some(({event})=>event.reasonCode==='provider-http-error'));
 assert.equal(f.responseMetadata.length,1);assert.deepEqual(f.responseMetadata[0],{httpStatus:400,errorCode:'unknown_parameter',errorType:'invalid_request_error',errorParameter:'prompt_cache_options',completionStatus:'none',incompleteReason:'none',usagePresent:false,inputTokensPresent:false,outputTokensPresent:false,cachedTokensPresent:false,cacheWriteTokensPresent:false,inputTokens:null,outputTokens:null,cachedInputTokens:null,cacheWriteTokens:null,modelMatches:false,serviceTierMatches:false});
 assert(!JSON.stringify(f.responseMetadata).includes('SECRET')&&!JSON.stringify(f.responseMetadata).includes(owner));
});
await check('Incomplete-provider status and absent usage fields are visible without weakening parsing or settlement',async()=>{
 const incomplete=fixture();incomplete.respond(async response=>Response.json({...await response.json(),status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'message',content:'SECRET generated output'}]}));
 await incomplete.handler()({action:'ask',question:incomplete.archived.question});
 assert.equal(incomplete.state.providerCalls,1);assert([...incomplete.reservations.values()].every(value=>value.actual===200));assert(incomplete.diagnostics.some(({event})=>event.reasonCode==='incomplete-provider-response'));
 assert.equal(incomplete.responseMetadata[0].completionStatus,'incomplete');assert.equal(incomplete.responseMetadata[0].incompleteReason,'max_output_tokens');assert(incomplete.responseMetadata[0].usagePresent);assert(!JSON.stringify(incomplete.responseMetadata).includes('SECRET'));
 const missing=fixture();missing.respond(async response=>{const payload=await response.json();delete payload.usage.input_tokens_details.cache_write_tokens;return Response.json(payload);});
 await missing.handler()({action:'ask',question:missing.archived.question});
 assert.equal(missing.state.providerCalls,1);assert([...missing.reservations.values()].every(value=>value.actual===undefined));assert(missing.diagnostics.some(({event})=>event.reasonCode==='missing-provider-usage'));assert(missing.responseMetadata[0].usagePresent);assert.equal(missing.responseMetadata[0].cacheWriteTokensPresent,false);assert.equal(missing.responseMetadata[0].cacheWriteTokens,null);
});
await check('Token telemetry accepts only bounded integer counters, preserves zero and retains unknown as null',()=>{
 for(const [key,maximum] of [['inputTokens',500000],['outputTokens',100000],['cachedInputTokens',500000],['cacheWriteTokens',500000]] as const){
  for(const value of [0,17,maximum])assert.equal(safeOpenAIResponseMetadata({[key]:value})[key],value);
  for(const value of [undefined,null,-1,1.5,Infinity,NaN,maximum+1,'SECRET','17',{},[]])assert.equal(safeOpenAIResponseMetadata({[key]:value})[key],null);
 }
 const counters=safeOpenAIResponseMetadata({inputTokens:1234,outputTokens:98,cachedInputTokens:234,cacheWriteTokens:56,rawUsage:'SECRET'});assert.deepEqual(safeOpenAIResponseMetadata(counters),counters);assert(!JSON.stringify(counters).includes('SECRET'));
});
await check('Documented billing-limit codes remain finite content-free metadata',()=>{
 for(const code of ['organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded','credit_balance_exhausted']){
  const projected=safeOpenAIResponseMetadata({httpStatus:429,errorCode:code,errorType:'insufficient_quota',message:'SECRET provider billing details',id:owner});
  assert.equal(projected.errorCode,code);assert.equal(projected.errorType,'insufficient_quota');assert(!JSON.stringify(projected).includes('SECRET')&&!JSON.stringify(projected).includes(owner));
 }
 assert.equal(safeOpenAIResponseMetadata({errorCode:'SECRET unknown billing code'}).errorCode,'other');
});
await check('Permanent insufficient-quota 429 stops after one provider attempt and retains exactly one unknown-cost hold',async()=>{
 const f=fixture();f.respond(async()=>Response.json({error:{type:'insufficient_quota',code:'organization_usage_limit_exceeded',message:'SECRET billing context'}},{status:429}));
 await f.handler()({action:'ask',question:f.archived.question});
 assert.equal(f.state.providerCalls,1);assert.equal(f.reservations.size,1);assert.equal(f.reserveRequests.length,1);assert([...f.reservations.values()].every(value=>value.actual===undefined));
 assert.equal(f.responseMetadata.length,1);assert.equal(f.responseMetadata[0].errorType,'insufficient_quota');assert.equal(f.responseMetadata[0].errorCode,'organization_usage_limit_exceeded');assert(f.diagnostics.some(({event})=>event.reasonCode==='provider-http-error'));
});
await check('Temporary 429 and server failures preserve the existing single automatic retry and conservative holds',async()=>{
 for(const [status,type,code] of [[429,'rate_limit_error','rate_limit_exceeded'],[503,'insufficient_quota','server_error']] as const){
  const f=fixture();f.respond(async()=>Response.json({error:{type,code}},{status}));
  await f.handler()({action:'ask',question:f.archived.question});
  assert.equal(f.state.providerCalls,2);assert.equal(f.reservations.size,2);assert.equal(f.reserveRequests.length,2);assert([...f.reservations.values()].every(value=>value.actual===undefined));assert.equal(f.responseMetadata.length,2);
 }
});
console.log(JSON.stringify({passed:true,groups:checks.length,checks,actualInference:false,actualDatabase:false,mode:'Offline server gate/hosted transport with existing atomic meter RPC doubles'}));
