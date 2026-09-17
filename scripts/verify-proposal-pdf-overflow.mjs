import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const worktree=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const outputDirectory=`${worktree}/output/pdf`;
mkdirSync(outputDirectory,{recursive:true});
const harnessDirectory=mkdtempSync(join(tmpdir(),'tenops-proposal-v2-overflow-'));

async function extractPdfText(path) {
  const document=await pdfjs.getDocument({data:new Uint8Array(readFileSync(path))}).promise;
  const pages=[];
  const pageItems=[];
  for(let pageNumber=1;pageNumber<=document.numPages;pageNumber+=1){
    const page=await document.getPage(pageNumber);
    const content=await page.getTextContent();
    pages.push(content.items.map((item)=>item.str).join(' '));
    pageItems.push(content.items);
  }
  return {text:pages.join('\n'),pages,pageItems};
}

function assertTailMarkers(text,markers,label) {
  const compactText=text.replace(/\s+/g,'');
  markers.forEach((marker)=>assert.ok(compactText.includes(marker.replace(/\s+/g,'')),`${label} PDF dropped tail marker: ${marker}`));
  assert.doesNotMatch(text,/\.\.\./,`${label} PDF must not replace authored content with ellipses`);
}

function fileImport(path) {
  return JSON.stringify(pathToFileURL(path).href);
}

function createEdgeHarness({name,sourcePath,startMarker,endMarker,imports,fixture,invocation}) {
  const source=readFileSync(sourcePath,'utf8');
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker);
  assert.ok(start>=0&&end>start,`${name} renderer boundaries were not found`);
  const generatedPath=join(harnessDirectory,`${name}-overflow.generated.mts`);
  writeFileSync(generatedPath,`${imports}\n${source.slice(start,end)}\nconst fixture=${JSON.stringify(fixture)};\n${invocation}\n`);
  execFileSync(process.execPath,['--import','tsx',generatedPath],{cwd:worktree,stdio:'inherit'});
}
const outputPath=`${outputDirectory}/proposal-v2-overflow-stress.pdf`;
const fixture={
  estimate_number:'Q26-9999-1.0',
  proposal_date:'2026-09-10',
  customer_name:'Customer '+('identity '.repeat(20))+'PROPOSAL-CUSTOMER-TAIL',
  customer_street:'Street line one',
  customer_address_line_2:'Suite line two\nBuilding line three\nDistrict line four\nCountry line five PROPOSAL-ADDRESS-TAIL',
  customer_city:'Carrollton',
  customer_state:'TX',
  customer_postal_code:'75007',
  customer_contact_name:'Contact '+('person '.repeat(18))+'PROPOSAL-CONTACT-NAME-TAIL',
  customer_office_phone:'555-1000',
  customer_mobile_phone:'555-2000',
  customer_email:'long-'+('segment-'.repeat(30))+'PROPOSAL-CONTACT-TAIL@example.com',
  project_name:'Project '+('identity '.repeat(20))+'PROPOSAL-PROJECT-TAIL',
  project_number:'26-9999',
  project_location:'Location '+('detail '.repeat(20))+'PROPOSAL-LOCATION-TAIL',
  side_mark:'Side '+('mark '.repeat(30))+'PROPOSAL-SIDE-TAIL',
  sales_rep:'Anthony '+('representative '.repeat(12))+'PROPOSAL-REP-TAIL',
  terms:'Terms '+('commercial '.repeat(24))+'PROPOSAL-TERMS-TAIL',
  valid_days:'30',
  requested_delivery:'Delivery',
  fob:'FOB '+('location '.repeat(26))+'PROPOSAL-FOB-TAIL',
  submitted_by_name:'Anthony Iorio',
  submitted_by_phone:'555-3000',
  submitted_by_email:'sales-'+('segment-'.repeat(22))+'PROPOSAL-SENDER-TAIL@example.com',
  notes:Array.from({length:95},(_,index)=>`PROPOSAL-NOTE-${index+1} retained`).join('\n')+'\nPROPOSAL-NOTES-TAIL',
  formula_snapshot:Array.from({length:90},(_,index)=>`PROPOSAL-FORMULA-${index+1} retained`).join('\n')+'\nPROPOSAL-FORMULA-TAIL',
  disclaimer_snapshot:
    'Material disclaimer '+('detail '.repeat(420))+'PROPOSAL-DISCLAIMER-A-TAIL\n\n'+
    'Dimension disclaimer '+('detail '.repeat(420))+'PROPOSAL-DISCLAIMER-B-TAIL',
  tax_enabled:true,
  tax_rate:8.25,
  lines:[{
    line_type:'product',
    item_number:'1',
    description:'SMART “QUOTE” — BULLET • '+Array.from({length:220},(_,index)=>`PROPOSAL-DESCRIPTION-${index+1}`).join(' ')+' PROPOSAL-DESCRIPTION-TAIL',
    ref:'REF-'+('segment-'.repeat(30))+'PROPOSAL-REF-TAIL',
    color_plate:'COLOR-'+('segment-'.repeat(20))+'PROPOSAL-COLOR-TAIL',
    quantity:'100',
    unit:'ea.',
    length:'120',
    width:'30',
    height_thickness:'2',
    cft:'20',
    lf:'100',
    estimated_weight:'18000',
    rate:50,
    total:5000,
  }],
};
createEdgeHarness({name:'proposal-v2',sourcePath:`${worktree}/supabase/functions/generate-proposal-pdf/index.ts`,startMarker:'const safe =',endMarker:"if (typeof Deno !== 'undefined')",fixture,imports:`import {writeFileSync} from 'node:fs';import {PDFDocument,StandardFonts,rgb} from ${fileImport(`${worktree}/node_modules/pdf-lib/cjs/index.js`)};import {buildProposalPdfModel,paginateProposalPdf,proposalPdfColumns,PROPOSAL_ESCALATION_NOTICE,PROPOSAL_LEAD_TIME_NOTICE,PROPOSAL_PDF_VERSION,wrapProposalText} from ${fileImport(`${worktree}/supabase/functions/generate-proposal-pdf/proposal-pdf-model.ts`)};import {tenartenLogo} from ${fileImport(`${worktree}/supabase/functions/generate-proposal-pdf/tenarten-logo.ts`)};import {normalizePdfText} from ${fileImport(`${worktree}/supabase/functions/_shared/pdf-text.mjs`)};`,invocation:`const bytes=await render(fixture);writeFileSync(${JSON.stringify(outputPath)},bytes);`});
const extracted=await extractPdfText(outputPath);
assertTailMarkers(extracted.text,['PROPOSAL-CUSTOMER-TAIL','PROPOSAL-ADDRESS-TAIL','PROPOSAL-CONTACT-NAME-TAIL','PROPOSAL-CONTACT-TAIL','PROPOSAL-PROJECT-TAIL','PROPOSAL-LOCATION-TAIL','PROPOSAL-SIDE-TAIL','PROPOSAL-REP-TAIL','PROPOSAL-TERMS-TAIL','PROPOSAL-FOB-TAIL','PROPOSAL-SENDER-TAIL','PROPOSAL-NOTES-TAIL','PROPOSAL-FORMULA-TAIL','PROPOSAL-DISCLAIMER-A-TAIL','PROPOSAL-DISCLAIMER-B-TAIL','PROPOSAL-DESCRIPTION-TAIL','PROPOSAL-REF-TAIL','PROPOSAL-COLOR-TAIL'],'Proposal V2');
const compactPages=extracted.pages.map((page)=>page.replace(/\s+/g,''));
assert.match(compactPages[0],/Project#26-9999/, 'first page must show Project # separately');
assert.match(compactPages[0],/ProjectNameProject.*PROPOSAL-PROJECT-TAIL/, 'first page must show Project Name separately');
assert.match(compactPages[0],/ProjectLocationLocation.*PROPOSAL-LOCATION-TAIL/, 'first page must show Project Location separately');
assert.match(compactPages[0],/RequesteddeliverydateDelivery/, 'authored Delivery must remain unchanged beneath the explicit caption');
assert.match(extracted.text,/SMART "QUOTE" - BULLET \*/, 'smart punctuation must normalize without replacement glyphs');
assert.doesNotMatch(extracted.text,/\?{3,}/, 'normalized PDF text must not contain question-mark replacement runs');
const continuationHeaderItems=extracted.pageItems[2];
const continuationBrand=continuationHeaderItems.find((item)=>item.str==='Tenarten Terrazzo');
const continuationEstimate=continuationHeaderItems.find((item)=>item.str.startsWith('Estimate Q26-9999-1.0'));
const continuationPageLabel=continuationHeaderItems.find((item)=>item.str.startsWith('Page 3 of '));
const continuationProjectNumber=continuationHeaderItems.find((item)=>item.str==='Project #: 26-9999');
assert.ok(continuationBrand&&continuationEstimate&&continuationPageLabel&&continuationProjectNumber,'continuation identity items must render');
assert.ok(continuationBrand.transform[4]+continuationBrand.width+8<continuationEstimate.transform[4],'continuation brand and bold Estimate identity must not overlap');
assert.ok(continuationProjectNumber.transform[4]+continuationProjectNumber.width+8<continuationPageLabel.transform[4],'continuation Project identity and page number must not overlap');
const formulaPageIndexes=compactPages.flatMap((page,index)=>page.includes('PROPOSAL-FORMULA-')?[index]:[]);
const notePageIndexes=compactPages.flatMap((page,index)=>page.includes('PROPOSAL-NOTE-')?[index]:[]);
assert.ok(Math.max(...formulaPageIndexes)<Math.min(...notePageIndexes),'rendered formula pages must precede rendered notes pages');
assert.ok(compactPages.findIndex((page)=>page.includes('PROPOSAL-DISCLAIMER-A-TAIL'))>0,'long material disclaimers must continue beyond page one');
assert.ok(compactPages.findIndex((page)=>page.includes('PROPOSAL-DISCLAIMER-B-TAIL'))>0,'long dimension disclaimers must continue beyond page one');
rmSync(harnessDirectory,{recursive:true,force:true});
console.log(`Proposal V2 overflow stress verifier passed (${extracted.pages.length} pages).`);
