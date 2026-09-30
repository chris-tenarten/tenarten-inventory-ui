import assert from 'node:assert/strict';
import {buildProductionBatchModel,captureBatchPackage,packageEquivalent,productionBatchReadiness} from '../supabase/functions/_shared/sample-production-batch.mjs';
import {standardFormulationState,SAMPLE_FORMULATION_PROFILES,applyFormulationProfile} from '../src/modules/samples/formulation';
import {newLocalSample} from '../src/modules/samples/types';
import {sampleBlendCatalogAutofill,clearSampleCatalogSelection} from '../src/modules/samples/material-autofill';
import {combinePurchasingCatalogRecords} from '../src/modules/purchasing/catalog-records';
const profile={...SAMPLE_FORMULATION_PROFILES.find(p=>p.id==='mtt-2560-standard-5to1')!,batchChipTargetLb:'180',batchReferenceThicknessIn:'.375'};
const state=applyFormulationProfile(standardFormulationState(),profile);
const catalog=combinePurchasingCatalogRecords([{id:'chip-1',item_name:'Blanco',vendor:'Supplier',size:'#1',unit:'50lb bag'}],[])[0];
const sample=newLocalSample({preparedBy:'Marcos',formulation:state});sample.id='captured-sample';
for(const [percent,weights] of [[[40,30,20,5,5],[72,54,36,9,9]],[[50,25,25],[90,45,45]],[[30,40,30],[54,72,54]]]){
 sample.blendRows=[...percent.map((p,i)=>({...sample.blendRows[0],...sampleBlendCatalogAutofill(sample.blendRows[0],catalog),percentage:String(p),id:'chip-'+i})),...newLocalSample({preparedBy:'Marcos',formulation:state}).blendRows.slice(1)];
 const before=JSON.stringify(sample);const m=buildProductionBatchModel(sample,'working');assert.deepEqual(m.rows.filter(r=>r.role==='aggregate').map(r=>r.batchQuantity),weights);assert.equal(m.rows.filter(r=>r.role==='aggregate').reduce((s,r)=>s+r.batchQuantity,0),180);
 assert.deepEqual(m.rows.slice(-3).map(r=>r.batchQuantity),[45,5.2734375,1.0546875]);assert.equal(m.rows.at(-2)?.exactLiquid,'675 fl oz');assert.equal(m.rows.at(-1)?.exactLiquid,'135 fl oz');assert.equal(m.reference?.coverageSf,45);assert.equal(JSON.stringify(sample),before);
}
const row=sample.blendRows[0];assert.equal(packageEquivalent(row,72)?.label,'1.44 × 50-lb bags');
for(const [unit,amount,lb] of [['lb','25',25],['kg','25',25/.45359237],['oz','800',50]] as const){const item={...catalog,packageEvidence:{label:'Bag',amount,unit}};const r={...row,...sampleBlendCatalogAutofill(row,item)};assert.equal(packageEquivalent(r,72)?.weightLb,lb);}
for(const label of ['2 x 50lb bags','50lb pallet','50 lb / bag or 25 lb','Bag','', '1 gal pail'])assert.equal(captureBatchPackage({...catalog,packageEvidence:{label,amount:'',unit:''}}),null);
assert.equal(captureBatchPackage({...catalog,packageEvidence:{label:'50lb bag',amount:'25',unit:'lb'}}),null);
assert.equal(packageEquivalent({...row,...clearSampleCatalogSelection(row)},72),null);
const issued=structuredClone({...sample,issue_number:1});const old=buildProductionBatchModel(issued,'issued');
catalog.packageEvidence={label:'25lb bag',amount:'',unit:''};profile.batchChipTargetLb='999';assert.deepEqual(buildProductionBatchModel(issued,'issued'),old);
const noPackage=structuredClone(sample);noPackage.blendRows.forEach(r=>{r.catalogSnapshot={};});assert.equal(productionBatchReadiness(noPackage).ready,true);assert.equal(buildProductionBatchModel(noPackage,'working').rows[0].package,null);
const other=structuredClone(sample);other.formulation.profile!.resinFlOzPerCft='512';other.formulation.resinParts='4';assert.deepEqual(buildProductionBatchModel(other,'working').rows.slice(-2).map(r=>r.batchQuantity),[5.625,1.40625]);
for(const role of ['aggregate','filler','resin','hardener'])assert.equal(productionBatchReadiness({...sample,blendRows:sample.blendRows.filter(r=>r.componentRole!==role)}).ready,false);
for(const field of ['batchChipTargetLb']){const s=structuredClone(sample);delete s.formulation.profile![field as 'batchChipTargetLb'];assert.equal(productionBatchReadiness(s).ready,false);}
assert.equal(productionBatchReadiness({...sample,formulation:{...state,calculationVersion:'sample-formulation-v1'}}).ready,false);
const ambiguous=structuredClone(sample);Object.assign(ambiguous.blendRows.at(-2)!,{quantityProvenance:'manual',quantity:'15',unit:'oz'});assert.equal(productionBatchReadiness(ambiguous).ready,false);
const extras=structuredClone(sample);extras.blendRows.push({...row,color:'Pigment',componentRole:'other',quantityProvenance:'manual',quantity:'1',unit:'oz'});assert.equal(buildProductionBatchModel(extras,'working').rows.find(r=>r.role==='other')?.batchQuantity,2.8125);extras.blendRows.at(-1)!.unit='scoop';assert.equal(productionBatchReadiness(extras).ready,false);
const incomplete=structuredClone(sample);incomplete.blendRows[0].percentage='1';assert.equal(productionBatchReadiness(incomplete).ready,false);
assert.throws(()=>buildProductionBatchModel(sample,'issued'),/identity/);
assert.equal(buildProductionBatchModel({...sample,issue_number:10},'working').status,'WORKING BATCH BLEND - NOT ISSUED');
console.log('Production Batch arithmetic/package/readiness passed: three blends, exact components, profile variants, extra/manual components, missing/ambiguous fallback, frozen issue, strict package parsing and no mutations.');

const doubled=structuredClone(sample);Object.assign(doubled.blendRows.find(r=>r.componentRole==='filler')!,{quantityProvenance:'manual',quantity:'32',unit:'oz'});
assert.equal(buildProductionBatchModel(doubled,'working').rows.find(r=>r.role==='filler')?.batchQuantity,90);
assert.equal(buildProductionBatchModel(doubled,'working').batchTarget,180);
