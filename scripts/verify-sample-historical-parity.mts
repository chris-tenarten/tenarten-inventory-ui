import assert from 'node:assert/strict';
import {calculateSampleFormulation,MASS_BALANCE_SAMPLE_FORMULATION_CALCULATION_VERSION,standardFormulationState} from '../src/modules/samples/formulation';

type Fixture={id:string;width:string;length:string;density:string;thickness:string;percentages:number[];expected:number[];filler:string;resin:string;hardener:string;ratio:'4'|'5'};
const fixtures:Fixture[]=[
 {id:'T25-203-B',width:'12',length:'12',density:'128',thickness:'0.375',percentages:[10,30,20,20,20],expected:[6.4,19.2,12.8,12.8,12.8],filler:'16',resin:'16',hardener:'4',ratio:'4'},
 {id:'T26-245-A',width:'12',length:'12',density:'128',thickness:'0.375',percentages:[5,10,10,10,15,15,15,20],expected:[3.2,6.4,6.4,6.4,9.6,9.6,9.6,12.8],filler:'18',resin:'15',hardener:'3',ratio:'5'},
 {id:'T26-273-A',width:'6',length:'12',density:'128',thickness:'0.375',percentages:[20,40,40],expected:[6.4,12.8,12.8],filler:'9',resin:'7.5',hardener:'1.5',ratio:'5'},
 {id:'T26-275-A',width:'12',length:'12',density:'96',thickness:'0.375',percentages:[25,25,25,25],expected:[12,12,12,12],filler:'16',resin:'16',hardener:'4',ratio:'4'},
 {id:'T25-125-A',width:'6',length:'12',density:'160',thickness:'0.375',percentages:[5,5,15,70,5],expected:[2,2,6,28,2],filler:'18',resin:'7.5',hardener:'1.5',ratio:'5'},
];

for(const fixture of fixtures){
 const rows=[
  ...fixture.percentages.map(percentage=>({percentage:String(percentage),quantity:'',unit:'oz',componentRole:'aggregate' as const,calculationBasis:'target_total' as const,quantityProvenance:'calculated' as const})),
  {percentage:'',quantity:fixture.filler,unit:'oz',componentRole:'other' as const,calculationBasis:null,quantityProvenance:'manual' as const},
  {percentage:'',quantity:fixture.resin,unit:'fl oz',componentRole:'resin' as const,calculationBasis:null,quantityProvenance:'manual' as const},
  {percentage:'',quantity:'',unit:'fl oz',componentRole:'hardener' as const,calculationBasis:null,quantityProvenance:'calculated' as const},
 ];
 const state={...standardFormulationState(),width:fixture.width,length:fixture.length,materialDensity:fixture.density,thicknessIn:fixture.thickness,resinParts:fixture.ratio,hardenerParts:'1'};
 const result=calculateSampleFormulation(state,rows);
 assert.equal(result.percentageTotal,'100',`${fixture.id} percentage total`);
 assert.deepEqual(result.rows.slice(0,fixture.percentages.length).map(row=>Number(row.calculatedQuantity)),fixture.expected,`${fixture.id} Aggregate parity`);
 assert.equal(Number(result.rows.at(-1)?.calculatedQuantity),Number(fixture.hardener),`${fixture.id} Hardener parity`);
 const changedFiller=calculateSampleFormulation(state,rows.map((row,index)=>index===fixture.percentages.length?{...row,quantity:String(Number(fixture.filler)+18)}:row));
 assert.equal(changedFiller.availableChipMixOz,result.availableChipMixOz,`${fixture.id} Filler independence`);
}

const compatibilityRows=[
 {percentage:'100',quantity:'',unit:'oz',componentRole:'aggregate' as const,calculationBasis:'target_total' as const,quantityProvenance:'calculated' as const},
 {percentage:'',quantity:'18',unit:'oz',componentRole:'other' as const,calculationBasis:null,quantityProvenance:'manual' as const},
 {percentage:'',quantity:'15',unit:'oz',componentRole:'resin' as const,calculationBasis:null,quantityProvenance:'manual' as const},
 {percentage:'',quantity:'',unit:'oz',componentRole:'hardener' as const,calculationBasis:null,quantityProvenance:'calculated' as const},
];
const v2=calculateSampleFormulation({...standardFormulationState(),calculationVersion:MASS_BALANCE_SAMPLE_FORMULATION_CALCULATION_VERSION,totalFormulaWeightOz:'100'},compatibilityRows);
assert.equal(v2.availableChipMixOz,'64','V2 mass-balance semantics remain interpretable');
const v1=calculateSampleFormulation({...standardFormulationState(),calculationVersion:'sample-formulation-v1',basis:'total_weight',totalWeight:'4'},compatibilityRows);
assert.equal(v1.availableChipMixOz,'64','V1 target-weight semantics remain interpretable');

console.log('Sample V3 historical-parity fixtures passed.');
