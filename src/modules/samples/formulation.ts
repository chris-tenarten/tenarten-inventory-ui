export const LEGACY_SAMPLE_FORMULATION_CALCULATION_VERSION='sample-formulation-v1';
export const MASS_BALANCE_SAMPLE_FORMULATION_CALCULATION_VERSION='sample-formulation-v2-mass-balance';
export const SAMPLE_FORMULATION_CALCULATION_VERSION='sample-formulation-v3-historical-parity';

export type FormulationBasis='total_weight'|'weight_per_sf';
export type DimensionUnit='in'|'ft';
export type SampleFormulationState={
  basis:FormulationBasis;
  weightUnit:'lb';
  totalWeight:string;
  totalFormulaWeightOz:string;
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
export type FormulationRowInput={percentage:string;quantity:string;unit?:string;componentRole:'aggregate'|'resin'|'hardener'|'other';calculationBasis:'target_total'|null;quantityProvenance:'calculated'|'manual'};

export const blankFormulationState=(resinParts='5',hardenerParts='1',defaultVersion:number|null=null):SampleFormulationState=>({basis:'total_weight',weightUnit:'lb',totalWeight:'',totalFormulaWeightOz:'',finishedPlateWidth:'',finishedPlateLength:'',finishedPlateQuantity:'',thicknessIn:'',length:'',width:'',dimensionUnit:'in',materialDensity:'',weightPerSf:'',weightPerSfProvenance:'calculated',resinParts,hardenerParts,ratioProvenance:'default',ratioDefaultSource:'General',supplierRatioDefaults:{},defaultVersion,calculationVersion:LEGACY_SAMPLE_FORMULATION_CALCULATION_VERSION});
export const standardFormulationState=(defaultVersion:number|null=null,supplierRatioDefaults:Record<string,string>={}):SampleFormulationState=>({...blankFormulationState('5','1',defaultVersion),basis:'weight_per_sf',finishedPlateWidth:'6',finishedPlateLength:'6',finishedPlateQuantity:'4',thicknessIn:'0.375',length:'12',width:'12',materialDensity:'128',weightPerSf:'4',supplierRatioDefaults,calculationVersion:SAMPLE_FORMULATION_CALCULATION_VERSION});
const positive=(value:string)=>{if(!value.trim())return null;const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:null;};
const display=(value:number|null)=>value===null?'':String(Math.round(value*10000)/10000);
export const normalizeSupplierKey=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');
export function resolveSupplierRatio(supplier:string,state:Pick<SampleFormulationState,'supplierRatioDefaults'>){const key=normalizeSupplierKey(supplier);return state.supplierRatioDefaults[key]??'5:1';}
export function applySupplierRatioDefault(state:SampleFormulationState,supplier:string):SampleFormulationState{const ratio=resolveSupplierRatio(supplier,state);const[resinParts,hardenerParts]=ratio.split(':');return{...state,resinParts,hardenerParts,ratioProvenance:'default',ratioDefaultSource:normalizeSupplierKey(supplier)?supplier.trim():'General'};}
const toOunces=(value:string,unit='oz')=>{const amount=positive(value);if(amount===null)return null;return unit.trim().toLowerCase()==='lb'?amount*16:amount;};
const toFluidOunces=(value:string,unit='fl oz')=>{const amount=positive(value);if(amount===null)return null;const normalized=unit.trim().toLowerCase();if(normalized==='gal'||normalized==='gallon'||normalized==='gallons')return amount*128;return normalized==='fl oz'||normalized==='fluid oz'||normalized==='fluid ounce'||normalized==='fluid ounces'||normalized==='oz'?amount:null;};

export function calculateSampleFormulation(state:SampleFormulationState,rows:FormulationRowInput[]){
  const length=positive(state.length),width=positive(state.width),density=positive(state.materialDensity),thickness=positive(state.thicknessIn),authoredRate=positive(state.weightPerSf),authoredTotal=positive(state.totalWeight);
  const finishedWidth=positive(state.finishedPlateWidth),finishedLength=positive(state.finishedPlateLength),finishedQuantity=positive(state.finishedPlateQuantity);
  const area=length===null||width===null?null:length*width*(state.dimensionUnit==='in'?1/144:1);
  const finishedArea=finishedWidth===null||finishedLength===null||finishedQuantity===null?null:finishedWidth*finishedLength*finishedQuantity/144;
  const productionVolume=area===null||thickness===null?null:area*(thickness/12);
  const calculatedRate=density===null||thickness===null?null:density*(thickness/12);
  const effectiveRate=state.weightPerSfProvenance==='manual'?authoredRate:calculatedRate;
  const geometryTargetWeight=state.basis==='total_weight'?authoredTotal:area===null||effectiveRate===null?null:area*effectiveRate;
  const percentageRows=rows.filter(row=>row.componentRole==='aggregate'&&row.quantityProvenance==='calculated');
  const percentageTotal=percentageRows.reduce((sum,row)=>sum+(positive(row.percentage)??0),0);
  const isMassBalance=state.calculationVersion===MASS_BALANCE_SAMPLE_FORMULATION_CALCULATION_VERSION;
  const isHistoricalParity=state.calculationVersion===SAMPLE_FORMULATION_CALCULATION_VERSION;
  const totalFormulaOz=isMassBalance?positive(state.totalFormulaWeightOz):null;
  const calculated=rows.map(()=>null as number|null);
  const resinIndex=rows.findIndex(row=>row.componentRole==='resin');
  const hardenerIndex=rows.findIndex(row=>row.componentRole==='hardener');
  const resinEffective=resinIndex<0?null:isHistoricalParity?toFluidOunces(rows[resinIndex].quantity,rows[resinIndex].unit):toOunces(rows[resinIndex].quantity,rows[resinIndex].unit);
  const resinParts=positive(state.resinParts),hardenerParts=positive(state.hardenerParts);
  if(hardenerIndex>=0&&rows[hardenerIndex].quantityProvenance==='calculated'&&resinEffective!==null&&resinParts&&hardenerParts!==null)calculated[hardenerIndex]=resinEffective*(hardenerParts/resinParts);
  const nonChipOz=isMassBalance?rows.reduce((sum,row,index)=>row.componentRole==='aggregate'?sum:sum+(row.quantityProvenance==='calculated'?(calculated[index]??0):(toOunces(row.quantity,row.unit)??0)),0):null;
  const availableChipMixOz=isMassBalance&&totalFormulaOz!==null&&nonChipOz!==null?totalFormulaOz-nonChipOz:null;
  const invalidMassBalance=availableChipMixOz!==null&&availableChipMixOz<0;
  const distributableChipOz=isMassBalance?(invalidMassBalance?null:availableChipMixOz):geometryTargetWeight===null?null:geometryTargetWeight*16;
  rows.forEach((row,index)=>{if(row.componentRole==='aggregate'&&row.quantityProvenance==='calculated'&&distributableChipOz!==null&&positive(row.percentage)!==null)calculated[index]=distributableChipOz*(positive(row.percentage)!/100);});
  const targetWeightOz=isMassBalance?distributableChipOz:geometryTargetWeight===null?null:geometryTargetWeight*16;
  const targetWeight=isMassBalance?targetWeightOz===null?null:targetWeightOz/16:geometryTargetWeight;
  return{areaSf:display(area),finishedAreaSf:display(finishedArea),productionVolumeCft:display(productionVolume),calculatedWeightPerSf:display(calculatedRate),effectiveWeightPerSf:display(effectiveRate),geometryChipMixWeight:display(geometryTargetWeight),geometryChipMixOz:display(geometryTargetWeight===null?null:geometryTargetWeight*16),totalFormulaWeightOz:display(totalFormulaOz),nonChipWeightOz:display(nonChipOz),availableChipMixOz:display(distributableChipOz),invalidMassBalance,targetWeight:display(targetWeight),targetWeightOz:display(targetWeightOz),percentageTotal:display(percentageTotal),percentageReconciles:percentageRows.length>0&&Math.abs(percentageTotal-100)<0.0005,rows:rows.map((row,index)=>({calculatedQuantity:display(calculated[index]),calculatedQuantityOz:display(isMassBalance||isHistoricalParity?calculated[index]:calculated[index]===null?null:calculated[index]!*16),effectiveQuantity:row.quantityProvenance==='manual'?row.quantity:display(calculated[index])}))};
}
