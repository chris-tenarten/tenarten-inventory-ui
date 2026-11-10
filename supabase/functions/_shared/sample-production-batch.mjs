import {BATCH_FIRST_VERSION,resolveBatchFiller} from './sample-batch-first.mjs';
import {projectSampleBatch,deriveBatchReference,formatBatchQuantity} from './sample-batch-projection.mjs';
import {normalizeSupportedSampleRatio} from './sample-ratio.mjs';
export const PRODUCTION_BATCH_PDF_VERSION='production-batch-blend-v1';
const text=v=>v==null?'':String(v);
const pick=(s,a,b=a)=>s?.[a]??s?.[b];
const positive=v=>text(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const massUnit=u=>/^(lb|lbs|pound|pounds)$/i.test(text(u).trim())?'lb':/^(oz|ounce|ounces)$/i.test(text(u).trim())?'oz':/^(kg|kilogram|kilograms)$/i.test(text(u).trim())?'kg':null;
// Capture only a complete, unambiguous catalog package. Never infer from price/order unit.
export function captureBatchPackage(item) {
 const e=item.packageEvidence;if(!e)return null;
 const label=text(e.label).trim();let amount=positive(e.amount),unit=massUnit(e.unit),container='package';
 const parsed=label.match(/^(\d+(?:\.\d+)?)\s*(pounds?|lbs?|kilograms?|kg|ounces?|oz)\.?\s*(bags?|pails?|boxes?|buckets?|drums?|cases?|totes?|kits?)?$/i);
 if(amount!==null&&unit){
  if(parsed&&(Number(parsed[1])!==amount||massUnit(parsed[2])!==unit))return null;
  if(!parsed&&label&&!/^(bag|pail|box|bucket|drum|case|tote|kit)$/i.test(label))return null;
  container=(parsed?.[3]||label||'package').toLowerCase();
 }else{
  if(text(e.amount).trim()||text(e.unit).trim()||!parsed)return null;
  amount=positive(parsed[1]);unit=massUnit(parsed[2]);container=(parsed[3]||'package').toLowerCase();
 }
 if(!amount||!unit)return null;
 return {version:1,amount:String(amount),unit,container,label,catalog_source:item.source,catalog_item_id:item.id,vendor:item.vendor,vendor_sku:item.vendorSku};
}
export function packageEquivalent(row,batchLb) {
 const p=pick(row,'catalogSnapshot','catalog_snapshot')?.package_context;
 if(!p||p.version!==1||p.catalog_source!==pick(row,'catalogSource','catalog_source')||p.catalog_item_id!==pick(row,'catalogItemId','catalog_item_id')||!p.catalog_item_id)return null;
 const amount=positive(p.amount),unit=massUnit(p.unit);if(amount===null||unit===null)return null;
 const weightLb=amount*(unit==='kg'?1/0.45359237:unit==='oz'?1/16:1);
 const equivalent=batchLb/weightLb;if(!Number.isFinite(equivalent)||equivalent<0)return null;
 const rounded=Number(equivalent.toFixed(2));
 const container=text(p.container).replace(/boxes$/,'box').replace(/s$/,'')||'package';
 return {amount,unit,weightLb,equivalent,container,label:`${Math.abs(equivalent-rounded)>1e-10?'≈ ':''}${rounded.toFixed(2)} × ${amount}-${unit} ${container}${rounded===1?'':'s'}`};
}
export function productionBatchReadiness(snapshot) {
 const state=pick(snapshot,'formulation','formulation_state')||{};
 const source=pick(snapshot,'blendRows','blend_rows')||[];
 const rows=Array.isArray(source)?source.map(r=>({...r,color:text(r.color),percentage:text(r.percentage),quantity:text(r.quantity),unit:text(r.unit),componentRole:pick(r,'componentRole','component_role'),quantityProvenance:pick(r,'quantityProvenance','quantity_provenance'),calculationBasis:pick(r,'calculationBasis','calculation_basis')})):[];
 const projection=projectSampleBatch(state,rows);const reasons=[...projection.issues];
 if(state.calculationVersion!==BATCH_FIRST_VERSION)reasons.unshift('Legacy Sample capture has no complete canonical Batch authority.');
 if(state.calculationVersion!==BATCH_FIRST_VERSION&&!['in','ft'].includes(state.dimensionUnit))reasons.push('Working Pour dimension unit is missing.');
 if(!state.profile)reasons.push('Captured formulation profile is missing.');
 if(!normalizeSupportedSampleRatio(state.resinParts,state.hardenerParts))reasons.push('Captured binder ratio is unsupported.');
 for(const role of ['aggregate','filler','resin','hardener'])if(!rows.some(r=>r.componentRole===role))reasons.push(`Required ${role} component is missing.`);
 rows.forEach((r,i)=>{
  if(!text(r.color).trim())reasons.push(`Material name is missing for component ${i+1}.`);
  if(!['aggregate','filler','resin','hardener','other'].includes(r.componentRole))reasons.push(`Component ${i+1} has no supported Formula Role.`);
  if(!['manual','calculated'].includes(r.quantityProvenance))reasons.push(`Component ${i+1} quantity authority is missing.`);
  if(r.componentRole==='other'&&r.quantityProvenance!=='manual')reasons.push(`Other component ${i+1} needs an explicit quantity and unit.`);
  const q=projection.rows[i]?.quantity;
  if(q==null||!Number.isFinite(q)||q<0||(['resin','hardener'].includes(r.componentRole)&&q===0))reasons.push(`Component ${i+1} has no authoritative Batch quantity.`);
 });
 return {ready:reasons.length===0,reasons:[...new Set(reasons)],state,rows,projection};
}
export function buildProductionBatchModel(snapshot,source) {
 const result=productionBatchReadiness(snapshot);if(!result.ready)throw new Error(`Production Batch unavailable: ${result.reasons.join(' ')}`);
 if(!['working','issued'].includes(source))throw new Error('Explicit Batch document source is required.');
 const issueNumber=Number(pick(snapshot,'issueNumber','issue_number'));
 if(source==='issued'&&!(Number.isInteger(issueNumber)&&issueNumber>0))throw new Error('Issued formulation identity is required.');
 const {state,rows,projection}=result;const order={aggregate:0,filler:1,other:2,resin:3,hardener:4};
 return {version:PRODUCTION_BATCH_PDF_VERSION,source,issueNumber:source==='issued'?issueNumber:null,
  status:source==='issued'?`ISSUED FORMULATION - ISSUE ${issueNumber}`:'WORKING BATCH BLEND - NOT ISSUED',
  identity:text(pick(snapshot,'colorPlateNumber','color_plate_number'))||text(pick(snapshot,'sampleName','sample_name'))||'Sample',
  sampleId:text(snapshot.id),project:text(pick(snapshot,'projectName','project_name')),job:text(pick(snapshot,'jobNumber','job_number')),
  profile:text(state.profile.name),profileRevision:state.profile.version,
  sourceDate:text(source==='issued'?pick(snapshot,'issuedAt','issued_at'):pick(snapshot,'updatedAt','updated_at')),
  approvedDate:source==='issued'?text(pick(snapshot,'approvedDate','approved_date')):'',
  resolvedBatch:resolveBatchFiller(state),batchTarget:projection.target,reference:deriveBatchReference(state),binderRatio:normalizeSupportedSampleRatio(state.resinParts,state.hardenerParts),effectiveChipDensityLbCft:Number(state.materialDensity),
  rows:rows.map((r,i)=>({...r,role:r.componentRole,batchQuantity:projection.rows[i].quantity,batchUnit:projection.rows[i].unit,quantityLabel:`${formatBatchQuantity(projection.rows[i].quantity,projection.rows[i].unit)} ${projection.rows[i].unit==='gal'?'US gal':projection.rows[i].unit}`,
   // Exact fl oz alongside rounded gallons preserves the captured binder recipe.
   exactLiquid:projection.rows[i].unit==='gal'?`${formatBatchQuantity(projection.rows[i].quantity*128,'fl oz')} fl oz`:'',
   size:text(r.size),vendor:text(r.vendor),package:['aggregate','filler'].includes(r.componentRole)?packageEquivalent(r,projection.rows[i].quantity):null,sourceIndex:i})).sort((a,b)=>order[a.role]-order[b.role]||a.sourceIndex-b.sourceIndex)
 };
}
