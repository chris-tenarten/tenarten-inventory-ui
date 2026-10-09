import assert from 'node:assert/strict';
import {applyPourLayout,batchFractionLabel,convertPourUnits,finishedGeometry,suggestPourLayouts} from '../src/modules/samples/pour-planning';
import {type SampleFormulationState,standardFormulationState,BATCH_FIRST_VERSION,calculateSampleFormulation} from '../src/modules/samples/formulation';
import {batchFirstProfile} from './support/sample-batch-first-fixture';
import type {SampleBlendRow} from '../src/modules/samples/types';
import {batchFirstQuantities} from '../supabase/functions/_shared/sample-batch-first.mjs';
const state: SampleFormulationState={...standardFormulationState(),calculationVersion:BATCH_FIRST_VERSION,profile:structuredClone(batchFirstProfile)};
const rows=[...['40','30','20','5','5'].map(percentage=>({componentRole:'aggregate',percentage,quantityProvenance:'calculated',unit:'oz'})),...['filler','resin','hardener'].map(componentRole=>({componentRole,quantityProvenance:'calculated',unit:componentRole==='filler'?'oz':'fl oz'}))] as SampleBlendRow[];
const original=JSON.stringify({state,rows}), q=(s=state,r=rows)=>batchFirstQuantities(s,r);
assert.deepEqual(finishedGeometry(state),{area:1,volume:.03125});assert.equal(q().productionVolumeCft,'0.03125');assert.equal(q().availableChipMixOz,'64');assert.equal(q().dryPoolOz,'81.777778');assert.equal(q().actualDryTotalOz,'82');assert.equal(batchFractionLabel(q().fraction),'1/45 Batch');
for(const changes of [{finishedPlateWidth:'12'},{finishedPlateLength:'12'},{finishedPlateQuantity:'8'}]){const s={...state,...changes};assert.equal(finishedGeometry(s).volume,.0625);assert.equal(q(s).availableChipMixOz,'64');}
for(const changes of [{thicknessIn:'.75'},{width:'24'},{length:'24'}]){const s={...state,...changes};assert.equal(q(s).productionVolumeCft,'0.0625');assert.equal(q(s).availableChipMixOz,'128');assert.equal(q(s).rows[5].exact,2*q().rows[5].exact!);}
const feet=convertPourUnits(state,'ft');assert.equal(feet.width,'1');assert.equal(feet.length,'1');assert.deepEqual(q(feet),q());assert.deepEqual(convertPourUnits(feet,'in'),state);
for(const width of ['7.123456','0.125','100.333333']){const s={...state,width};const back=convertPourUnits(convertPourUnits(s,'ft'),'in');assert.ok(Math.abs(Number(back.width)-Number(width))<1e-10);assert.equal(q(back).availableChipMixOz,q(s).availableChipMixOz);}
assert.equal(convertPourUnits({...state,width:''},'ft').width,'');
const suggestions=suggestPourLayouts(state,'0','0');assert.equal(suggestions.issue,null);assert.deepEqual(suggestions.layouts.map(l=>[l.name,l.widthIn,l.lengthIn]),[['Compact grid',12,12],['Single row',24,6],['Single column',6,24]]);
const withGap=suggestPourLayouts(state,'1','.125').layouts[0];assert.equal(withGap.widthIn,14.125);assert.equal(withGap.lengthIn,14.125);const applied={...feet,...applyPourLayout(feet,withGap)};assert.equal(q(applied).availableChipMixOz,calculateSampleFormulation({...state,width:'14.125',length:'14.125'},rows).availableChipMixOz);assert.equal(applied.profile,state.profile);
assert.equal(suggestPourLayouts({...state,finishedPlateQuantity:'1'},'0','0').layouts.length,1);assert.ok(suggestPourLayouts({...state,finishedPlateQuantity:'2.5'},'0','0').issue);assert.ok(suggestPourLayouts(state,'-1','0').issue);
assert.ok(suggestPourLayouts({...state,finishedPlateWidth:'3',finishedPlateLength:'12',finishedPlateQuantity:'8'},'0','0').layouts.length<=3);
const manual=rows.map(r=>r.componentRole==='filler'?{...r,quantityProvenance:'manual' as const,quantity:'22'}:r);assert.equal(q({...state,width:'24'},manual).rows[5].shop,22);assert.equal(q({...state,width:'24'},manual).rows[5].exact,35.55555555555556);
// Existing captures are only read: no profile/geometry upgrade or mutation on summary/suggestion generation.
const legacy={...state,calculationVersion:'sample-formulation-v4-density-profile',profile:{...batchFirstProfile,batchChipTargetLb:undefined}};
const before=JSON.stringify(legacy);finishedGeometry(legacy);suggestPourLayouts(legacy,'0','0');assert.equal(JSON.stringify(legacy),before);
assert.equal(JSON.stringify({state,rows}),original);
console.log('PASS geometry A–M calculations: baseline, finished independence, shared thickness, pour edits, units, suggestions, allowances, apply, volume comparison inputs, manual preservation, nonmutating legacy reads. Batch-first engine unchanged.');
