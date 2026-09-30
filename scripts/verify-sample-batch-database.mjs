import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startDatabase,sql,docker,asUser,json,provision,admin,member,migration,referenceMigration} from './support/sample-batch-database.mjs';
const name=`tenops-batch-gate-${process.pid}`;
const rows=(percent)=>[...percent.map((p,i)=>({color:`Chip ${i}`,percentage:String(p),component_role:'aggregate',calculation_basis:'target_total',quantity_provenance:'calculated',unit:'oz'})),...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
const expectFailure=(statement,contains)=>{assert.throws(()=>sql(name,statement),e=>String(e).includes(contains));};
try{
 startDatabase(name,{applyBatch:false});
 const sid=sql(name,asUser('select public.create_sample()'));
 const oldState=JSON.parse(sql(name,`select formulation_state from samples where id='${sid}'`));
 sql(name,asUser(`select save_sample_draft(${json({id:sid,prepared_by:'Historical QA',formulation_state:oldState})},${json(rows([100]))},'Historical fixture');select save_sample_working_version('${sid}','Before migration');select issue_sample_form('${sid}')`));
 const before=sql(name,`select jsonb_build_object('samples',(select jsonb_agg(to_jsonb(s)) from samples s),'versions',(select jsonb_agg(to_jsonb(v)) from sample_working_versions v),'issued',(select jsonb_agg(to_jsonb(i)) from sample_issued_documents i))`);
 sql(name,readFileSync('supabase/migrations/'+migration,'utf8'));
 sql(name,readFileSync('supabase/migrations/'+referenceMigration,'utf8'));
 assert.equal(sql(name,`select jsonb_build_object('samples',(select jsonb_agg(to_jsonb(s)) from samples s),'versions',(select jsonb_agg(to_jsonb(v)) from sample_working_versions v),'issued',(select jsonb_agg(to_jsonb(i)) from sample_issued_documents i))`),before);
 const pid=provision(name);expectFailure(asUser(readFileSync('supabase/operations/sample-batch/provision-mtt.sql','utf8').replaceAll(":'mtt_id'",`'${pid}'`).replaceAll(":'expected_revision'","'1'")),'ERROR');assert.equal(sql(name,'select count(*) from sample_operational_profiles where batch_chip_target_lb is not null'),'1');
 expectFailure(asUser(`select save_sample_operational_profile('${pid}',1,(select to_jsonb(p) from sample_operational_profiles p where id='${pid}'))`),'Profile changed');
 for(const user of [member,'00000000-0000-0000-0000-000000000011']){
  if(user!==member)sql(name,`insert into app_users values('${user}','Inactive','admin',false)`);
  expectFailure(asUser(`select save_sample_operational_profile('${pid}',2,'{}')`,user),'active Admin');
 }
 const p=JSON.parse(sql(name,`select row_to_json(p) from sample_operational_profiles p where id='${pid}'`));
 for(const value of [0,-1,'NaN','Infinity','100000000','bad'])expectFailure(asUser(`select save_sample_operational_profile('${pid}',2,${json({...p,batch_chip_target_lb:value})})`),'ERROR');
 const omitted={...p};delete omitted.batch_chip_target_lb;sql(name,asUser(`select save_sample_operational_profile('${pid}',2,${json(omitted)})`));assert.equal(sql(name,`select batch_chip_target_lb from sample_operational_profiles where id='${pid}'`),'180.000000');
 const base=JSON.parse(sql(name,`select formulation_state from samples where id='${sid}'`));
 base.profile={...base.profile,id:'operational:'+pid,version:3,name:'MTT — 5:1',dryPoolOzPerCft:'2560',defaultFillerOzPerCft:'512',batchChipTargetLb:'180'};
 const save=(state,parts=rows([40,30,20,5,5]))=>sql(name,asUser(`select save_sample_draft(${json({id:sid,prepared_by:'QA',sample_size:'6x6',sample_quantity:'1',formulation_state:state})},${json(parts)},'Local Batch QA')`));
 for(const percentages of [[40,30,20,5,5],[50,25,25],[30,40,30]]){
  save(base,rows(percentages));const values=JSON.parse(sql(name,`select jsonb_agg(calculated_quantity order by display_order) from sample_blend_rows where sample_id='${sid}'`));assert.deepEqual(values,[...percentages.map(p=>64*p/100),16,15,3]);
  sql(name,asUser(`select issue_sample_form('${sid}')`));
 }
 for(const percentages of [[40,20],[50,50,25]]){save(base,rows(percentages));expectFailure(asUser(`select issue_sample_form('${sid}')`),'must total 100');}
 save(base);const v=sql(name,asUser(`select save_sample_working_version('${sid}','with target')`));const issued=sql(name,asUser(`select issue_sample_form('${sid}')`));
 const historical=sql(name,`select to_jsonb(i) from sample_issued_documents i where id='${issued}'`);
 assert.equal(sql(name,`select document_version from sample_issued_documents where id='${issued}'`),'sample-work-order-pdf-v7-batch-basis');
 const without=structuredClone(base);delete without.profile.batchChipTargetLb;save(without);assert.equal(Number(sql(name,`select formulation_state#>>'{profile,batchChipTargetLb}' from samples where id='${sid}'`)),180);
 const clear=structuredClone(base);clear.profile.batchChipTargetLb=null;save(clear);const legacy=sql(name,asUser(`select save_sample_working_version('${sid}','no target')`));
 save(base);sql(name,asUser(`select restore_sample_working_version('${sid}','${legacy}')`));assert.equal(sql(name,`select formulation_state#>'{profile,batchChipTargetLb}' from samples where id='${sid}'`),'null');
 sql(name,asUser(`select restore_sample_working_version('${sid}','${v}')`));
 const duplicate=sql(name,asUser(`select duplicate_sample('${sid}',true)`));assert.equal(Number(sql(name,`select formulation_state#>>'{profile,batchChipTargetLb}' from samples where id='${duplicate}'`)),180);
 sql(name,asUser(`select save_sample_operational_profile('${pid}',3,(select to_jsonb(p)||'{"batch_chip_target_lb":200}'::jsonb from sample_operational_profiles p where id='${pid}'))`));
 assert.equal(sql(name,`select to_jsonb(i) from sample_issued_documents i where id='${issued}'`),historical);assert.equal(Number(sql(name,`select formulation_state#>>'{profile,batchChipTargetLb}' from samples where id='${sid}'`)),180);
 const replacement=structuredClone(without);replacement.profile.version=4;save(replacement);assert.equal(sql(name,`select formulation_state->'profile' ? 'batchChipTargetLb' from samples where id='${sid}'`),'f');
 const absentVersion=sql(name,asUser(`select save_sample_working_version('${sid}','absent capture')`));save(base);sql(name,asUser(`select restore_sample_working_version('${sid}','${absentVersion}')`));assert.equal(sql(name,`select formulation_state->'profile' ? 'batchChipTargetLb' from samples where id='${sid}'`),'f');
 sql(name,asUser(`select save_sample_operational_profile('${pid}',4,(select to_jsonb(p)||'{"batch_chip_target_lb":null}'::jsonb from sample_operational_profiles p where id='${pid}'))`));assert.equal(sql(name,`select batch_chip_target_lb is null from sample_operational_profiles where id='${pid}'`),'t');
 for(const value of ['0','NaN','-1','Infinity','100000000','bad']){const invalid=structuredClone(base);invalid.profile.batchChipTargetLb=value;expectFailure(asUser(`select save_sample_draft(${json({id:sid,prepared_by:'QA',formulation_state:invalid})},${json(rows([100]))})`),'ERROR');}
 for(const signature of ['save_sample_draft_before_batch(jsonb,jsonb)','issue_sample_form_before_batch(uuid)','save_sample_operational_profile_before_batch(uuid,integer,jsonb)','normalize_sample_formulation_before_batch(jsonb)'])assert.equal(sql(name,`select has_function_privilege('authenticated','public.${signature}','execute')`),'f');
 assert.equal(sql(name,"select has_function_privilege('authenticated','public.normalize_sample_formulation(jsonb)','execute')"),'f');
 assert.equal(sql(name,"select has_function_privilege('anon','public.save_sample_draft(jsonb,jsonb)','execute')"),'f');
 const developer='00000000-0000-0000-0000-000000000012';sql(name,`insert into app_users values('${developer}','Developer','developer',true)`);sql(name,asUser(`select save_sample_operational_profile(null,null,${json({...p,name:'Local custom target',batch_chip_target_lb:240})})`,developer));assert.equal(sql(name,"select batch_chip_target_lb from sample_operational_profiles where name='Local custom target'"),'240.000000');
 console.log('Batch database gate passed: append-only schema, guarded MTT configuration, three authored blends, incomplete draft/issue gates, revisions/RBAC, omitted/null/replacement, duplicate/restore/issue immutability and private wrappers.');
}finally{docker(['stop',name]);}
