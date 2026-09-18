import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { normalizePdfTextSize } from '../supabase/functions/_shared/pdf-text-size.mjs';
import { assertTailMarkers,createEdgeHarness,extractPdfText,fileImport,outputDirectory,repoRoot } from './pdf-overflow-stress-utils.mjs';

const longDescription=Array.from({length:170},(_,index)=>`PO-DESCRIPTION-${index+1}`).join(' ')+' PO-DESCRIPTION-TAIL';
const fixture={
  order:{po_number:'PO-OVERFLOW-STRESS',po_date:'2026-09-10',status:'draft',material_classification:'mixed',template_name:'tenops',template_version:2,vendor_name:'Overflow Vendor Company',vendor_address:'Street line one\nSuite and building line two\nDistrict line three\nCity state postal line four\nCountry line five\nDelivery instruction line six\nPO-ADDRESS-TAIL',vendor_contact:'Buyer Name | Senior Procurement Manager | 555-111-2222 | '+('contact-without-breaks-'.repeat(14))+'PO-CONTACT-TAIL',production_job_id:'job',job_number:'26-9999',job_name:'Long Project Identity for Overflow Verification',ship_to:'Receiving Dock\nBuilding A\nFloor 2\nRoom 230\nCarrollton Texas\nAttention Logistics\nPO-SHIP-TAIL',payment_terms:'Net 30',requested_date:'2026-09-30',originated_by:'Quality Gate',authorized_by:'Release Gate',commercial_notes:Array.from({length:70},(_,index)=>`PO-NOTE-${index+1} retained content`).join('\n')+'\nPO-NOTES-TAIL',subtotal:2,tax_amount:0,freight:0,total:2},
  lines:[{line_number:1,line_kind:'chip',material:'Alaska White',vendor_sku:'AW-STRESS',chip_size:'#1',container_size:'50 LB',container:'Bag',quantity:1,unit:'Bag',unit_price:1,line_total:1,description:longDescription},{line_number:2,line_kind:'resin',material:'Resin',vendor_sku:'RESIN-STRESS',resin_color:'Blue',component_type:'Part A',container_size:'5 GAL',container:'Pail',quantity:1,unit:'gal',unit_price:1,line_total:1,description:'PO-SECOND-LINE-TAIL'}],
};
assert.equal(normalizePdfTextSize(undefined), 'standard');
assert.equal(normalizePdfTextSize('huge'), 'standard');
fixture.lines.push(...['pigment','filler','other'].map((kind,index)=>({...fixture.lines[1],line_number:index+3,line_kind:kind,material:kind,description:`PO-${kind.toUpperCase()}-TAIL`})));
const normal = {
  order: {...fixture.order, po_number:'PO-TEXT-SIZE', vendor_address:'123 Industrial Way\nCarrollton, TX 75007', vendor_contact:'Pat Smith | Purchasing | pat@example.com | 555-0100', ship_to:'Tenarten Terrazzo\n2933 Eisenhower St., Suite 120\nCarrollton, TX 75007', commercial_notes:'Deliver to receiving dock. Call before delivery.'},
  lines: fixture.lines.map(line=>({...line, description:'Representative material for shop production'})),
};
const imports=`import {writeFileSync,readFileSync} from 'node:fs';import {degrees,PDFDocument,StandardFonts,rgb} from ${fileImport(`${repoRoot}/node_modules/pdf-lib/es/index.js`)};import {buildPurchaseOrderPdfModel,PURCHASE_ORDER_PDF_VERSION} from ${fileImport(`${repoRoot}/supabase/functions/_shared/purchase-order-pdf-model.mjs`)};import {normalizePdfText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/pdf-text.mjs`)};import {chunkPdfLines,wrapMeasuredPdfText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/pdf-layout.mjs`)};`;
const identityOverflow = {order:{...normal.order, vendor_name:('Very Long Company '.repeat(25))+'NAME-END', vendor_address:('Address line\n'.repeat(40))+'ADDRESS-END', vendor_contact:('unbroken-contact-'.repeat(100))+'CONTACT-END', ship_to:('Receiving instruction\n'.repeat(40))+'SHIP-END', originated_by:'Long originator '.repeat(20)+'ORIGIN-END', authorized_by:'Long authorizer '.repeat(20)+'AUTH-END'},lines:normal.lines};
for (const [name, source] of [['normal',normal],['long-mixed',fixture],['identity-overflow',identityOverflow]]) {
  for (const preset of ['compact','standard','large']) {
    assert.equal(normalizePdfTextSize(preset), preset);
    const outputPath=`${outputDirectory}/purchase-order-${name}-${preset}.pdf`;
    createEdgeHarness({name:'purchase-order',sourcePath:`${repoRoot}/supabase/functions/generate-purchase-order-pdf/index.ts`,startMarker:'const safeText',endMarker:'Deno.serve(',fixture:{...source,order:{...source.order,pdf_text_size:preset}},imports,invocation:`void(async()=>{const logo='data:image/png;base64,'+readFileSync(${JSON.stringify(`${repoRoot}/public/logo.png`)}).toString('base64');const bytes=await renderPdf(fixture.order,fixture.lines,new Date('2026-09-10T12:00:00Z'),logo,true);writeFileSync(${JSON.stringify(outputPath)},bytes);})();`});
    if (name === 'normal' && preset === 'standard') {
      // Original renderer at 3ed0b50, identical fixture/date/logo: byte-for-byte compatibility.
      assert.equal(createHash('sha256').update(readFileSync(outputPath)).digest('hex'), 'ce8a44e02d567d4424508cb2571edf2795f16ef1d97d7a340d821b8913b72682');
    }
    const document = await pdfjs.getDocument({data:new Uint8Array(readFileSync(outputPath))}).promise;
    for (let pageNumber=1;pageNumber<=document.numPages;pageNumber++) {
      const content=await (await document.getPage(pageNumber)).getTextContent();
      for (const item of content.items) {
        if (!item.str.trim() || item.str === 'DRAFT - NOT ISSUED') continue;
        assert.ok(item.transform[4] >= 31 && item.transform[4]+item.width <= 581, `${name} ${preset} horizontal overflow: ${item.str}`);
        assert.ok(item.transform[5] >= 21, `${name} ${preset} below footer: ${item.str}`);
        if (item.transform[5] > 23) assert.ok(item.transform[5] >= 40, 'Content must stay above footer');
      }
    }
    const extracted=await extractPdfText(outputPath);
    if(name==='identity-overflow') assertTailMarkers(extracted.text,['NAME-END','ADDRESS-END','CONTACT-END','SHIP-END','ORIGIN-END','AUTH-END','DETAILS - CONTINUED'],`Identity ${preset}`);
    assertTailMarkers(extracted.text,['ITEM','SKU','DESCRIPTION','QTY','UNIT','UNIT PRICE','TOTAL'],'Seven-column header');
    if(name==='long-mixed') assertTailMarkers(extracted.text,['PO-ADDRESS-TAIL','PO-CONTACT-TAIL','PO-SHIP-TAIL','PO-DESCRIPTION-TAIL','PO-SECOND-LINE-TAIL','PO-PIGMENT-TAIL','PO-FILLER-TAIL','PO-OTHER-TAIL','PO-NOTES-TAIL'],`Purchase Order ${preset}`);
    console.log(`${name} ${preset} passed (${extracted.pages.length} pages).`);
  }
}
