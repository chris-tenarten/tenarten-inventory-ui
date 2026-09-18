// Local candidate rendering of authenticated, saved/reopened hosted fixtures.
// Usage: node scripts/verify-purchasing-text-size-hosted-renderer.mjs <gate-directory> <downloaded-hosted-function-directory>
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createEdgeHarness,fileImport,repoRoot,assertTailMarkers,extractPdfText} from './pdf-overflow-stress-utils.mjs';
const directory=resolve(process.argv[2]);const hosted=resolve(process.argv[3]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const imports=(shared)=>`import {writeFileSync,readFileSync} from 'node:fs';import {degrees,PDFDocument,StandardFonts,rgb} from ${fileImport(`${repoRoot}/node_modules/pdf-lib/es/index.js`)};import {buildPurchaseOrderPdfModel,PURCHASE_ORDER_PDF_VERSION} from ${fileImport(`${shared}/purchase-order-pdf-model.mjs`)};import {normalizePdfText} from ${fileImport(`${shared}/pdf-text.mjs`)};import {chunkPdfLines,wrapMeasuredPdfText} from ${fileImport(`${shared}/pdf-layout.mjs`)};`;
async function textGeometry(path){const doc=await pdfjs.getDocument({data:new Uint8Array(readFileSync(path))}).promise;const pages=[];for(let n=1;n<=doc.numPages;n++){const content=await(await doc.getPage(n)).getTextContent();pages.push(content.items.filter(i=>i.str.trim()&&!i.str.startsWith('Generated ')).map(i=>({str:i.str,x:i.transform[4],y:i.transform[5],width:i.width,height:i.height})));}return pages;}
const evidence={hostedSourceSha256:hash(readFileSync(`${hosted}/generate-purchase-order-pdf/index.ts`)),candidateSourceSha256:hash(readFileSync(`${repoRoot}/supabase/functions/generate-purchase-order-pdf/index.ts`)),fixtures:{}};
for(const file of readdirSync(directory).filter(f=>f.endsWith('-snapshot.json'))){
 const label=file.replace('-snapshot.json',''),fixture=JSON.parse(readFileSync(`${directory}/${file}`));const draft=!label.startsWith('issued-');
 const timestamp=draft?(await PDFDocument.load(readFileSync(`${directory}/${label}-live.pdf`))).getCreationDate().toISOString():'2026-09-18T12:00:00.000Z';
 const candidatePath=`${directory}/${label}-candidate.pdf`;
 function render(sourcePath,shared,path){createEdgeHarness({name:'po-hosted-candidate',sourcePath,startMarker:'const safeText',endMarker:'Deno.serve(',fixture,imports:imports(shared),invocation:`void(async()=>{const logo='data:image/png;base64,'+readFileSync(${JSON.stringify(`${repoRoot}/public/logo.png`)}).toString('base64');const bytes=await renderPdf(fixture.orderSnapshot,fixture.linesSnapshot,new Date(${JSON.stringify(timestamp)}),logo,${draft});writeFileSync(${JSON.stringify(path)},bytes);})();`});}
 render(`${repoRoot}/supabase/functions/generate-purchase-order-pdf/index.ts`,`${repoRoot}/supabase/functions/_shared`,candidatePath);
 const extracted=await extractPdfText(candidatePath);assertTailMarkers(extracted.text,['ITEM','SKU','DESCRIPTION','QTY','UNIT','UNIT PRICE','TOTAL'],label);
 if(label.startsWith('long-mixed'))assertTailMarkers(extracted.text,['ADDRESS-TAIL','CONTACT-TAIL','SHIP-TAIL','DESCRIPTION-TAIL','NOTES-TAIL'],label);
 const candidate=await textGeometry(candidatePath);for(const page of candidate)for(const item of page){if(item.str==='DRAFT - NOT ISSUED')continue;assert(item.x>=31&&item.x+item.width<=581,`${label}: horizontal overflow ${item.str}`);assert(item.y>=21,`${label}: footer overflow`);}
 const preset=fixture.orderSnapshot.pdf_text_size;const sku=candidate.flat().find(i=>i.str==='SKU-chip');assert(sku);assert(Math.abs(sku.height-({compact:5.6,standard:6.2,large:8}[preset]))<0.01);
 const row={preset,pages:extracted.pages.length,rowFontSize:sku.height,pdfSha256:hash(readFileSync(candidatePath))};
 if(draft){const live=await textGeometry(`${directory}/${label}-live.pdf`);row.liveRowFontSize=live.flat().find(i=>i.str==='SKU-chip')?.height;
  if(label==='normal-standard'){
   const baselinePath=`${directory}/normal-standard-downloaded-hosted.pdf`;render(`${hosted}/generate-purchase-order-pdf/index.ts`,`${hosted}/_shared`,baselinePath);
   assert.deepEqual(candidate,await textGeometry(baselinePath),'Standard candidate must preserve downloaded hosted normal geometry');
   assert.deepEqual(candidate,live,'Standard candidate must preserve live normal text geometry');row.standardLiveGeometryIdentical=true;row.standardDownloadedBytesIdentical=hash(readFileSync(candidatePath))===hash(readFileSync(baselinePath));
  }
 }
 evidence.fixtures[label]=row;
}
writeFileSync(`${directory}/renderer-report.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
