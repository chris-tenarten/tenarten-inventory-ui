import assert from 'node:assert/strict';
import {startDatabase,sql,docker,asUser,json,provision,provisionReference} from './support/sample-batch-database.mjs';
import {buildProductionBatchModel} from '../supabase/functions/_shared/sample-production-batch.mjs';
const name=`tenops-production-batch-${process.pid}`;
try{
 startDatabase(name);const pid=provision(name);provisionReference(name,pid);
 const id=sql(name,asUser('select create_sample()'));
 const state=JSON.parse(sql(name,`select formulation_state from samples where id='${id}'`));
 state.profile={...state.profile,id:'operational:'+pid,version:3,name:'MTT',batchChipTargetLb:'180',batchReferenceThicknessIn:'.375',defaultChipDensityLbCft:'128',defaultFillerOzPerCft:'512',resinFlOzPerCft:'480'};
 const rows=[...[40,30,20,5,5].map((p,i)=>({color:`Chip ${i}`,percentage:p,component_role:'aggregate',calculation_basis:'target_total',quantity_provenance:'calculated',unit:'oz',catalog_source:'standard',catalog_item_id:'selected-'+i,catalog_snapshot:{package_context:{version:1,amount:'50',unit:'lb',container:'bag',catalog_source:'standard',catalog_item_id:'selected-'+i,vendor:'Supplier',vendor_sku:'SKU-'+i}}})),...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const save=()=>sql(name,asUser(`select save_sample_draft(${json({id,prepared_by:'Marcos',formulation_state:state})},${json(rows)})`));save();
 const issue=sql(name,asUser(`select issue_sample_form('${id}')`));
 const snapshot=()=>JSON.parse(sql(name,`select issued_snapshot from sample_issued_documents where id='${issue}'`));
 const issued=snapshot();const model=buildProductionBatchModel(issued,'issued');assert.equal(model.rows[0].package?.label,'1.44 × 50-lb bags');
 rows[0].catalog_snapshot!.package_context.amount='25';state.profile.defaultFillerOzPerCft='1024';save();
 sql(name,asUser(`select save_sample_operational_profile('${pid}',3,(select to_jsonb(p)||'{"filler_rate":1024,"batch_chip_target_lb":200}'::jsonb from sample_operational_profiles p where id='${pid}'))`));
 assert.deepEqual(snapshot(),issued);assert.deepEqual(buildProductionBatchModel(snapshot(),'issued'),model);
 const current=JSON.parse(sql(name,asUser(`select get_sample_working_pdf_snapshot('${id}',null)`)));const working=buildProductionBatchModel(current,'working');assert.equal(working.rows[0].package?.label,'2.88 × 25-lb bags');assert.equal(working.rows.find(r=>r.role==='filler')?.batchQuantity,90);
 assert.equal(model.rows.find(r=>r.role==='filler')?.batchQuantity,45);
 const before=sql(name,"select jsonb_build_object('samples',(select jsonb_agg(to_jsonb(s)) from samples s),'rows',(select jsonb_agg(to_jsonb(r)) from sample_blend_rows r),'issues',(select jsonb_agg(to_jsonb(i)) from sample_issued_documents i))");buildProductionBatchModel(snapshot(),'issued');assert.equal(sql(name,"select jsonb_build_object('samples',(select jsonb_agg(to_jsonb(s)) from samples s),'rows',(select jsonb_agg(to_jsonb(r)) from sample_blend_rows r),'issues',(select jsonb_agg(to_jsonb(i)) from sample_issued_documents i))"),before);
 console.log('Production lifecycle passed: captured packages survive draft/profile changes; saved draft vs issue diverge correctly; rendering model performs no persistence writes.');
}finally{docker(['stop',name]);}
