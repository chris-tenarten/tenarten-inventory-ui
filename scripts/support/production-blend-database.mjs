import {readFileSync} from 'node:fs';
import {startDatabase,sql,asUser,literal,json,admin,member} from './sample-batch-database.mjs';
export {sql,asUser,literal,json,admin,member};
export const blendMigration='20261005150000_production_blend_plans.sql';
export function startBlendDatabase(name){
 startDatabase(name);
 for(const f of ['20260902_001_sample_draft_deletion.sql','20260902_005_sample_recent_value_suggestions.sql','20260917_003_sample_deletion_lifecycle.sql','20260917_006_sample_admin_draft_deletion.sql','20261001010000_sample_batch_first_authority.sql','20261001013000_sample_batch_first_history.sql','20261001150000_sample_batch_filler_override.sql','20261001160000_sample_four_to_one_baseline_correction.sql','20261002120000_sample_normal_resin_profiles.sql'])sql(name,readFileSync('supabase/migrations/'+f,'utf8'));
 sql(name,readFileSync('supabase/migrations/'+blendMigration,'utf8'));
 // The minimal established bootstrap omits baseline schema USAGE and app_users SELECT grants.
 sql(name,'grant usage on schema public,auth to authenticated,service_role; grant select on app_users to authenticated;');
}
// Local adapter executes real database functions and tables; no hosted traffic.
export function blendClients(container,actor=admin){
 const call=q=>sql(container,asUser('select '+q,actor));const parsed=q=>JSON.parse(call(q));
 const rpc=async(name,args={})=>{try{
  if(name==='get_my_app_user')return {data:parsed(`coalesce(jsonb_agg(u),'[]') from app_users u where user_id=${literal(actor)}`)};
  if(name==='get_sample_working_pdf_snapshot')return {data:parsed(`get_sample_working_pdf_snapshot(${literal(args.p_sample_id)},null)`)};
  if(name==='persist_production_blend'){
   const a=args;return {data:parsed(`persist_production_blend(${literal(a.p_actor)},${a.p_id?literal(a.p_id):'null'},${a.p_revision??'null'},${literal(a.p_sample_id)},${a.p_source_document_id?literal(a.p_source_document_id):'null'},${json(a.p_source_snapshot)},${json(a.p_inputs)},${json(a.p_model)},${a.p_issue})`)};
  }throw new Error('Unsupported RPC '+name);
 }catch(e){return {error:{message:e.message}};}};
 const client={rpc,auth:{getUser:async()=>({data:{user:{id:actor}}})},from:table=>{
  if(!['production_blend_plans','sample_issued_documents'].includes(table))throw new Error('Unexpected table');let filters=[];
  const q={select:()=>q,eq:(key,value)=>{if(!['id','sample_id'].includes(key))throw new Error('Unexpected filter');filters.push(`${key}=${literal(value)}`);return q;},single:async()=>{try{return {data:parsed(`to_jsonb(t) from ${table} t where ${filters.join(' and ')}`)}}catch(e){return {error:e}};},order:async()=>({data:parsed(`coalesce(jsonb_agg(t order by created_at desc),'[]') from ${table} t where ${filters.join(' and ')}`)})};return q;
 }};return {user:client,service:{rpc}};
}
