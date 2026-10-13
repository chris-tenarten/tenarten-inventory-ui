import {batchFirstQuantities, type SampleFormulationState, type FormulationRowInput} from './formulation';

export const preparationHelp = "Shop quantities are scaled from the formulation's reference preparation. Exact Batch calculations are preserved. Manual overrides take precedence.";
export function exactPreparationDisplay(value:number|null) {
 if(value===null)return 'unavailable — canonical Batch requirement unresolved';
 const rounded=Number(value.toFixed(2));
 return `${Math.abs(value-rounded)>1e-9?'≈ ':''}${rounded.toLocaleString('en-US',{maximumFractionDigits:2})}`;
}
// Presentation only: quantity selection remains in the captured Batch-first engine.
export function preparationDescription(state:SampleFormulationState, rows:FormulationRowInput[], index:number, projection= batchFirstQuantities(state,rows)): {label:string;note:string} {
 const row=rows[index],role=row.componentRole,result=projection.rows[index];
 if(row.quantityProvenance==='manual')return {label:'SHOP PREPARATION',note:'Manual override — remains fixed when the formulation or geometry changes.'};
 if(role==='aggregate')return {label:'EXACT BATCH PROJECTION',note:'Authored percentage of the Working Pour Chip Mix.'};
 if(role==='hardener') {
  const resinIndex=rows.findIndex(r=>r.componentRole==='resin');
  if(resinIndex>=0){const resin=preparationDescription(state,rows,resinIndex,projection);return {label:resin.label,note:result?.shop==null?'No authoritative preparation quantity is available.':`Derived from Resin using the captured ${state.profile?.resinParts}:${state.profile?.hardenerParts} ratio.`};}
 }
 const instruction=role==='filler'||role==='resin'?state.profile?.batchContract?.components[role]?.shopWorking:undefined;
 const volume=Number(state.length)*Number(state.width)/(state.dimensionUnit==='in'?144:1)*Number(state.thicknessIn)/12;
 const reference=Number(instruction?.volumeCft);
 const modified=projection.resolvedBatch.modified && (role==='filler'||role==='resin') && projection.canonical[role]!==null;
 const usable=instruction&&instruction.provenance.trim()&&reference>0&&!modified;
 if(usable&&(instruction.rule==='historical_volume_rate'||Math.abs(volume-reference)<1e-9))return {label:'SHOP PREPARATION',note:instruction.rule==='historical_volume_rate'?'Scaled from captured reference preparation.':'Captured reference-volume preparation.'};
 return {label:'EXACT BATCH PROJECTION',note:result?.exact==null?'No authoritative preparation quantity is available.':modified?'Modified Batch: baseline shop reference does not apply.':instruction?'Outside the captured reference volume; using exact projection.':'No practical reference captured; using exact projection.'};
}
