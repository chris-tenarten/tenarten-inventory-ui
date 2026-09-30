import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderProductionBatch} from '../supabase/functions/_shared/production-batch-pdf';
import {standardFormulationState,SAMPLE_FORMULATION_PROFILES,applyFormulationProfile} from '../src/modules/samples/formulation';
import {newLocalSample} from '../src/modules/samples/types';
import {sampleBlendCatalogAutofill} from '../src/modules/samples/material-autofill';
import {combinePurchasingCatalogRecords} from '../src/modules/purchasing/catalog-records';
const output=path.resolve('output/pdf/production-batch');mkdirSync(output,{recursive:true});
const state=applyFormulationProfile(standardFormulationState(),{...SAMPLE_FORMULATION_PROFILES[2],batchChipTargetLb:'180',batchReferenceThicknessIn:'.375'});
const sample=newLocalSample({preparedBy:'Marcos',formulation:state});sample.id='fixture-captured-source';sample.sampleName='MTT Blanco / Grey';sample.colorPlateNumber='T26-123A';
const item=combinePurchasingCatalogRecords([{id:'one',item_name:'Blanco Mexicano',vendor:'T&M',size:'#1',unit:'50lb bag'}],[])[0];
sample.blendRows=[...[40,30,20,5,5].map((p,i)=>({...sample.blendRows[0],...sampleBlendCatalogAutofill(sample.blendRows[0],{...item,id:'material-'+i,materialName:['Blanco #1','Blanco #2','MOP','True Grey #1','True Grey #2'][i]}),percentage:String(p)})),...sample.blendRows.slice(1)];
const issued={...sample,issue_number:2,issued_at:'2026-09-30T15:00:00Z'};
async function check(snapshot:unknown,source:string,name:string){
 const bytes=await renderProductionBatch(snapshot,source);writeFileSync(`${output}/${name}.pdf`,bytes);
 const doc=await pdfjs.getDocument({data:bytes,standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;let text='';
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n);const content=await page.getTextContent();let pageText='';
  for(const item of content.items){if(!('str' in item))continue;pageText+=item.str+'\n';if(item.str.trim()){assert.ok(item.transform[4]>=35&&item.transform[4]+item.width<=578,`horizontal overflow ${name}: ${item.str}`);assert.ok(item.transform[5]>=25&&item.transform[5]<=765,`vertical overflow ${name}: ${item.str}`);}}
  assert.match(pageText,source==='issued'?/ISSUED FORMULATION - ISSUE 2/:/WORKING BATCH BLEND - NOT ISSUED/);text+=pageText;
  const viewport=page.getViewport({scale:1.5});const canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d') as unknown as CanvasRenderingContext2D,viewport,canvas:canvas as unknown as HTMLCanvasElement}).promise;writeFileSync(`${output}/${name}-${n}.png`,canvas.toBuffer('image/png'));
 }
 return {text,pages:doc.numPages};
}
const working=await check(sample,'working','working');const controlled=await check(issued,'issued','issued');
for(const label of ['72 lb','54 lb','36 lb','9 lb','45 lb','675 fl oz','135 fl oz','1.44 × 50-lb bags','45 SF @ 3/8 in'])assert.ok(controlled.text.includes(label),label);
assert.ok(!working.text.includes('ISSUED FORMULATION'));assert.ok(!controlled.text.includes('NOT ISSUED'));
assert.ok(controlled.text.indexOf('True Grey #2')<controlled.text.indexOf('Filler'));assert.ok(controlled.text.indexOf('Filler')<controlled.text.indexOf('Resin / Part A'));assert.ok(controlled.text.indexOf('Resin / Part A')<controlled.text.indexOf('Hardener / Part B'));
const stress=structuredClone(issued);stress.notes='Long operational note. '.repeat(160);stress.blendRows=[...Array.from({length:60},(_,i)=>({...sample.blendRows[0],percentage:String(100/60),color:`Material-${String(i).padStart(3,'0')} `+'Long descriptive chip '.repeat(10),vendor:'Supplier name '.repeat(8),size:'Large #1'})),...sample.blendRows.slice(-3)];
const long=await check(stress,'issued','overflow');assert.ok(long.pages>2);for(let i=0;i<60;i++)assert.equal(long.text.split(`Material-${String(i).padStart(3,'0')}`).length-1,1);
assert.ok(long.text.indexOf('Material-059')<long.text.indexOf('Filler'));assert.ok(long.text.indexOf('Filler')<long.text.indexOf('Resin / Part A'));assert.ok(long.text.indexOf('Resin / Part A')<long.text.indexOf('Hardener / Part B'));
console.log(JSON.stringify({output,workingPages:working.pages,issuedPages:controlled.pages,overflowPages:long.pages,checks:'source labels on every page, exact quantities, semantic ordering, unique rows, bounded text and rendered PNGs passed'}));
