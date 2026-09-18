import assert from 'node:assert/strict';
import {calculateSampleFormulation,standardFormulationState} from '../src/modules/samples/formulation';

const aggregate=(percentage:string)=>({percentage,quantity:'',unit:'oz',componentRole:'aggregate' as const,calculationBasis:'target_total' as const,quantityProvenance:'calculated' as const});
const rows=(filler='18',resin='15')=>[aggregate('40'),aggregate('30'),aggregate('20'),aggregate('5'),aggregate('5'),{percentage:'',quantity:filler,unit:'oz',componentRole:'other' as const,calculationBasis:null,quantityProvenance:'manual' as const},{percentage:'',quantity:resin,unit:'oz',componentRole:'resin' as const,calculationBasis:null,quantityProvenance:'manual' as const},{percentage:'',quantity:'',unit:'oz',componentRole:'hardener' as const,calculationBasis:null,quantityProvenance:'calculated' as const}];
const state=standardFormulationState();
const standard=calculateSampleFormulation(state,rows());assert.deepEqual([standard.availableChipMixOz,standard.rows[7].effectiveQuantity],['64','3']);
const filler=calculateSampleFormulation(state,rows('36'));assert.equal(filler.availableChipMixOz,'64');assert.deepEqual(filler.rows.slice(0,5).map(row=>row.effectiveQuantity),['25.6','19.2','12.8','3.2','3.2']);
const resin=calculateSampleFormulation(state,rows('18','20'));assert.deepEqual([resin.availableChipMixOz,resin.rows[7].effectiveQuantity],['64','4']);
const ratio=calculateSampleFormulation({...state,resinParts:'4'},rows('18','20'));assert.deepEqual([ratio.availableChipMixOz,ratio.rows[7].effectiveQuantity],['64','5']);
const geometry=calculateSampleFormulation({...state,width:'24'},rows());assert.equal(geometry.geometryChipMixWeight,'8');assert.equal(geometry.availableChipMixOz,'128');
const thickness=calculateSampleFormulation({...state,thicknessIn:'0.5'},rows());assert.equal(thickness.calculatedWeightPerSf,'5.3333');assert.equal(thickness.availableChipMixOz,'85.3333');
const density=calculateSampleFormulation({...state,materialDensity:'96'},rows());assert.equal(density.calculatedWeightPerSf,'3');assert.equal(density.availableChipMixOz,'48');
const manual=calculateSampleFormulation(state,[{...aggregate('100'),quantity:'9',quantityProvenance:'manual',calculationBasis:null}]);assert.equal(manual.rows[0].effectiveQuantity,'9');assert.equal(manual.percentageTotal,'0');
console.log('Sample formulation dependency/reactivity matrix passed.');
