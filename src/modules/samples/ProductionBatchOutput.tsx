"use client";
import {useState} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {buildProductionBlend,blendNumber as n} from '../../../supabase/functions/_shared/production-blend.mjs';
import {blendShopPresentation} from '../../../supabase/functions/_shared/production-blend-shop.mjs';
import {hasCapturedBatchBasis} from './operational-profile-model';
import type {SampleRecord} from './types';

type Inputs={batchCount:string;plannedQuantity:string;blendSize:string};
type Snapshot=Parameters<typeof buildProductionBlend>[0];
type Model=ReturnType<typeof buildProductionBlend>;
type Plan={id:string;revision:number;status:'working'|'issued';inputs:Inputs;model:Model;source_snapshot:Snapshot;created_at:string};
async function request(body:Record<string,unknown>){
 const {data,error}=await supabase.functions.invoke('generate-sample-pdf',{body});
 if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}
 return data;
}
export default function ProductionBatchOutput({sample,onSave,onPreview}:{sample:SampleRecord;onSave:()=>Promise<SampleRecord>;onPreview:(url:string,filename:string)=>void}){
 const auth=useAuth();const canManage=auth.can('production_blend.manage');
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [source,setSource]=useState('working'),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[plans,setPlans]=useState<Plan[]>([]),[plan,setPlan]=useState<Plan|null>(null);
 const [inputs,setInputs]=useState<Inputs>({batchCount:'1',plannedQuantity:'',blendSize:'1000'});
 let model:Model|null=null,calculationError='';
 if(snapshot)try{model=buildProductionBlend(snapshot,inputs);}catch(e){calculationError=e instanceof Error?e.message:'Invalid planning inputs.';}
 const missingCurrentBasis = !hasCapturedBatchBasis(sample.formulation);
 const frozen=plan?.status==='issued';
 const shown=frozen?plan.model:model;
 const shop=shown?blendShopPresentation(shown,Boolean(frozen)):null;
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Unable to load Production Blend.');}finally{setBusy(false);}}
 async function refresh(){setPlans(await request({action:'blend-list',sampleId:sample.id}));}
 async function begin(){await run(async()=>{await refresh();setOpen(true);});}
 async function capture(){await run(async()=>{
  if(source==='working' && auth.can('writeBusinessData'))await onSave();
  const context=await request({action:'blend-context',sampleId:sample.id,...(source==='working'?{}:{documentId:source})});
  const probe=buildProductionBlend(context.snapshot,{batchCount:1,plannedQuantity:1,blendSize:1000});
  setSnapshot(context.snapshot);setInputs({batchCount:'1',plannedQuantity:String(probe.batchChipLb),blendSize:'1000'});setPlan(null);
 });}
 function load(p:Plan){setPlan(p);setSnapshot(p.source_snapshot);setInputs(p.inputs);setError('');}
 async function save(issue=false){const saved:Plan=await request({action:issue?'blend-issue':'blend-save',sampleId:sample.id,documentId:source==='working'?undefined:source,planId:plan?.id,revision:plan?.revision,expectedSourceUpdatedAt:!plan?snapshot?.updated_at:undefined,inputs});load(saved);await refresh();return saved;}
 async function pdf(){await run(async()=>{const saved=frozen?plan:await save();const blob=await request({action:'blend-pdf',planId:saved.id});if(!(blob instanceof Blob))throw new Error('Invalid Production PDF response.');onPreview(URL.createObjectURL(blob),`Production-Blend-${saved.status}.pdf`);});}
 if(!canManage)return null;
 const button='min-h-11 border border-blue-900 px-3 py-2 text-sm font-bold disabled:opacity-40';
 return <section aria-label="Production Blend Sheet" className="border border-slate-300 bg-white p-4">
  <h2 className="text-sm font-bold uppercase tracking-wide">Production Blend Sheet</h2>
  <p className="mt-1 text-xs text-slate-600">Plan aggregate staging from a saved formulation. No inventory is reserved or consumed.</p>
  {!sample.id&&<p className="mt-2 text-xs text-slate-600">Save this Sample before planning Production.</p>}
  {!open?<button type="button" disabled={busy||!sample.id} className={`${button} mt-3`} onClick={()=>void begin()}>Plan Production Blend</button>:<>
   <div className="mt-3 flex flex-wrap gap-3">
    <label className="text-sm">Source formulation<select aria-label="Production source formulation" disabled={busy} value={source} onChange={e=>{setSource(e.target.value);setSnapshot(null);setPlan(null);}} className="ml-2 min-h-11 border border-slate-300"><option value="working">Current saved formulation</option>{sample.issuedDocuments.map(d=><option value={d.id} key={d.id}>Sample Issue {d.issueNumber}</option>)}</select></label>
    <button type="button" className={button} disabled={busy || (source==='working' && missingCurrentBasis)} onClick={()=>void capture()}>New Blend Plan</button>
   </div>
   {source==='working' && missingCurrentBasis && <p role="status" className="mt-3 text-sm text-amber-900">This formulation has no captured Batch basis. <a className="font-bold underline" href="#sample-resin-system">Review the current Resin System defaults</a>, explicitly apply a complete profile, then save to enable New Blend Plan. Issued Sample history remains unchanged.</p>}
   {source!=='working' && <p className="mt-3 text-sm text-slate-600">Issued sources are immutable. If this issue lacks Batch authority, select Current saved formulation, review and apply current Resin System defaults there, then save. This does not update the issued source.</p>}
   {plans.length>0&&<label className="mt-3 block text-sm">Saved Production plans<select aria-label="Saved Production plans" value={plan?.id||''} onChange={e=>{const p=plans.find(p=>p.id===e.target.value);if(p)load(p);}} className="ml-2 min-h-11 max-w-full border border-slate-300"><option value="">Select a plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.status==='issued'?'Issued':'Working'} · {n(p.model.batchCount)} Batches · {n(p.model.plannedQuantity)} lb · {new Date(p.created_at).toLocaleString()}</option>)}</select></label>}
   {snapshot&&<div className="mt-4 space-y-4">
    <p className="text-sm font-bold">{frozen?'ISSUED PRODUCTION BLEND SHEET':'WORKING PRODUCTION BLEND — NOT ISSUED'}</p>
    <p className="text-xs text-slate-600">{plan?'Uses this plan’s captured formulation and package data. Create a new plan to use a different source.':'Save captures the selected saved formulation and package data.'}</p>
    <div className="grid gap-4 sm:grid-cols-3">
     {(['batchCount','plannedQuantity','blendSize'] as const).map((key,i)=><label key={key} className="text-sm font-bold">{['Batch Count','Planned Quantity','Blend Size'][i]}{i>0?' (lb)':''}<input aria-label={['Batch Count','Planned Quantity','Blend Size'][i]} type="number" min="0" step="any" disabled={busy||frozen} value={inputs[key]} onChange={e=>setInputs({...inputs,[key]:e.target.value})} className="mt-1 min-h-11 w-full border border-slate-300 px-2"/>{key==='plannedQuantity'&&<span className="mt-1 block text-xs font-normal text-slate-600">Operator input: change this production target as needed. Adjustment = Planned − Calculated.</span>}</label>)}
    </div>
    {calculationError&&!frozen&&<p role="alert" className="text-sm text-red-800">{calculationError}</p>}
    {shown&&<>
     {shown.blendCount<1&&<p role="status" className="text-sm text-amber-800">This plan is less than one Blend. Review the Planned Quantity or Blend Size before issuing.</p>}
     <dl className="grid gap-3 bg-slate-50 p-3 sm:grid-cols-3"><div><dt>Calculated Quantity <span className="block text-xs">Batch Count × chips per Batch</span></dt><dd className="font-bold">{n(shown.calculatedQuantity)} lb</dd></div><div><dt>Adjustment</dt><dd className="font-bold">{shown.adjustment>=0?'+':''}{n(shown.adjustment)} lb</dd></div><div><dt>Blends <span className="block text-xs">Planned Quantity ÷ Blend Size</span></dt><dd className="font-bold">{n(shown.blendCount)}</dd></div></dl>
     {shown.warnings.map(w=><p key={w} role="alert" className="text-sm text-amber-800">{w} Correct it before issue.</p>)}
     {shop&&<>
      <h3 className="text-sm font-bold">{shop.heading}</h3>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr>{['Material','Size','Vendor',shop.basis==='plannedQuantity'?'Shop Qty':'Bags / Blend',shop.basis==='plannedQuantity'?'lb':'lb / Blend','Qty in Stock','Qty to Order'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{shown.aggregates.map((r:Model["aggregates"][number],i:number)=><tr key={i} className="border-t border-slate-200"><td className="p-2">{r.material}</td><td className="p-2">{r.size}</td><td className="p-2">{r.vendor}</td><td className="p-2 font-bold">{shop.rows[i].instruction}</td><td className="p-2">{n(shop.rows[i].pounds)}</td><td className="p-2 text-slate-500">—</td><td className="p-2 text-slate-500">—</td></tr>)}</tbody></table></div>
      <details className="text-sm"><summary className="cursor-pointer font-bold">View calculation details</summary>
       <p className="my-2">Exact Blend Count: {String(shown.blendCount)} ({String(shown.plannedQuantity)} lb ÷ {String(shown.blendSize)} lb).</p>
       <p className="my-2">Recipe basis: {shop.basis==='plannedQuantity'?'Planned Quantity':'Blend Size'} · {String(shop.basisLb)} lb. Inventory placeholders are not connected to Inventory.</p>
       {shown.aggregates.map((r:Model["aggregates"][number],i:number)=>{const d=shop.rows[i];return <div key={i} className="border-t border-slate-200 py-2"><strong>{r.material}</strong><p>{String(d.percentage)}% × {String(shop.basisLb)} lb = {String(d.pounds)} lb</p><p>Package: {d.packageWeightLb==null?'Unavailable':`${String(d.packageWeightLb)} lb / ${d.packageContainer}`} · {d.packageSource==='captured_catalog'?'Captured/catalog metadata':d.packageSource==='normal_aggregate_50lb'?'Normal-Aggregate 50-lb fallback':'No package authority'}</p><p>Exact package equivalent: {d.exactEquivalent==null?'Unavailable':String(d.exactEquivalent)} · Shop instruction: {d.instruction}</p></div>;})}
      </details>
     </>}

     {shown.filler.map((f:Model["filler"][number],i:number)=><p key={i} className="text-sm">Filler: {f.material} — {f.quantity==null ? "Production quantity unavailable" : `${n(f.quantity)} lb (${n(f.perBatch)} lb/Batch × ${n(shown.batchCount)} Batches)`}{f.package && <span> · {n(f.package.equivalent)} × {n(f.package.weightLb)} lb / {f.package.container}</span>}</p>)}
     <p className="text-sm">Part A: <strong>{shown.binder.resin?`${n(shown.binder.resin.total)} US gal`:'Unavailable'}</strong> · Part B: <strong>{shown.binder.hardener?`${n(shown.binder.hardener.total)} US gal`:'Unavailable'}</strong> · {n(shown.batchCount)} Batches</p>
    </>}
    <div className="flex flex-wrap gap-2">{!frozen&&<><button type="button" disabled={busy||!model} className={button} onClick={()=>void run(async()=>{await save();})}>Save Blend Plan</button><button type="button" disabled={busy||!model||Boolean(model?.warnings.length)} className={button} onClick={()=>void run(async()=>{await save(true);})}>Issue Production Blend</button></>}<button type="button" disabled={busy||!shown} className={`${button} bg-blue-900 text-white`} onClick={()=>void pdf()}>Generate {frozen?'Issued':'Working'} Production Blend PDF</button></div>
   </div>}
  </>}
  {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
 </section>;
}
