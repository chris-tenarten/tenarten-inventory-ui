import assert from 'node:assert/strict';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
import {blendFixtures} from './support/production-blend-fixtures.mts';
for(const [i,f] of blendFixtures.entries()){
 const before=JSON.stringify(f.snapshot),m=buildProductionBlend(f.snapshot,f.inputs);
 assert.equal(m.adjustment,[50,40,400,1200,20][i]);assert.equal(m.blendCount,[5,.8,2,12,.2][i]);
 assert.deepEqual(m.aggregates.map(r=>r.bagsPerBlend),[[2,6,4,4,4],[.5,.5,1.5,7,.5],[4,8,8],[3.5,3.5,.5,.5,3,3,2,2,1,1],[8,6,4,1,1]][i]);
 assert.equal(m.binder.resin?.total,f.inputs.batchCount*5);assert.equal(m.binder.hardener?.total,f.inputs.batchCount);
 assert.equal(m.aggregates.reduce((n,r)=>n+r.totalLb,0),f.inputs.plannedQuantity);
 assert.equal(JSON.stringify(f.snapshot),before);
 const changed=buildProductionBlend(f.snapshot,{...f.inputs,plannedQuantity:f.inputs.plannedQuantity*2,blendSize:500});assert.deepEqual(changed.binder,m.binder);assert.deepEqual(changed.aggregates.map(r=>r.percentage),m.aggregates.map(r=>r.percentage));
}
const f=blendFixtures[3],copy=structuredClone(f.snapshot);
copy.blendRows[0].catalogSnapshot.package_context.amount='25';assert.equal(buildProductionBlend(copy,f.inputs).aggregates[0].bagsPerBlend,7);
copy.blendRows[0].catalogSnapshot={};assert.equal(buildProductionBlend(copy,f.inputs).aggregates[0].bagsPerBlend,null);
copy.formulation.profile.batchContract.components.resin.authority='unresolved';const partial=buildProductionBlend(copy,f.inputs);assert.equal(partial.binder.resin,null);assert.equal(partial.binder.hardener,null);
assert.equal(buildProductionBlend(f.snapshot,{...f.inputs,plannedQuantity:1}).warnings.length,1);
for(const key of ['batchCount','plannedQuantity','blendSize'])for(const invalid of [0,-1,'',NaN,Infinity,true,[1],{}])assert.throws(()=>buildProductionBlend(f.snapshot,{...f.inputs,[key]:invalid}));
const legacy=structuredClone(f.snapshot);legacy.formulation.calculationVersion='legacy';assert.throws(()=>buildProductionBlend(legacy,f.inputs),/authoritative/);
copy.blendRows[0].percentage='1';assert.throws(()=>buildProductionBlend(copy,f.inputs),/100/);
console.log('PASS: 4 historical + current fixtures; package fallback/alternate, fractional bags/Blends, binder separation, invalid inputs, legacy and percentages');
const override=structuredClone(blendFixtures[4].snapshot);
override.formulation.profile.batchContract.fillerSubstitution='equal_mass_preserve_yield_v1';override.formulation.batchFillerOverrideLb='100';
const modified=buildProductionBlend(override,{batchCount:1,plannedQuantity:130,blendSize:500});assert.equal(modified.batchChipLb,130);assert.equal(modified.binder.resin.total,5);
override.blendRows.find(r=>r.componentRole==='resin').quantity='999';assert.equal(buildProductionBlend(override,{batchCount:1,plannedQuantity:130,blendSize:500}).binder.resin.total,5);
const four=structuredClone(blendFixtures[4].snapshot);four.formulation.profile.resinParts='4';four.formulation.profile.batchChipTargetLb='150';assert.equal(buildProductionBlend(four,{batchCount:2,plannedQuantity:300,blendSize:500}).binder.hardener.total,2.5);
console.log('PASS: formulation Filler override, Sample shop quantity isolation, profile-specific 4:1 binder');
