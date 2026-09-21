import assert from 'node:assert/strict';
import {buildSamplePdfModel} from '../supabase/functions/_shared/sample-work-order-pdf-model.mjs';
import {
  calculateSampleFormulation,
  normalizeSupportedSampleRatio,
  normalizedSampleRatioParts,
  standardFormulationState,
} from '../src/modules/samples/formulation';
import {validateSampleForOutput} from '../src/modules/samples/sample-errors';
import {newLocalSample} from '../src/modules/samples/types';

for(const [resin,hardener,expected] of [
  ['5','1','5:1'],['5.0','1.0','5:1'],['5.0000','1.0000','5:1'],
  ['4','1','4:1'],['4.0','1.0','4:1'],['4.0000','1.0000','4:1'],
  ['10','2','5:1'],['8','2','4:1'],
] as const)assert.equal(normalizeSupportedSampleRatio(resin,hardener),expected);
for(const [resin,hardener] of [[''],['wat','1'],['5','0'],['5','-1'],['3','1'],[null,'1'],['5',undefined]] as const)assert.equal(normalizeSupportedSampleRatio(resin,hardener),null);
assert.deepEqual(normalizedSampleRatioParts('5.0000','1.0000'),{ratio:'5:1',resinParts:'5',hardenerParts:'1'});

const rows=[
 {percentage:'100',quantity:'',unit:'oz',color:'Aggregate',componentRole:'aggregate' as const,calculationBasis:'target_total' as const,quantityProvenance:'calculated' as const},
 {percentage:'',quantity:'',unit:'oz',color:'Filler',componentRole:'filler' as const,calculationBasis:null,quantityProvenance:'calculated' as const},
 {percentage:'',quantity:'',unit:'fl oz',color:'Resin',componentRole:'resin' as const,calculationBasis:null,quantityProvenance:'calculated' as const},
 {percentage:'',quantity:'',unit:'fl oz',color:'Hardener',componentRole:'hardener' as const,calculationBasis:null,quantityProvenance:'calculated' as const},
];
const hosted={...standardFormulationState(),resinParts:'5.0000',hardenerParts:'1.0000'};
const calculated=calculateSampleFormulation(hosted,rows);
assert.equal(calculated.availableChipMixOz,'64');assert.equal(calculated.rows[3].effectiveQuantity,'3');
assert.deepEqual(calculated,calculateSampleFormulation({...hosted,resinParts:'5',hardenerParts:'1'},rows),'fixed-scale and canonical client calculations must be identical');
const sample={...newLocalSample({preparedBy:'Verifier',formulation:hosted}),blendRows:rows.map((row,index)=>({id:`row-${index}`,percentage:row.percentage,color:row.color,size:'',materialType:'',quantity:row.quantity,unit:row.unit,vendor:'',catalogSource:null,catalogItemId:null,catalogSnapshot:{},displayOrder:index,componentRole:row.componentRole,calculationBasis:row.calculationBasis,quantityProvenance:row.quantityProvenance,calculatedQuantity:calculated.rows[index].calculatedQuantity}))};
assert.equal(validateSampleForOutput(sample),null,'hosted fixed-scale values must pass Working Sheet validation');
assert.notEqual(validateSampleForOutput({...sample,formulation:{...hosted,resinParts:'3',hardenerParts:'1'}}),null,'unsupported numeric ratios remain invalid');

const manual={...hosted,resinParts:'4.0000',ratioProvenance:'manual' as const,ratioDefaultSource:'Manual'};
const saved=JSON.parse(JSON.stringify({...sample,formulation:manual}));
const versionSnapshot=JSON.parse(JSON.stringify(saved));
const restored=JSON.parse(JSON.stringify(versionSnapshot));
const issuedSnapshot=JSON.parse(JSON.stringify(restored));
for(const state of [saved.formulation,versionSnapshot.formulation,restored.formulation,issuedSnapshot.formulation]){
  assert.equal(normalizeSupportedSampleRatio(state.resinParts,state.hardenerParts),'4:1');
  assert.equal(state.ratioProvenance,'manual');
  assert.equal(state.ratioDefaultSource,'Manual');
}
assert.equal(calculateSampleFormulation(manual,rows).rows[3].effectiveQuantity,'3.75');
const pdf=buildSamplePdfModel({formulation_state:{...manual,derived:{availableChipMixOz:64}},blend_rows:[]});
assert.match(pdf.formulationSummary,/Resin : Hardener 4:1/);assert.doesNotMatch(pdf.formulationSummary,/4\.0000:1\.0000/);

console.log('Sample ratio normalization passed: canonical/fixed-scale 4:1 and 5:1, invalid inputs, manual provenance, save/version/restore/issue snapshots, calculation and PDF display.');
