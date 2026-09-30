import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildSamplePdfModel, paginateSampleRows } from '../supabase/functions/_shared/sample-work-order-pdf-model.mjs';
import { createEdgeHarness, extractPdfText, fileImport, outputDirectory, repoRoot } from './pdf-overflow-stress-utils.mjs';

const aggregate = (index) => ({ component_role:'aggregate', percentage:String(index+1), color:`Chip ${index+1}`, size:'#1', material_type:'Marble', quantity_provenance:'calculated', calculated_quantity:String(index+0.5), unit:'oz', vendor:`Vendor ${index+1}` });
const tail = [
  { component_role:'filler', color:'ATF-20', material_type:'Filler', quantity:16, unit:'oz', vendor:'T&M Supply', quantity_provenance:'manual' },
  { component_role:'resin', color:'001 White', material_type:'Resin', quantity:15, unit:'fl oz', vendor:'Key Resin', quantity_provenance:'manual' },
  { component_role:'hardener', color:'Hardener', material_type:'Hardener', calculated_quantity:3, unit:'fl oz', vendor:'Key Resin', quantity_provenance:'calculated' },
];
const five = [
  ['40','Blanco Mexicano','#1','25.6','Marble','Arim'],
  ['30','Blanco Mexicano','#2','19.2','Marble','Arim'],
  ['20','Mother Of Pearl Modern','#2','12.8','Shell','Arim'],
  ['5','True Grey','#1','3.2','Marble','CCQ'],
  ['5','True Grey','#2','3.2','Marble','CCQ'],
].map(([percentage,color,size,calculated_quantity,material_type,vendor])=>({component_role:'aggregate',percentage,color,size,calculated_quantity,material_type,vendor,unit:'oz',quantity_provenance:'calculated'}));
const snapshot = {
  render_context:'working', prepared_by:'QA', sample_size:'6 x 6', sample_quantity:'4',
  formulation_state:{basis:'weight_per_sf',calculationVersion:'sample-formulation-v4-density-profile',profile:{name:'MTT'},resinParts:'5',hardenerParts:'1',materialDensity:'128',thicknessIn:'0.375',derived:{areaSf:1,productionVolumeCft:0.03125,availableChipMixOz:64,effectiveChipDensityLbCft:128,effectiveWeightPerSf:4,dryPoolOz:80,actualDryTotalOz:80,dryPoolVarianceOz:0,effectiveFillerOz:16,effectiveResinFlOz:15}},
};
const cases = [
  ['one', [aggregate(0)]], ['two', [aggregate(0),aggregate(1)]],
  ['cross-page', Array.from({length:18},(_,i)=>aggregate(i))],
  ['five',five], ['long',Array.from({length:45},(_,i)=>aggregate(i))],
].map(([name,aggregates])=>({name,expected:[...aggregates,...tail],snapshot:{...snapshot,blend_rows:[aggregates[0],...tail,...aggregates.slice(1)]}}));
const compact = (s)=>s.replace(/\s+/g,'');
const rowText = (row)=>compact([row.percentage,row.color,row.size,row.materialType,row.quantity,row.unit,row.vendor].join(' '));
for (const test of cases) {
  const original = structuredClone(test.snapshot);
  const model = buildSamplePdfModel(test.snapshot);
  const expected = test.expected.map(row=>buildSamplePdfModel({blend_rows:[row]}).rows[0]);
  assert.deepEqual(model.rows,expected,`${test.name}: every value and stable role order`);
  assert.deepEqual(test.snapshot,original,`${test.name}: source snapshot untouched`);
  assert.equal(model.formulationSummary,buildSamplePdfModel({...test.snapshot,blend_rows:[]}).formulationSummary);
  assert.deepEqual(paginateSampleRows(model.rows,100,510).flatMap(page=>page.rows),expected);
  test.expectedModel = expected;
}
// Camel-case preview payloads and stable repeated-role ordering use the same path.
const camel = [{componentRole:'hardener',color:'H'},{componentRole:'aggregate',color:'A1'},{componentRole:'other',color:'O'},{componentRole:'filler',color:'F1'},{componentRole:'aggregate',color:'A2'},{componentRole:'filler',color:'F2'},{componentRole:'resin',color:'R'}];
assert.deepEqual(buildSamplePdfModel({blendRows:camel}).rows.map(r=>r.color),['A1','A2','F1','F2','O','R','H']);
assert.deepEqual(buildSamplePdfModel({blend_rows:[{color:'Legacy Z'},{color:'Legacy A'}]}).rows.map(r=>r.color),['Legacy Z','Legacy A']);
assert.deepEqual(buildSamplePdfModel({...cases[3].snapshot,issue_number:1,render_context:'issued'}).rows,cases[3].expectedModel);
writeFileSync(`${outputDirectory}/sample-row-order-fixture.json`,JSON.stringify(cases[3].snapshot,null,2));
createEdgeHarness({name:'sample-row-order',sourcePath:`${repoRoot}/supabase/functions/generate-sample-pdf/index.ts`,startMarker:'const allowedOrigins',endMarker:'if (typeof Deno !== "undefined")',fixture:cases.map(({name,snapshot})=>({name,snapshot})),
  imports:`import {writeFileSync} from 'node:fs';import {PDFDocument,StandardFonts,rgb} from ${fileImport(`${repoRoot}/node_modules/pdf-lib/es/index.js`)};import {buildSamplePdfModel,paginateSampleRows,SAMPLE_PDF_VERSION,sampleRowHeight,wrapSampleText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/sample-work-order-pdf-model.mjs`)};import {normalizePdfText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/pdf-text.mjs`)};import {chunkPdfLines,wrapMeasuredPdfText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/pdf-layout.mjs`)};`,
  invocation:`void(async()=>{for(const test of fixture)writeFileSync(${JSON.stringify(outputDirectory)}+'/sample-row-order-'+test.name+'.pdf',await renderSampleWorkOrder(test.snapshot));})();`,
});
for (const test of cases) {
  const extracted=await extractPdfText(`${outputDirectory}/sample-row-order-${test.name}.pdf`);
  const text=compact(extracted.text);
  let cursor=0;
  for(const row of test.expectedModel){const needle=rowText(row);const position=text.indexOf(needle,cursor);assert.ok(position>=cursor,`${test.name}: missing/out-of-order ${needle}`);assert.equal(text.split(needle).length-1,1,`${test.name}: duplicate row`);cursor=position+needle.length;}
  assert.match(extracted.text,/WORKING SAMPLE - NOT ISSUED/);
  if(['one','two'].includes(test.name))assert.equal(extracted.pages.length,1);
  if(['cross-page','long'].includes(test.name)){
    assert.ok(extracted.pages.length>1);
    assert.match(extracted.pages[1],/WORKING POUR - CONTINUATION/);
    assert.ok(!extracted.pages[0].includes('ATF-20'),'tail is not forced onto page one');
  }
  console.log(`${test.name}: ${test.expectedModel.length} rows, ${extracted.pages.length} pages; all fields/order/uniqueness passed`);
}
