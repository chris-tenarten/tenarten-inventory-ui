import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {PDFDocument} from 'pdf-lib';
import {applyResinIdentity,synchronizeResin,resinConflict} from '../src/modules/samples/resin-identity';
import {newLocalSample,blankSampleBlendRow} from '../src/modules/samples/types';
import {applyFormulationProfile,standardFormulationState} from '../src/modules/samples/formulation';
import {batchFirstProfile} from './support/sample-batch-first-fixture';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index';
import {projectSampleBatch} from '../src/modules/samples/batch-projection';
let sample=applyResinIdentity(newLocalSample({preparedBy:'Marcos',formulation:applyFormulationProfile(standardFormulationState(),{...batchFirstProfile,vendorName:'MTT'})}),applyFormulationProfile(standardFormulationState(),{...batchFirstProfile,vendorName:'MTT'}));
assert.equal(sample.resinSupplier,'MTT');assert.equal(sample.blendRows[2].color,'MTT Resin');assert.equal(sample.resinColorNumber,'');
sample=synchronizeResin(sample,'setup','K-123 White');assert.equal(sample.blendRows[2].color,'K-123 White');assert.equal(resinConflict(sample),false);
sample=synchronizeResin(sample,'row','K-456 Ivory');assert.equal(sample.resinColorNumber,'K-456 Ivory');
const key={...sample.formulation,profile:{...sample.formulation.profile!,vendorName:'Key Resin',name:'Key Resin — 5:1'}};
sample=applyResinIdentity(sample,key);assert.equal(sample.resinColorNumber,'K-456 Ivory');assert.equal(sample.blendRows[2].color,'K-456 Ivory');assert.equal(sample.resinSupplier,'Key Resin');assert.equal(sample.blendRows[3].color,'Key Hardener');assert.equal(sample.blendRows[3].vendor,'Key Resin');
const independent={...sample,resinColorNumber:'Other authored value'};assert.equal(resinConflict(independent),true);const conflict=synchronizeResin(independent,'row','New row description');assert.equal(conflict.resinColorNumber,'Other authored value');assert.equal(resinConflict(conflict),true);assert.equal(synchronizeResin(conflict,'setup',conflict.resinColorNumber,true).blendRows[2].color,'Other authored value');
const rowFirst=synchronizeResin({...sample,resinColorNumber:''},'row','Row first');assert.equal(rowFirst.resinColorNumber,'Row first');
const generic=applyResinIdentity(newLocalSample({preparedBy:'Marcos',formulation:sample.formulation}),key);assert.equal(generic.blendRows[2].color,'Key Resin');assert.equal(generic.resinColorNumber,'');
const dir='output/pdf/gio';mkdirSync(dir,{recursive:true});
for(const count of [1,5,8,45]){
 const rows=Array.from({length:count},(_,i)=>({...blankSampleBlendRow(i),color:i%2?'Canadian New Royal Green':'Blanco Mexicano',percentage:String(100/count),size:'#1',materialType:'Marble',vendor:'Terrazzo & Marble Supply'})).concat(sample.blendRows.slice(1));
 const snapshot={...sample,sampleName:'Gio Sample review',render_context:'working',blendRows:rows};const bytes=await renderSampleWorkOrder(snapshot);const pdf=await PDFDocument.load(bytes);assert.equal(count<=8?pdf.getPageCount()===1:pdf.getPageCount()>1,true,`Unexpected page count ${count}: ${pdf.getPageCount()}`);writeFileSync(`${dir}/working-${count}.pdf`,bytes);
 assert.equal(projectSampleBatch(sample.formulation,rows).target,180);
}
console.log('PASS vendor defaults, generic/authored profile changes, two-way sync/conflict resolution, 1/5/8 aggregates one page, 45 aggregates safe pagination.');
