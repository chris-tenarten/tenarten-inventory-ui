// V5 quantities flow from captured Batch authority to exact projection, then shop preparation.
// A shop instruction is never promoted to Batch authority.
export const BATCH_FIRST_VERSION = 'sample-formulation-v5-batch-first';
export const amount = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const out = n => n == null ? '' : String(Math.round(n * 1e6) / 1e6);
// Captured opt-in rule: preserve baseline Batch volume; substitute filler by mass.
export const FILLER_SUBSTITUTION_RULE = 'equal_mass_preserve_yield_v1';
export function resolveBatchFiller(state) {
 const p=state.profile??{}, c=p.batchContract??{};
 const baselineChip=amount(p.batchChipTargetLb), component=c.components?.filler;
 const baselineFiller=component?.authority==='confirmed'&&component.unit==='lb'&&component.provenance?.trim()?amount(component.exact):null;
 const enabled=state.calculationVersion===BATCH_FIRST_VERSION&&c.fillerSubstitution===FILLER_SUBSTITUTION_RULE&&baselineChip>0&&baselineFiller!==null&&amount(p.defaultChipDensityLbCft)>0;
 const overridden=state.batchFillerOverrideLb!==null&&state.batchFillerOverrideLb!==undefined;
 const filler=overridden?amount(state.batchFillerOverrideLb):baselineFiller;
 const target=enabled&&filler!==null?baselineChip+baselineFiller-filler:baselineChip;
 const valid=!overridden||(enabled&&filler!==null&&target>0);
 return {enabled,valid,baselineChip,baselineFiller,filler:valid?filler:null,target:valid?target:null,modified:valid&&overridden&&filler!==baselineFiller};
}
export function batchFirstQuantities(state, rows) {
 const profile=state.profile??{}, contract=profile.batchContract??{}, components=contract.components??{};
 const length=amount(state.length),width=amount(state.width),thickness=amount(state.thicknessIn);
 const area=length===null||width===null?null:length*width/(state.dimensionUnit==='in'?144:1);
 const volume=area===null||thickness===null?null:area*thickness/12;
 const loading=amount(profile.defaultChipDensityLbCft),target=amount(profile.batchChipTargetLb),batch=resolveBatchFiller(state);
 const batchVolume=target&&loading?target/loading:null, fraction=volume===null||!batchVolume?null:volume/batchVolume;
 const chips=!batch.valid?null:batch.enabled?(fraction===null||batch.target===null?null:batch.target*fraction*16):volume===null||loading===null?null:volume*loading*16;
 const currentLoading=batch.enabled&&batchVolume&&batch.target!==null?batch.target/batchVolume:loading;
 const ratio=amount(profile.resinParts),hardener=amount(profile.hardenerParts);
 const canonical = role => {
  if(role==='filler'&&batch.enabled)return batch.filler;
  const c=components[role];
  if(role==='hardener'&&c?.rule==='resin_ratio'&&c.authority==='confirmed'&&ratio&&hardener===1){const a=canonical('resin');return a===null?null:a/ratio;}
  return c?.authority==='confirmed'&&c.unit===(role==='filler'?'lb':'gal')&&c.provenance?.trim()?amount(c.exact):null;
 };
 const exactRole=role=>{const b=canonical(role);return b===null||fraction===null?null:b*fraction*(role==='filler'?16:128);};
 const defaultShop=role=>{
  if(batch.modified&&canonical(role)!==null)return exactRole(role);
  const instruction=components[role]?.shopWorking;
  if(instruction&&volume!==null&&instruction.provenance?.trim()){
   const base=amount(instruction.volumeCft),q=amount(instruction.quantity);
   if(base&&q!==null&&(instruction.unit===(role==='filler'?'oz':'fl oz'))){
    if(Math.abs(volume-base)<1e-9)return q;
    if(instruction.rule==='historical_volume_rate')return q*volume/base;
   }
  }
  return exactRole(role);
 };
 const manual=(r)=>{const n=amount(r.quantity),u=(r.unit??'').toLowerCase();return n===null?null:['resin','hardener'].includes(r.componentRole)?u==='gal'?n*128:u==='fl oz'?n:null:u==='lb'?n*16:u==='oz'?n:null;};
 const resinRow=rows.find(r=>r.componentRole==='resin');
 const resinShop=resinRow?.quantityProvenance==='manual'?manual(resinRow):defaultShop('resin');
 const resolved=rows.map(r=>{
  const role=r.componentRole, exact=role==='aggregate'?(fraction===null||chips===null||amount(r.percentage)===null?null:chips*Number(r.percentage)/100):exactRole(role);
  const shop=r.quantityProvenance==='manual'?manual(r):role==='aggregate'?(chips===null||amount(r.percentage)===null?null:chips*Number(r.percentage)/100):role==='hardener'?resinShop===null||!ratio||hardener!==1?null:resinShop/ratio:defaultShop(role);
  const source=r.quantityProvenance==='manual'?'Shop override — Batch unchanged':role==='aggregate'?(fraction===null?'Historical shop chip loading':'Exact Batch projection'):role==='hardener'?'Shop binder ratio':!batch.modified&&components[role]?.shopWorking?'Captured shop instruction':'Exact Batch projection';
  return {exact,shop,source,calculatedQuantity:r.quantityProvenance==='manual'?'':out(shop),calculatedQuantityOz:r.quantityProvenance==='manual'?'':out(shop),effectiveQuantity:out(shop)};
 });
 const fillers=resolved.filter((_,i)=>rows[i].componentRole==='filler');
 const filler=fillers.length&&fillers.every(r=>r.shop!==null)?fillers.reduce((s,r)=>s+r.shop,0):null;
 const exactFiller=fillers.length&&fillers.every(r=>r.exact!==null)?fillers.reduce((s,r)=>s+r.exact,0):null;
 const aggregates=resolved.filter((_,i)=>rows[i].componentRole==='aggregate');
 const shopChips=aggregates.length&&aggregates.every(r=>r.shop!==null)?aggregates.reduce((s,r)=>s+r.shop,0):null;
 const percentageRows=rows.filter(r=>r.componentRole==='aggregate');
 const total=percentageRows.reduce((s,r)=>s+(amount(r.percentage)??0),0);
 const finished=[state.finishedPlateWidth,state.finishedPlateLength,state.finishedPlateQuantity].map(amount);
 const productionIssues=['filler','resin','hardener'].filter(role=>canonical(role)===null).map(role=>`${role==='resin'?'Part A':role==='hardener'?'Part B':'Filler'} canonical Batch requirement is unresolved`);
 if(!batch.valid)productionIssues.push('Batch Filler must be valid and leave a positive Chip Mix under the captured substitution rule');
 const shopIssues=resolved.flatMap((r,i)=>r.shop===null?[`${rows[i].componentRole}: enter a shop quantity for this Working Pour`]:[]);
 return {resolvedBatch:batch,areaSf:out(area),finishedAreaSf:out(finished.some(v=>v===null)?null:finished[0]*finished[1]*finished[2]/144),productionVolumeCft:out(volume),calculatedWeightPerSf:out(loading===null||thickness===null?null:loading*thickness/12),effectiveWeightPerSf:out(currentLoading===null||thickness===null?null:currentLoading*thickness/12),geometryChipMixWeight:out(chips===null?null:chips/16),geometryChipMixOz:out(chips),dryPoolOz:out(chips===null||exactFiller===null?null:chips+exactFiller),actualDryTotalOz:out(shopChips===null||filler===null?null:shopChips+filler),dryPoolVarianceOz:'',defaultFillerOz:out(defaultShop('filler')),effectiveFillerOz:out(filler),defaultResinFlOz:out(defaultShop('resin')),effectiveResinFlOz:out(resinShop),effectiveChipDensityLbCft:out(loading),totalFormulaWeightOz:'',nonChipWeightOz:'',availableChipMixOz:out(chips),invalidMassBalance:!batch.valid,targetWeight:out(chips===null?null:chips/16),targetWeightOz:out(chips),percentageTotal:out(total),percentageReconciles:percentageRows.length>0&&Math.abs(total-100)<.0005,rows:resolved,fraction,canonical:{filler:canonical('filler'),resin:canonical('resin'),hardener:canonical('hardener')},productionIssues,shopIssues};
}
