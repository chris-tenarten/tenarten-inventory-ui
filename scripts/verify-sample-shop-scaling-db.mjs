// Isolated disposable PostgreSQL only. No hosted credentials, migrations or data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startBlendDatabase,sql,asUser,json,literal} from './support/production-blend-database.mjs';
import {docker} from './support/sample-batch-database.mjs';
const container=`tenops-shop-policy-check-${process.pid}`;
const call=q=>sql(container,asUser('select '+q));const parsed=q=>JSON.parse(call(q));
try{
 startBlendDatabase(container);
 for(const file of ['20261006120000_sample_audience_pdf_version.sql','20261009120000_sample_decimal_input_parsing.sql'])sql(container,readFileSync('supabase/migrations/'+file,'utf8'));
 let p=parsed("to_jsonb(p) from sample_operational_profiles p where name='Key Resin'");
 const id=call('public.create_sample()'),state=parsed(`formulation_state from samples where id=${literal(id)}`);
 state.width='24';state.profile={...state.profile,id:'operational:'+p.id,name:'Key Resin — 5:1',version:p.revision,batchContract:p.batch_contract};
 const rows=[{component_role:'aggregate',color:'Georgia White',percentage:'100',calculation_basis:'target_total',quantity_provenance:'calculated',unit:'oz'},...['filler','resin','hardener'].map(component_role=>({component_role,color:component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const save=()=>call(`save_sample_draft(${json({id,prepared_by:'Local verifier',formulation_state:state})},${json(rows)},'Preparation policy verification')`);
 save();const legacy=call(`issue_sample_form(${literal(id)})`);const oldCapture=call(`issued_snapshot::text from sample_issued_documents where id=${literal(legacy)}`);
 for(const role of ['filler','resin'])p.batch_contract.components[role].shopWorking.rule='historical_volume_rate';
 call(`save_sample_operational_profile(${literal(p.id)},${p.revision},${json(p)})`);
 assert.equal(call(`formulation_state#>>'{profile,batchContract,components,filler,shopWorking,rule}' from samples where id=${literal(id)}`),'at_volume');
 p=parsed(`to_jsonb(p) from sample_operational_profiles p where id=${literal(p.id)}`);state.profile={...state.profile,version:p.revision,batchContract:p.batch_contract};save();
 let reopened=parsed(`get_sample_working_pdf_snapshot(${literal(id)},null)`);assert.equal(reopened.formulation_state.profile.batchContract.components.filler.shopWorking.rule,'historical_volume_rate');
 const quantities=Object.fromEntries(reopened.blend_rows.map(r=>[r.component_role,Number(r.quantity)]));assert.deepEqual(quantities,{aggregate:128,filler:36,resin:30,hardener:6});
 const current=call(`issue_sample_form(${literal(id)})`);assert.equal(call(`issued_snapshot::text from sample_issued_documents where id=${literal(legacy)}`),oldCapture);
 assert.equal(call(`issued_snapshot#>>'{formulation_state,profile,batchContract,components,filler,shopWorking,rule}' from sample_issued_documents where id=${literal(current)}`),'historical_volume_rate');
 rows[1]={...rows[1],quantity_provenance:'manual',quantity:'21'};rows[2]={...rows[2],quantity_provenance:'manual',quantity:'22'};state.width='48';save();
 reopened=parsed(`get_sample_working_pdf_snapshot(${literal(id)},null)`);for(const [role,expected] of [['filler',21],['resin',22],['hardener',4.4]])assert.equal(Number(reopened.blend_rows.find(r=>r.component_role===role).quantity),expected);
 assert.equal(call(`issued_snapshot::text from sample_issued_documents where id=${literal(legacy)}`),oldCapture);
 console.log('PASS actual DB: explicit managed-policy revision, no automatic draft update, selected policy Save/Reopen, 128/36/30/6 capture, fixed manual quantities, ratio-derived Hardener, old issued snapshot unchanged.');
}finally{docker(['stop',container]);}
