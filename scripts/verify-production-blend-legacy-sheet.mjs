// Focused PDF mapping/captured-source compatibility checks; execute with tsx for shared TS imports.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
import {productionBlendSheet} from '../supabase/functions/_shared/production-blend-sheet.mjs';
import {renderProductionBlend} from '../supabase/functions/_shared/production-blend-pdf.ts';
const output='output/pdf/blend-legacy-aligned';mkdirSync(output,{recursive:true});
function plan(index,inputs=blendFixtures[index].inputs){
 const source=structuredClone(blendFixtures[index].snapshot);
 // Historical row types are fixture evidence, never inferred by the renderer.
 source.blendRows.filter(r=>r.componentRole==='aggregate').forEach((r,i)=>{if([1,2,3].includes(index))r.materialType='Marble';if(index===0)r.materialType=[0,1,4].includes(i)?'Glass':'Marble';});
 if(index===4)source.formulation.profile.name='MTT — 5.0000:1';
 return {id:'not-for-shop-uuid',status:'working',created_at:'2026-10-05T15:00:00Z',source_snapshot:source,model:buildProductionBlend(source,inputs)};
}
const small=plan(4,{batchCount:1,plannedQuantity:180,blendSize:1000}),big=plan(1),agawam=plan(3);
const smallSheet=productionBlendSheet(small);assert.deepEqual(smallSheet.rows.map(r=>r.pounds),[72,54,36,9,9]);assert.deepEqual(smallSheet.rows.map(r=>r.required),['1 bag + 22 lb','1 bag + 4 lb','36 lb','9 lb','9 lb']);assert.deepEqual(smallSheet.rows.map(r=>r.perBlend),['8','6','4','1','1']);assert.equal(smallSheet.totalPerBlend,'20');assert.equal(smallSheet.totalRequired,'—');
const ag=productionBlendSheet(agawam);assert.equal(ag.totalPerBlend,'20');assert.equal(ag.totalRequired,'240');assert.equal(ag.totalPercentage,'100');assert.deepEqual(ag.rows.map(r=>r.required),['42','42','6','6','36','36','24','24','12','12']);
assert.equal(productionBlendSheet(big).rows.reduce((sum,r)=>sum+r.pounds,0),400);assert.equal(big.model.blendCount,.8);
for(const [index,expected] of [[0,[33,150,50,5000]],[2,[8,200,400,2000]]]){const p=plan(index);assert.deepEqual([p.model.batchCount,p.model.batchChipLb,p.model.adjustment,p.model.plannedQuantity],expected);assert.equal(productionBlendSheet(p).totalPercentage,'100');}
const full=plan(4,{batchCount:1,plannedQuantity:1000,blendSize:1000});assert.deepEqual(productionBlendSheet(full).rows.map(r=>r.perBlend),['8','6','4','1','1']);
const missing=structuredClone(small);delete missing.source_snapshot;assert(productionBlendSheet(missing).rows.every(r=>r.type==='—'&&r.sku==='—'));assert.equal(productionBlendSheet(missing).workOrder,'—');
const explicit=structuredClone(small);explicit.source_snapshot.blendRows[0].catalogSnapshot.package_context.amount='25';explicit.source_snapshot.blendRows[0].catalogSnapshot.package_context.vendor_sku='CAPTURED-25';explicit.model=buildProductionBlend(explicit.source_snapshot,small.model);assert.equal(productionBlendSheet(explicit).rows[0].required,'2 bags + 22 lb');assert.equal(productionBlendSheet(explicit).rows[0].sku,'CAPTURED-25');
const issued=structuredClone(small);issued.status='issued';issued.issued_at='2026-10-07T01:00:00Z';assert.equal(productionBlendSheet(issued).date,'10/06/2026');assert.equal(productionBlendSheet(small).date,'10/05/2026');delete issued.issued_at;assert.equal(productionBlendSheet(issued).date,'—');
async function check(p,name){
 const before=JSON.stringify(p),bytes=await renderProductionBlend(p);assert.equal(JSON.stringify(p),before);
 const doc=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;
 assert.equal(doc.numPages,1,name);const page=await doc.getPage(1),items=(await page.getTextContent()).items.filter(i=>i.str?.trim());
 for(const i of items){assert(i.transform[4]>=27&&i.transform[4]+i.width<=765,`horizontal clipping: ${i.str}`);assert(i.transform[5]>=20&&i.transform[5]<=589,`vertical clipping: ${i.str}`);}
 const text=items.map(i=>i.str).join(' ');
 for(const label of ['MATERIAL QUANTITY & BLEND SHEET','DATE:','JOB #:','WO #: —','PLATE #:','SKU','CHIP COLOR','% OF BLEND','TYPE','VENDOR','BAGS REQUIRED','IN STOCK','NEED TO ORDER','TOTAL'])assert(text.includes(label),label);
 for(const unwanted of ['ADJD BATCHES','LBS. / BATCH','ADJ','LBS. REQUIRED','Calculated Quantity','Planned Chip Total','lb / BLEND','not-for-shop-uuid','Planning warning','lb/Batch ×','reserved or consumed','captured_catalog'])assert(!text.includes(unwanted),unwanted);
 assert(!items.some(i=>i.str==='BLEND SIZE'));
 const countItem=items.find(i=>i.str===`${p.model.blendCount} CHIP BLENDS`);if(p.model.blendCount>=1){assert(countItem);assert.equal(countItem.height,11);}else{assert(!countItem);assert(!text.includes('CHIP BLENDS'));}
 assert(items.filter(i=>i.str==='—').length>=p.model.aggregates.length*2);
 const viewport=page.getViewport({scale:1.5}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
 writeFileSync(`${output}/${name}.pdf`,bytes);writeFileSync(`${output}/${name}.png`,canvas.toBuffer('image/png'));return text;
}
const s=await check(small,'MTT-180-lb');assert(s.includes('MTT — 5:1'));assert(s.includes('FILLER: ATF-20 — 50 lb'));assert(s.includes('5 US gal'));assert(s.includes('1 US gal'));assert(s.includes('1 bag + 22 lb'));

const a=await check(agawam,'Agawam');for(const v of ['240','20','12 CHIP BLENDS','300 US gal','60 US gal','3,000 lb'])assert(a.includes(v),v);
assert.equal(ag.rows[0].perBlend,'3.5');assert.equal(ag.rows[2].perBlend,'0.5');
assert.equal(productionBlendSheet(explicit).rows[0].perBlend,'16');
assert.equal(smallSheet.totalPercentage,'100');
// Focused pagination guard for the newly widened table; no extra review artifact.
const overflow=structuredClone(agawam);
overflow.model.aggregates=Array.from({length:25},(_,i)=>({...agawam.model.aggregates[0],material:`Row-${String(i).padStart(2,'0')} Long captured aggregate identity for continuation layout`,percentage:4}));
const overflowBefore=JSON.stringify(overflow);
const overflowPdf=await pdfjs.getDocument({data:await renderProductionBlend(overflow),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;
assert(overflowPdf.numPages>1);let overflowText='';
for(let i=1;i<=overflowPdf.numPages;i++){const content=await(await overflowPdf.getPage(i)).getTextContent();for(const item of content.items){if(!item.str?.trim())continue;assert(item.transform[4]>=27&&item.transform[4]+item.width<=765);assert(item.transform[5]>=20&&item.transform[5]<=589);overflowText+=item.str+' ';}}
for(let i=0;i<25;i++)assert.equal(overflowText.split(`Row-${String(i).padStart(2,'0')}`).length-1,1);
assert.equal(JSON.stringify(overflow),overflowBefore);
console.log('PASS: no PDF calculation summary or partial Blend count; nominal per-Blend bags including fractional/explicit packages; actual partial requirements; unchanged binder/filler; inventory placeholders; immutable rendering; two one-page PDFs and pagination bounds.');
