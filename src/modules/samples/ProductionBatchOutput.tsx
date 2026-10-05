"use client";
import {useState} from 'react';
import {BusinessSelect} from '@/components/BusinessWriteControls';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {buildProductionBlend,blendNumber as n} from '../../../supabase/functions/_shared/production-blend.mjs';
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
 const auth=useAuth();const {profile}=auth;const admin=profile?.isActive&&profile.role==='admin'&&auth.can('writeBusinessData');
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [source,setSource]=useState('working'),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[plans,setPlans]=useState<Plan[]>([]),[plan,setPlan]=useState<Plan|null>(null);
 const [inputs,setInputs]=useState<Inputs>({batchCount:'1',plannedQuantity:'',blendSize:'1000'});
 let model:Model|null=null,calculationError='';
 if(snapshot)try{model=buildProductionBlend(snapshot,inputs);}catch(e){calculationError=e instanceof Error?e.message:'Invalid planning inputs.';}
 const missingCurrentBasis = !hasCapturedBatchBasis(sample.formulation);
 const frozen=plan?.status==='issued';
 const shown=frozen?plan.model:model;
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Unable to load Production Blend.');}finally{setBusy(false);}}
 async function refresh(){setPlans(await request({action:'blend-list',sampleId:sample.id}));}
 async function begin(){await run(async()=>{await refresh();setOpen(true);});}
 async function capture(){await run(async()=>{
  if(source==='working')await onSave();
  const context=await request({action:'blend-context',sampleId:sample.id,...(source==='working'?{}:{documentId:source})});
  const probe=buildProductionBlend(context.snapshot,{batchCount:1,plannedQuantity:1,blendSize:1000});
  setSnapshot(context.snapshot);setInputs({batchCount:'1',plannedQuantity:String(probe.batchChipLb),blendSize:'1000'});setPlan(null);
 });}
 function load(p:Plan){setPlan(p);setSnapshot(p.source_snapshot);setInputs(p.inputs);setError('');}
 async function save(issue=false){const saved:Plan=await request({action:issue?'blend-issue':'blend-save',sampleId:sample.id,documentId:source==='working'?undefined:source,planId:plan?.id,revision:plan?.revision,expectedSourceUpdatedAt:!plan?snapshot?.updated_at:undefined,inputs});load(saved);await refresh();return saved;}
 async function pdf(){await run(async()=>{const saved=frozen?plan:await save();const blob=await request({action:'blend-pdf',planId:saved.id});if(!(blob instanceof Blob))throw new Error('Invalid Production PDF response.');onPreview(URL.createObjectURL(blob),`Production-Blend-${saved.status}.pdf`);});}
 if(!admin)return null;
 const button='min-h-11 border border-blue-900 px-3 py-2 text-sm font-bold disabled:opacity-40';
 return <section aria-label="Production Blend Sheet" className="border border-slate-300 bg-white p-4">
  <h2 className="text-sm font-bold uppercase tracking-wide">Production Blend Sheet</h2>
  <p className="mt-1 text-xs text-slate-600">Plan aggregate staging from a saved formulation. No inventory is reserved or consumed.</p>
  {!sample.id&&<p className="mt-2 text-xs text-slate-600">Save this Sample before planning Production.</p>}
  {!open?<button type="button" disabled={busy||!sample.id} className={`${button} mt-3`} onClick={()=>void begin()}>Plan Production Blend</button>:<>
   <div className="mt-3 flex flex-wrap gap-3">
    <label className="text-sm">Source formulation<BusinessSelect aria-label="Production source formulation" disabled={busy} value={source} onChange={e=>{setSource(e.target.value);setSnapshot(null);setPlan(null);}} className="ml-2 min-h-11 border border-slate-300"><option value="working">Current saved formulation</option>{sample.issuedDocuments.map(d=><option value={d.id} key={d.id}>Sample Issue {d.issueNumber}</option>)}</BusinessSelect></label>
    <button type="button" className={button} disabled={busy || (source==='working' && missingCurrentBasis)} onClick={()=>void capture()}>New Blend Plan</button>
   </div>
   {source==='working' && missingCurrentBasis && <p role="status" className="mt-3 text-sm text-amber-900">This formulation has no captured Batch basis. <a className="font-bold underline" href="#sample-resin-system">Review the current Resin System defaults</a>, explicitly apply a complete profile, then save to enable New Blend Plan. Issued Sample history remains unchanged.</p>}
   {source!=='working' && <p className="mt-3 text-sm text-slate-600">Issued sources are immutable. If this issue lacks Batch authority, select Current saved formulation, review and apply current Resin System defaults there, then save. This does not update the issued source.</p>}
   {plans.length>0&&<label className="mt-3 block text-sm">Saved Production plans<BusinessSelect aria-label="Saved Production plans" value={plan?.id||''} onChange={e=>{const p=plans.find(p=>p.id===e.target.value);if(p)load(p);}} className="ml-2 min-h-11 max-w-full border border-slate-300"><option value="">Select a plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.status==='issued'?'Issued':'Working'} · {n(p.model.batchCount)} Batches · {n(p.model.plannedQuantity)} lb · {new Date(p.created_at).toLocaleString()}</option>)}</BusinessSelect></label>}
   {snapshot&&<div className="mt-4 space-y-4">
    <p className="text-sm font-bold">{frozen?'ISSUED PRODUCTION BLEND SHEET':'WORKING PRODUCTION BLEND — NOT ISSUED'}</p>
    <p className="text-xs text-slate-600">{plan?'Uses this plan’s captured formulation and package data. Create a new plan to use a different source.':'Save captures the selected saved formulation and package data.'}</p>
    <div className="grid gap-4 sm:grid-cols-3">
     {(['batchCount','plannedQuantity','blendSize'] as const).map((key,i)=><label key={key} className="text-sm font-bold">{['Batch Count','Planned Quantity','Blend Size'][i]}{i>0?' (lb)':''}<input aria-label={['Batch Count','Planned Quantity','Blend Size'][i]} type="number" min="0" step="any" disabled={busy||frozen} value={inputs[key]} onChange={e=>setInputs({...inputs,[key]:e.target.value})} className="mt-1 min-h-11 w-full border border-slate-300 px-2"/>{key==='plannedQuantity'&&<span className="mt-1 block text-xs font-normal text-slate-600">Adjust the planned amount as needed for production.</span>}</label>)}
    </div>
    {calculationError&&!frozen&&<p role="alert" className="text-sm text-red-800">{calculationError}</p>}
    {shown&&<>
     <dl className="grid gap-3 bg-slate-50 p-3 sm:grid-cols-3"><div><dt>Calculated Quantity</dt><dd className="font-bold">{n(shown.calculatedQuantity)} lb</dd></div><div><dt>Adjustment</dt><dd className="font-bold">{shown.adjustment>=0?'+':''}{n(shown.adjustment)} lb</dd></div><div><dt>Blends</dt><dd className="font-bold">{n(shown.blendCount)}</dd></div></dl>
     {shown.warnings.map(w=><p key={w} role="alert" className="text-sm text-amber-800">{w} Correct it before issue.</p>)}
     <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr>{['Material','Size','Vendor','%','Bags / Blend','lb / Blend'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{shown.aggregates.map((r:Model["aggregates"][number],i:number)=><tr key={i} className="border-t border-slate-200"><td className="p-2">{r.material}</td><td className="p-2">{r.size}</td><td className="p-2">{r.vendor}</td><td className="p-2">{n(r.percentage)}</td><td className="p-2 font-bold">{r.bagsPerBlend==null?'Unavailable':n(r.bagsPerBlend)}{r.packageWeightLb&&<span className="block text-xs font-normal">{n(r.packageWeightLb)} lb / {r.packageContainer}</span>}</td><td className="p-2">{n(r.lbPerBlend)}</td></tr>)}</tbody></table></div>
     {shown.filler.map((f:Model["filler"][number],i:number)=><p key={i} className="text-sm">Filler: {f.material} — Production quantity unavailable</p>)}
     <p className="text-sm">Part A: <strong>{shown.binder.resin?`${n(shown.binder.resin.total)} US gal`:'Unavailable'}</strong> · Part B: <strong>{shown.binder.hardener?`${n(shown.binder.hardener.total)} US gal`:'Unavailable'}</strong> · {n(shown.batchCount)} Batches</p>
    </>}
    <div className="flex flex-wrap gap-2">{!frozen&&<><button type="button" disabled={busy||!model} className={button} onClick={()=>void run(async()=>{await save();})}>Save Blend Plan</button><button type="button" disabled={busy||!model||Boolean(model?.warnings.length)} className={button} onClick={()=>void run(async()=>{await save(true);})}>Issue Production Blend</button></>}<button type="button" disabled={busy||!shown} className={`${button} bg-blue-900 text-white`} onClick={()=>void pdf()}>Generate {frozen?'Issued':'Working'} Production Blend PDF</button></div>
   </div>}
  </>}
  {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
 </section>;
}
