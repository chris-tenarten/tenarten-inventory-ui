/** Synthetic RPC/provider transport only. NOT JWT/RLS or PostgreSQL validation. */
import {readFileSync} from 'node:fs';
import {createHostedTenbot,type HostedRpc} from '../../supabase/functions/_shared/tenbot-hosted';
import {cloudflareProvider,TenbotError} from '../../supabase/functions/_shared/tenbot-core';
import type {StoredAgentState} from '../../supabase/functions/_shared/tenbot-agent-history-store';
const archived=JSON.parse(readFileSync(new URL('../fixtures/tenbot-capability-history.synthetic.json',import.meta.url),'utf8'));
type Conversation={id:string;owner:string;version:number;expires:number;claim:string|null;state:StoredAgentState;turns:{question:string;answer:string}[]};
export function createHostedTenbotFixture(owner='11111111-1111-4111-8111-111111111111'){
 const rows=new Map<string,Conversation>(),reservations=new Map<string,{reserved:number;actual?:number}>();
 const state={allowed:true,groupAllowed:true,budget:true,providerFailure:false,apiModel:'gpt-6.1-terra',serviceTier:'default',commitFailure:false,qwenPause:null as null|(()=>Promise<void>),now:Date.now(),providerCalls:0,qwenCalls:0,jobCalls:0,steps:0,context:[] as unknown[],events:[] as string[]};
 const can=(capability:unknown)=>state.allowed&&(capability!=='messaging.write'||state.groupAllowed);
 const caller:HostedRpc=async(name,args={})=>{
  state.events.push(name);const id=String(args.p_conversation_id??''),row=rows.get(id);
  if(name==='has_app_capability')return {data:can(args.p_capability),error:null};
  if(name==='has_proposal_access')return {data:state.allowed,error:null};
  if(name==='tenbot_agent_claim'){
   if(!state.allowed)return {data:{ok:false},error:null};
   let current=row;
   if(!id){current={id:crypto.randomUUID(),owner,version:0,expires:state.now+3600000,claim:null,state:{guidance:[],display:[]},turns:[]};rows.set(current.id,current);}
   if(!current||current.owner!==owner||current.expires<=state.now)return {data:{ok:false},error:null};
   if(current.claim)return {data:{ok:false,reason:'busy'},error:null};
   current.claim=crypto.randomUUID();
   return {data:{ok:true,id:current.id,ownerId:owner,revision:current.version,claim:current.claim,expiresAt:new Date(current.expires).toISOString()},error:null};
  }
  if(name==='tenbot_agent_release'){
   if(!state.allowed)return {data:false,error:null};
   if(row&&row.owner===owner&&row.claim===args.p_claim&&row.version===args.p_revision)row.claim=null;
   return {data:!row||row.owner===owner&&row.claim===null,error:null};
  }
  if(name==='tenbot_agent_clear'){const removed=Boolean(row&&row.owner===owner&&rows.delete(id));return {data:removed,error:null};}
  if(name==='tenbot_load_conversation')return {data:row&&row.owner===owner?{ok:true,id,ownerId:owner,version:row.version,turns:structuredClone(row.turns)}:{ok:false},error:null};
  if(name==='tenbot_clear_conversation')return {data:Boolean(row&&row.owner===owner&&rows.delete(id)),error:null};
  throw Error('Unexpected synthetic caller RPC: '+name);
 };
 const service:HostedRpc=async(name,args={})=>{
  state.events.push(name);const row=rows.get(String(args.p_conversation_id??''));
  if(name==='tenbot_agent_load')return {data:row&&row.owner===args.p_user&&row.version===args.p_revision&&row.claim===args.p_claim?structuredClone(row.state):null,error:null};
  if(name==='tenbot_agent_commit'){
   if(state.commitFailure)return {data:false,error:null};
   if(!row||!state.allowed||row.owner!==args.p_user||row.version!==args.p_revision||row.claim!==args.p_claim)return {data:false,error:null};
   row.state=structuredClone(args.p_state) as StoredAgentState;row.version++;row.claim=null;if(args.p_renew)row.expires=state.now+3600000;
   return {data:true,error:null};
  }
  if(name==='tenbot_openai_reserve'){
   if(!state.allowed||!state.budget)return {data:null,error:{message:'Synthetic meter denied'}};
   reservations.set(String(args.p_id),{reserved:Number(args.p_reserved_microusd)});
   return {data:{ok:true,id:args.p_id,requestId:args.p_request_id,reservedMicrousd:args.p_reserved_microusd},error:null};
  }
  if(name==='tenbot_openai_settle'){
   const r=reservations.get(String(args.p_id));if(!r)throw Error('Unknown reservation');
   if(args.p_actual_microusd!==null)r.actual=Number(args.p_actual_microusd);
   return {data:{ok:true,id:args.p_id,state:r.actual===undefined?'uncertain':'measured',accountedMicrousd:r.actual??r.reserved,overrun:false},error:null};
  }
  if(name==='tenbot_reserve_usage')return {data:crypto.randomUUID(),error:null};
  if(name==='tenbot_finish_usage')return {data:null,error:null};
  if(name==='tenbot_append_conversation_turn'){
   if(!row||!state.allowed||row.owner!==args.p_user||row.version!==args.p_expected_version)return {data:false,error:null};
   row.turns=[...row.turns,{question:String(args.p_question),answer:String(args.p_answer)}].slice(-2);row.version++;
   return {data:true,error:null};
  }
  throw Error('Unexpected synthetic service RPC: '+name);
 };
 const fetcher:typeof fetch=async(_url,init)=>{
  state.providerCalls++;const request=JSON.parse(String(init?.body));state.context.push(request.input);
  if(request.model!=='gpt-6.1-terra'||request.service_tier!=='default'||request.store!==false)throw Error('Unsafe provider contract');
  if(state.providerFailure)return Response.json({error:{code:'synthetic_outage'}},{status:503});
  const step=archived.modelSteps[state.steps++%archived.modelSteps.length];
  return Response.json({status:'completed',model:state.apiModel,service_tier:state.serviceTier,usage:{input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}},output:step.calls.length?step.calls.map((c:{id:string;name:string;arguments:unknown})=>({type:'function_call',call_id:c.id,name:c.name,arguments:JSON.stringify(c.arguments)})):[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(step.final)}]}]});
 };
 const qwen=cloudflareProvider('fixture-account','fixture-key',async()=>{
  state.qwenCalls++;await state.qwenPause?.();return Response.json({success:true,result:{response:JSON.stringify({ids:['group'],answer:'Open Messaging, choose New group, enter a group name, select another participant, then choose Create group.',summary:''}),usage:{prompt_tokens:110,completion_tokens:20}}});
 });
 const handler=(origin='https://tendev.pages.dev',config={})=>createHostedTenbot({owner,origin,config:{enabled:true,origins:['https://tendev.pages.dev','http://localhost:3000'],apiKey:'fixture-secret-never-real',keyExpiresAt:new Date(state.now+3600000).toISOString(),spendingAuthorized:true,...config},caller,service,jobTools:{async execute(){state.jobCalls++;throw new TenbotError('Synthetic Job access unavailable.',403);}},qwen,fetcher,now:()=>state.now});
 return {handler,state,rows,reservations,owner,archived,caller,service,fetcher};
}
