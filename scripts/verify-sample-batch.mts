import assert from 'node:assert/strict';
import {projectSampleBatch,formatBatchQuantity} from '../src/modules/samples/batch-projection';
import {standardFormulationState,SAMPLE_FORMULATION_PROFILES,calculateSampleFormulation,applyFormulationProfile} from '../src/modules/samples/formulation';
import {newLocalSample} from '../src/modules/samples/types';
import {validateSampleForOutput} from '../src/modules/samples/sample-errors';
const profile={...SAMPLE_FORMULATION_PROFILES.find(p=>p.id==='mtt-2560-standard-5to1')!,batchChipTargetLb:'180'};
const state=applyFormulationProfile(standardFormulationState(),profile);
const close=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [percent,batch,working] of [[[40,30,20,5,5],[72,54,36,9,9],[25.6,19.2,12.8,3.2,3.2]],[[50,25,25],[90,45,45],[32,16,16]],[[30,40,30],[54,72,54],[19.2,25.6,19.2]]]){
 const sample=newLocalSample({preparedBy:'QA',formulation:state});const template=sample.blendRows[0];sample.blendRows=[...percent.map((p,i)=>({...template,id:String(i),percentage:String(p)})),...sample.blendRows.slice(1)];
 const frozen=JSON.stringify(sample);const p=projectSampleBatch(state,sample.blendRows);const w=calculateSampleFormulation(state,sample.blendRows);
 assert.equal(p.complete,true);assert.deepEqual(p.rows.slice(0,percent.length).map(r=>r.quantity),batch);assert.deepEqual(w.rows.slice(0,percent.length).map(r=>Number(r.effectiveQuantity)),working);
 assert.equal(w.effectiveFillerOz,'16');assert.equal(w.effectiveResinFlOz,'15');assert.equal(w.rows.at(-1)?.effectiveQuantity,'3');close(p.rows.at(-3)!.quantity,45);close(p.rows.at(-2)!.quantity,5.2734375);close(p.rows.at(-1)!.quantity,1.0546875);assert.equal(validateSampleForOutput(sample,'formal-issue'),null);
 for(let n=0;n<10;n++)projectSampleBatch(state,sample.blendRows);assert.equal(JSON.stringify(sample),frozen);
 const incomplete=sample.blendRows.map((r,i)=>i===0?{...r,percentage:'10'}:r);assert.equal(projectSampleBatch(state,incomplete).complete,false);assert.notEqual(validateSampleForOutput({...sample,blendRows:incomplete},'formal-issue'),null);
 const excess=sample.blendRows.map((r,i)=>i===0?{...r,percentage:'99'}:r);assert.equal(projectSampleBatch(state,excess).complete,false);assert.notEqual(validateSampleForOutput({...sample,blendRows:excess},'formal-issue'),null);
 for(const [length,width,t] of [['6','6','.375'],['24','12','.375'],['12','12','.5'],['1','1','.375']]){
  const f={...state,length,width,thicknessIn:t,dimensionUnit:length==='1'?'ft' as const:'in' as const};const b=projectSampleBatch(f,sample.blendRows);assert.deepEqual(b.rows.slice(0,percent.length).map(r=>r.quantity),batch);close(b.rows.at(-3)!.quantity,45);close(b.rows.at(-2)!.quantity,5.2734375);
 }
 const duplicateBinder=[...sample.blendRows,{...sample.blendRows.at(-2)!,id:'extra-resin'}];assert.equal(projectSampleBatch(state,duplicateBinder).rows.at(-1)?.quantity,null);
 const custom=projectSampleBatch({...state,profile:{...profile,batchChipTargetLb:'200'}},sample.blendRows);assert.equal(custom.subtotalLb,200);assert.equal(calculateSampleFormulation({...state,profile:{...profile,batchChipTargetLb:'200'}},sample.blendRows).availableChipMixOz,'64');
 assert.equal(formatBatchQuantity(5.2734375,'gal'),'≈ 5.273438');
 assert.equal(calculateSampleFormulation({...state,finishedPlateQuantity:'1'},sample.blendRows).availableChipMixOz,'64');
 const ratio=projectSampleBatch({...state,resinParts:'4'},sample.blendRows);close(ratio.rows.at(-1)!.quantity,1.318359375);
 assert.equal(calculateSampleFormulation({...state,resinParts:'4'},sample.blendRows).rows.at(-1)?.effectiveQuantity,'3.75');
 assert.equal(projectSampleBatch({...state,profile:{...profile,batchChipTargetLb:null}},sample.blendRows).target,null);
 const manual=sample.blendRows.map((r,i)=>i===0?{...r,quantity:'12',quantityProvenance:'manual' as const}:r);assert.equal(projectSampleBatch(state,manual).complete,false);
 const resinOverride=sample.blendRows.map(r=>r.componentRole==='resin'?{...r,quantity:'1',unit:'gal',quantityProvenance:'manual' as const}:r);close(projectSampleBatch(state,resinOverride).rows.at(-2)!.quantity,45);
 const ambiguous=resinOverride.map(r=>r.componentRole==='resin'?{...r,unit:'oz'}:r);assert.equal(projectSampleBatch(state,ambiguous).rows.at(-2)!.quantity,null);assert.equal(projectSampleBatch(state,ambiguous).rows.at(-1)!.quantity,null);
 assert.equal(projectSampleBatch({...state,width:'0'},sample.blendRows).fraction,null);
 assert.equal(projectSampleBatch({...state,calculationVersion:'sample-formulation-v1'},sample.blendRows).complete,false);
 console.log(`${percent.join('/')} => ${batch.join('/')} lb and ${working.join('/')} oz; parity, variants and incomplete issue gates passed`);
}
for(const target of ['0','-1','NaN','Infinity','100000000'])assert.equal(projectSampleBatch({...state,profile:{...profile,batchChipTargetLb:target}},[]).target,null);
