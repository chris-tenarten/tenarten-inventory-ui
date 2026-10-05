// @ts-nocheck -- PDF rendering gate.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
import {renderProductionBlend} from '../supabase/functions/_shared/production-blend-pdf.ts';
const output='output/pdf/production-blend';mkdirSync(output,{recursive:true});
async function check(f,name=f.name,status='working'){
 const model=buildProductionBlend(f.snapshot,f.inputs),bytes=await renderProductionBlend({model,status,id:'Local review'});writeFileSync(`${output}/${name}.pdf`,bytes);
 const doc=await pdfjs.getDocument({data:bytes,standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;let all='';
 for(let i=1;i<=doc.numPages;i++){
  const p=await doc.getPage(i),content=await p.getTextContent();
  for(const item of content.items){if(!('str' in item))continue;all+=item.str+'\n';if(item.str.trim()){assert.ok(item.transform[4]>=35&&item.transform[4]+item.width<=578,`horizontal clipping ${item.str}`);assert.ok(item.transform[5]>=19&&item.transform[5]<=765,`vertical clipping ${item.str}`);}}
  const viewport=p.getViewport({scale:1.5}),canvas=createCanvas(viewport.width,viewport.height);await p.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;writeFileSync(`${output}/${name}-${i}.png`,canvas.toBuffer('image/png'));
 }
 assert.match(all,/PRODUCTION BLEND SHEET/);assert.match(all,/BAGS \/ BLEND/);assert.match(all,/US gal/);assert.ok(!all.includes('lb/CFT'));assert.ok(!all.includes('Working Pour'));
 if(name!=='overflow')assert.equal(doc.numPages,1,name);
 return {name,pages:doc.numPages,text:all};
}
const results=[];for(const f of blendFixtures)results.push(await check(f));
assert.match(results[3].text,/300 US gal/);assert.match(results[3].text,/60 US gal/);assert.match(results[3].text,/3.5/);assert.match(results[1].text,/0.8/);
const stress=structuredClone(blendFixtures[4]);const row=stress.snapshot.blendRows[0];stress.snapshot.blendRows=[...Array.from({length:45},(_,i)=>({...row,color:`Material-${String(i).padStart(2,'0')} Long material name for safe multi-line pagination`,vendor:'Long identifiable vendor name',percentage:String(100/45)})),...stress.snapshot.blendRows.slice(-3)];
const large=await check(stress,'overflow','issued');assert.ok(large.pages>1);for(let i=0;i<45;i++)assert.equal(large.text.split(`Material-${String(i).padStart(2,'0')}`).length-1,1);
console.log(JSON.stringify({output,results:results.map(({name,pages})=>({name,pages})),overflowPages:large.pages,checks:'bounds, pagination, 45 unique rows, gallon units, fractional values, compact normal sheets'}));
