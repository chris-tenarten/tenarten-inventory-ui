import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {calculateSampleFormulation,applyFormulationProfile,standardFormulationState,SAMPLE_FORMULATION_PROFILES,BATCH_FIRST_VERSION,batchFirstQuantities} from '../src/modules/samples/formulation';
import {projectSampleBatch,deriveBatchReference} from '../src/modules/samples/batch-projection';
import {productionBatchReadiness,buildProductionBatchModel,packageEquivalent} from '../supabase/functions/_shared/sample-production-batch.mjs';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index';
import {renderProductionBatch} from '../supabase/functions/_shared/production-batch-pdf';
import {buildSamplePdfModel} from '../supabase/functions/_shared/sample-work-order-pdf-model.mjs';
import {batchFirstProfile} from './support/sample-batch-first-fixture';
const profile=batchFirstProfile;
const state=applyFormulationProfile(standardFormulationState(),profile);
const row=(role:string,p='')=>({color:role==='aggregate'?'Blanco Mexicano':role,percentage:p,quantity:'',unit:['resin','hardener'].includes(role)?'fl oz':'oz',componentRole:role,quantityProvenance:'calculated',calculationBasis:role==='aggregate'?'target_total':null});
const close=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.equal(state.calculationVersion,BATCH_FIRST_VERSION);
let representative:any;
for(const blend of [[40,30,20,5,5],[50,25,25],[30,40,30]]){
 const rows:any[]=[...blend.map(p=>row('aggregate',String(p))),row('filler'),row('resin'),row('hardener')];
 const q=batchFirstQuantities(state,rows),batch=projectSampleBatch(state,rows);
 assert.equal(q.availableChipMixOz,'64');assert.equal(q.effectiveFillerOz,'18');assert.equal(q.actualDryTotalOz,'82');assert.equal(q.effectiveChipDensityLbCft,'128');close(q.fraction,1/45);
 close(q.rows.at(-3)!.exact,800/45);close(q.rows.at(-2)!.exact,640/45);close(q.rows.at(-1)!.exact,128/45);
 assert.deepEqual(batch.rows.slice(-3).map(r=>r.quantity),[50,5,1]);assert.deepEqual(batch.rows.slice(0,blend.length).map(r=>r.quantity),blend.map(p=>180*p/100));assert.equal(batch.complete,true);
 const altered=rows.map(r=>r.componentRole==='filler'?{...r,quantity:'64',quantityProvenance:'manual'}:r);
 const edited=batchFirstQuantities({...state,materialDensity:'32'},altered);assert.equal(edited.availableChipMixOz,'64');assert.equal(edited.effectiveChipDensityLbCft,'128');assert.equal(edited.actualDryTotalOz,'128');assert.deepEqual(projectSampleBatch(state,altered).rows,batch.rows);
 for(const [width,t] of [['6','.375'],['12','.375'],['24','.375'],['12','.75']]){
  const changed={...state,width,thicknessIn:t};const c=batchFirstQuantities(changed,rows);close(c.rows.at(-3)!.exact,50*16*Number(width)/12*Number(t)/12/(180/128));assert.deepEqual(projectSampleBatch(changed,rows).rows,batch.rows);
 }
 const snapshot={sampleName:'MTT Batch-first',preparedBy:'Marcos',formulation:state,blendRows:rows};assert.equal(productionBatchReadiness(snapshot).ready,true);assert.equal(buildProductionBatchModel(snapshot,'working').rows.length,rows.length);
 assert.equal(projectSampleBatch(state,rows.map((r,i)=>i===0?{...r,percentage:'1'}:r)).complete,false);
 representative??=snapshot;
}
assert.deepEqual(deriveBatchReference(state),{chipTargetLb:180,chipDensityLbCft:128,referenceThicknessIn:.375,referenceThicknessFt:.03125,volumeCft:1.40625,coverageSf:45,chipRateLbSf:4});
const unknown=structuredClone(state);unknown.profile!.batchContract!.components.filler!.exact=null;unknown.profile!.batchContract!.components.filler!.authority='unresolved';assert.equal(productionBatchReadiness({...representative,formulation:unknown}).ready,false);
const noGeometry={...state,length:'',width:'',thicknessIn:''};assert.equal(productionBatchReadiness({...representative,formulation:noGeometry}).ready,true);
const legacy=applyFormulationProfile(standardFormulationState(),SAMPLE_FORMULATION_PROFILES[2]);assert.equal(calculateSampleFormulation(legacy,representative.blendRows).effectiveFillerOz,'16');assert.equal(productionBatchReadiness({...representative,formulation:legacy}).ready,false);
const packageRow={catalogSource:'regular',catalogItemId:'x',catalogSnapshot:{package_context:{version:1,catalog_source:'regular',catalog_item_id:'x',amount:'50',unit:'lb',container:'bag'}}};close(packageEquivalent(packageRow,72)?.equivalent??null,1.44);assert.equal(packageEquivalent({},72),null);
const model=buildSamplePdfModel(representative);assert.equal(model.rows.at(-3).quantity,'18');assert.ok(model.formulationSummary.includes('Shop dry: 82'));
mkdirSync('output/pdf/batch-first',{recursive:true});writeFileSync('output/pdf/batch-first/MTT-Working-Sample.pdf',await renderSampleWorkOrder(representative));writeFileSync('output/pdf/batch-first/MTT-Production-Batch.pdf',await renderProductionBatch(representative,'working'));
writeFileSync('output/pdf/batch-first/fixture.json',JSON.stringify(representative,null,2));
console.log('Batch-first calculations, authority gates, proportions, shop isolation, package and PDF models PASS');
