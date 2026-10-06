"use client";
import {useEffect,useImperativeHandle,useRef,useState} from 'react';
import Help from './ContextHelp';
import type {Ref} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {buildProductionBlend,blendNumber as n} from '../../../supabase/functions/_shared/production-blend.mjs';
import {blendShopPresentation} from '../../../supabase/functions/_shared/production-blend-shop.mjs';
import {editBlendPlanning} from './blend-planner-inputs';
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
export default function ProductionBatchOutput({sample,onSave,onPreview,onDirtyChange,ref}:{sample:SampleRecord;onSave:()=>Promise<SampleRecord>;onPreview:(url:string,filename:string)=>void;onDirtyChange?:(dirty:boolean)=>void;ref?:Ref<{open:()=>void}>}){
 const auth=useAuth();const canManage=auth.can('production_blend.manage');
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [source,setSource]=useState('working'),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[plans,setPlans]=useState<Plan[]>([]);
 const [inputs,setInputs]=useState<Inputs>({batchCount:'1',plannedQuantity:'',blendSize:'1000'});
 const [dirty,setDirty]=useState(false),[pending,setPending]=useState<Plan|null>(null);
 const lock=useRef(false),section=useRef<HTMLElement>(null);
 useImperativeHandle(ref,()=>({open:()=>void begin()}));
 useEffect(()=>{onDirtyChange?.(dirty);const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,onDirtyChange]);
 let model:Model|null=null,calculationError='';
 if(snapshot)try{model=buildProductionBlend(snapshot,inputs);}catch(e){calculationError=e instanceof Error?e.message:'Invalid planning inputs.';}
 const shown=model,shop=shown?blendShopPresentation(shown,false):null;
 const missingCurrentBasis=!hasCapturedBatchBasis(sample.formulation);
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Unable to generate Blend Sheet.');}finally{lock.current=false;setBusy(false);}}
 async function refresh(){setPlans(await request({action:'blend-list',sampleId:sample.id}));}
 async function capture(selected=source){
  const context=await request({action:'blend-context',sampleId:sample.id,...(selected==='working'?{}:{documentId:selected})});
  const probe=buildProductionBlend(context.snapshot,{batchCount:1,plannedQuantity:1,blendSize:1000});
  setSnapshot(context.snapshot);setInputs({batchCount:'1',plannedQuantity:String(probe.batchChipLb),blendSize:'1000'});setDirty(false);
 }
 async function begin(){await run(async()=>{await refresh();setOpen(true);if(!missingCurrentBasis&&!snapshot)await capture();setTimeout(()=>section.current?.scrollIntoView({behavior:'smooth',block:'start'}),0);});}
 async function view(p:Plan){const blob=await request({action:'blend-pdf',planId:p.id});if(!(blob instanceof Blob))throw new Error('Invalid Production PDF response.');onPreview(URL.createObjectURL(blob),'Material-Quantity-Blend-Sheet.pdf');}
 async function generate(){await run(async()=>{
  if(pending){await view(pending);setPending(null);return;}
  if(!model||!snapshot)throw new Error(calculationError||'Review the formulation first.');
  if(source==='working'&&auth.can('writeBusinessData'))await onSave();
  const context=await request({action:'blend-context',sampleId:sample.id,...(source==='working'?{}:{documentId:source})});
  const current=buildProductionBlend(context.snapshot,inputs);
  if(JSON.stringify({...current,sourceUpdatedAt:null})!==JSON.stringify({...model,sourceUpdatedAt:null})){setSnapshot(context.snapshot);throw new Error('The saved formulation changed. Review the updated quantities, then generate.');}
  const saved:Plan=await request({action:'blend-issue',sampleId:sample.id,...(source==='working'?{}:{documentId:source}),expectedSourceUpdatedAt:context.snapshot.updated_at,inputs});
  setPending(saved);setDirty(false);await refresh();await view(saved);setPending(null);
 });}
 const edit=(field:'batchCount'|'adjustment'|'blendSize',value:string)=>{if(!snapshot)return;const basis=buildProductionBlend(snapshot,{batchCount:1,plannedQuantity:1,blendSize:1000}).batchChipLb;setInputs(current=>editBlendPlanning(current,field,value,Number(basis)));setDirty(true);};
 if(!canManage||!open)return null;
 const button='min-h-11 border border-blue-900 px-3 py-2 text-sm font-bold disabled:opacity-40';
 return <section ref={section} aria-label="Production Blend Sheet" className="scroll-mt-40 border border-blue-300 bg-white p-4">
  <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Production planning</h2><button type="button" className="min-h-11 text-sm font-bold text-blue-900 underline" onClick={()=>setOpen(false)}>Back to Sample</button></div>
  <p className="mt-1 text-xs text-slate-600">Configure the material requirement, then generate the shop sheet.</p>
  {!sample.id&&<p className="mt-2 text-xs text-slate-600">Save this Sample before planning Production.</p>}
  <>
   <p className="mt-3 text-xs text-slate-600">Based on {source==='working'?'current saved formulation':'selected historical formulation'}.</p>
   {sample.issuedDocuments.length>0&&<label className="mt-3 block text-sm">Formulation version<select aria-label="Formulation version" disabled={busy||Boolean(pending)} value={source} onChange={e=>{if(dirty&&!window.confirm('Discard unsaved Blend planning changes?'))return;const selected=e.target.value;setSource(selected);setSnapshot(null);void run(()=>capture(selected));}} className="ml-2 min-h-11 border border-slate-300"><option value="working">Current saved formulation</option>{sample.issuedDocuments.map(d=><option key={d.id} value={d.id}>Historical Sample {d.issueNumber}</option>)}</select></label>}
   {source==='working'&&missingCurrentBasis&&<p className="mt-3 text-sm text-amber-900">Apply current profile defaults and save this formulation before planning Production. <a href="#sample-resin-system" className="underline">Review Resin System</a></p>}
   {!snapshot&&!missingCurrentBasis&&<button type="button" className={button} disabled={busy} onClick={()=>void run(()=>capture())}>Load formulation</button>}
   {snapshot&&<div className="mt-4 space-y-4">
    <fieldset disabled={busy||Boolean(pending)} className="grid gap-4 md:grid-cols-3">
     <div className="border border-slate-200 p-3"><h3 className="mb-3 font-bold">Production requirement</h3>
      <label className="block text-sm font-bold">ADJD Batches<Help label="ADJD Batches">Final production batches. Drives Resin, Hardener and Filler.</Help><input aria-label="ADJD Batches" type="number" min="0" step="any" value={inputs.batchCount} onChange={e=>edit('batchCount',e.target.value)} className="mt-2 min-h-11 w-full border px-2"/></label>
      <p className="mt-3 text-sm">Chip Mix / Batch<Help label="Chip Mix / Batch">Chip weight per Batch from the captured formulation.</Help>: <strong>{shown?n(shown.batchChipLb):'—'} lb</strong></p>
      <p className="mt-2 text-sm">Calculated Chips: <strong>{shown?n(shown.calculatedQuantity):'—'} lb</strong></p>
     </div>
     <div className="border border-slate-200 p-3"><h3 className="mb-3 font-bold">Chip adjustment</h3>
      <label className="block text-sm font-bold">ADJ (lb)<Help label="ADJ">Additional chips added to the calculated Batch requirement.</Help><input aria-label="ADJ (lb)" type="number" step="any" value={inputs.plannedQuantity===''?'':snapshot?Number(inputs.plannedQuantity)-Number(inputs.batchCount)*Number(buildProductionBlend(snapshot,{batchCount:1,plannedQuantity:1,blendSize:1000}).batchChipLb):''} onChange={e=>edit('adjustment',e.target.value)} className="mt-2 min-h-11 w-full border px-2"/></label>
      <p className="mt-3 text-sm">Total Chips Required<Help label="Total Chips Required">Final chip quantity to prepare after ADJ.</Help>: <strong>{shown?n(shown.plannedQuantity):'—'} lb</strong></p>
     </div>
     <div className="border border-slate-200 p-3"><h3 className="mb-3 font-bold">Blend staging</h3>
      <label className="block text-sm font-bold">Blend Size (lb)<Help label="Blend Size">Chip mix staged in one Blend or super sack.</Help><input aria-label="Blend Size (lb)" type="number" min="0" step="any" value={inputs.blendSize} onChange={e=>edit('blendSize',e.target.value)} className="mt-2 min-h-11 w-full border px-2"/></label>
      <p className="mt-3 text-sm">CHIP BLENDS<Help label="CHIP BLENDS">Blend units produced from the total chip requirement.</Help>: <strong>{shown?n(shown.blendCount):'—'}</strong></p>
      {shown&&<p className="text-sm">{Number.isInteger(shown.blendCount)?`${n(shown.blendCount)} × ${n(shown.blendSize)}-lb Blends`:`${n(Math.floor(shown.blendCount))} full Blends + ${n(shown.plannedQuantity%shown.blendSize)} lb`}</p>}
     </div>
    </fieldset>
    {calculationError&&<p role="alert" className="text-sm text-red-800">{calculationError}</p>}
    {shown&&<>

     {shown.warnings.map(w=><p key={w} role="alert" className="text-sm text-amber-800">{w.replaceAll('Planned Quantity','Total Chips Required')} Correct it before generating.</p>)}
     {shop&&<>
      <h3 className="text-sm font-bold">{shop.basis==='plannedQuantity'?'ACTUAL MATERIAL REQUIRED':'NOMINAL BLEND RECIPE'}</h3>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr>{['Material','Size','Vendor',shop.basis==='plannedQuantity'?'Bags Required':'Bags / Blend',shop.basis==='plannedQuantity'?'lb':'lb / Blend','Qty in Stock','Qty to Order'].map(h=><th key={h} className="p-2">{h}{h==='Bags / Blend'&&<Help label={h}>Bags of this aggregate in one nominal Blend.</Help>}{h==='Bags Required'&&<Help label={h}>Actual total material required for this plan.</Help>}</th>)}</tr></thead><tbody>{shown.aggregates.map((r:Model["aggregates"][number],i:number)=><tr key={i} className="border-t border-slate-200"><td className="p-2">{r.material}</td><td className="p-2">{r.size}</td><td className="p-2">{r.vendor}</td><td className="p-2 font-bold">{shop.rows[i].instruction}</td><td className="p-2">{n(shop.rows[i].pounds)}</td><td className="p-2 text-slate-500">—</td><td className="p-2 text-slate-500">—</td></tr>)}</tbody></table></div>
      <details className="text-sm"><summary className="cursor-pointer font-bold">View calculation details</summary>
       <p className="my-2">Exact Blend Count: {String(shown.blendCount)} ({String(shown.plannedQuantity)} lb ÷ {String(shown.blendSize)} lb).</p>
       <p className="my-2">Recipe basis: {shop.basis==='plannedQuantity'?'Total Chips Required':'Blend Size'} · {String(shop.basisLb)} lb. Inventory placeholders are not connected to Inventory.</p>
       {shown.aggregates.map((r:Model["aggregates"][number],i:number)=>{const d=shop.rows[i];return <div key={i} className="border-t border-slate-200 py-2"><strong>{r.material}</strong><p>{String(d.percentage)}% × {String(shop.basisLb)} lb = {String(d.pounds)} lb</p><p>Package: {d.packageWeightLb==null?'Unavailable':`${String(d.packageWeightLb)} lb / ${d.packageContainer}`} · {d.packageSource==='captured_catalog'?'Captured/catalog metadata':d.packageSource==='normal_aggregate_50lb'?'Normal-Aggregate 50-lb fallback':'No package authority'}</p><p>Exact package equivalent: {d.exactEquivalent==null?'Unavailable':String(d.exactEquivalent)} · Shop instruction: {d.instruction}</p></div>;})}
      </details>
     </>}

     {shown.filler.map((f:Model["filler"][number],i:number)=><p key={i} className="text-sm">Filler: {f.material} — {f.quantity==null ? "Production quantity unavailable" : `${n(f.quantity)} lb (${n(f.perBatch)} lb/Batch × ${n(shown.batchCount)} Batches)`}{f.package && <span> · {n(f.package.equivalent)} × {n(f.package.weightLb)} lb / {f.package.container}</span>}</p>)}
     <p className="text-sm">Part A: <strong>{shown.binder.resin?`${n(shown.binder.resin.total)} US gal`:'Unavailable'}</strong> · Part B: <strong>{shown.binder.hardener?`${n(shown.binder.hardener.total)} US gal`:'Unavailable'}</strong> · {n(shown.batchCount)} Batches</p>
    </>}
    <button type="button" disabled={busy||!shown||Boolean(shown.warnings.length)} className={`${button} bg-blue-900 text-white`} onClick={()=>void generate()}>{busy?'Generating…':pending?'Retry opening generated sheet':'Generate Blend Sheet'}</button>
   </div>}
   <section className="mt-5 border-t pt-3"><h3 className="font-bold">Generated Blend Sheets</h3>
    {plans.filter(p=>p.status==='issued').map(p=><button type="button" disabled={busy} key={p.id} className="mt-2 block text-left text-sm underline" onClick={()=>void run(()=>view(p))}>{p.model.identity} · {p.model.project||p.model.job||'No project'} · {n(p.model.plannedQuantity)} lb · {new Date(p.created_at).toLocaleString()}</button>)}
    {!plans.some(p=>p.status==='issued')&&<p className="text-sm text-slate-500">No generated Blend Sheets yet.</p>}
   </section>
   {plans.some(p=>p.status==='working')&&<details className="mt-3"><summary>Legacy saved plans</summary>{plans.filter(p=>p.status==='working').map(p=><button type="button" disabled={busy} key={p.id} className="mt-2 block text-sm underline" onClick={()=>void run(()=>view(p))}>{p.model.identity} · {n(p.model.plannedQuantity)} lb · {new Date(p.created_at).toLocaleString()} — view captured plan</button>)}</details>}
  </>
  {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
 </section>;
}
