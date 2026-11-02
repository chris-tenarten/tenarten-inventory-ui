import assert from 'node:assert/strict';
import {runTenbotAgent,emptyUsage,type AgentTool,type AgentProvider,type AgentStep,type AgentFinal} from '../supabase/functions/_shared/tenbot-agent';
import {createReviewedOperationRegistry} from '../supabase/functions/_shared/tenbot-reviewed-operations';
import {createReviewedActionTransport} from '../supabase/functions/_shared/tenbot-action-transport';
import type {PreparedAction,ActionCard,ActionReference,ActionRpc} from '../supabase/functions/_shared/tenbot-actions';
import type {ActionPasswordDependencies} from '../supabase/functions/_shared/tenbot-action-auth';

// Scripted transport and caller doubles only. No credentials, fetch, provider,
// database or browser. Domain adapters have their own focused verifiers.
const checks:string[]=[];
const reference:ActionReference={id:'c1c42c5b-28ed-4b54-a74b-1e5b90f17682',revision:1,hash:'a'.repeat(64),expiresAt:'2026-11-02T23:00:00Z'};
const prepared:PreparedAction={operation:'proposal.save_draft',parameters:{p_proposal:{project_name:'Fixture'},p_lines:[]},review:{title:'Save Proposal draft',summary:'Review this new Proposal draft.',consequences:['Creates one draft. Does not issue a document.'],fields:[],issues:[]}};
const card:ActionCard={kind:'proposed_action',contract:'tenbot.actions.v1',reference,operation:prepared.operation,review:prepared.review,confirmation:{kind:'account_password',available:true}};
const empty={type:'object',properties:{},required:[],additionalProperties:false} as const;
const calls:string[]=[];
const make=(name:string,kind:'read'|'prepare'='read'):AgentTool=>({name,kind,description:'Injected local composition fixture only.',parameters:{...empty,required:[]},async execute(){calls.push(name);return {data:{fixture:true},...(kind==='prepare'?{proposal:prepared as never}:{})};}});
const registry=createReviewedOperationRegistry([[make('read_supplied_document'),make('search_material_catalog')],[make('get_order'),make('prepare_proposal_draft','prepare')]]);
function script(names:string[]):AgentProvider{
 let round=0;
 return {name:'scripted composition fixture',model:'none',async step():Promise<AgentStep>{
  const step=(toolCalls:AgentStep['calls'],final?:AgentFinal):AgentStep=>({calls:toolCalls,continuation:[],usage:emptyUsage(),...(final?{final}:{})});
  if(round++===0)return step([{id:'discover',name:'discover_capabilities',arguments:{names}}]);
  if(round<=names.length+1)return step([{id:`call${round}`,name:names[round-2],arguments:{}}]);
  return step([],{answer:'Fixture investigation complete. No business data saved.',observations:[{text:'Fixture records were read.',evidence_ids:names.map((_,i)=>`e${i+1}`)}],inferences:[],recommendations:[],questions:[],completed_actions:[]});
 }};
}
for(const [question,names] of [
 ['Compare this invoice with the order.',['read_supplied_document','search_material_catalog','get_order']],
 ['Which material details are missing?',['read_supplied_document','search_material_catalog']],
 ['Prepare a Proposal from these specifications.',['read_supplied_document','search_material_catalog','prepare_proposal_draft']],
] as const){
 calls.length=0;
 const result=await runTenbotAgent({question},{callerId:'fixture-owner',provider:script([...names]),tools:registry.tools,authorize:async()=>true});
 assert.equal(result.status,'completed',result.reason);assert.deepEqual(calls,[...names]);assert.equal(result.usage.costUsd,0);
 let published=0;const cards=await registry.publish(result,reference.id,{async prepare(input){published++;assert.deepEqual(input.action,prepared);return card;}},async()=>true);
 assert.equal(published,names.includes('prepare_proposal_draft' as never)?1:0);assert.equal(cards.length,published);
 checks.push(`existing runtime composition: ${question}`);
}
assert.throws(()=>createReviewedOperationRegistry([[make('get_order')],[make('get_order')]]));
checks.push('duplicate registry rejected; no execute or password tool exposed');
await assert.rejects(registry.prepareRevision({name:'get_order',arguments:{},callerId:'fixture-owner',signal:new AbortController().signal}));
await assert.rejects(registry.prepareRevision({name:'prepare_proposal_draft',arguments:{password:'never-to-model'},callerId:'fixture-owner',signal:new AbortController().signal}));
checks.push('revision uses existing strict prepare schema; read tool and extra credentials rejected');
let touched=0;
const rpc:ActionRpc={async rpc(){touched++;return {data:{contract:'tenbot.actions.v1',card,state:'prepared',receipt:null},error:null};}};
const never=()=>{throw Error('Trusted authentication must not run in these tests');};
const password:ActionPasswordDependencies={authenticate:never,createPasswordClient:never,callerForToken:never,service:{rpc:never}};
for(const config of [{enabled:false,origin:'https://tendev.pages.dev'},{enabled:true,origin:'https://tenops.pages.dev'},{enabled:true,origin:''}]){
 const response=await createReviewedActionTransport({...config,caller:rpc,password})({workspace:'tenbot.actions.v1',action:'confirm',reference,password:'fixture-password'});
 assert.equal(response.status,409);assert.equal(touched,0);assert(!JSON.stringify(response).includes('fixture-password'));
}
checks.push('default OFF and Production/absent origin denied before RPC or Auth');
const transport=createReviewedActionTransport({enabled:true,origin:'https://tendev.pages.dev',caller:rpc,password});
assert.equal((await transport({workspace:'tenbot.actions.v1',action:'status',reference,password:'fixture-password'})).status,409);
assert.equal(touched,0);
assert.equal((await transport({workspace:'tenbot.actions.v1',action:'status',reference})).status,200);
assert.equal(touched,1);
checks.push('password only accepted in trusted confirm shape; status preserves owner-scoped contract');
const broken=createReviewedActionTransport({enabled:true,origin:'https://tendev.pages.dev',caller:{async rpc(){throw Error('SECRET raw database diagnostic');}},password});
const failed=await broken({workspace:'tenbot.actions.v1',action:'status',reference});assert(!JSON.stringify(failed).includes('SECRET'));
checks.push('raw exceptions never reach employee payloads');
console.log(JSON.stringify({mode:'offline-scripted',paidInference:false,database:false,checks},null,2));
