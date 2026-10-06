// @ts-nocheck -- focused planner, capture and PDF compatibility checks.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {editBlendPlanning} from '../src/modules/samples/blend-planner-inputs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';
import {startBlendDatabase,sql,asUser,literal,json,blendClients} from './support/production-blend-database.mjs';
import {docker} from './support/sample-batch-database.mjs';
import {handleProductionBlend} from '../supabase/functions/_shared/production-blend-handler.ts';
const snapshot=blendFixtures[4].snapshot;
let input={batchCount:'1',plannedQuantity:'180',blendSize:'1000'};
input=editBlendPlanning(input,'batchCount','10',180);assert.equal(input.plannedQuantity,'1800');
input=editBlendPlanning(input,'adjustment','200',180);assert.equal(input.plannedQuantity,'2000');
const m=buildProductionBlend(snapshot,input);assert.equal(m.filler[0].quantity,500);assert.equal(m.binder.resin.total,50);assert.equal(m.binder.hardener.total,10);
const staged=buildProductionBlend(snapshot,editBlendPlanning(input,'blendSize','500',180));assert.equal(staged.plannedQuantity,2000);assert.equal(staged.adjustment,200);assert.equal(staged.blendCount,4);assert.deepEqual(staged.filler,m.filler);assert.deepEqual(staged.binder,m.binder);
assert.equal(editBlendPlanning(input,'batchCount','2',180).plannedQuantity,'560');
const adjusted=buildProductionBlend(snapshot,editBlendPlanning(input,'adjustment','300',180));assert.deepEqual(adjusted.filler,m.filler);assert.deepEqual(adjusted.binder,m.binder);assert.deepEqual(adjusted.aggregates.map(r=>r.percentage),m.aggregates.map(r=>r.percentage));
const name=`tenops-generator-ux-${process.pid}`;
try {
 startBlendDatabase(name);const call=q=>sql(name,asUser('select '+q)),parse=q=>JSON.parse(call(q));
 const id=call('create_sample()'),state=parse(`formulation_state from samples where id=${literal(id)}`);
 const rows=[...[40,30,20,5,5].map((p,i)=>({color:'Chip '+i,percentage:String(p),component_role:'aggregate',quantity_provenance:'calculated',calculation_basis:'target_total',unit:'oz',catalog_source:'standard',catalog_item_id:'chip-'+i,catalog_snapshot:{package_context:{version:1,amount:'50',unit:'lb',container:'bag',catalog_source:'standard',catalog_item_id:'chip-'+i}}})),...['filler','resin','hardener'].map(component_role=>({color:component_role,component_role,quantity_provenance:'calculated',unit:component_role==='filler'?'oz':'fl oz'}))];
 const save=()=>call(`save_sample_draft(${json({id,prepared_by:'Marcos',color_plate_number:'T26-901A',formulation_state:state})},${json(rows)},'Generator review')`);save();
 const oldId=call(`issue_sample_form(${literal(id)})`),old=parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(oldId)}`);
 sql(name,readFileSync('supabase/migrations/20261006120000_sample_audience_pdf_version.sql','utf8'));
 assert.deepEqual(parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(oldId)}`),old);
 const newId=call(`issue_sample_form(${literal(id)})`),fresh=parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(newId)}`);
 assert.notEqual(newId,oldId);assert.deepEqual(parse(`to_jsonb(d) from sample_issued_documents d where id=${literal(oldId)}`),old);
 assert.equal(old.document_version,'sample-work-order-pdf-v9-compact');assert.equal(fresh.document_version,'sample-work-order-pdf-v10-audience');
 const request=body=>handleProductionBlend({...blendClients(name),body,headers:{}});
 await request({action:'blend-context',sampleId:id});assert.equal(call('count(*) from production_blend_plans'),'0');
 const inputs={batchCount:1,plannedQuantity:230,blendSize:1000};
 const response=await request({action:'blend-issue',sampleId:id,inputs});assert.equal(response.status,200,await response.clone().text());const first=await response.json();assert.equal(first.status,'issued');assert.equal(call('count(*) from production_blend_plans'),'1');
 const second=await(await request({action:'blend-issue',sampleId:id,inputs})).json();assert.notEqual(second.id,first.id);assert.equal(call('count(*) from production_blend_plans'),'2');
 rows[0].catalog_snapshot.package_context.amount='25';save();sql(name,"update sample_operational_profiles set description='Later local profile edit'");
 assert.deepEqual(parse(`to_jsonb(p) from production_blend_plans p where id=${literal(first.id)}`),first);
 assert.equal((await request({action:'blend-pdf',planId:first.id})).status,200);assert.equal((await request({action:'blend-save',planId:first.id,revision:first.revision,inputs})).status,422);
 const legacy=await(await request({action:'blend-save',sampleId:id,inputs})).json();assert.equal((await request({action:'blend-pdf',planId:legacy.id})).status,200);
 const output='output/pdf/generator-ux';mkdirSync(output,{recursive:true});
 for(const [label,doc] of [['Sample-new',fresh],['Sample-legacy',old]]) {
  const before=JSON.stringify(doc);const bytes=await renderSampleWorkOrder(doc.issued_snapshot,doc.document_version);assert.equal(JSON.stringify(doc),before);
  const pdf=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;assert.equal(pdf.numPages,1);
  const page=await pdf.getPage(1),items=(await page.getTextContent()).items.filter(i=>i.str?.trim()),text=items.map(i=>i.str).join(' ');
  if(label==='Sample-new'){for(const t of ['SAMPLE PLATE QUANTITIES','FORMULA / COLOR PLATE #','CHIP MIX TOTAL','100%','64','18','15','3','Filler','Resin','Hardener','Finished Plates','Working Pour'])assert(text.includes(t),t);for(const t of ['Batch basis','SHOP PREPARATION','sample-work-order-pdf-v10'])assert(!text.includes(t),t);}else assert(text.includes('SHOP PREPARATION QUANTITIES'));
  for(const i of items){assert(i.transform[4]>=35&&i.transform[4]+i.width<=578,`clipped ${i.str}`);assert(i.transform[5]>=15&&i.transform[5]<=765);}
  const viewport=page.getViewport({scale:1.5}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;writeFileSync(`${output}/${label}.pdf`,bytes);writeFileSync(`${output}/${label}.png`,canvas.toBuffer('image/png'));
 }
 console.log('PASS planner ADJ/staging isolation; transient context; distinct atomic generated captures; legacy access; immutable source/package replay; local migration future-only renderer; new/old one-page Sample PDFs.');
}finally{docker(['stop',name]);}
