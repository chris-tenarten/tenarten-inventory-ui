// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {answer,resolveInput,requiredInferencePermissions,TenbotError,type InferenceProvider,type InferenceInput} from './tenbot-core.ts';
type Rpc=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
export async function handleTenbot(body:Record<string,unknown>,userId:string,caller:Rpc,service:Rpc,provider:InferenceProvider|null,_legacyBudget?:number){
 // Retained call compatibility only; the atomic database policy is authoritative.
 void _legacyBudget;
 const call=async(rpc:Rpc,name:string,args:Record<string,unknown>={})=>{const r=await rpc(name,args);if(r.error)throw new TenbotError(name==='tenbot_reserve_usage'?'TenBot shared usage limit or inference budget reached. Please retry later.':'TenBot could not complete this action.',name==='tenbot_reserve_usage'?429:403);return r.data;};
 const allowed=await call(caller,'has_app_capability',{p_capability:'readOperationalData'});if(allowed!==true)throw new TenbotError('Your account is not authorized.',403);
 if(body.action==='usage'){
  if(await call(caller,'has_app_capability',{p_capability:'manageUsers'})!==true)throw new TenbotError('Your account is not authorized.',403);
  const usage=await call(caller,'tenbot_usage_summary');
  return {usage};
 }
 if(body.action==='submit')return {id:await call(caller,'tenbot_submit_feedback',{p_draft:body.draft,p_confirmed:body.confirmed===true})};
 if(body.action==='list')return {items:await call(caller,'tenbot_list_feedback',{p_status:body.status||'',p_module:body.module||''})};
 if(body.action==='review')return {result:await call(caller,'tenbot_review_feedback',{p_id:body.id,p_status:body.status,p_note:body.note||''})};
 if(!['ask','draft'].includes(String(body.action)))throw new TenbotError('Unknown TenBot action.');
 const permissions=new Set<string>();
 // Resolve only relevant public guide gates; the Proposal workspace has its
 // own existing grant RPC, not an invented app-capability name.
 const resolved=resolveInput(body),matches=[...resolved.entries,...resolved.directEntries];
 for(const permission of requiredInferencePermissions(matches)){
  const allowed=permission==='proposal.access'?await call(caller,'has_proposal_access'):await call(caller,'has_app_capability',{p_capability:permission});
  if(allowed===true)permissions.add(permission);
 }
 let reservation:unknown=null,model:string|null=null,inputForUsage:InferenceInput|null=null;
 const finish=async(outcome:'completed'|'failed')=>{
  const measured=inputForUsage?provider?.usage?.(inputForUsage):null;
  // Metering is provider-owned server telemetry, never fields from the request
  // or generated prose. Unknown/failed usage retains its original reservation.
  const valid=measured&&measured.model===model&&Number.isSafeInteger(measured.inputTokens)&&measured.inputTokens>=0&&Number.isSafeInteger(measured.outputTokens)&&measured.outputTokens>=0&&Number.isFinite(measured.estimatedNeurons)&&measured.estimatedNeurons>=0;
  await call(service,'tenbot_finish_usage',{p_id:reservation,p_outcome:outcome,p_model:model,
   p_input_tokens:valid?measured.inputTokens:null,p_output_tokens:valid?measured.outputTokens:null,p_estimated_neurons:valid?measured.estimatedNeurons:null});
 };
 try{const result=await answer(body,permissions,provider,async(input)=>{
  const estimate=provider?.reserveEstimate?.(input);
  if(!estimate||!Number.isFinite(estimate.neurons)||estimate.neurons<=0||!estimate.model)throw new TenbotError('TenBot metering is unavailable. Please use direct search.',503);
  model=estimate.model;
  inputForUsage=input;
  reservation=await call(service,'tenbot_reserve_usage',{p_user:userId,p_model:model,p_reserved_neurons:estimate.neurons});
 });
 if(reservation)await finish('completed');return result;
 }catch(e){if(reservation)await finish('failed').catch(()=>{});throw e;}
}
