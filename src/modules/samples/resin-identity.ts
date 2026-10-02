import type {SampleRecord} from './types';
import type {SampleFormulationState} from './formulation';
export const resinVendor=(state:SampleFormulationState)=>state.profile?.vendorName || state.profile?.name.split(' — ')[0].split(' / ')[0] || '';
export const binderDescription=(vendor:string,role:'resin'|'hardener')=>`${vendor.replace(/\s+Resin$/i,'')} ${role==='resin'?'Resin':'Hardener'}`.trim();
const generic=(text:string,vendor:string,role:'resin'|'hardener')=>!text.trim()||text===binderDescription(vendor,role)||text.toLowerCase()===role;
export function resinConflict(sample:SampleRecord){const row=sample.blendRows.find(r=>r.componentRole==='resin');return Boolean(row&&sample.resinColorNumber.trim()&&row.color.trim()&&sample.resinColorNumber!==row.color&&!generic(row.color,resinVendor(sample.formulation),'resin'));}
export function synchronizeResin(sample:SampleRecord,source:'setup'|'row',value:string,replace=false):SampleRecord {
 const row=sample.blendRows.find(r=>r.componentRole==='resin');if(!row)return {...sample,resinColorNumber:value};
 const old=source==='setup'?sample.resinColorNumber:row.color,peer=source==='setup'?row.color:sample.resinColorNumber;
 const sync=replace||!peer.trim()||peer===old||(source==='setup'&&generic(peer,resinVendor(sample.formulation),'resin'));
 return {...sample,resinColorNumber:source==='setup'||sync?value:sample.resinColorNumber,blendRows:sample.blendRows.map(r=>r===row&&(source==='row'||sync)?{...r,color:value,catalogSource:null,catalogItemId:null,catalogSnapshot:{}}:r)};
}
export function applyResinIdentity(sample:SampleRecord,formulation:SampleFormulationState):SampleRecord {
 const previous=resinVendor(sample.formulation),vendor=resinVendor(formulation);
 return {...sample,formulation,resinSupplier:!sample.resinSupplier.trim()||sample.resinSupplier===previous?vendor:sample.resinSupplier,
  blendRows:sample.blendRows.map(row=>{
   if(row.componentRole!=='resin'&&row.componentRole!=='hardener')return row;
   const color=generic(row.color,previous,row.componentRole)?row.componentRole==='resin'&&sample.resinColorNumber.trim()?sample.resinColorNumber:binderDescription(vendor,row.componentRole):row.color;
   return {...row,color,vendor:!row.vendor.trim()||row.vendor===previous?vendor:row.vendor,catalogSource:null,catalogItemId:null,catalogSnapshot:{}};
  })};
}
