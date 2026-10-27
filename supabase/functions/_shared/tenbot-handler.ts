// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; Next excludes Edge sources.
import {answer,resolveInput,TenbotError,type InferenceProvider} from './tenbot-core.ts';
type Rpc=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
export async function handleTenbot(body:Record<string,unknown>,userId:string,caller:Rpc,service:Rpc,provider:InferenceProvider|null,budget:number){
 const call=async(rpc:Rpc,name:string,args:Record<string,unknown>={})=>{const r=await rpc(name,args);if(r.error)throw new TenbotError(name==='tenbot_reserve_usage'?'TenBot shared usage limit or monthly budget reached. Please retry later.':'TenBot could not complete this action.',name==='tenbot_reserve_usage'?429:403);return r.data;};
 const allowed=await call(caller,'has_app_capability',{p_capability:'readOperationalData'});if(allowed!==true)throw new TenbotError('Your account is not authorized.',403);
 if(body.action==='usage'){
  if(await call(caller,'has_app_capability',{p_capability:'manageUsers'})!==true)throw new TenbotError('Your account is not authorized.',403);
  const usage=await call(caller,'tenbot_usage_summary');
  return {usage:{...usage as Record<string,unknown>,monthlyBudgetUsd:Number.isFinite(budget)&&budget>0?budget:0}};
 }
 if(body.action==='submit')return {id:await call(caller,'tenbot_submit_feedback',{p_draft:body.draft,p_confirmed:body.confirmed===true})};
 if(body.action==='list')return {items:await call(caller,'tenbot_list_feedback',{p_status:body.status||'',p_module:body.module||''})};
 if(body.action==='review')return {result:await call(caller,'tenbot_review_feedback',{p_id:body.id,p_status:body.status,p_note:body.note||''})};
 if(!['ask','draft'].includes(String(body.action)))throw new TenbotError('Unknown TenBot action.');
 const permissions=new Set<string>();
 // Resolve only relevant public guide gates; the Proposal workspace has its
 // own existing grant RPC, not an invented app-capability name.
 const matches=resolveInput(body).entries;
 for(const permission of new Set(matches.flatMap(e=>[e.permission,...e.additionalPermissions||[]]))){
  const allowed=permission==='proposal.access'?await call(caller,'has_proposal_access'):await call(caller,'has_app_capability',{p_capability:permission});
  if(allowed===true)permissions.add(permission);
 }
 let reservation:unknown=null;
 try{const result=await answer(body,permissions,provider,async()=>{reservation=await call(service,'tenbot_reserve_usage',{p_user:userId,p_monthly_usd:budget});});
 if(reservation)await call(service,'tenbot_finish_usage',{p_id:reservation,p_outcome:'completed'});return result;
 }catch(e){if(reservation)await call(service,'tenbot_finish_usage',{p_id:reservation,p_outcome:'failed'}).catch(()=>{});throw e;}
}
