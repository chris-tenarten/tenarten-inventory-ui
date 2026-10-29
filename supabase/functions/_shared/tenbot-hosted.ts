/** Hosted read-only construction. Models receive neither a database client nor secrets. */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {createTenbotAgentSessions,HostedAgentUnavailable} from './tenbot-agent-session.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {createTenbotAgentHistoryStore} from './tenbot-agent-history-store.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {createHostedOpenAIMetering} from './tenbot-openai-metering.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {createOpenAIProvider,OPENAI_EXPERIMENT_PRICING} from './tenbot-openai.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {AgentStepError} from './tenbot-agent.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {handleTenbot} from './tenbot-handler.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import {TenbotError,type InferenceProvider} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Node/Deno module
// @ts-ignore -- Edge imports require explicit extensions.
import type {JobTools} from './tenbot-job-session.ts';

export type HostedRpc=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
export type HostedTenbotConfig={enabled:boolean;origins:string[];apiKey:string;keyExpiresAt:string;spendingAuthorized:boolean};
export const TENBOT_HOSTED_SERVICE_RPCS=new Set([
 'tenbot_reserve_usage','tenbot_finish_usage','tenbot_append_conversation_turn',
 'tenbot_openai_reserve','tenbot_openai_settle','tenbot_openai_meter_status',
 'tenbot_agent_load','tenbot_agent_commit',
]);
export function createHostedTenbot(options:{owner:string;origin:string;config:HostedTenbotConfig;caller:HostedRpc;service:HostedRpc;jobTools:JobTools;qwen:InferenceProvider|null;fetcher?:typeof fetch;now?:()=>number}){
 const {owner,caller,service,jobTools,qwen,config}=options,now=options.now??Date.now;
 const enabled=config.enabled&&Boolean(options.origin)&&config.origins.includes(options.origin);
 const can=async(capability:string)=>{
  const result=capability==='proposal.access'?await caller('has_proposal_access'):await caller('has_app_capability',{p_capability:capability});
  return !result.error&&result.data===true;
 };
 const defaultHandler=(body:Record<string,unknown>)=>handleTenbot(body,owner,caller,service,qwen,undefined,jobTools);
 const expires=Date.parse(config.keyExpiresAt);
 const historyStore=createTenbotAgentHistoryStore(caller,service);
 const sessions=enabled?createTenbotAgentSessions({
  can:(_owner,capability)=>_owner===owner?can(capability):Promise.resolve(false),
  jobTools:()=>jobTools,mode:'openai',readOnlyHosted:true,now,
  sessionStore:historyStore,
  provider(){
   // Check on every turn and again before every network dispatch. An operator's
   // verified expiry is a hard upper bound, never evidence of key validity.
   if(!config.spendingAuthorized||config.apiKey.length<16||!Number.isFinite(expires)||expires<=now())return {name:'OpenAI Responses',model:'gpt-6.1-terra',async step(){throw new AgentStepError('provider-not-configured');}};
   const meter=createHostedOpenAIMetering({owner,model:'gpt-6.1-terra',requestId:crypto.randomUUID(),rpc:service});
   return createOpenAIProvider({model:'gpt-6.1-terra',apiKey:config.apiKey,spendingAuthorized:true,pricing:OPENAI_EXPERIMENT_PRICING['gpt-6.1-terra'],reserveBudget:meter.reserveBudget,requireResponseMetadata:true,
    async fetcher(url,init){
     if(expires<=now())throw new AgentStepError('provider-key-expired');
     return (options.fetcher??fetch)(url,init);
    },
   });
  },
 }):null;
 return async(body:Record<string,unknown>)=>{
  if(body.action==='status'){
   if(Object.keys(body).some(key=>key!=='action'))throw new TenbotError('Invalid status request.');
   if(!await can('readOperationalData'))throw new TenbotError('Your account is not authorized.',403);
   return {mode:enabled?'assistant':'qwen',historyAvailable:enabled,readOnly:true};
  }
  if(!sessions)return defaultHandler(body);
  // Hosted read-only routes cannot receive document/prepare/approve/execute
  // fields. Existing explicit Product feedback remains on its normal path.
  if(['ask','history','clear'].includes(String(body.action))){
   const allowed=body.action==='ask'?['action','question','context','conversationId']:['action','conversationId'];
   if(Object.keys(body).some(key=>!allowed.includes(key)))throw new TenbotError('Invalid read-only TenBot request.');
   try{return await sessions(body,owner);}catch(error){
    if(!(error instanceof HostedAgentUnavailable)||body.action!=='ask')throw error;
    // Same authenticated conversation row, separate legacy context. No model
    // continuation, operational evidence or client-replayed history is copied.
    if(!await can('readOperationalData'))throw new TenbotError('Your account is not authorized.',403);
    // Reclaim before fallback so another ask/hydration cannot change the CAS
    // version while Qwen is answering. No inference begins if reclaim fails.
    const lease=await historyStore.claim(owner,error.conversationId);
    try{
     const fallback=await defaultHandler({...body,conversationId:error.conversationId});
     return {...fallback,conversationId:error.conversationId,contentScope:'volatile',fallback:true};
    }finally{
     // Legacy ask appends exactly once, even if later metering fails. Release
     // only our exact claim at the original or known next revision.
     try{await historyStore.release(lease);}catch{await historyStore.release({...lease,revision:lease.revision+1});}
    }
   }
  }
  if(body.action==='refresh-job'){
   if(Object.keys(body).some(key=>!['action','conversationId'].includes(key))||!await can('readOperationalData'))throw new TenbotError('Your account is not authorized.',403);
   // Live operational answers are deliberately not retained in agent history.
   return {expired:true};
  }
  return defaultHandler(body);
 };
}
