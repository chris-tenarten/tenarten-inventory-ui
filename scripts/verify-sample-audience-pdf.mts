// @ts-nocheck -- shared Deno renderer exercised with existing captured fixture inputs.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {renderAudienceSample} from '../supabase/functions/_shared/sample-audience-pdf.ts';
const output='output/pdf/generator-ux';mkdirSync(output,{recursive:true});
for(const [index,name] of [[4,'Sample-MTT'],[3,'Sample-ten-aggregates']]){
 const sample=structuredClone(blendFixtures[index].snapshot);sample.issueNumber=1;
 const before=JSON.stringify(sample),bytes=await renderAudienceSample(sample);assert.equal(JSON.stringify(sample),before);
 const pdf=await pdfjs.getDocument({data:bytes.slice(),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;assert.equal(pdf.numPages,1);
 const page=await pdf.getPage(1),items=(await page.getTextContent()).items.filter(i=>i.str?.trim()),text=items.map(i=>i.str).join(' ');
 for(const t of ['SAMPLE WORK ORDER','SAMPLE PLATE QUANTITIES','CHIP MIX TOTAL','100%','Filler','Resin','Hardener'])assert(text.includes(t),t);
 assert(text.indexOf('CHIP MIX TOTAL')<text.indexOf('Filler'));assert(!text.includes('Batch basis'));assert(!text.includes('5.0000:1'));
 for(const i of items){assert(i.transform[4]>=35&&i.transform[4]+i.width<=578,`clipped ${i.str}`);assert(i.transform[5]>=15&&i.transform[5]<=765);}
 const viewport=page.getViewport({scale:1.5}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;writeFileSync(`${output}/${name}.pdf`,bytes);writeFileSync(`${output}/${name}.png`,canvas.toBuffer('image/png'));
}
console.log('PASS two new Sample layouts: five/ten aggregate rows, roles, subtotal, no Batch provenance, no mutation, one page and bounded text.');
