import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {applyFormulationProfile,standardFormulationState,calculateSampleFormulation,SAMPLE_FORMULATION_PROFILES} from '../src/modules/samples/formulation';
import {batchFirstProfile} from './support/sample-batch-first-fixture';
import {batchFirstQuantities,resolveBatchFiller,FILLER_SUBSTITUTION_RULE} from '../supabase/functions/_shared/sample-batch-first.mjs';
import {projectSampleBatch,deriveBatchReference} from '../src/modules/samples/batch-projection';
import {buildProductionBatchModel,productionBatchReadiness,packageEquivalent} from '../supabase/functions/_shared/sample-production-batch.mjs';
import {renderProductionBatch} from '../supabase/functions/_shared/production-batch-pdf';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index';
const profile=structuredClone(batchFirstProfile);profile.batchContract.fillerSubstitution=FILLER_SUBSTITUTION_RULE;
const state=applyFormulationProfile(standardFormulationState(),profile),before=JSON.stringify(profile);
const close=(a:unknown,b:number)=>assert.ok(Math.abs(Number(a)-b)<.000001,`${a} != ${b}`);
let review:any;
for(const percentages of [[40,30,20,5,5],[50,25,25],[30,40,30]]) {
 const rows:any[]=[...percentages.map(percentage=>({componentRole:'aggregate',percentage:String(percentage),color:'Blanco Mexicano',calculationBasis:'target_total'})),...['filler','resin','hardener'].map(componentRole=>({componentRole,color:componentRole}))].map(r=>({...r,unit:['resin','hardener'].includes(r.componentRole)?'fl oz':'oz',quantity:'',quantityProvenance:'calculated'}));
 for(const override of [null,'100']) {
  const st={...state,batchFillerOverrideLb:override}, q=batchFirstQuantities(st,rows), b=projectSampleBatch(st,rows), target=override?130:180;
  assert.equal(b.target,target);assert.deepEqual(b.rows.slice(0,-3).map(r=>r.quantity),percentages.map(p=>target*p/100));
  assert.deepEqual(b.rows.slice(-3).map(r=>r.quantity),[override?100:50,5,1]);close(q.fraction,1/45);
  close(q.availableChipMixOz,target*16/45);close(q.rows.at(-3)?.exact,(override?100:50)*16/45);close(q.rows.at(-2)?.exact,640/45);close(q.rows.at(-1)?.exact,128/45);
  close(q.dryPoolOz,230*16/45);close(q.effectiveFillerOz,override?1600/45:18);close(q.effectiveResinFlOz,override?640/45:15);
  assert.equal(q.effectiveChipDensityLbCft,'128');assert.equal(deriveBatchReference(st)?.coverageSf,45);close(deriveBatchReference(st)?.chipRateLbSf,target/45);
  const twice=batchFirstQuantities({...st,width:'24'},rows);close(twice.availableChipMixOz,target*32/45);assert.equal(projectSampleBatch({...st,width:'24'},rows).target,target);
  const shop=rows.map(r=>r.componentRole==='filler'?{...r,quantity:'60',quantityProvenance:'manual'}:r);assert.deepEqual(projectSampleBatch(st,shop),b);
  const snapshot={sampleName:'MTT Filler formulation',preparedBy:'Marcos',formulation:st,blendRows:rows};
  assert.equal(productionBatchReadiness(snapshot).ready,true);assert.deepEqual(buildProductionBatchModel(snapshot,'working').rows.map(r=>r.role),rows.map(r=>r.componentRole));
  if(override)review=snapshot;
 }
 assert.equal(projectSampleBatch(state,rows.map((r,i)=>i===0?{...r,percentage:'1'}:r)).complete,false);
 assert.deepEqual(rows.slice(0,-3).map(r=>Number(r.percentage)),percentages);
}
for(const invalid of ['','-1','230','231','NaN'])assert.equal(resolveBatchFiller({...state,batchFillerOverrideLb:invalid}).valid,false);
assert.equal(resolveBatchFiller({...state,profile:batchFirstProfile,batchFillerOverrideLb:'100'}).valid,false);
assert.equal(JSON.stringify(profile),before);
const sherwin=structuredClone(profile);sherwin.batchChipTargetLb='150';sherwin.resinParts='4';sherwin.batchContract.components.filler!.exact='50';sherwin.batchContract.components.resin={exact:null,unit:'gal',authority:'unresolved',provenance:'Not established',shopWorking:{quantity:'16',unit:'fl oz',volumeCft:'.03125',rule:'historical_volume_rate',provenance:'Captured historical Sample binder'}};
const s4=applyFormulationProfile(state,sherwin);assert.equal(projectSampleBatch(s4,review.blendRows).target,150);assert.equal(projectSampleBatch({...s4,batchFillerOverrideLb:'100'},review.blendRows).target,100);assert.equal(productionBatchReadiness({...review,formulation:s4}).ready,false);
const q4=batchFirstQuantities({...s4,batchFillerOverrideLb:'100'},review.blendRows);assert.equal(q4.effectiveResinFlOz,'16');assert.equal(q4.rows.at(-1)?.shop,4);
const legacy=applyFormulationProfile(state,SAMPLE_FORMULATION_PROFILES[2]);assert.equal(calculateSampleFormulation(legacy,review.blendRows).effectiveFillerOz,'16');
const packageRow={catalogSource:'regular',catalogItemId:'chip',catalogSnapshot:{package_context:{version:1,catalog_source:'regular',catalog_item_id:'chip',amount:'50',unit:'lb',container:'bag'}}};close(packageEquivalent(packageRow,52)?.equivalent,1.04);assert.equal(packageEquivalent({},52),null);
const dir='output/pdf/filler-override';mkdirSync(dir,{recursive:true});
// Representative 40/30/20/5/5, retain all components and percentages in both documents.
review.blendRows=[40,30,20,5,5].map(percentage=>({...review.blendRows[0],percentage:String(percentage)})).concat(review.blendRows.slice(-3));
writeFileSync(`${dir}/MTT-modified-Working-Sample.pdf`,await renderSampleWorkOrder(review));writeFileSync(`${dir}/MTT-modified-Production-Batch.pdf`,await renderProductionBatch(review,'working'));writeFileSync(`${dir}/fixture.json`,JSON.stringify(review,null,2));
console.log('PASS 5:1 and 4:1 substitution, fixed yield/binder/baseline, percentages, exact/shop separation, invalid override gates, legacy, package conversions and both PDFs');
