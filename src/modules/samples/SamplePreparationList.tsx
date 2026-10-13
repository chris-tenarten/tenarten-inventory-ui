"use client";
import {useState} from 'react';
import {BusinessButton,BusinessInput} from '@/components/BusinessWriteControls';
import {PurchasingChoiceWithCustom,purchasingQuantityUnits} from '@/modules/purchasing/material-controls';
import ContextHelp from './ContextHelp';
import {BATCH_FIRST_VERSION,batchFirstQuantities,calculateSampleFormulation,type SampleFormulationState} from './formulation';
import {sampleRowsForDisplay,type SampleBlendRow} from './types';
import {exactPreparationDisplay,preparationDescription} from './preparation';
import {displayRatio} from '../../../supabase/functions/_shared/ratio-display.mjs';

export default function SamplePreparationList({state,rows,result,onPatch}:{state:SampleFormulationState;rows:SampleBlendRow[];result:ReturnType<typeof calculateSampleFormulation>|null;onPatch:(index:number,changes:Partial<SampleBlendRow>)=>void}){
 const [blurred,setBlurred]=useState<Record<string,boolean>>({});
 const batchFirst=state.calculationVersion===BATCH_FIRST_VERSION;
 const displayRows=sampleRowsForDisplay(rows);
 const projection=batchFirst?batchFirstQuantities(state,rows):null;
 return <section aria-label="Shop preparation" className="border border-slate-300 bg-white p-3 sm:p-4">
  <div className="flex items-center gap-1"><h2 className="text-base font-bold">Shop Preparation</h2><ContextHelp label="Preparation amounts">The calculated amount comes from the Batch formula. The preparation amount follows the selected shop preparation instructions.</ContextHelp></div>
  <div className="preparation-heading text-xs font-semibold text-slate-600"><span>Material</span><span>Amount to prepare</span></div>
  <div data-testid="preparation-list">{displayRows.map(({row,sourceIndex:index},displayIndex)=>{
   const manual=row.quantityProvenance==='manual';
   const value=manual?row.quantity:result?.rows[index]?.calculatedQuantity||'';
   const unit=row.componentRole==='resin'||row.componentRole==='hardener'?'fl oz':row.componentRole==='other'?row.unit:'oz';
   const canOverride=['aggregate','filler','resin','hardener'].includes(row.componentRole)&&!(batchFirst&&row.componentRole==='hardener');
   const blank=manual&&blurred[row.id]&&String(value).trim()==='';
   const info=projection?preparationDescription(state,rows,index,projection):null;
   const previous=displayRows[displayIndex-1]?.row;
   const group=displayIndex===0||previous?.componentRole==='aggregate'&&row.componentRole!=='aggregate';
   return <div key={row.id}>
    {group&&<h3 className="mt-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{row.componentRole==='aggregate'?'Aggregates':'Filler & Binder'}</h3>}
    <div className="preparation-row" data-preparation-row={row.id} data-role={row.componentRole}>
     <div className="min-w-0"><p className="break-words text-sm font-semibold">{row.color||row.componentRole}</p><p className="text-xs text-slate-500">{row.componentRole==='aggregate'?`${row.percentage||'0'}%${row.size?` · ${row.size}`:''}`:row.componentRole[0].toUpperCase()+row.componentRole.slice(1)}{manual&&<span className="ml-2 font-semibold text-amber-800">Manual override</span>}</p></div>
     <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
       {manual?<label className="inline-flex min-w-0 items-center gap-1"><span className="sr-only">{row.componentRole} quantity</span><BusinessInput aria-label={`${row.componentRole} quantity`} aria-invalid={blank||undefined} aria-describedby={blank?`preparation-error-${row.id}`:undefined} type="number" min="0" step="any" value={value} onChange={e=>onPatch(index,{quantity:e.target.value})} onBlur={()=>setBlurred(current=>({...current,[row.id]:true}))} className="h-11 w-28 min-w-0 border border-amber-400 bg-amber-50 px-2 text-base font-semibold sm:h-9"/><span className="text-xs">{unit}</span></label>:<output aria-label={`${row.componentRole} amount to prepare`} className="text-base font-bold tabular-nums">{value||'—'} <span className="text-xs font-normal">{unit}</span></output>}
       {canOverride&&<BusinessButton type="button" aria-label={manual?`Use calculated preparation for ${row.componentRole}`:`Edit ${row.componentRole} preparation quantity`} onClick={()=>onPatch(index,{quantityProvenance:manual?'calculated':'manual',calculationBasis:row.componentRole==='aggregate'&&manual?'target_total':null,quantity:manual?row.quantity:(result?.rows[index]?.calculatedQuantity||''),unit})} className="min-h-11 px-2 text-xs font-semibold text-blue-900 underline sm:min-h-9">{manual?'Use calculated preparation':'Edit'}</BusinessButton>}
      </div>
      {blank&&<p id={`preparation-error-${row.id}`} role="alert" className="mt-1 text-xs text-red-700">Enter a preparation quantity{canOverride?' or choose Use calculated preparation':''}.</p>}
      {projection&&row.componentRole!=='aggregate'&&<p className="text-xs text-slate-500">Calculated: {exactPreparationDisplay(projection.rows[index]?.exact??null)}{projection.rows[index]?.exact!=null?` ${unit}`:''}</p>}
      {row.componentRole==='hardener'&&!manual&&<p className="text-xs text-slate-600">Calculated from Resin at {displayRatio(state.profile?.resinParts??state.resinParts,state.profile?.hardenerParts??state.hardenerParts)}.</p>}
     </div>
     <details className="preparation-details text-xs text-slate-500"><summary className="cursor-pointer py-1">Details<span className="sr-only"> for {row.color||row.componentRole}</span></summary><p>{info?.note|| (manual?'Manual preparation quantity.':'Calculated preparation quantity.')}</p>{projection&&row.componentRole==='aggregate'&&<p>Calculated amount: {exactPreparationDisplay(projection.rows[index]?.exact??null)} oz</p>}<p>{[row.vendor,row.size,row.materialType].filter(Boolean).join(' · ')}</p>{row.componentRole==='other'&&manual&&<label>Unit<PurchasingChoiceWithCustom value={row.unit} options={purchasingQuantityUnits} onChange={unit=>onPatch(index,{unit})} className="min-h-11 border px-2"/></label>}</details>
    </div>
   </div>;
  })}</div>
  <p className={`mt-2 border-t border-slate-300 pt-2 text-sm font-semibold ${result?.percentageReconciles?'text-slate-800':'text-red-800'}`}>Chip Mix: {result?.availableChipMixOz||'—'} oz · {result?.percentageTotal||'0'}% / 100%</p>
 </section>;
}
