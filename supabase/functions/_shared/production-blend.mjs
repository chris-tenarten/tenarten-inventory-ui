import {buildBlendShopPresentation} from './production-blend-shop.mjs';
import {BATCH_FIRST_VERSION,resolveBatchFiller,batchFirstQuantities} from './sample-batch-first.mjs';
import {packageEquivalent} from './sample-production-batch.mjs';
export const PRODUCTION_BLEND_VERSION='production-blend-v1';
const text=v=>v==null?'':String(v);
const pick=(s,a,b)=>s?.[a]??s?.[b];
const positive=v=>['number','string'].includes(typeof v)&&text(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
export const blendNumber=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:6});
// Production planning only: never write this fallback into catalog or Sample data.
export function productionAggregatePackage(row, quantityLb) {
 const captured=packageEquivalent(row,quantityLb);
 if(captured)return {...captured,provenance:'captured_catalog'};
 const snapshot=pick(row,'catalogSnapshot','catalog_snapshot')??{};
 const role=pick(row,'componentRole','component_role');
 // Unusable explicit package evidence is not permission to replace that basis.
 const explicitBasis=snapshot.package_context || snapshot.packageEvidence || snapshot.package_weight_lb || snapshot.package_quantity || snapshot.packaging;
 const unit=text(snapshot.unit).trim().toLowerCase();
 if(role!=='aggregate'||explicitBasis||(unit&&!['lb','lbs','oz','kg','bag','bags',''].includes(unit)))return null;
 return {weightLb:50,container:'bag',equivalent:quantityLb/50,provenance:'normal_aggregate_50lb'};
}
export function buildProductionBlend(snapshot,inputs){
 const state=pick(snapshot,'formulation','formulation_state')??{};
 const rows=(pick(snapshot,'blendRows','blend_rows')??[]).map(r=>({...r,componentRole:pick(r,'componentRole','component_role')}));
 const batch=resolveBatchFiller(state);
 if(state.calculationVersion!==BATCH_FIRST_VERSION||!batch.valid||!(batch.target>0))throw new Error('Captured formulation has no authoritative Batch Chip Mix basis.');
 const batchCount=positive(inputs.batchCount),plannedQuantity=positive(inputs.plannedQuantity),blendSize=positive(inputs.blendSize);
 if(!batchCount||!plannedQuantity||!blendSize)throw new Error('Batch Count, Planned Quantity and Blend Size must be positive.');
 const aggregates=rows.filter(r=>r.componentRole==='aggregate');
 if(!aggregates.length||aggregates.some(r=>!text(r.color).trim()||text(r.percentage).trim()===''||!Number.isFinite(Number(r.percentage))||Number(r.percentage)<0)||Math.abs(aggregates.reduce((n,r)=>n+Number(r.percentage),0)-100)>.0005)throw new Error('The approved aggregate blend must total 100% and identify every material.');
 const calculatedQuantity=batchCount*batch.target,adjustment=plannedQuantity-calculatedQuantity,blendCount=plannedQuantity/blendSize;
 const canonical=batchFirstQuantities(state,rows).canonical;
 const fillers=rows.filter(r=>r.componentRole==='filler');
 const binder=role=>{const quantity=canonical[role];return quantity>0?{perBatch:quantity,total:quantity*batchCount,unit:'US gal'}:null;};
 const model={version:PRODUCTION_BLEND_VERSION,identity:text(pick(snapshot,'colorPlateNumber','color_plate_number'))||text(pick(snapshot,'sampleName','sample_name'))||'Sample',sampleId:text(snapshot.id),sourceIssueNumber:pick(snapshot,'issueNumber','issue_number')??null,sourceUpdatedAt:pick(snapshot,'updatedAt','updated_at')??null,project:text(pick(snapshot,'projectName','project_name')),job:text(pick(snapshot,'jobNumber','job_number')),profile:text(state.profile?.name),profileIdentity:state.profile?.id,profileRevision:state.profile?.version,batchChipLb:batch.target,batchCount,plannedQuantity,blendSize,calculatedQuantity,adjustment,blendCount,
  warnings:adjustment<0?['Planned Quantity is below the calculated production quantity.']:[],
  aggregates:aggregates.map((r,index)=>{const percentage=Number(r.percentage),lbPerBlend=blendSize*percentage/100,totalLb=plannedQuantity*percentage/100,p=productionAggregatePackage(r,lbPerBlend);return {sourceIndex:index,material:text(r.color),size:text(r.size),vendor:text(r.vendor),percentage,lbPerBlend,totalLb,packageWeightLb:p?.weightLb??null,packageProvenance:p?.provenance??null,packageContainer:p?.container??null,bagsPerBlend:p?.equivalent??null,totalBags:p?totalLb/p.weightLb:null,catalogSource:pick(r,'catalogSource','catalog_source'),catalogItemId:pick(r,'catalogItemId','catalog_item_id'),catalogSnapshot:pick(r,'catalogSnapshot','catalog_snapshot')??null};}),
  filler:fillers.map(r=>{const perBatch=fillers.length===1?canonical.filler:null,quantity=perBatch===null?null:perBatch*batchCount;return {material:text(r.color),vendor:text(r.vendor),perBatch,quantity,unit:'lb',package:quantity===null?null:packageEquivalent(r,quantity),reason:quantity===null?'Captured Filler authority or material allocation is unavailable.':null};}),
  binder:{resin:binder('resin'),hardener:binder('hardener'),resinIdentity:rows.find(r=>r.componentRole==='resin')?.color??'',hardenerIdentity:rows.find(r=>r.componentRole==='hardener')?.color??'',ratio:state.profile?.resinParts&&state.profile?.hardenerParts?`${state.profile.resinParts}:${state.profile.hardenerParts}`:null}};
 if([calculatedQuantity,adjustment,blendCount,...model.filler.map(r=>r.quantity??0),...model.aggregates.flatMap(r=>[r.lbPerBlend,r.totalLb,r.bagsPerBlend??0,r.totalBags??0]),model.binder.resin?.total??0,model.binder.hardener?.total??0].some(n=>!Number.isFinite(n)))throw new Error('Production quantities exceed the supported numeric range.');
 return {...model,shopPresentation:buildBlendShopPresentation(model)};
}
