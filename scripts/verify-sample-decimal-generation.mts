import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {startBlendDatabase,sql,asUser,json,literal} from './support/production-blend-database.mjs';
import {docker} from './support/sample-batch-database.mjs';
import {translateSampleError} from '../src/modules/samples/sample-errors';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index';
const container=`tenops-decimal-generation-${process.pid}`;
const call=(q:string)=>sql(container,asUser('select '+q));const parse=(q:string)=>JSON.parse(call(q));
const migration='20261009120000_sample_decimal_input_parsing.sql';
try{
 startBlendDatabase(container);
 sql(container,readFileSync('supabase/migrations/20261006120000_sample_audience_pdf_version.sql','utf8'));
 const id=call('public.create_sample()');const initial=parse(`formulation_state from samples where id=${literal(id)}`);
 const rows=['aggregate','filler','resin','hardener'].map(role=>({component_role:role,color:role,percentage:role==='aggregate'?'100':'',quantity:'',unit:['resin','hardener'].includes(role)?'fl oz':'oz',quantity_provenance:'calculated',calculation_basis:role==='aggregate'?'target_total':null}));
 const profile=(name:string)=>{const p=parse(`to_jsonb(p) from sample_operational_profiles p where name=${literal(name)}`);return {...initial.profile,id:'operational:'+p.id,version:p.revision,name:p.name,resinParts:String(p.resin_parts),hardenerParts:String(p.hardener_parts),batchChipTargetLb:String(p.batch_chip_target_lb),batchReferenceThicknessIn:p.batch_reference_thickness_in==null?null:String(p.batch_reference_thickness_in),defaultChipDensityLbCft:String(p.chip_density),batchContract:p.batch_contract};};
 const save=(name:string,thickness:string)=>call(`public.save_sample_draft(${json({id,prepared_by:'Local verifier',color_plate_number:'T26-991A',formulation_state:{...initial,profile:profile(name),thicknessIn:thickness}})},${json(rows)},'Decimal generation')`);
 const count=()=>call(`count(*) from sample_issued_documents where sample_id=${literal(id)}`);
 save('Key Resin','0.375');const oldId=call(`public.issue_sample_form(${literal(id)})`);const old=call(`to_jsonb(d) from sample_issued_documents d where id=${literal(oldId)}`);
 save('Key Resin','.75');assert.equal(parse(`formulation_state from samples where id=${literal(id)}`).derived.productionVolumeCft,null);
 const before=count();for(let i=0;i<2;i++)assert.throws(()=>call(`public.issue_sample_form(${literal(id)})`),/Complete the shop preparation quantities/);assert.equal(count(),before);
 console.log('REPRODUCED: .75 saves with null projection; issuance fails on preparation quantities; repeat failure creates no document.');
 sql(container,readFileSync('supabase/migrations/'+migration,'utf8'));assert.equal(call(`to_jsonb(d) from sample_issued_documents d where id=${literal(oldId)}`),old);
 for(const input of ['.75','0.75','00.750',' 0.75 '])assert.equal(Number(call(`public.sample_nonnegative_numeric(${literal(input)})`)),.75);
 for(const input of ['', '.', '-1','NaN','Infinity','1e3','1/2','1..2'])assert.equal(call(`public.sample_nonnegative_numeric(${literal(input)})`),'');
 mkdirSync('/tmp/tenops-decimal-pdfs',{recursive:true});
 for(const name of ['Key Resin','Sherwin'])for(const thickness of ['0.375','.75','0.75']){
  save(name,thickness);const state=parse(`formulation_state from samples where id=${literal(id)}`);assert.equal(Number(state.derived.productionVolumeCft),Number(thickness)/12);assert.equal(state.resinParts,name==='Key Resin'?'5':'4');
  const n=Number(count());const issued=call(`public.issue_sample_form(${literal(id)})`);assert.equal(Number(count()),n+1);
  const doc=parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(issued)}`);
  const pdf=await renderSampleWorkOrder(doc.issued_snapshot,doc.document_version);assert.equal(Buffer.from(pdf).subarray(0,4).toString(),'%PDF');
  writeFileSync(`/tmp/tenops-decimal-pdfs/${name.replaceAll(' ','-')}-${thickness}.pdf`,pdf);
  assert.deepEqual(Buffer.from(await renderSampleWorkOrder(doc.issued_snapshot,doc.document_version)),Buffer.from(pdf),'retry renders same capture');assert.equal(Number(count()),n+1);
  console.log('PASS',name,thickness,'save/reopen/issue/PDF',state.derived.availableChipMixOz,'oz');
 }
 assert.equal(call(`to_jsonb(d) from sample_issued_documents d where id=${literal(oldId)}`),old,'prior issue untouched');
 const bad={...initial,profile:{...profile('Key Resin'),resinParts:'3'}};assert.throws(()=>call(`public.normalize_sample_formulation(${json(bad)})`),/ratio|profile|binder relationship/i);
 const translated=translateSampleError({code:'22023',message:'Complete the shop preparation quantities before issuing.'},'formal-issue');assert.equal(translated.kind,'calculation-incomplete');assert.doesNotMatch(translated.message,/\bratio\b/i);
 assert.match(translateSampleError({message:'Invalid Resin : Hardener ratio.'},'formal-issue').message,/ratio/);
 assert.notEqual(translateSampleError({message:'Generation failed.'},'formal-issue').message,'Choose a valid Resin : Hardener ratio.');
 console.log('PASS invalid ratios remain rejected; historical issue unchanged; parser invalid inputs rejected; accurate error classification.');
}finally{docker(['stop',container]);}
