import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startIntakeDatabase,sql,docker,value,asUser,literal,json,admin,member} from './support/intake-materials-database.mjs';
import {deriveRequirements,assessRequirements} from '../src/modules/intake-materials/requirements';
import {newScopeLine} from '../src/modules/intake-materials/contracts';
// @ts-expect-error -- tsx resolves the existing .mts fixture at runtime.
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {extractPdfForm,extractWorkbookForm} from '../src/modules/intake-materials/historical-extraction';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import readExcel from 'read-excel-file/node';
const fixture=blendFixtures[3],line={...newScopeLine(),label:'Finish A',quantity:'120',unit:'pieces',yieldPerBatch:'2',batchRounding:'fractional' as const,plannedQuantity:'12000',blendSize:'1000',thickness:'.375',overage:'0',assumptions:'Reviewed 60 batches; 1200 lb chip adjustment; original Agawam basis'};
const result=deriveRequirements([line],[fixture.snapshot]);assert.equal(result.requirements.find(r=>r.role==='aggregate')?.quantity,2100);assert.equal(result.requirements.find(r=>r.role==='resin')?.quantity,300);
const withoutPackages=structuredClone(fixture.snapshot);withoutPackages.blendRows.forEach(r=>r.catalogSnapshot={});assert.equal(deriveRequirements([line],[withoutPackages]).requirements[0].packageEquivalent,null);
assert.equal(deriveRequirements([{...line,thickness:'1'}],[fixture.snapshot]).requirements[0].quantity,null);
const mapped={...result.requirements[0],quantity:100,mapping:{vendor:'Arim',color:'New Pure White',size:'0',category:'chip',unit:'Bags',factor:'50',evidence:'Confirmed 50 lb bag and exact SKU',leadTimeDays:'14',supplier:'Arim'}};
const supply=[{vendor:'Arim',color:'New Pure White',size:'0',category:'chip',unit:'Bags',quantity:3},{vendor:'Arim',color:'New Pure White',size:'0',category:'chip',unit:'Bags',quantity:10,temporary_job_label:'Other work'}];
const assessed=assessRequirements([mapped,{...mapped,key:'second'}],supply,[],null);assert.equal(assessed[0].available,150);assert.equal(assessed[0].reservedElsewhere,500);assert.equal(assessed[1].shortage,50);
assert.ok(assessRequirements([mapped,{...mapped,key:'kg',unit:'kg',mapping:{...mapped.mapping,factor:'22.6796185'}}],supply,[],null)[1].shortage!>77);
assert.equal(assessRequirements([{...mapped,mapping:undefined}],supply,[],null)[0].available,null);
// Actual representative originals are read locally; originals/business data are never copied into Git.
const workbook='/Users/chrisngo/Downloads/Blank Color Plate MANUAL TEMPLATE.xlsx';
if(readFileSync(workbook).length){const rows=await readExcel(workbook);const x=extractWorkbookForm(rows,'Historical Excel template');assert.ok(x.warnings.some(w=>w.includes('Plate number')));assert.equal(x.sample.colorPlateNumber,'T25-');}
const sources=[['/Users/chrisngo/my stuff/Jobs/2026 Sample Plate Formulations.pdf','T26-271-A',5],['/Users/chrisngo/Downloads/26-0529 Agawam MAT QTY BLEND 092226-1,2,3.pdf','T26-267-A',10]] as const;
for(const [file,plate,count] of sources){const task=getDocument({data:new Uint8Array(readFileSync(file))});try{const d=await task.promise;const p=await d.getPage(1);const t=await p.getTextContent();const x=extractPdfForm(t.items.flatMap(i=>'str' in i?[{x:i.transform[4],y:i.transform[5],text:i.str.trim()}]:[]),file);assert.equal(x.sample.colorPlateNumber,plate);assert.equal(x.sample.blendRows.filter(r=>r.componentRole==='aggregate').length,count);assert.equal(x.sample.blendRows.reduce((s,r)=>s+Number(r.percentage),0),100);}finally{await task.destroy();}}
const name='tenops-intake-materials-verify-'+process.pid;let started=false;
try{started=true;startIntakeDatabase(name);console.log('Canonical dependency replay and three forward migrations passed.');
const bid=value(name,"create_bid('Local Customer','Intake materials verification')");const sample=value(name,'create_sample()');
// Existing managed Sample state is used, not fabricated Production Job identity.
const state=JSON.parse(value(name,`formulation_state from samples where id=${literal(sample)}`));
const rows=fixture.snapshot.blendRows.map(r=>({percentage:r.percentage,color:r.color,size:r.size,vendor:r.vendor,unit:r.unit,component_role:r.componentRole,quantity_provenance:'calculated',calculation_basis:r.componentRole==='aggregate'?'target_total':null,catalog_source:r.catalogSource,catalog_item_id:r.catalogItemId,catalog_snapshot:r.catalogSnapshot}));
value(name,`save_sample_draft(${json({id:sample,project_name:'Local source',color_plate_number:'T26-499-A',approved_date:'2026-10-26',formulation_state:state})},${json(rows)},'Local verified source')`);
const version=value(name,`save_sample_working_version(${literal(sample)},'Approved formulation')`);
const acceptedLine={...line,sourceKind:'version' as const,sourceId:version};
const context=JSON.parse(value(name,`bid_scope_context(${literal(bid)},null,${json([acceptedLine])})`));const calc=deriveRequirements([acceptedLine],context.sources);
const accept=()=>value(name,`to_jsonb(persist_bid_scope(${literal(admin)},null,null,${json([acceptedLine])},${json(context)},'Reviewed acceptance',${json(calc.requirements)},${json(calc.unresolved)}))`,admin,'service_role');
const capture=JSON.parse(accept());assert.equal(capture.revision,1);assert.equal(capture.calculation_version,'bid-material-requirements-v1');
const denied=(fn:()=>unknown)=>assert.throws(fn);
denied(accept); // stale expected scope
 denied(()=>value(name,`prepare_admin_delete_bid(${literal(bid)})`));
for(const actor of [member]){denied(()=>value(name,`bid_scope_context(${literal(bid)},null,${json([acceptedLine])})`,actor));assert.equal(value(name,'count(*) from bid_scope_captures',actor),'0');}
denied(()=>value(name,`persist_bid_scope(${literal(admin)},null,null,'[]','{}','fake','[]','[]')`));
denied(()=>sql(name,`update bid_scope_captures set evidence='rewrite' where id=${literal(capture.id)}`));
// Unresolved acceptance does not replace the existing deposit gate.
let stamp=value(name,`updated_at from bids where id=${literal(bid)}`);denied(()=>value(name,`convert_bid_to_production(${literal(bid)},${literal(stamp)},'unscheduled')`));
sql(name,`update bids set status='won',deposit_received_date='2026-10-26' where id=${literal(bid)}`);stamp=value(name,`updated_at from bids where id=${literal(bid)}`);
const job=value(name,`convert_bid_to_production(${literal(bid)},${literal(stamp)},'unscheduled')`);assert.equal(value(name,`convert_bid_to_production(${literal(bid)},${literal(stamp)},'unscheduled')`),job);assert.equal(value(name,`scope_id from job_bid_scope_handoffs where job_id=${literal(job)}`),capture.id);assert.equal(value(name,`count(*) from jobs where id=${literal(job)}`),'1');
// Original evidence lifecycle: documented, transcribed, verified; no allocation.
sql(name,"insert into storage.objects(bucket_id,name) values('unrelated-bucket','keep-existing-lifecycle');delete from storage.objects where bucket_id='unrelated-bucket';");assert.equal(sql(name,"select count(*) from storage.objects where bucket_id='unrelated-bucket'"),'0');
const digest='a'.repeat(64),original=JSON.parse(value(name,`to_jsonb(begin_historical_sample_import('historical.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',100,${literal(digest)},'{}'))`));
sql(name,asUser(`insert into storage.objects(bucket_id,name) values('historical-samples',${literal(original.storage_path)})`));
const before=value(name,'suggest_sample_color_plate_number()');
const payload={...JSON.parse(value(name,`to_jsonb(s) from samples s where id=${literal(sample)}`)),id:'',job_id:null,bid_id:null,color_plate_number:'T26-098-B'};
const importCall=()=>value(name,`persist_historical_sample(${literal(admin)},${literal(original.id)},${literal(digest)},${json(payload)},${json(rows)},'Historical fixture')`,admin,'service_role');
const imported=importCall();assert.equal(importCall(),imported);denied(()=>value(name,`prepare_admin_delete_sample(${literal(imported)})`));assert.equal(value(name,'suggest_sample_color_plate_number()'),before);
denied(()=>value(name,`complete_historical_sample_import(${literal(original.id)},${json(payload)},${json(rows)},'bypass')`));
sql(name,asUser(`delete from storage.objects where name=${literal(original.storage_path)}`));assert.equal(value(name,`count(*) from storage.objects where name=${literal(original.storage_path)}`),'1');
 denied(()=>sql(name,`delete from storage.objects where name=${literal(original.storage_path)}`));
const importStamp=value(name,`updated_at from samples where id=${literal(imported)}`);const verification=value(name,`verify_historical_sample(${literal(original.id)},${literal(importStamp)},'Compared original and reviewed Batch authority')`);assert.ok(verification);
denied(()=>sql(name,`update historical_sample_verifications set evidence='overwrite'`));
sql(name,`update samples set approved_date='2026-10-26' where id=${literal(imported)}`);const activeBid=value(name,"create_bid('Local','Historical verification gate')");
 const importedVersion=value(name,`save_sample_working_version(${literal(imported)},'Cannot bypass verification')`);denied(()=>value(name,`bid_scope_context(${literal(activeBid)},null,${json([{...acceptedLine,sourceId:importedVersion}])})`));
assert.ok(JSON.parse(value(name,`bid_scope_context(${literal(activeBid)},null,${json([{...acceptedLine,sourceKind:'historical',sourceId:verification}])})`)).sources.length);
 // Explicit Blend capability + Proposal access grants authority without employee identity.
 sql(name,`insert into proposal_access_users(user_id) values(${literal(member)});update app_users set production_blend_manage=true where user_id=${literal(member)}`);
 assert.ok(JSON.parse(value(name,`bid_scope_context(${literal(activeBid)},null,${json([{...acceptedLine,sourceKind:'historical',sourceId:verification}])})`,member)).sources.length);
 sql(name,`update app_users set role='guest',read_only=true where user_id=${literal(member)}`);
 denied(()=>value(name,`begin_historical_sample_import('blocked.pdf','application/pdf',1,${literal(digest)},'{}')`,member));
 denied(()=>value(name,`verify_historical_sample(${literal(original.id)},${literal(importStamp)},'blocked')`,member));
 sql(name,`update app_users set is_active=false where user_id=${literal(member)}`);assert.equal(value(name,'count(*) from bid_scope_captures',member),'0');
 denied(()=>value(name,'count(*) from bid_scope_captures',member,'anon'));
 assert.equal(value(name,'count(*) from inventory_items'),'0');assert.equal(value(name,'count(*) from pending_receivals'),'0');
console.log('Passed: calculation/package/mapping, representative Excel + 2 PDF layouts, RLS denial, trusted persistence, immutable evidence, import retry/numbering, Won/deposit conversion + retry-safe handoff.');
}finally{if(started)docker(['stop',name]);}
