// @ts-nocheck -- focused disposable RPC/history boundary checks.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {preferredColorPlate,colorPlateWarning,colorPlateConflict} from '../src/modules/samples/color-plate-identifier';
import {startBlendDatabase,sql,asUser,literal,json} from './support/production-blend-database.mjs';import {docker} from './support/sample-batch-database.mjs';
assert.equal(preferredColorPlate(' t26-258a '),'T26-258-A');assert.equal(preferredColorPlate('T26-258-A'),'T26-258-A');assert.equal(preferredColorPlate('TT25-125-A'),'TT25-125-A');assert(colorPlateWarning('TT25-125-A'));assert(colorPlateWarning('CUSTOM BLUE'));assert(colorPlateConflict([{id:'1',colorPlateNumber:'T26-258A'}],'2','T26-258-A'));
const db=`tenops-workspace-identifiers-${process.pid}`;
try{
 startBlendDatabase(db);const call=q=>sql(db,asUser('select '+q)),parse=q=>JSON.parse(call(q));const id=call('create_sample()'),state=parse(`formulation_state from samples where id=${literal(id)}`);
 const rows=[{color:'White',percentage:'100',component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total',unit:'oz'},...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const save=plate=>call(`save_sample_draft(${json({id,prepared_by:'Marcos',color_plate_number:plate,formulation_state:state})},${json(rows)},'Identifier review')`);
 save('T26-258A');const doc=call(`issue_sample_form(${literal(id)})`),before=parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(doc)}`),beforeSample=parse(`to_jsonb(s) from samples s where id=${literal(id)}`);
 sql(db,readFileSync('supabase/migrations/20261006160000_sample_color_plate_validation.sql','utf8'));assert.deepEqual(parse(`to_jsonb(s) from samples s where id=${literal(id)}`),beforeSample);
 for(const plate of ['T26-258-A','T26-258A','CUSTOM BLUE','TT25-125-A']){save(plate);assert.equal(call(`color_plate_number from samples where id=${literal(id)}`),plate);assert.deepEqual(parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(doc)}`),before);}
 // Unedited historical text must not be case/whitespace-normalized by an unrelated save.
 sql(db,`update samples set color_plate_number='tt25-125-a ' where id=${literal(id)}`);save('tt25-125-a ');assert.equal(parse(`to_jsonb(color_plate_number) from samples where id=${literal(id)}`),'tt25-125-a ');
 assert.throws(()=>save('X'.repeat(81)),/80 characters/);
 console.log('PASS preferred/tolerated/unusual identifiers; ambiguous text preserved; prospective collision warning; 80-character boundary; no migration row changes; immutable issued history.');
}finally{docker(['stop',db]);}
