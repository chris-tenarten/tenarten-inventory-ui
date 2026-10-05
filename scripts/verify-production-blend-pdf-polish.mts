// @ts-nocheck -- focused Node execution of the shared Deno renderer.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
import {renderProductionBlend} from '../supabase/functions/_shared/production-blend-pdf.ts';
const mtt=structuredClone(blendFixtures[4].snapshot);
mtt.formulation.profile.name='MTT — 5.0000:1';
const partial=buildProductionBlend(mtt,{batchCount:1,plannedQuantity:180,blendSize:1000});
const full=buildProductionBlend(mtt,{batchCount:1,plannedQuantity:1000,blendSize:1000});
const big=buildProductionBlend(blendFixtures[1].snapshot,blendFixtures[1].inputs);
const agawam=buildProductionBlend(blendFixtures[3].snapshot,blendFixtures[3].inputs);
const output='output/pdf/blend-v11-polish';mkdirSync(output,{recursive:true});
async function render(model,name){
 const before=JSON.stringify(model);
 const bytes=await renderProductionBlend({id:'Local review',status:'working',model});
 assert.equal(JSON.stringify(model),before,'Rendering must not mutate the capture');
 const doc=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;
 assert.equal(doc.numPages,1);
 const page=await doc.getPage(1);const items=(await page.getTextContent()).items.filter(i=>i.str?.trim());
 const text=items.map(i=>i.str).join(' ');
 const total=items.findIndex(i=>i.str==='TOTAL');assert(total>=0);
 const pounds=model.shopPresentation.rows.reduce((sum,row)=>sum+row.pounds,0);
 assert.equal(items[total+1].str,`${pounds.toLocaleString('en-US')} lb`);
 assert(text.includes('Qty in Stock'));assert(text.includes('Qty to Order'));
 assert(items.filter(i=>i.str==='—').length>=model.aggregates.length*2);
 assert(!text.includes('Planned aggregate total:'));
 if(name){writeFileSync(`${output}/${name}.pdf`,bytes);const viewport=page.getViewport({scale:1.5}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;writeFileSync(`${output}/${name}.png`,canvas.toBuffer('image/png'));}
 return text;
}
const smallText=await render(partial,'MTT-180-lb');
for(const expected of ['BATCH SIZE 180 lb','BATCH COUNT 1','PLANNED CHIP TOTAL 180 lb','MTT — 5:1','BINDER — 1 BATCH','1 bag + 22 lb','1 bag + 4 lb','36 lb','9 lb'])assert(smallText.includes(expected),expected);
assert(!smallText.includes('0.18'));assert(!smallText.includes('BLEND SIZE'));assert(!smallText.includes('1 BATCHES'));assert(!smallText.includes('× 1 Batches'));
assert.equal(partial.blendCount,.18);
const fullText=await render(full,'MTT-full-Blend');assert(fullText.includes('BLENDS 1'));assert(fullText.includes('BLEND SIZE 1,000 lb'));assert(fullText.includes('8 bags'));
const bigText=await render(big,'Big-Springs');assert(bigText.includes('PLANNED CHIP TOTAL 400 lb'));assert(!bigText.includes('0.8'));assert.equal(big.blendCount,.8);
const agawamText=await render(agawam,'Agawam');for(const expected of ['BLENDS 12','BLEND SIZE 1,000 lb','BATCH COUNT 60','PLANNED CHIP TOTAL 12,000 lb','BINDER — 60 BATCHES','300 US gal','60 US gal'])assert(agawamText.includes(expected),expected);
// Rendering uses captured size, not an MTT constant; stored profile precision is untouched.
const alternative=structuredClone(partial);alternative.batchChipLb=150;alternative.profile='Sherwin - 4.0000:1';
const alternativeText=await render(alternative,null);assert(alternativeText.includes('BATCH SIZE 150 lb'));assert(alternativeText.includes('Sherwin — 4:1'));assert.equal(alternative.profile,'Sherwin - 4.0000:1');
console.log('PASS: partial/full summary, table totals, ratio display, singular/plural, exact counts preserved, em-dash placeholders, captured 150-lb size; four one-page review PDFs.');
