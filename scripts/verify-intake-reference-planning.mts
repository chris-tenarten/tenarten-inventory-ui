import assert from 'node:assert/strict';
import {newScopeLine,type ScopeLine} from '../src/modules/intake-materials/contracts';
import {deriveRequirements,resolveScopePlan,scopeBatchCount} from '../src/modules/intake-materials/requirements';
import {buildProductionBlend} from '../supabase/functions/_shared/production-blend.mjs';
// @ts-expect-error -- tsx resolves the existing .mts fixture at runtime.
import {blendFixtures} from './support/production-blend-fixtures.mts';

const fixture=blendFixtures[3];
const sample=structuredClone(fixture.snapshot) as unknown as Record<string,unknown>;
const blend={...structuredClone(sample),_scope_provenance:{inputs:fixture.inputs,status:'issued'}};
const reference:ScopeLine={...newScopeLine(),label:'Finish A',sourceKind:'version',sourceId:'saved-sample',productionBatches:'3'};
const first=(line:ScopeLine,source:Record<string,unknown>=sample)=>deriveRequirements([line],[source]);
const aggregate=(result:ReturnType<typeof first>)=>result.requirements.find(r=>r.role==='aggregate')!;
const resin=(result:ReturnType<typeof first>)=>result.requirements.find(r=>r.role==='resin')!;
const before=JSON.stringify({sample,blend,reference});

// A commercial quantity and prose assumptions are independent of an explicit Batch plan.
assert.deepEqual(resolveScopePlan(reference,sample),{batchCount:3,plannedQuantity:540,blendSize:1000,thickness:.375,overage:0,basis:'Explicit Production Batches',issues:[]});
assert.equal(scopeBatchCount(reference),3);
const explicit=first(reference);
assert.equal(aggregate(explicit).quantity,94.5);
assert.equal(resin(explicit).quantity,15);
assert.ok(explicit.unresolved.some(u=>u.includes('commercial scope quantity/unit')));
assert.ok(!explicit.requirements.some(r=>r.unresolved.some(u=>u.includes('assumptions')||u.includes('Overage')||u.includes('thickness'))));

// Reuse the immutable issued Blend's full authored plan, including its chip adjustment.
const reuse={...reference,sourceKind:'blend' as const,productionBatches:''};
assert.deepEqual(resolveScopePlan(reuse,blend),{batchCount:60,plannedQuantity:12000,blendSize:1000,thickness:.375,overage:0,basis:'Captured issued Blend inputs',issues:[]});
const reused=first(reuse,blend);
assert.equal(aggregate(reused).quantity,2100);
assert.equal(resin(reused).quantity,300);
const canonical=buildProductionBlend(blend,fixture.inputs);
assert.equal(aggregate(reused).quantity,canonical.aggregates[0].totalLb);
assert.equal(resin(reused).quantity,canonical.binder.resin?.total);

// A changed production quantity never silently carries the prior plan's chip total.
assert.equal(resolveScopePlan({...reuse,productionBatches:'3'},blend).plannedQuantity,540);
assert.equal(aggregate(first({...reuse,productionBatches:'3'},blend)).quantity,94.5);
const reviewedYield={...reuse,quantity:'120',unit:'pieces',yieldPerBatch:'2',batchRounding:'fractional' as const};
assert.equal(resolveScopePlan(reviewedYield,blend).batchCount,60);
assert.equal(resolveScopePlan(reviewedYield,blend).plannedQuantity,10800);
assert.equal(resolveScopePlan({...reviewedYield,quantity:'121',batchRounding:'whole_up'},blend).batchCount,61);
const adjusted=first({...reference,plannedQuantity:'600',overage:'10'});
assert.equal(aggregate(adjusted).quantity,115.50000000000001);
assert.equal(resin(adjusted).quantity,16.5);

// No Sample plate geometry, similarly shaped metadata, or malformed override invents yield.
const unknown=first({...reference,productionBatches:''});
assert.ok(unknown.requirements.every(r=>r.quantity===null));
assert.ok(unknown.unresolved.some(u=>u.includes('Production Batch quantity is unresolved')));
assert.equal(resolveScopePlan({...reference,productionBatches:''},blend).batchCount,null);
for(const value of ['0','-2','not-a-number','Infinity']){
 const invalidBatch=resolveScopePlan({...reuse,productionBatches:value},blend);
 assert.equal(invalidBatch.batchCount,null);assert.ok(invalidBatch.issues.length);
 const invalidChips=resolveScopePlan({...reference,plannedQuantity:value},sample);
 assert.equal(invalidChips.plannedQuantity,null);assert.ok(invalidChips.issues.length);
 const invalidSize=resolveScopePlan({...reference,blendSize:value},sample);
 assert.equal(invalidSize.blendSize,null);assert.ok(invalidSize.issues.length);
 const invalidThickness=resolveScopePlan({...reference,thickness:value},sample);
 assert.equal(invalidThickness.thickness,null);assert.ok(invalidThickness.issues.length);
}
assert.equal(resolveScopePlan({...reuse,yieldPerBatch:'invalid'},blend).batchCount,null);
assert.equal(resolveScopePlan({...reuse,yieldPerBatch:'2'},blend).batchCount,null);
assert.equal(resolveScopePlan({...reuse,quantity:'1e308',yieldPerBatch:'1e-308',batchRounding:'fractional'},blend).batchCount,null);
assert.equal(resolveScopePlan({...reference,productionBatches:'1e308'},sample).plannedQuantity,null);
assert.equal(resolveScopePlan(reuse,{...blend,_scope_provenance:{inputs:{...fixture.inputs,plannedQuantity:'invalid'}}}).plannedQuantity,null);
assert.equal(aggregate(first({...reference,overage:'-1'})).quantity,null);
assert.equal(aggregate(first({...reference,thickness:'1'})).quantity,null);
assert.ok(first({...reference,blendSize:'0'}).requirements.every(r=>r.quantity===null));
assert.ok(first({...reference,plannedQuantity:'0'}).requirements.every(r=>r.quantity===null));

// Old unmarked capture semantics retain their explicit yield/thickness/overage requirements.
const legacy:ScopeLine={...reference,planningBasis:undefined,productionBatches:undefined,quantity:'120',unit:'pieces',yieldPerBatch:'2',batchRounding:'fractional',plannedQuantity:'12000',blendSize:'1000',thickness:'.375',overage:'0',assumptions:'Reviewed original scope'};
const legacyResult=first(legacy);
assert.equal(aggregate(legacyResult).quantity,2100);assert.equal(resin(legacyResult).quantity,300);
assert.equal(aggregate(first({...legacy,thickness:''})).quantity,null);
assert.equal(aggregate(first({...legacy,overage:''})).quantity,null);
assert.equal(aggregate(first({...legacy,assumptions:''})).quantity,null);
assert.ok(first({...legacy,quantity:''}).requirements.every(r=>r.quantity===null));
assert.ok(first({...legacy,yieldPerBatch:''},blend).requirements.every(r=>r.quantity===null));
assert.equal(JSON.stringify({sample,blend,reference}),before);
console.log('Passed: reference defaults, independent commercial scope, saved Blend reuse, reviewed production/yield overrides, invalid/unknown planning, canonical calculation parity and legacy capture compatibility.');
