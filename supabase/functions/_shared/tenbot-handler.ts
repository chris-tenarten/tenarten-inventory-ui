// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {answer,resolveInput,requiredInferencePermissions,TenbotError,type InferenceProvider,type InferenceInput} from './tenbot-core.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {validFeedbackDraft,serverConversationContext,safeText} from './tenbot-privacy.ts';
type Rpc=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
export async function handleTenbot(body:Record<string,unknown>,userId:string,caller:Rpc,service:Rpc,provider:InferenceProvider|null,_legacyBudget?:number){
 // Retained call compatibility only; the atomic database policy is authoritative.
 void _legacyBudget;
 const call=async(rpc:Rpc,name:string,args:Record<string,unknown>={})=>{const r=await rpc(name,args);if(r.error)throw new TenbotError(name==='tenbot_reserve_usage'?'TenBot shared usage limit or inference budget reached. Please retry later.':'TenBot could not complete this action.',name==='tenbot_reserve_usage'?429:403);return r.data;};
 const allowed=await call(caller,'has_app_capability',{p_capability:'readOperationalData'});if(allowed!==true)throw new TenbotError('Your account is not authorized.',403);
 if(body.action==='clear'){
  if(typeof body.conversationId!=='string'||!uuid.test(body.conversationId))throw new TenbotError('Invalid conversation request.');
  if(await call(caller,'tenbot_clear_conversation',{p_conversation_id:body.conversationId})!==true)throw new TenbotError('Conversation unavailable.',403);
  return {cleared:true};
 }
 if(body.action==='usage'){
  if(await call(caller,'has_app_capability',{p_capability:'manageUsers'})!==true)throw new TenbotError('Your account is not authorized.',403);
  const usage=await call(caller,'tenbot_usage_summary');
  return {usage};
 }
 if(body.action==='submit'){
  if(body.confirmed!==true||!validFeedbackDraft(body.draft))throw new TenbotError('Review and confirm the complete suggestion before submitting.');
  const id=await call(caller,'tenbot_submit_feedback',{p_draft:body.draft,p_confirmed:true});
  if(typeof id!=='string')throw new TenbotError('The suggestion was not saved. Review it and retry.');
  return {id};
 }
 if(body.action==='list'||body.action==='review'){
  if(await call(caller,'has_app_capability',{p_capability:'manageUsers'})!==true)throw new TenbotError('Your account is not authorized.',403);
  if(body.action==='list'){
   if(!safeText(body.status||'',80,false)||!safeText(body.module||'',120,false))throw new TenbotError('Invalid feedback filter.');
   return {items:await call(caller,'tenbot_list_feedback',{p_status:body.status||'',p_module:body.module||''})};
  }
  if(typeof body.id!=='string'||!uuid.test(body.id)||!['New','Needs Clarification','Under Consideration','Backlogged','Declined','Shipped'].includes(String(body.status))||!safeText(body.note||'',1200,false))throw new TenbotError('Invalid feedback review.');
  return {result:await call(caller,'tenbot_review_feedback',{p_id:body.id,p_status:body.status,p_note:body.note||''})};
 }
 if(!['ask','draft'].includes(String(body.action)))throw new TenbotError('Unknown TenBot action.');
 const permissions=new Set<string>();
 // Resolve only relevant public guide gates; the Proposal workspace has its
 // own existing grant RPC, not an invented app-capability name.
 resolveInput(body); // Reject caller-authored prior turns before any history access.
 if(body.conversationId!==undefined&&(typeof body.conversationId!=='string'||!uuid.test(body.conversationId)))throw new TenbotError('Invalid conversation request.');
 const conversation=await call(caller,'tenbot_load_conversation',{p_conversation_id:body.conversationId??null}) as Conversation;
 if(!conversation?.ok||conversation.ownerId!==userId||!uuid.test(conversation.id))throw new TenbotError('Conversation unavailable. Reopen TenBot and retry.',403);
 const history=serverConversationContext(conversation.turns);
 const resolved=resolveInput(body,history),matches=[...resolved.entries,...resolved.directEntries];
 for(const permission of requiredInferencePermissions(matches)){
  const allowed=permission==='proposal.access'?await call(caller,'has_proposal_access'):await call(caller,'has_app_capability',{p_capability:permission});
  if(allowed===true)permissions.add(permission);
 }
 let reservation:unknown=null,model:string|null=null,inputForUsage:InferenceInput|null=null,finishAttempted=false;
 const finish=async(outcome:'completed'|'failed')=>{
  // A failed finish RPC leaves the reservation conservative. Do not retry it
  // under another outcome or turn that persistence error into an AI fallback.
  finishAttempted=true;
  const measured=inputForUsage?provider?.usage?.(inputForUsage):null;
  // Metering is provider-owned server telemetry, never fields from the request
  // or generated prose. Unknown/failed usage retains its original reservation.
  const valid=measured&&measured.model===model&&Number.isSafeInteger(measured.inputTokens)&&measured.inputTokens>=0&&Number.isSafeInteger(measured.outputTokens)&&measured.outputTokens>=0&&Number.isFinite(measured.estimatedNeurons)&&measured.estimatedNeurons>=0;
  await call(service,'tenbot_finish_usage',{p_id:reservation,p_outcome:outcome,p_model:model,
   p_input_tokens:valid?measured.inputTokens:null,p_output_tokens:valid?measured.outputTokens:null,p_estimated_neurons:valid?measured.estimatedNeurons:null});
 };
 try{
 let result;
 try{result=await answer(body,permissions,provider,async(input)=>{
  const estimate=provider?.reserveEstimate?.(input);
  if(!estimate||!Number.isFinite(estimate.neurons)||estimate.neurons<=0||!estimate.model)throw new TenbotError('TenBot metering is unavailable. Please use direct search.',503);
  model=estimate.model;
  inputForUsage=input;
  reservation=await call(service,'tenbot_reserve_usage',{p_user:userId,p_model:model,p_reserved_neurons:estimate.neurons});
 },history);
 }catch(e){
  if(reservation)await finish('failed').catch(()=>{});
  // Reuse this authenticated owner's loaded history/version and permissions.
  // Only inference/answer failures on ask fall back; never reload history,
  // retry the model, or mask an authorization/input/persistence conflict.
  if(!provider||body.action!=='ask'||!(e instanceof TenbotError)||![429,502,503].includes(e.status))throw e;
  result={...await answer(body,permissions,null,async()=>{throw new TenbotError('Direct guidance cannot reserve inference.',503);},history),fallback:true};
 }
 if(body.action==='ask'){
  const prose=result.mode==='guide'?result.sources.map(source=>source.guidance).join(' ')||result.message:result.message;
  const saved=await call(service,'tenbot_append_conversation_turn',{p_user:userId,p_conversation_id:conversation.id,p_expected_version:conversation.version,p_question:resolved.question,p_answer:prose.slice(0,1600)});
  if(saved!==true)throw new TenbotError('Conversation changed. Reopen TenBot and retry.',409);
 }
 if(reservation&&!finishAttempted)await finish('completed');return {...result,conversationId:conversation.id};
 }catch(e){if(reservation&&!finishAttempted)await finish('failed').catch(()=>{});throw e;}
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Conversation={ok:boolean;id:string;ownerId:string;version:number;turns:{question:string;answer:string}[]};
