// @ts-nocheck -- real disposable PostgreSQL and the production Blend handler.
import assert from 'node:assert/strict';
import {startBlendDatabase,sql,asUser,literal,json,blendClients} from './support/production-blend-database.mjs';
import {docker} from './support/sample-batch-database.mjs';
import {handleProductionBlend} from '../supabase/functions/_shared/production-blend-handler.ts';
import {applyOperationalProfile,canApplyCurrentBatchDefaults,hasCapturedBatchBasis} from '../src/modules/samples/operational-profile-model';
import {SAMPLE_FORMULATION_CALCULATION_VERSION,batchFirstQuantities} from '../src/modules/samples/formulation';
const name=`tenops-batch-capture-${process.pid}`;
try {
 startBlendDatabase(name);
 const call=q=>sql(name,asUser('select '+q)),parse=q=>JSON.parse(call(q));
 const profiles=parse("jsonb_agg(p) from sample_operational_profiles p");
 for(const label of ['MTT','Key Resin','Terroxy']) {
  const p=profiles.find(p=>p.name===label);assert(p, label);assert(canApplyCurrentBatchDefaults(p),label);
 }
 assert(!canApplyCurrentBatchDefaults(profiles.find(p=>p.name==='Cement')));
 assert(!canApplyCurrentBatchDefaults(profiles.find(p=>p.name==='Sherwin')), 'Current Sherwin has unresolved Production binder authority');
 const modernId=call('create_sample()');const untouched=call(`to_jsonb(s)::text from samples s where id=${literal(modernId)}`);
 const id=call('create_sample()'),modern=parse(`formulation_state from samples where id=${literal(id)}`);
 const modernBefore=JSON.stringify(modern);assert(hasCapturedBatchBasis(modern));
 const profile=profiles.find(p=>`operational:${p.id}`===modern.profile.id);
 const legacy=structuredClone(modern);legacy.calculationVersion=SAMPLE_FORMULATION_CALCULATION_VERSION;
 delete legacy.profile.batchContract;delete legacy.profile.batchChipTargetLb;delete legacy.profile.batchReferenceThicknessIn;
 Object.assign(legacy.profile,{dryPoolOzPerCft:'2560',defaultFillerOzPerCft:'512',resinFlOzPerCft:'480'});
 const rows=[...[40,30,20,5,5].map((p,i)=>({color:`Chip ${i+1}`,percentage:String(p),component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total',unit:'oz'})),...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const save=state=>call(`save_sample_draft(${json({id,prepared_by:'Marcos',formulation_state:state})},${json(rows)},'Legacy MTT capture review')`);
 // Model an existing pre-Batch record; normal save must not upgrade it implicitly.
 sql(name,`update samples set formulation_state=${json(legacy)} where id=${literal(id)}`);save(legacy);
 assert(!hasCapturedBatchBasis(parse(`formulation_state from samples where id=${literal(id)}`)));
 const issueId=call(`issue_sample_form(${literal(id)})`);
 const issueBefore=call(`issued_snapshot::text from sample_issued_documents where id=${literal(issueId)}`);
 const inputs={batchCount:1,plannedQuantity:180,blendSize:1000};
 const request=body=>handleProductionBlend({...blendClients(name),body,headers:{}});
 const denied=await request({action:'blend-save',sampleId:id,inputs});assert.equal(denied.status,422);assert.match(await denied.text(),/no authoritative Batch/);
 const upgraded=applyOperationalProfile(legacy,profile);assert(hasCapturedBatchBasis(upgraded));
 const q=batchFirstQuantities(upgraded,[]);assert.equal(Number(upgraded.profile.batchChipTargetLb),180);assert.equal(q.canonical.filler,50);assert.equal(q.canonical.resin,5);assert.equal(q.canonical.hardener,1);assert.equal(Number(upgraded.profile.batchReferenceThicknessIn),.375);assert.equal(Number(upgraded.profile.defaultChipDensityLbCft),128);
 save(upgraded);const reopened=parse(`formulation_state from samples where id=${literal(id)}`);assert.deepEqual(reopened.profile,upgraded.profile);assert(hasCapturedBatchBasis(reopened));assert.equal(reopened.resolvedBatch.chipLb,180);assert.equal(reopened.resolvedBatch.fillerLb,50);
 const allowed=await request({action:'blend-save',sampleId:id,inputs});assert.equal(allowed.status,200,await allowed.clone().text());assert.equal((await allowed.json()).model.batchChipLb,180);
 assert.equal(call(`issued_snapshot::text from sample_issued_documents where id=${literal(issueId)}`),issueBefore);
 const historical=await request({action:'blend-save',sampleId:id,documentId:issueId,inputs});assert.equal(historical.status,422);
 assert.equal(JSON.stringify(modern),modernBefore);
 assert.equal(call(`to_jsonb(s)::text from samples s where id=${literal(modernId)}`),untouched);
 assert(hasCapturedBatchBasis({...modern,batchFillerOverrideLb:'999'}),'Invalid modern overrides must use existing validation, not legacy upgrade guidance');
 assert.equal(call(`formulation_state->'profile'->>'batchChipTargetLb' from samples where id=${literal(id)}`),'180');
 console.log('PASS: pre-Batch MTT rejected, explicit managed defaults capture 180/50/5/1 + reference, save/reopen, Blend creation, immutable issued history still rejected, complete managed profiles eligible; unresolved Sherwin ineligible, Cement ineligible, modern state unchanged.');
} finally {docker(['stop',name]);}
