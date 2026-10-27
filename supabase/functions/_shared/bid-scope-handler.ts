// @ts-nocheck -- Deno Edge boundary; validated with real PostgreSQL callers.
import {deriveRequirements,assessRequirements} from '../../../src/modules/intake-materials/requirements.ts';
import type {ScopeLine,Requirement} from '../../../src/modules/intake-materials/contracts.ts';
// Uses the authenticated caller for every read; only calculated captures use service credentials.
export async function handleBidScope({user,service,body,headers}: {user:any;service:any;body:any;headers:Record<string,string>}) { // eslint-disable-line @typescript-eslint/no-explicit-any
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  if(!['scope-preview','scope-accept','scope-assess','historical-complete'].includes(body.action))throw new Error('Unsupported scope operation');
  if(body.action==='historical-complete'){
   const actor=await user.auth.getUser();if(actor.error||!actor.data.user)throw new Error('Authentication required');
   const original=await user.from('historical_sample_imports').select('*').eq('id',body.importId).single();if(original.error||original.data?.created_by!==actor.data.user.id)throw new Error('Original evidence is unavailable');
   const bytes=await user.storage.from('historical-samples').download(original.data.storage_path);if(bytes.error)throw bytes.error;
   if(bytes.data.size!==Number(original.data.byte_size))throw new Error('Original size differs from recorded evidence');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await bytes.data.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');
   // Only transcription fields are editable; privileged identity/evidence parameters stay server-bound.
   const result=await service.rpc('persist_historical_sample',{p_actor:actor.data.user.id,p_import_id:original.data.id,p_sha256:digest,p_sample:body.payload?.p_sample,p_rows:body.payload?.p_rows,p_sample_name:body.payload?.p_sample_name});if(result.error)throw result.error;return reply(result.data);
  }
  if(body.action==='scope-assess'){
   const record=await user.from('bid_scope_captures').select('*').eq('id',body.scopeId).single();if(record.error||!record.data)throw new Error('Accepted scope is unavailable');
   const supply=await user.rpc('bid_material_supply');if(supply.error)throw supply.error;
   const bid=await user.from('bids').select('production_job_id').eq('id',record.data.bid_id).single();if(bid.error)throw bid.error;
   const catalog={};
   for(const requirement of record.data.requirements){
    if(!requirement.catalogItemId||!['standard','specialty'].includes(requirement.catalogSource))continue;
    const specialty=requirement.catalogSource==='specialty';const fields=specialty?'vendor_name,vendor_sku,packaging,unit_size,unit_size_uom,lead_time_days':'vendor,unit';
    const reference=await user.from(specialty?'vendor_catalog_v2':'vendor_catalog').select(fields).eq('id',requirement.catalogItemId).maybeSingle();
    if(reference.error||!reference.data)continue;const c=reference.data;
    catalog[requirement.key]={vendor:String(c.vendor_name??c.vendor??''),leadTimeDays:c.lead_time_days==null?null:Number(c.lead_time_days),packageInfo:String(c.packaging??c.unit??''),evidence:`Linked ${requirement.catalogSource} catalog record${c.vendor_sku?' · SKU '+c.vendor_sku:''}; observed ${supply.data.assessed_at}; supplier estimate, not a commitment`};
   }
   return reply({assessedAt:supply.data.assessed_at,assessment:assessRequirements(record.data.requirements as Requirement[],supply.data.inventory,supply.data.incoming,bid.data.production_job_id,catalog)});
  }
  const context=await user.rpc('bid_scope_context',{p_bid_id:body.bidId,p_proposal_id:body.proposalId||null,p_lines:body.lines});if(context.error)throw context.error;
  const calculated=deriveRequirements(body.lines as ScopeLine[],context.data.sources);
  if(!body.proposalId)calculated.unresolved.push('Accepted Proposal revision is not selected.');
  if(body.action==='scope-preview')return reply({...calculated,context:context.data});
  const actor=await user.auth.getUser();if(actor.error||!actor.data.user)throw new Error('Authentication required');
  const result=await service.rpc('persist_bid_scope',{p_actor:actor.data.user.id,p_expected_scope_id:body.expectedScopeId||null,p_proposal_id:body.proposalId||null,p_lines:body.lines,p_context:context.data,p_evidence:body.evidence,p_requirements:calculated.requirements,p_unresolved:calculated.unresolved});if(result.error)throw result.error;
  return reply(result.data);
 }catch(error){return reply({error:error instanceof Error?error.message:String((error as {message?:string})?.message||'Scope operation failed')},422);}
}
