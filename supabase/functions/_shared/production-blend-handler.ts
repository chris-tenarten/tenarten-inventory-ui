// @ts-nocheck -- shared Edge handler; integration tested with disposable PostgreSQL.
import {diagnosticResponse} from './sample-diagnostics.mjs';
import {buildProductionBlend} from './production-blend.mjs';
import {renderProductionBlend} from './production-blend-pdf.ts';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function handleProductionBlend({user,service,body,headers}){
 const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 const correlationId=crypto.randomUUID();let stage='authorization',diagnosticSnapshot=null;
 const failure=async(error,status)=>reply({error:stage==='pdf-render'?'Blend Sheet could not be rendered.':stage==='snapshot-persistence'?'Blend Sheet could not be saved.':error.message||'Unable to process Production Blend.',...await diagnosticResponse(user,error,stage,{correlationId,state:diagnosticSnapshot?.formulation_state??diagnosticSnapshot?.formulation,source:diagnosticSnapshot?'captured-snapshot':undefined})},status);
 const {data:allowed,error}=await user.rpc('has_app_capability',{p_capability:'production_blend.manage'});
 if(error||allowed!==true)return failure(new Error('Production Blend planning access is required.'),403);
 try{
  stage='request-validation';const action=body.action;
  if(!['blend-context','blend-list','blend-save','blend-issue','blend-pdf'].includes(action))return failure(new Error('Unsupported Production Blend action.'),400);
  stage='source-load';let plan=null;
  if(body.planId){if(!uuid(body.planId))throw new Error('Invalid plan identifier.');const r=await user.from('production_blend_plans').select('*').eq('id',body.planId).single();if(r.error||!r.data)throw new Error('Plan not found.');plan=r.data;}
  if(action==='blend-list'){if(!uuid(body.sampleId))throw new Error('Invalid Sample identifier.');let query=user.from('production_blend_plans').select(body.metadata?'id,status,created_at,identity:model->>identity,project:model->>project,job:model->>job,planned_quantity:model->>plannedQuantity':'*').eq('sample_id',body.sampleId).order('created_at',{ascending:false});if(body.latest===true)query=query.eq('status','issued').limit(1);const r=await query;if(r.error)throw r.error;return reply(r.data);}
  if(action==='blend-pdf'){diagnosticSnapshot=plan?.source_snapshot;stage='pdf-render';if(!plan)throw new Error('Save the plan before generating.');return new Response(await renderProductionBlend(plan),{headers:{...headers,'Content-Type':'application/pdf','Cache-Control':'no-store','Content-Disposition':'inline; filename="Production-Blend-Sheet.pdf"'}});}
  if(plan?.status==='issued'&&action!=='blend-context')throw new Error('Issued Production Blend Sheets are immutable.');
  let snapshot=plan?.source_snapshot,sourceDocumentId=plan?.source_document_id??null,sampleId=plan?.sample_id??body.sampleId;
  if(!snapshot){
   if(!uuid(sampleId))throw new Error('Invalid Sample identifier.');
   if(body.documentId){if(!uuid(body.documentId))throw new Error('Invalid issued formulation.');const r=await user.from('sample_issued_documents').select('issued_snapshot,issue_number,sample_id').eq('id',body.documentId).single();if(r.error||r.data?.sample_id!==sampleId)throw new Error('Issued formulation does not belong to this Sample.');snapshot={...r.data.issued_snapshot,issue_number:r.data.issue_number};sourceDocumentId=body.documentId;}
   else{const r=await user.rpc('get_sample_working_pdf_snapshot',{p_sample_id:sampleId,p_version_id:null});if(r.error||!r.data)throw new Error(r.error?.message||'Saved Sample not found.');snapshot=r.data;}
  }
  if(action==='blend-context')return reply({snapshot,plan});
  if(!plan&&body.expectedSourceUpdatedAt&&snapshot.updated_at!==body.expectedSourceUpdatedAt)throw new Error('Source formulation changed; create a new plan to review the current capture.');
  const inputs={batchCount:body.inputs?.batchCount,plannedQuantity:body.inputs?.plannedQuantity,blendSize:body.inputs?.blendSize};
  diagnosticSnapshot=snapshot;stage='blend-calculation';const model=buildProductionBlend(snapshot,inputs);
  if(action==='blend-issue'&&model.warnings.length)throw new Error(model.warnings[0]+' Correct it before issue.');
  stage='authorization';const actor=await user.auth.getUser();if(actor.error||!actor.data.user)throw new Error('Authentication required.');
  stage='snapshot-persistence';const result=await service.rpc('persist_production_blend',{p_actor:actor.data.user.id,p_id:plan?.id??null,p_revision:body.revision??null,p_sample_id:sampleId,p_source_document_id:sourceDocumentId,p_source_snapshot:snapshot,p_inputs:inputs,p_model:model,p_issue:action==='blend-issue'});
  if(result.error)throw new Error(result.error.message);return reply(result.data);
 }catch(error){return failure(error,422);}
}
