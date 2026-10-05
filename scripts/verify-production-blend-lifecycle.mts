// @ts-nocheck -- exercises Deno handler against disposable PostgreSQL.
import assert from 'node:assert/strict';
import {startBlendDatabase,sql,asUser,literal,json,admin,member,blendClients} from './support/production-blend-database.mjs';
import {docker} from './support/sample-batch-database.mjs';
import {handleProductionBlend} from '../supabase/functions/_shared/production-blend-handler.ts';
const name=`tenops-production-blend-${process.pid}`;
try{
 startBlendDatabase(name);
 const call=q=>sql(name,asUser('select '+q)),parse=q=>JSON.parse(call(q));
 const id=call('create_sample()'),state=parse(`formulation_state from samples where id=${literal(id)}`);
 const rows=[...[40,30,20,5,5].map((p,i)=>({color:'Chip '+i,percentage:String(p),component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total',unit:'oz',catalog_source:'standard',catalog_item_id:'chip-'+i,catalog_snapshot:{package_context:{version:1,amount:'50',unit:'lb',container:'bag',catalog_source:'standard',catalog_item_id:'chip-'+i}}})),...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const save=()=>call(`save_sample_draft(${json({id,prepared_by:'Marcos',formulation_state:state})},${json(rows)},'Production lifecycle')`);save();
 const inputs={batchCount:60,plannedQuantity:12000,blendSize:1000};
 const request=(body,actor=admin)=>handleProductionBlend({...blendClients(name,actor),body,headers:{}});
 for(const action of ['blend-context','blend-list','blend-save','blend-issue','blend-pdf'])assert.equal((await request({action,sampleId:id,inputs},member)).status,403);
 const created=await request({action:'blend-save',sampleId:id,inputs,model:{adjustment:999}});assert.equal(created.status,200,await created.clone().text());const plan=await created.json();assert.equal(plan.model.adjustment,1200);
 const below=await request({action:'blend-save',planId:plan.id,revision:1,inputs:{...inputs,plannedQuantity:1}});assert.equal(below.status,200);assert.equal((await request({action:'blend-issue',planId:plan.id,revision:2,inputs:{...inputs,plannedQuantity:1}})).status,422);
 assert.equal((await request({action:'blend-save',planId:plan.id,revision:1,inputs})).status,422);
 rows[0].catalog_snapshot.package_context.amount='25';save();sql(name,`update sample_operational_profiles set description='Later profile edit'`);
 const issuedResponse=await request({action:'blend-issue',planId:plan.id,revision:2,inputs});assert.equal(issuedResponse.status,200,await issuedResponse.clone().text());const issued=await issuedResponse.json();assert.equal(issued.model.aggregates[0].packageWeightLb,50);
 assert.equal((await request({action:'blend-save',planId:plan.id,revision:3,inputs})).status,422);
 assert.throws(()=>sql(name,`update production_blend_plans set model='{}' where id=${literal(plan.id)}`),/immutable/);
 assert.throws(()=>sql(name,`delete from production_blend_plans where id=${literal(plan.id)}`),/immutable/);
 assert.throws(()=>sql(name,`set role authenticated; select persist_production_blend('${admin}',null,null,'${id}',null,'{}','{}','{}',false)`),/permission denied/);
 assert.equal(sql(name,asUser(`set role authenticated; select count(*) from production_blend_plans;`,member)),'0');
 assert.equal(sql(name,asUser(`set role authenticated; select count(*) from production_blend_plans;`,admin)),'1');

 const pdf=await request({action:'blend-pdf',planId:plan.id});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');
 const doc=call(`issue_sample_form(${literal(id)})`);const context=await request({action:'blend-context',sampleId:id,documentId:doc});assert.equal(context.status,200);
 assert.deepEqual(parse(`to_jsonb(p) from production_blend_plans p where id=${literal(plan.id)}`),issued);
 const disposable=call('create_sample()');sql(name,`update samples set formulation_state=${json(state)} where id=${literal(disposable)}`);call(`save_sample_draft(${json({id:disposable,prepared_by:'Marcos',formulation_state:state})},${json(rows)},'Delete source check')`);const detached=await request({action:'blend-issue',sampleId:disposable,inputs});assert.equal(detached.status,200);const captured=await detached.json();sql(name,`delete from samples where id=${literal(disposable)}`);assert.deepEqual(parse(`to_jsonb(p) from production_blend_plans p where id=${literal(captured.id)}`),captured);
 console.log('PASS: migration, captured source/package integrity, Admin UI API boundary, RLS, RPC grants, optimistic revision, below-calculated issue block, immutable issue, source deletion preserves independent capture, PDF, issued Sample source');
}finally{docker(['stop',name]);}
