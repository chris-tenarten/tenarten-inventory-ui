import {supabase} from '@/lib/supabase';
import {loadCompleteRows} from '@/lib/complete-rows';
import {loadScopedRows} from '@/lib/scoped-rows';
import type {ScopeCapture,ScopeLine,SourceOption,Requirement,Assessment} from './contracts';
export async function invoke<T>(body:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.functions.invoke('generate-sample-pdf',{body});if(error){if('context' in error&&error.context instanceof Response){const detail=await error.context.json().catch(()=>null);throw new Error(detail?.error||error.message);}throw error;}if(data?.error)throw new Error(data.error);return data as T;}
export async function scopeSources(bidId:string){const r=await supabase.rpc('list_bid_scope_sources',{p_bid_id:bidId});if(r.error)throw r.error;return r.data as SourceOption[];}
/** Label eligible Blend references using their existing immutable issuance metadata. */
export async function governingSources(bidId:string){
 const options=await scopeSources(bidId),ids=options.filter(option=>option.kind==='blend').map(option=>option.id);
 const plans=await loadScopedRows<{id:string;revision:number;issued_at:string|null;created_at:string}>(ids,(scope,from,to)=>supabase.from('production_blend_plans').select('id,revision,issued_at,created_at',{count:'exact'}).in('id',scope!).order('id').range(from,to));
 return options.map(option=>{const plan=option.kind==='blend'?plans.find(plan=>plan.id===option.id):null;return plan?{...option,label:`${option.label} · r${plan.revision} · ${new Date(plan.issued_at||plan.created_at).toLocaleString()}`}:option;});
}
export async function scopeHistory(bidId:string){return await loadCompleteRows((from,to)=>supabase.from('bid_scope_captures').select('*',{count:'exact'}).eq('bid_id',bidId).order('revision',{ascending:false}).range(from,to)) as ScopeCapture[];}
export const previewScope=(bidId:string,proposalId:string,lines:ScopeLine[])=>invoke<{requirements:Requirement[];unresolved:string[];context:{sources:Record<string,unknown>[]}}>({action:'scope-preview',bidId,proposalId,lines});
export const acceptScope=(bidId:string,proposalId:string,lines:ScopeLine[],expectedScopeId:string|null,evidence:string)=>invoke<ScopeCapture>({action:'scope-accept',bidId,proposalId,lines,expectedScopeId,evidence});
export const assessScope=(scopeId:string)=>invoke<{assessment:Assessment[];assessedAt:string}>({action:'scope-assess',scopeId});
export async function materialSupply(){const r=await supabase.rpc('bid_material_supply');if(r.error)throw r.error;return r.data as {inventory:Record<string,unknown>[];incoming:Record<string,unknown>[];assessed_at:string};}

export type IntakeWorkflowSummary={id:string;production_job_id:string|null;accepted_revision:number|null;unresolved_count:number|null};
export async function workflowSummaries(){return await loadCompleteRows((from,to)=>supabase.rpc('intake_workflow_summaries',{}, {count:'exact'}).order('id').range(from,to)) as IntakeWorkflowSummary[];}
