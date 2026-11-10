import {resolveBatchFiller} from '../../../supabase/functions/_shared/sample-batch-first.mjs';
import {buildProductionBlend} from '../../../supabase/functions/_shared/production-blend.mjs';
import type {Requirement,ScopeLine,Assessment} from './contracts.ts';
const n=(v:unknown)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const text=(v:unknown)=>v==null?'':String(v);
const supplied=(value:unknown)=>text(value).trim()!=='';
const positive=(value:unknown)=>{const valueNumber=n(value);return valueNumber!==null&&valueNumber>0?valueNumber:null;};
export function scopeBatchCount(line:ScopeLine){if(line.planningBasis==='reference'&&supplied(line.productionBatches))return positive(line.productionBatches);const q=n(line.quantity),yieldPerBatch=n(line.yieldPerBatch);if(q===null||q<=0||yieldPerBatch===null||yieldPerBatch<=0||!['fractional','whole_up'].includes(line.batchRounding))return null;const count=q/yieldPerBatch;return line.batchRounding==='whole_up'?Math.ceil(count):count;}
export type ScopePlan={batchCount:number|null;plannedQuantity:number|null;blendSize:number|null;thickness:number|null;overage:number|null;basis:string;issues:string[]};
/** Resolve planning inputs from immutable references, without authoring a formulation. */
export function resolveScopePlan(line:ScopeLine,snapshot:Record<string,unknown>):ScopePlan{
 const state=(snapshot.formulation_state??snapshot.formulation??{}) as Record<string,unknown>;
 const issues:string[]=[];
 if(line.planningBasis!=='reference'){
  const batchCount=scopeBatchCount(line),target=positive(resolveBatchFiller(state as unknown as Parameters<typeof resolveBatchFiller>[0]).target);
  return {batchCount,plannedQuantity:supplied(line.plannedQuantity)?positive(line.plannedQuantity):batchCount!==null&&target!==null?batchCount*target:null,blendSize:positive(line.blendSize),thickness:positive(line.thickness),overage:n(line.overage),basis:'Reviewed scope yield',issues};
 }
 const provenance=(snapshot._scope_provenance??{}) as Record<string,unknown>;
 const saved=(line.sourceKind==='blend'?(provenance.inputs??{}):{}) as Record<string,unknown>;
 const batchOverride=supplied(line.productionBatches),yieldOverride=supplied(line.yieldPerBatch)||supplied(line.batchRounding);
 let batchCount=batchOverride?positive(line.productionBatches):yieldOverride?scopeBatchCount(line):positive(saved.batchCount);
 if(batchCount!==null&&!Number.isFinite(batchCount))batchCount=null;
 const basis=batchOverride?'Explicit Production Batches':yieldOverride?'Reviewed commercial quantity-to-Batch yield':batchCount!==null?'Captured issued Blend inputs':'Production quantity unresolved';
 if(batchCount===null)issues.push(batchOverride?'Production Batch quantity must be positive.':yieldOverride?'Scope yield per Batch and rounding choice are unresolved.':'Production Batch quantity is unresolved; enter batches or reference an issued Blend.');
 const target=positive(resolveBatchFiller(state as unknown as Parameters<typeof resolveBatchFiller>[0]).target);
 const reuseChipPlan=!batchOverride&&!yieldOverride&&supplied(saved.plannedQuantity);
 let plannedQuantity=supplied(line.plannedQuantity)?positive(line.plannedQuantity):reuseChipPlan?positive(saved.plannedQuantity):batchCount!==null&&target!==null?batchCount*target:null;
 if(plannedQuantity!==null&&!Number.isFinite(plannedQuantity)){plannedQuantity=null;issues.push('Production quantities exceed the supported numeric range.');}
 if(supplied(line.plannedQuantity)&&plannedQuantity===null)issues.push('Chip quantity override must be positive.');
 else if(reuseChipPlan&&plannedQuantity===null)issues.push('Captured issued Blend chip quantity is unresolved.');
 const blendSize=supplied(line.blendSize)?positive(line.blendSize):supplied(saved.blendSize)?positive(saved.blendSize):1000;
 if(blendSize===null)issues.push('Blend size must be positive.');
 const thickness=positive(supplied(line.thickness)?line.thickness:state.thicknessIn);
 if(thickness===null)issues.push('Scope thickness is unresolved.');
 else if(supplied(line.thickness)&&n(state.thicknessIn)!==thickness)issues.push('Scope thickness differs from the captured formulation; review yield before planning.');
 const overage=supplied(line.overage)?n(line.overage):0;
 if(overage===null||overage<0)issues.push('Overage percentage must be zero or positive.');
 return {batchCount,plannedQuantity,blendSize,thickness,overage,basis,issues};
}
/** Shared by the preview and authenticated Edge capture. No inventory mutations. */
export function deriveRequirements(lines:ScopeLine[],sources:Record<string,unknown>[]){
 const requirements:Requirement[]=[],unresolved:string[]=[];
 lines.forEach((line,i)=>{
  const snapshot=sources[i]??{}, state=(snapshot.formulation_state??snapshot.formulation??{}) as Record<string,unknown>;
  const rows=(snapshot.blend_rows??snapshot.blendRows??[]) as Record<string,unknown>[];
  const reference=line.planningBasis==='reference',plan=resolveScopePlan(line,snapshot),missing:string[]=reference?[...plan.issues]:[];
  if(!(n(line.quantity)!>0)||!line.unit.trim()){
   if(reference)unresolved.push(`${line.label||`Scope ${i+1}`}: commercial scope quantity/unit is unresolved.`);
   else missing.push('Scope quantity/unit is unresolved.');
  }
  const batchCount=reference?plan.batchCount:scopeBatchCount(line);
  if(!reference){
   if(batchCount===null)missing.push('Scope yield per Batch and rounding choice are unresolved.');
   if(!line.assumptions.trim())missing.push('Calculation assumptions are undocumented.');
   if(!(n(line.thickness)!>0))missing.push('Scope thickness is unresolved.');
   else if(n(state.thicknessIn)!==n(line.thickness))missing.push('Scope thickness differs from the captured formulation; review yield before planning.');
   if(n(line.overage)===null||n(line.overage)!<0)missing.push('Overage percentage is unresolved.');
  }
  const overage=reference?plan.overage:n(line.overage),extra=overage!==null&&overage>=0?1+overage/100:null;
  const add=(role:string,material:string,quantity:number|null,unit:string,index:number,issues:string[]=[],vendor='',size='',pkg:number|null=null,packageEvidence:string|null=null)=>{
   const key=`${i}:${role}:${index}`;
   requirements.push({key,scope:line.label||`Scope ${i+1}`,role,material,vendor,size,quantity:missing.length?null:quantity,unit,packageEquivalent:missing.length?null:pkg,packageEvidence,unresolved:[...missing,...issues,...(!material.trim()?['Material identity is unresolved.']:[])],mapping:line.mappings?.[key]});
  };
  try{
   const defaultChip=batchCount===null?null:batchCount*Number(resolveBatchFiller(state as unknown as Parameters<typeof resolveBatchFiller>[0]).target);
   const model=buildProductionBlend(snapshot,{batchCount:batchCount??'',plannedQuantity:reference?plan.plannedQuantity??'':line.plannedQuantity.trim()?line.plannedQuantity:defaultChip??'',blendSize:reference?plan.blendSize??'':line.blendSize});
   for(const warning of model.warnings)missing.push(warning);
   model.aggregates.forEach((r:Record<string,unknown>,j:number)=>add('aggregate',text(r.material),extra===null?null:Number(r.totalLb)*extra,'lb',j,[],text(r.vendor),text(r.size),r.packageProvenance==='captured_catalog'&&extra!==null?Number(r.totalBags)*extra:null,r.packageProvenance==='captured_catalog'?'Captured catalog package':null));
   model.filler.forEach((r:Record<string,unknown>,j:number)=>add('filler',text(r.material),r.quantity==null||extra===null?null:Number(r.quantity)*extra,'lb',j,r.quantity==null?['Filler allocation is unresolved.']:[],text(r.vendor),'',extra!==null&&r.package?Number((r.package as Record<string,unknown>).equivalent)*extra:null,r.package?'Captured catalog package':null));
   for(const role of ['resin','hardener'] as const){const r=model.binder[role];const authored=rows.filter(row=>(row.componentRole??row.component_role)===role);add(role,text(model.binder[`${role}Identity`]),r&&extra!==null?Number(r.total)*extra:null,'US gal',0,!r||authored.length!==1?[`${role} quantity or allocation is unresolved.`]:[]);}
   // Zero/unknown canonical components are not silently omitted.
   if(!model.filler.length)add('filler','',null,'lb',0,['Filler material/quantity is unresolved.']);
  }catch(error){missing.push(error instanceof Error?error.message:'Formulation calculation unsupported.');add('unresolved',text(snapshot.color_plate_number??snapshot.colorPlateNumber),null,'',0,['Choose a supported captured Batch formulation.']);}
  line.consumables?.forEach((c,j)=>add('consumable',c.material,n(c.quantity)!>=0?n(c.quantity):null,c.unit,j,!c.evidence.trim()||!c.unit.trim()||n(c.quantity)===null?['Consumable quantity/unit evidence is unresolved.']:[]));
  const additional=[...rows.filter(row=>(row.componentRole??row.component_role)==='other').map(row=>text(row.color)),text(snapshot.sealer)].filter(Boolean);
  for(const material of additional)if(!line.consumables?.some(c=>c.material===material))add('consumable',material,null,'',100+additional.indexOf(material),['Define an explicit Production quantity and unit for this captured consumable.']);
  for(const r of requirements.filter(r=>r.key.startsWith(`${i}:`))){const index=Number(r.key.split(':')[2]),source=rows.filter(row=>(row.componentRole??row.component_role)===r.role)[index];if(source){r.catalogSource=text(source.catalog_source??source.catalogSource);r.catalogItemId=text(source.catalog_item_id??source.catalogItemId);}}
  if(!line.consumables?.length)unresolved.push(`${line.label||`Scope ${i+1}`}: non-blend consumables are not defined; confirm exclusions.`);
  for(const r of requirements.filter(r=>r.key.startsWith(`${i}:`)))if(r.quantity===null&&!r.unresolved.length)r.unresolved.push('Quantity is unresolved.');
 });
 for(const r of requirements){if(r.quantity!==null&&!Number.isFinite(r.quantity)){r.quantity=null;r.unresolved.push('Quantity exceeds the supported numeric range.');}if(r.packageEquivalent!==null&&!Number.isFinite(r.packageEquivalent))r.packageEquivalent=null;}
 for(const r of requirements)unresolved.push(...r.unresolved.map(x=>`${r.scope} / ${r.material||r.role}: ${x}`));
 return {requirements,unresolved:[...new Set(unresolved)]};
}
type Supply=Record<string,unknown>;
/** Reviewed exact tuple + documented factor only. Similar names never establish identity. */
export function assessRequirements(requirements:Requirement[],inventory:Supply[],incoming:Supply[],jobId:string|null,catalog:Record<string,{vendor:string;leadTimeDays:number|null;packageInfo:string;evidence:string}>={}):Assessment[]{
 const remaining=new Map<string,number>();
 return requirements.map(r=>{
  const supplier=catalog[r.key];const m=r.mapping,unknown=[...r.unresolved],etas:string[]=[];
  const empty={key:r.key,available:null,reservedForJob:null,reservedElsewhere:null,incoming:null,shortage:null,unknown,etas,leadTimeDays:null,supplier:m?.supplier||supplier?.vendor||r.vendor,supplierEvidence:supplier?.evidence,packageInfo:supplier?.packageInfo};
  if(!m?.evidence?.trim()||!(n(m.factor)!>0)||!m.color?.trim()||!m.unit?.trim()){unknown.push('Material mapping and unit-conversion evidence are required.');return empty;}
  const match=(s:Supply,isIncoming=false)=>text(s.vendor)===m.vendor&&text(isIncoming?s.material_name:s.color)===m.color&&text(s.size)===m.size&&text(s.category)===m.category&&text(s.unit)===m.unit;
  const factor=Number(m.factor);let available=0,reservedForJob=0,reservedElsewhere=0,incomingQuantity=0;
  const eligible=(s:Supply)=>!s.production_job_id&&!s.temporary_job_label&&!s.earmarked_for_job&&!s.is_earmarked;
  const key=JSON.stringify([m.vendor,m.color,m.size,m.category,m.unit]);
  for(const s of inventory.filter(s=>match(s))){const q=n(s.quantity);if(q===null||q<0){unknown.push('An inventory quantity is invalid.');continue;}if(jobId&&s.production_job_id===jobId)reservedForJob+=q*factor;else if(eligible(s))available+=q*factor;else reservedElsewhere+=q*factor;}
  for(const s of incoming.filter(s=>match(s,true)&&['pending','partially_received'].includes(text(s.status)))){
   if(!eligible(s)&&(!jobId||s.production_job_id!==jobId))continue;
   const expected=n(s.quantity_expected),received=n(s.quantity_received)??0;if(expected===null||received<0){unknown.push('An incoming quantity is invalid.');continue;}
   incomingQuantity+=Math.max(0,expected-received)*factor;
   if(s.eta)etas.push(text(s.eta));else unknown.push('Incoming supply has no ETA.');
  }
  // Shared stock is consumed once in this read-only allocation, in scope order.
  const consumed=(remaining.get(key)??0)*factor,total=available+reservedForJob,usable=Math.max(0,total-consumed);
  const quantity=r.unresolved.length?null:r.quantity;
  if(quantity!==null)remaining.set(key,(consumed+quantity)/factor);
  const lead=n(m.leadTimeDays)??n(supplier?.leadTimeDays);if(lead===null||lead<0)unknown.push('Supplier lead time is unknown.');
  return {...empty,available:Math.max(0,available-Math.max(0,consumed-reservedForJob)),reservedForJob:Math.max(0,reservedForJob-consumed),reservedElsewhere,incoming:incomingQuantity,shortage:quantity===null?null:Math.max(0,quantity-usable),unknown:[...new Set(unknown)],etas:[...new Set(etas)],leadTimeDays:lead!==null&&lead>=0?lead:null};
 });
}
