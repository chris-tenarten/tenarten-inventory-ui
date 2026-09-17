import assert from 'node:assert/strict';
import {calculateSampleFormulation,standardFormulationState} from '../src/modules/samples/formulation';

const aggregate=(percentage:string)=>({percentage,quantity:'',unit:'oz',componentRole:'aggregate' as const,calculationBasis:'target_total' as const,quantityProvenance:'calculated' as const});
const rows=(filler='18',resin='15')=>[aggregate('40'),aggregate('30'),aggregate('20'),aggregate('5'),aggregate('5'),{percentage:'',quantity:filler,unit:'oz',componentRole:'other' as const,calculationBasis:null,quantityProvenance:'manual' as const},{percentage:'',quantity:resin,unit:'oz',componentRole:'resin' as const,calculationBasis:null,quantityProvenance:'manual' as const},{percentage:'',quantity:'',unit:'oz',componentRole:'hardener' as const,calculationBasis:null,quantityProvenance:'calculated' as const}];
const state=standardFormulationState();
const standard=calculateSampleFormulation(state,rows());assert.deepEqual([standard.availableChipMixOz,standard.rows[7].effectiveQuantity],['64','3']);
const filler=calculateSampleFormulation(state,rows('36'));assert.equal(filler.availableChipMixOz,'46');assert.deepEqual(filler.rows.slice(0,5).map(row=>row.effectiveQuantity),['18.4','13.8','9.2','2.3','2.3']);
const resin=calculateSampleFormulation(state,rows('18','20'));assert.deepEqual([resin.availableChipMixOz,resin.rows[7].effectiveQuantity],['58','4']);
const ratio=calculateSampleFormulation({...state,resinParts:'4'},rows('18','20'));assert.deepEqual([ratio.availableChipMixOz,ratio.rows[7].effectiveQuantity],['57','5']);
const geometry=calculateSampleFormulation({...state,width:'24'},rows());assert.equal(geometry.geometryChipMixWeight,'8');assert.equal(geometry.availableChipMixOz,'64','geometry remains reference-only');
const zero=calculateSampleFormulation({...state,totalFormulaWeightOz:'36'},rows());assert.equal(zero.availableChipMixOz,'0');assert.equal(zero.invalidMassBalance,false);
const invalid=calculateSampleFormulation({...state,totalFormulaWeightOz:'35'},rows());assert.equal(invalid.invalidMassBalance,true);assert.equal(invalid.availableChipMixOz,'');
const manual=calculateSampleFormulation(state,[{...aggregate('100'),quantity:'9',quantityProvenance:'manual',calculationBasis:null}]);assert.equal(manual.rows[0].effectiveQuantity,'9');assert.equal(manual.percentageTotal,'0');
console.log('Sample formulation dependency/reactivity matrix passed.');
