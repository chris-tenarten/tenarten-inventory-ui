import {displayProfileRatio} from './ratio-display.mjs';
import {blendNumber as n} from './production-blend.mjs';
const pick=(row,camel,snake)=>row?.[camel]??row?.[snake];
const present=value=>value==null||String(value).trim()===''?'—':String(value);
/** Read only captured plan/source data; never consult current catalog/profile/Inventory. */
export function productionBlendSheet(plan){
 const m=plan.model,source=plan.source_snapshot??{};
 const capturedRows=source.blendRows??source.blend_rows??[];
 const aggregates=capturedRows.filter(row=>pick(row,'componentRole','component_role')==='aggregate');
 const full=m.blendCount>=1;
 const dateValue=plan.status==='issued'?plan.issued_at:plan.created_at;
 const date=dateValue?new Date(dateValue):null;
 const profile=displayProfileRatio(present(m.profile)).replace(/\s[-–]\s(?=\d+:)/g,' — ');
 const rows=m.aggregates.map((row,index)=>{
  const captured=aggregates[row.sourceIndex??index]??{};
  const catalog=row.catalogSnapshot??{};
  const pounds=row.totalLb,weight=row.packageWeightLb,equivalent=row.totalBags;
  let required=`${n(pounds)} lb`;
  const isBag=row.packageContainer==='bag';
  const wholePackages=equivalent!=null&&Number.isInteger(equivalent);
  if(equivalent!=null&&weight>0){
   const count=Math.floor(equivalent),remainder=pounds-count*weight;
   const container=row.packageContainer||'package';
   required=wholePackages&&isBag?n(equivalent):[count?`${n(count)} ${container}${count>1?'s':''}`:'',remainder?`${n(remainder)} lb`:''].filter(Boolean).join(' + ')||'0 lb';
  }
  return {material:present(row.material),sku:present(catalog.vendor_sku??catalog.vendorSku??catalog.package_context?.vendor_sku),
   type:present(pick(captured,'materialType','material_type')),size:present(row.size),vendor:present(row.vendor),percentage:row.percentage,
   perBlend:isBag&&row.bagsPerBlend!=null?n(row.bagsPerBlend):'—',required,pounds,
   perBlendBags:isBag?row.bagsPerBlend:null,requiredBags:isBag&&wholePackages?equivalent:null};
 });
 const sumKnown=key=>rows.every(row=>row[key]!=null)?n(rows.reduce((sum,row)=>sum+row[key],0)):'—';
 return {profile,full,date:date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):'—',
  job:present(m.job),project:present(m.project),plate:present(m.identity),
  // The current captured Sample/Job contract has no authoritative Work Order field.
  workOrder:'—',rows,totalPercentage:n(rows.reduce((sum,row)=>sum+row.percentage,0)),totalPerBlend:sumKnown('perBlendBags'),totalRequired:sumKnown('requiredBags'),
  other:capturedRows.filter(row=>pick(row,'componentRole','component_role')==='other').map(row=>({label:/^cement$/i.test(pick(row,'materialType','material_type')??'')?'CEMENT':'OTHER',name:present(row.color)}))};
}
