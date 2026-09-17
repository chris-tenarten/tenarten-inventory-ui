export const SAMPLE_FORMULATION_CALCULATION_VERSION='sample-formulation-v1';

export type FormulationBasis='total_weight'|'weight_per_sf';
export type DimensionUnit='in'|'ft';
export type SampleFormulationState={
  basis:FormulationBasis;
  weightUnit:'lb';
  totalWeight:string;
  finishedPlateWidth:string;
  finishedPlateLength:string;
  finishedPlateQuantity:string;
  thicknessIn:string;
  length:string;
  width:string;
  dimensionUnit:DimensionUnit;
  materialDensity:string;
  weightPerSf:string;
  weightPerSfProvenance:'calculated'|'manual';
  resinParts:string;
  hardenerParts:string;
  ratioProvenance:'default'|'manual';
  ratioDefaultSource:string;
  supplierRatioDefaults:Record<string,string>;
  defaultVersion:number|null;
  calculationVersion:string;
};
export type FormulationRowInput={percentage:string;quantity:string;componentRole:'aggregate'|'resin'|'hardener'|'other';calculationBasis:'target_total'|null;quantityProvenance:'calculated'|'manual'};

export const blankFormulationState=(resinParts='5',hardenerParts='1',defaultVersion:number|null=null):SampleFormulationState=>({basis:'total_weight',weightUnit:'lb',totalWeight:'',finishedPlateWidth:'',finishedPlateLength:'',finishedPlateQuantity:'',thicknessIn:'',length:'',width:'',dimensionUnit:'in',materialDensity:'',weightPerSf:'',weightPerSfProvenance:'calculated',resinParts,hardenerParts,ratioProvenance:'default',ratioDefaultSource:'General',supplierRatioDefaults:{},defaultVersion,calculationVersion:SAMPLE_FORMULATION_CALCULATION_VERSION});
export const standardFormulationState=(defaultVersion:number|null=null,supplierRatioDefaults:Record<string,string>={}):SampleFormulationState=>({...blankFormulationState('5','1',defaultVersion),basis:'weight_per_sf',finishedPlateWidth:'6',finishedPlateLength:'6',finishedPlateQuantity:'4',thicknessIn:'0.375',length:'12',width:'12',materialDensity:'128',weightPerSf:'4',supplierRatioDefaults});
const positive=(value:string)=>{if(!value.trim())return null;const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:null;};
const display=(value:number|null)=>value===null?'':String(Math.round(value*10000)/10000);
export const normalizeSupplierKey=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');
export function resolveSupplierRatio(supplier:string,state:Pick<SampleFormulationState,'supplierRatioDefaults'>){const key=normalizeSupplierKey(supplier);return state.supplierRatioDefaults[key]??'5:1';}
export function applySupplierRatioDefault(state:SampleFormulationState,supplier:string):SampleFormulationState{const ratio=resolveSupplierRatio(supplier,state);const[resinParts,hardenerParts]=ratio.split(':');return{...state,resinParts,hardenerParts,ratioProvenance:'default',ratioDefaultSource:normalizeSupplierKey(supplier)?supplier.trim():'General'};}

export function calculateSampleFormulation(state:SampleFormulationState,rows:FormulationRowInput[]){
  const length=positive(state.length),width=positive(state.width),density=positive(state.materialDensity),thickness=positive(state.thicknessIn),authoredRate=positive(state.weightPerSf),authoredTotal=positive(state.totalWeight);
  const finishedWidth=positive(state.finishedPlateWidth),finishedLength=positive(state.finishedPlateLength),finishedQuantity=positive(state.finishedPlateQuantity);
  const area=length===null||width===null?null:length*width*(state.dimensionUnit==='in'?1/144:1);
  const finishedArea=finishedWidth===null||finishedLength===null||finishedQuantity===null?null:finishedWidth*finishedLength*finishedQuantity/144;
  const productionVolume=area===null||thickness===null?null:area*(thickness/12);
  const calculatedRate=density===null||thickness===null?null:density*(thickness/12);
  const effectiveRate=state.weightPerSfProvenance==='manual'?authoredRate:calculatedRate;
  const targetWeight=state.basis==='total_weight'?authoredTotal:area===null||effectiveRate===null?null:area*effectiveRate;
  const percentageRows=rows.filter(row=>row.componentRole==='aggregate'&&row.calculationBasis==='target_total');
  const percentageTotal=percentageRows.reduce((sum,row)=>sum+(positive(row.percentage)??0),0);
  const calculated=rows.map(row=>row.componentRole==='aggregate'&&row.calculationBasis==='target_total'&&targetWeight!==null&&positive(row.percentage)!==null?targetWeight*(positive(row.percentage)!/100):null);
  const resinIndex=rows.findIndex(row=>row.componentRole==='resin');
  const hardenerIndex=rows.findIndex(row=>row.componentRole==='hardener');
  const resinEffective=resinIndex<0?null:rows[resinIndex].quantityProvenance==='manual'?positive(rows[resinIndex].quantity):calculated[resinIndex];
  const resinParts=positive(state.resinParts),hardenerParts=positive(state.hardenerParts);
  if(hardenerIndex>=0&&rows[hardenerIndex].quantityProvenance==='calculated'&&resinEffective!==null&&resinParts&&hardenerParts!==null)calculated[hardenerIndex]=resinEffective*(hardenerParts/resinParts);
  return{areaSf:display(area),finishedAreaSf:display(finishedArea),productionVolumeCft:display(productionVolume),calculatedWeightPerSf:display(calculatedRate),effectiveWeightPerSf:display(effectiveRate),targetWeight:display(targetWeight),targetWeightOz:display(targetWeight===null?null:targetWeight*16),percentageTotal:display(percentageTotal),percentageReconciles:percentageRows.length>0&&Math.abs(percentageTotal-100)<0.0005,rows:rows.map((row,index)=>({calculatedQuantity:display(calculated[index]),calculatedQuantityOz:display(calculated[index]===null?null:calculated[index]!*16),effectiveQuantity:row.quantityProvenance==='manual'?row.quantity:display(calculated[index])}))};
}
