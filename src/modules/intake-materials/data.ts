import {supabase} from '@/lib/supabase';
import {loadCompleteRows} from '@/lib/complete-rows';
import type {ScopeCapture,ScopeLine,SourceOption,Requirement,Assessment} from './contracts';
export async function invoke<T>(body:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.functions.invoke('generate-sample-pdf',{body});if(error){if('context' in error&&error.context instanceof Response){const detail=await error.context.json().catch(()=>null);throw new Error(detail?.error||error.message);}throw error;}if(data?.error)throw new Error(data.error);return data as T;}
export async function scopeSources(bidId:string){const r=await supabase.rpc('list_bid_scope_sources',{p_bid_id:bidId});if(r.error)throw r.error;return r.data as SourceOption[];}
export async function scopeHistory(bidId:string){return await loadCompleteRows((from,to)=>supabase.from('bid_scope_captures').select('*',{count:'exact'}).eq('bid_id',bidId).order('revision',{ascending:false}).range(from,to)) as ScopeCapture[];}
export const previewScope=(bidId:string,proposalId:string,lines:ScopeLine[])=>invoke<{requirements:Requirement[];unresolved:string[]}>({action:'scope-preview',bidId,proposalId,lines});
export const acceptScope=(bidId:string,proposalId:string,lines:ScopeLine[],expectedScopeId:string|null,evidence:string)=>invoke<ScopeCapture>({action:'scope-accept',bidId,proposalId,lines,expectedScopeId,evidence});
export const assessScope=(scopeId:string)=>invoke<{assessment:Assessment[];assessedAt:string}>({action:'scope-assess',scopeId});
export async function materialSupply(){const r=await supabase.rpc('bid_material_supply');if(r.error)throw r.error;return r.data as {inventory:Record<string,unknown>[];incoming:Record<string,unknown>[];assessed_at:string};}

export type IntakeWorkflowSummary={id:string;production_job_id:string|null;accepted_revision:number|null;unresolved_count:number|null};
export async function workflowSummaries(){return await loadCompleteRows((from,to)=>supabase.rpc('intake_workflow_summaries',{}, {count:'exact'}).order('id').range(from,to)) as IntakeWorkflowSummary[];}
