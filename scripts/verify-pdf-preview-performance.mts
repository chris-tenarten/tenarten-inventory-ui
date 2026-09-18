import assert from 'node:assert/strict';
import { pdfPreviewInputKey, SessionPdfPreviewCache } from '../src/lib/pdf-preview-cache';

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
console.log('PDF preview cache verifier passed: exact repeats hit; edits, presets, and profile versions invalidate; cache is bounded.');
