import assert from 'node:assert/strict';
import {
  pdfPreviewInputKey,
  sampleWorkingPreviewInputKey,
  SessionPdfPreviewCache,
} from '../src/lib/pdf-preview-cache';

const base = {
  id:'draft-1',
  pdfTextSize:'standard',
  formulation:{calculationVersion:'sample-formulation-v4-density-profile',profile:{id:'standard',version:2}},
  lines:[{id:'line-1',quantity:'10',description:'Material'}],
};
const cache = new SessionPdfPreviewCache(2);
const standardKey = pdfPreviewInputKey(base);
const standardBlob = new Blob(['standard'],{type:'application/pdf'});
cache.set(standardKey,standardBlob);
assert.equal(cache.get(standardKey),standardBlob);
assert.notEqual(pdfPreviewInputKey({...base,pdfTextSize:'compact'}),standardKey);
assert.notEqual(pdfPreviewInputKey({...base,lines:[{...base.lines[0],quantity:'11'}]}),standardKey);
assert.notEqual(pdfPreviewInputKey({...base,formulation:{...base.formulation,profile:{id:'standard',version:3}}}),standardKey);
const compactKey=pdfPreviewInputKey({...base,pdfTextSize:'compact'});
const largeKey=pdfPreviewInputKey({...base,pdfTextSize:'large'});
cache.set(compactKey,new Blob(['compact']));
cache.set(largeKey,new Blob(['large']));
assert.equal(cache.get(standardKey),undefined,'least-recent entry must be bounded');
assert(cache.get(compactKey));
assert(cache.get(largeKey));
const poPresetCache = new SessionPdfPreviewCache(3);
for (const preset of ['compact','standard','large'] as const) {
  poPresetCache.set(pdfPreviewInputKey({...base,pdfTextSize:preset}),new Blob([preset]));
}
assert.equal(await poPresetCache.get(pdfPreviewInputKey({...base,pdfTextSize:'standard'}))?.text(),'standard');
assert.equal(await poPresetCache.get(pdfPreviewInputKey({...base,pdfTextSize:'large'}))?.text(),'large');

const poRenderInput = (pdfTextSize:'compact'|'standard'|'large', quantity='10') => ({
  action:'draft-preview',
  orderSnapshot:{po_number:'DRAFT',pdf_text_size:pdfTextSize,vendor_name:'Vendor',updated_at:undefined},
  linesSnapshot:[{line_number:1,material:'Material',quantity}],
});
const lifecycle = {save:0,reload:0,edge:0};
const preview = (input:ReturnType<typeof poRenderInput>) => {
  const key=pdfPreviewInputKey(input);
  const hit=poPresetCache.get(key);
  if(hit)return hit;
  lifecycle.save+=1;lifecycle.reload+=1;lifecycle.edge+=1;
  const blob=new Blob([input.orderSnapshot.pdf_text_size]);
  poPresetCache.set(key,blob);
  return blob;
};
const firstStandard=preview(poRenderInput('standard'));
const firstLarge=preview(poRenderInput('large'));
const beforeStandardReturn={...lifecycle};
assert.equal(preview(poRenderInput('standard')),firstStandard);
assert.deepEqual(lifecycle,beforeStandardReturn,'cached preset return must perform zero save, reload, or Edge work');
const firstCompact=preview(poRenderInput('compact'));
const beforeAllCached={...lifecycle};
assert.equal(preview(poRenderInput('compact')),firstCompact);
assert.equal(preview(poRenderInput('large')),firstLarge);
assert.equal(preview(poRenderInput('standard')),firstStandard);
assert.deepEqual(lifecycle,beforeAllCached,'all three cached presets must remain reusable');
assert.notEqual(preview(poRenderInput('standard','11')),firstStandard,'rendered edits must invalidate cached previews');

const sample = {
  id:'sample-1',sampleName:'Trial',bidId:'',jobId:'',requestedBy:'Chris',requestedDate:'2026-09-21',projectName:'Project',preparedBy:'Chris',customerName:'Customer',colorPlateNumber:'T26-999-A',finishRequested:'200 Grit',sampleSize:'6 x 6',sampleQuantity:'4',notes:'Notes',filler:'ATF-20',sealer:'TerraGlaze',resinSupplier:'Key Resin',resinColorNumber:'001 White',moreNotes:'',approvedDate:'',createdByUserId:'user-1',creatorName:'Chris',createdAt:'2026-09-21T10:00:00Z',updatedAt:'2026-09-21T10:00:00Z',jobNumber:'26-9999',
  formulation:{calculationVersion:'sample-formulation-v4-density-profile',profile:{id:'standard',version:2},derived:{availableChipMixOz:64}},
  blendRows:[{id:'row-1',percentage:'100',color:'Alaska White',size:'#1',materialType:'Marble',quantity:'64',calculatedQuantity:'64',quantityProvenance:'calculated',unit:'oz',vendor:'KCI',catalogSource:null,catalogItemId:null,catalogSnapshot:{},displayOrder:0,componentRole:'aggregate',calculationBasis:'target_total'}],
  workingVersions:[],issuedDocuments:[],
};
const sampleKey=sampleWorkingPreviewInputKey(sample);
const timestampChanged={...sample};timestampChanged.updatedAt='2026-09-21T11:00:00Z';
assert.equal(sampleWorkingPreviewInputKey(timestampChanged),sampleKey,'server timestamps must not invalidate Sample previews');
const versionsChanged={...sample,workingVersions:[{id:'v1'}]};
assert.equal(sampleWorkingPreviewInputKey(versionsChanged),sampleKey,'version-list bookkeeping must not invalidate current Working Sheet previews');
assert.notEqual(sampleWorkingPreviewInputKey({...sample,notes:'Changed rendered notes'}),sampleKey,'rendered Sample fields must invalidate previews');
assert.notEqual(sampleWorkingPreviewInputKey({...sample,formulation:{...sample.formulation,derived:{availableChipMixOz:60}}}),sampleKey,'Sample calculations must invalidate previews');

console.log('PDF preview cache verifier passed: three PO presets hit independently with zero persistence/Edge work; rendered edits invalidate; server metadata is ignored for Sample Working Sheets; cache is session-scoped and bounded.');
