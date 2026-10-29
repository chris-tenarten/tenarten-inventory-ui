// A narrow persistence adapter for proven TenBot workflow/scope dialogue only.
// The caller JWT claims/clears its own conversation; only the trusted server can
// publish validated state bound to that exact owner, revision and lease.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared Deno/Node source
// @ts-ignore -- explicit extension for Edge compatibility.
import {TenbotError} from './tenbot-core.ts';
export type KnowledgeProof={id:string;digest:string};
export type StoredGuidanceTurn={question:string;answer:string;sources:KnowledgeProof[]};
export type StoredDisplayAnswer={conversationId:string;mode:'agent-experiment'|'assistant';contentScope:'workflow'|'scope';message:string;sources:never[];snapshot:{revision:string;verifiedAt:string};summary:null;suggestionAllowed:false;notices:never[]};
export type StoredDisplayTurn={id:string;question:string;createdAt:string;answeredAt:string;answer:StoredDisplayAnswer;sources:KnowledgeProof[];scopeDigest:string};
export type StoredAgentState={guidance:StoredGuidanceTurn[];display:StoredDisplayTurn[]};
export type AgentSessionLease={id:string;owner:string;revision:number;claim:string;expiresAt:number;state:StoredAgentState};
export type AgentSessionStore={
 claim(owner:string,id?:string):Promise<AgentSessionLease>;
 commit(lease:AgentSessionLease,state:StoredAgentState,renew:boolean):Promise<void>;
 release(lease:AgentSessionLease):Promise<void>;
 clear(owner:string,id:string):Promise<void>;
};
export type AgentHistoryRpc=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=/^[a-f0-9]{64}$/;
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value:Record<string,unknown>,expected:string[])=>Object.keys(value).length===expected.length&&Object.keys(value).every(key=>expected.includes(key));
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const timestamp=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const empty=(value:unknown)=>Array.isArray(value)&&value.length===0;
const proofs=(value:unknown):value is KnowledgeProof[]=>Array.isArray(value)&&value.length<=12&&value.every(item=>record(item)&&keys(item,['id','digest'])&&text(item.id,160)&&typeof item.digest==='string'&&digest.test(item.digest));
/** Reject native continuations, live facts, tool payloads and arbitrary keys. */
export function validateStoredAgentState(value:unknown):value is StoredAgentState{
 if(!record(value)||!keys(value,['guidance','display'])||new TextEncoder().encode(JSON.stringify(value)).byteLength>64000)return false;
 if(!Array.isArray(value.guidance)||value.guidance.length>3||!value.guidance.every(turn=>record(turn)&&keys(turn,['question','answer','sources'])&&text(turn.question,1200)&&text(turn.answer,2400)&&proofs(turn.sources)&&turn.sources.length>0))return false;
 if(!Array.isArray(value.display)||value.display.length>8)return false;
 return value.display.every(turn=>{
  if(!record(turn)||!keys(turn,['id','question','createdAt','answeredAt','answer','sources','scopeDigest'])||typeof turn.id!=='string'||!uuid.test(turn.id)||!text(turn.question,1200)||!timestamp(turn.createdAt)||!timestamp(turn.answeredAt)||!proofs(turn.sources)||typeof turn.scopeDigest!=='string'||!digest.test(turn.scopeDigest))return false;
  const answer=turn.answer;
  return record(answer)&&keys(answer,['conversationId','mode','contentScope','message','sources','snapshot','summary','suggestionAllowed','notices'])&&typeof answer.conversationId==='string'&&uuid.test(answer.conversationId)&&['agent-experiment','assistant'].includes(String(answer.mode))&&['workflow','scope'].includes(String(answer.contentScope))&&text(answer.message,2400)&&empty(answer.sources)&&record(answer.snapshot)&&keys(answer.snapshot,['revision','verifiedAt'])&&text(answer.snapshot.revision,100)&&timestamp(answer.snapshot.verifiedAt)&&answer.summary===null&&answer.suggestionAllowed===false&&empty(answer.notices)&&(answer.contentScope!=='workflow'||turn.sources.length>0);
 });
}
export function createTenbotAgentHistoryStore(caller:AgentHistoryRpc,service:AgentHistoryRpc):AgentSessionStore{
 const call=async(rpc:AgentHistoryRpc,name:string,args:Record<string,unknown>)=>{const result=await rpc(name,args);if(result.error)throw new TenbotError('Conversation storage is unavailable. Please retry later.',503);return result.data;};
 return {
  async claim(owner,id){
   if(!uuid.test(owner)||id!==undefined&&!uuid.test(id))throw new TenbotError('Invalid conversation request.');
   const data=await call(caller,'tenbot_agent_claim',{p_conversation_id:id??null});
   if(!record(data)||data.ok!==true){
    if(record(data)&&data.reason==='busy')throw new TenbotError('A request is already running in this conversation.',409);
    if(record(data)&&data.reason==='limit')throw new TenbotError('TenBot conversation limit reached.',429);
    throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
   }
   if(data.ownerId!==owner||typeof data.id!=='string'||!uuid.test(data.id)||id!==undefined&&data.id!==id||typeof data.claim!=='string'||!uuid.test(data.claim)||!Number.isSafeInteger(data.revision)||Number(data.revision)<0||!timestamp(data.expiresAt))throw new TenbotError('Conversation storage is unavailable.',503);
   try{
    // The public caller RPC returns metadata only. Raw stored prose must not be
    // obtainable by bypassing the Edge source/grant revalidation below it.
    const state=await call(service,'tenbot_agent_load',{p_user:owner,p_conversation_id:data.id,p_claim:data.claim,p_revision:data.revision});
    if(!validateStoredAgentState(state)||state.display.some(turn=>turn.answer.conversationId!==data.id))throw new TenbotError('Conversation storage is unavailable.',503);
    return {id:data.id,owner,revision:Number(data.revision),claim:data.claim,expiresAt:Date.parse(String(data.expiresAt)),state:structuredClone(state)};
   }catch(error){
    await call(caller,'tenbot_agent_release',{p_conversation_id:data.id,p_claim:data.claim,p_revision:data.revision});throw error;
   }
  },
  async commit(lease,state,renew){
   if(!validateStoredAgentState(state)||state.display.some(turn=>turn.answer.conversationId!==lease.id))throw new TenbotError('Conversation storage rejected the update.',503);
   const data=await call(service,'tenbot_agent_commit',{p_user:lease.owner,p_conversation_id:lease.id,p_claim:lease.claim,p_revision:lease.revision,p_state:state,p_renew:renew});
   if(data!==true)throw new TenbotError('Conversation changed or access expired. Reopen TenBot and retry.',409);
  },
  async release(lease){if(await call(caller,'tenbot_agent_release',{p_conversation_id:lease.id,p_claim:lease.claim,p_revision:lease.revision})!==true)throw new TenbotError('Conversation release is unavailable. Please retry later.',503);},
  async clear(owner,id){
   if(!uuid.test(owner)||!uuid.test(id))throw new TenbotError('Invalid conversation request.');
   if(await call(caller,'tenbot_agent_clear',{p_conversation_id:id})!==true)throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
  },
 };
}
