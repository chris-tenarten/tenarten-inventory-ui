'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/lib/auth';
import {hasProposalAccess,loadBidProposalSummaries,type BidProposalSummary} from '@/modules/proposals/queries';
import {scopeSources,scopeHistory,previewScope,acceptScope,assessScope,materialSupply} from './data';
import {scopeBatchCount,resolveScopePlan} from './requirements';
import {newScopeLine,type ScopeLine,type ScopeCapture,type SourceOption,type Requirement,type Assessment,type MaterialMapping} from './contracts';
const field='min-h-10 w-full border border-slate-300 bg-white px-2 py-1 text-sm';
const button='min-h-10 border border-slate-400 px-3 text-sm font-bold disabled:opacity-40';
function captureLabel(source:Record<string,unknown>|undefined,line:ScopeLine){
 if(!source||!line.sourceId)return 'Sample / formulation revision unresolved';
 const meta=(source._scope_provenance??{}) as Record<string,unknown>;
 const state=(source.formulation_state??source.formulation??{}) as Record<string,unknown>;
 const profile=(state.profile??{}) as Record<string,unknown>;
 const kind={issued:'Issued Sample',version:'Saved Sample',blend:'Issued Blend',historical:'Verified historical Sample'}[line.sourceKind];
 return [String(source.color_plate_number??source.colorPlateNumber??source.sample_name??'Sample'),kind,meta.version_number?`version ${meta.version_number}`:meta.issue_number?`issue ${meta.issue_number}`:meta.revision?`revision ${meta.revision}`:meta.verified_at?`verified ${new Date(String(meta.verified_at)).toLocaleString()}`:'captured revision',String(profile.name||'Profile unresolved')].join(' · ');
}
function capturedLine(line:ScopeLine,source:Record<string,unknown>|undefined){
 const plan=line.planningBasis==='reference'?resolveScopePlan(line,source??{}):null;
 return <div className="space-y-1"><p><strong>{line.label||'Scope'}</strong> · {line.quantity||'?'} {line.unit||'commercial units unresolved'} · Production: {plan?.batchCount??scopeBatchCount(line)??'Unresolved'} Batches</p><p className="text-xs text-slate-600">{captureLabel(source,line)}</p><details className="text-xs text-slate-600"><summary className="cursor-pointer py-1">Manufacturing basis</summary><p>{plan?.basis||'Previously captured scope yield'} · {plan?.thickness??line.thickness??'?'} in · {plan?.overage??line.overage??'?'}% additional overage</p><p>{plan?`${plan.plannedQuantity??'?'} lb chip · ${plan.blendSize??'?'} lb Blend size`:`${line.yieldPerBatch||'?'} ${line.unit} / Batch · ${line.batchRounding||'rounding unresolved'} · ${line.plannedQuantity||'calculated'} lb chip`}</p>{line.assumptions&&<p className="whitespace-pre-wrap">{line.assumptions}</p>}</details></div>;
}
// A new revision may reuse the old capture, but never edits that capture.
function reviewLine(line:ScopeLine):ScopeLine{return line.planningBasis==='reference'?structuredClone(line):{...structuredClone(line),planningBasis:'reference',productionBatches:String(scopeBatchCount(line)??'')};}
export default function BidScopePanel({bidId,converted=false,onChanged,onDirtyChange,onBusyChange}:{bidId:string;converted?:boolean;onChanged?:()=>void|Promise<unknown>;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}){
 const auth=useAuth();
 const [history,setHistory]=useState<ScopeCapture[]>([]),[sources,setSources]=useState<SourceOption[]>([]),[proposals,setProposals]=useState<BidProposalSummary[]>([]);
 const [lines,setLines]=useState<ScopeLine[]>([newScopeLine()]),[proposal,setProposal]=useState(''),[evidence,setEvidence]=useState('');
 const [requirements,setRequirements]=useState<Requirement[]>([]),[unresolved,setUnresolved]=useState<string[]>([]),[previewSources,setPreviewSources]=useState<Record<string,unknown>[]>([]);
 const [assessment,setAssessment]=useState<Assessment[]>([]),[supply,setSupply]=useState<Record<string,unknown>[]>([]);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[canRead,setCanRead]=useState<boolean|null>(null),[editing,setEditing]=useState(false),[baseline,setBaseline]=useState(''),[assessedAt,setAssessedAt]=useState(''),[isConverted,setIsConverted]=useState(converted);
 const canAccept=canRead&&auth.can('accessIntake')&&auth.can('writeBusinessData')&&auth.can('production_blend.manage')&&!isConverted;
 const dirty=editing&&JSON.stringify({lines,proposal,evidence})!==baseline;
 useEffect(()=>{if(converted){setIsConverted(true);setEditing(false);setRequirements(history[0]?.requirements??[]);setUnresolved(history[0]?.unresolved??[]);}},[converted,history]);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 async function refresh(){
  const allowed=await hasProposalAccess();setCanRead(allowed);if(!allowed)return;
  const [h,s,p,stock]=await Promise.all([scopeHistory(bidId),scopeSources(bidId),loadBidProposalSummaries(bidId),materialSupply()]);
  setHistory(h);setSources(s);setProposals(p.filter(p=>p.status==='issued'));
  const b=await supabase.from('bids').select('production_job_id').eq('id',bidId).single();if(b.error)throw b.error;setIsConverted(Boolean(b.data.production_job_id));
  const all:Record<string,unknown>[]=[...stock.inventory,...stock.incoming.map(r=>({...r,color:r.material_name}))];
  setSupply([...new Map(all.map(r=>[JSON.stringify([r.vendor||'',r.color||'',r.size||'',r.category||'',r.unit||'']),r])).values()]);
  if(h[0]){setRequirements(h[0].requirements);setUnresolved(h[0].unresolved);}
 }
 useEffect(()=>{let active=true;void refresh().catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[bidId]); // eslint-disable-line react-hooks/exhaustive-deps
 async function work(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:String((e as {message?:string}).message||e));}finally{setBusy(false);}}
 function invalidate(){setRequirements([]);setUnresolved([]);setAssessment([]);setAssessedAt('');setPreviewSources([]);}
 function change(i:number,patch:Partial<ScopeLine>){setLines(old=>old.map((l,j)=>j===i?{...l,...patch}:l));invalidate();}
 async function preview(){const p=await previewScope(bidId,proposal,lines);setRequirements(p.requirements);setUnresolved(p.unresolved);setPreviewSources(p.context.sources);setAssessment([]);}
 function begin(){
  const next=history[0]?.lines.map(reviewLine)??[newScopeLine()],selected=history[0]?.proposal_id??'';
  setLines(next);setProposal(selected);setEvidence('');setBaseline(JSON.stringify({lines:next,proposal:selected,evidence:''}));setEditing(true);invalidate();
 }
 function cancel(){setEditing(false);setRequirements(history[0]?.requirements??[]);setUnresolved(history[0]?.unresolved??[]);setAssessment([]);setAssessedAt('');}
 function mapping(r:Requirement,patch:Partial<MaterialMapping>){
  const i=Number(r.key.split(':')[0]);
  const fallback:MaterialMapping={vendor:'',color:'',size:'',category:'',unit:'',factor:'',evidence:'',leadTimeDays:'',supplier:''};
  const m={...(lines[i].mappings[r.key]||fallback),...patch};
  setLines(old=>old.map((l,j)=>j===i?{...l,mappings:{...l.mappings,[r.key]:m}}:l));setAssessment([]);setAssessedAt('');
 }
 if(canRead===false)return <section className="mt-4 border bg-white p-4 text-sm">Accepted scope requires existing Proposal access.</section>;
 return <section className="mt-4 space-y-4 border border-slate-300 bg-white p-4" aria-label="Accepted scope and materials">
  <div><h3 className="text-sm font-bold uppercase">Accepted scope & materials</h3><p className="mt-1 text-xs text-slate-600">Reference approved work from Samples and Proposals. Material planning is optional; unresolved details and shortages are advisory.</p></div>
  {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
  {history[0]?<div className="space-y-3 text-sm">
   <p><strong>Accepted revision {history[0].revision}</strong> · {new Date(history[0].accepted_at).toLocaleString()} · {history[0].accepted_by_name} · {String(history[0].proposal_reference.estimate_number||'Proposal unresolved')}</p>
   <p className="whitespace-pre-wrap">{history[0].evidence}</p>
   {history[0].lines.map((l,i)=><div key={i}>{capturedLine(l,history[0].sources[i])}</div>)}
   <button disabled={busy} className={button} onClick={()=>void work(async()=>{const x=await assessScope(history[0].id);setAssessment(x.assessment);setAssessedAt(x.assessedAt);})}>Refresh read-only availability</button>
   <details><summary className="cursor-pointer">Acceptance history ({history.length})</summary>{history.map(h=><details key={h.id} className="mt-2 border-l-2 border-slate-300 pl-3"><summary>Revision {h.revision} · {h.accepted_at} · {h.accepted_by_name}</summary><p>{String(h.proposal_reference.estimate_number||'Proposal unresolved')} · {h.evidence}</p>{h.lines.map((l,i)=><div key={i}>{capturedLine(l,h.sources[i])}</div>)}{h.requirements.map(r=><p key={r.key}>{r.scope} · {r.material||r.role}: {r.quantity??'Unresolved'} {r.unit}</p>)}</details>)}</details>
  </div>:<p className="text-sm text-slate-600">No accepted scope yet. Continue ordinary Bid work; Won + recorded deposit remains the Production conversion gate.</p>}
  {canAccept&&!editing&&<button className={button} onClick={begin}>Review {history.length?'new scope revision':'scope for acceptance'}</button>}
  {editing&&<fieldset disabled={busy} className="space-y-4">
   <label className="block text-xs font-bold">Accepted issued Proposal revision<select className={field} value={proposal} onChange={e=>{setProposal(e.target.value);invalidate();}}><option value="">Unresolved / not selected</option>{proposals.map(p=><option key={p.id} value={p.id}>{p.estimateNumber}</option>)}</select></label>
   {lines.map((l,i)=><div key={i} className="space-y-3 border border-slate-300 bg-slate-50 p-3">
    <div className="flex items-center justify-between text-xs font-bold">Scope {i+1}<button type="button" className="min-h-8 underline" onClick={()=>{setLines(lines.filter((_,j)=>j!==i).map(x=>({...x,mappings:{}})));invalidate();}}>Remove</button></div>
    <label className="block text-xs">Finish / scope description<input className={field} value={l.label} onChange={e=>change(i,{label:e.target.value})}/></label>
    <label className="block text-xs">Sample / formulation revision<select className={field} value={l.sourceId?`${l.sourceKind}:${l.sourceId}`:''} onChange={e=>{const [kind,id]=e.target.value.split(':');const fresh=newScopeLine();change(i,{...fresh,label:l.label,quantity:l.quantity,unit:l.unit,sourceKind:kind as ScopeLine['sourceKind']||'issued',sourceId:id||''});}}><option value="">Unresolved / not selected</option>{sources.map(s=><option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.label}</option>)}</select></label>
    <p className="text-xs text-slate-600">Author or revise formulations and Blend Sheets in <a className="underline" href="/samples" target="_blank" rel="noreferrer">Samples</a>, then select the approved revision here. Changing this reference resets its manufacturing overrides.</p>
    <div className="grid grid-cols-2 gap-3"><label className="text-xs">Commercial quantity<input className={field} value={l.quantity} onChange={e=>change(i,{quantity:e.target.value})}/></label><label className="text-xs">Commercial unit<input className={field} value={l.unit} onChange={e=>change(i,{unit:e.target.value})}/></label></div>
    <label className="block text-xs font-bold">Production quantity (Batches)<input className={field} inputMode="decimal" value={l.productionBatches??''} onChange={e=>change(i,{productionBatches:e.target.value})} placeholder="Optional — reuse selected Blend quantity"/></label>
    <p className="text-xs text-slate-600">Separate from the quoted quantity. Blank uses a reviewed yield or the selected issued Blend plan when available. A Sample revision supplies its Batch formulation; its plate dimensions do not establish production yield.</p>
    {previewSources[i]&&<p className="text-xs text-slate-700" data-testid="production-basis">{resolveScopePlan(l,previewSources[i]).basis} · {resolveScopePlan(l,previewSources[i]).batchCount??'Unresolved'} Batches</p>}
    <details className="space-y-3 border-t border-slate-200 pt-2"><summary className="min-h-9 cursor-pointer text-xs font-bold">Manufacturing assumptions & overrides (optional)</summary>
     <p className="text-xs text-slate-600">Saved formulation and Blend inputs remain authoritative. Leave overrides blank to reuse them. Blank additional overage adds 0%; it does not remove an adjustment already included in a saved Blend. No formulation changes are made here.</p>
     <div className="grid grid-cols-2 gap-3">{([['yieldPerBatch','Commercial units per Batch'],['plannedQuantity','Chip quantity override (lb)'],['blendSize','Blend size override (lb)'],['thickness','Thickness override (in)'],['overage','Additional overage (%)']] as const).map(([k,label])=><label key={k} className="text-xs">{label}<input className={field} value={l[k]} onChange={e=>change(i,{[k]:e.target.value})}/></label>)}</div>
     <label className="block text-xs">Yield rounding<select className={field} value={l.batchRounding} onChange={e=>change(i,{batchRounding:e.target.value as ScopeLine['batchRounding']})}><option value="">Unresolved / not used</option><option value="fractional">Fractional batches</option><option value="whole_up">Whole batches, round up</option></select></label>
     <p className="text-xs text-slate-600">Use a reviewed commercial yield only when Production Batches is blank. An entered Production Batch quantity takes precedence. Yield is never inferred from a Sample.</p>
     <label className="block text-xs">Manufacturing notes / override evidence<textarea className={field} value={l.assumptions} onChange={e=>change(i,{assumptions:e.target.value})}/></label>
     {previewSources[i]&&<p className="text-xs text-slate-600">Resolved basis: {resolveScopePlan(l,previewSources[i]).plannedQuantity??'?'} lb chip · {resolveScopePlan(l,previewSources[i]).blendSize??'?'} lb Blend size · {resolveScopePlan(l,previewSources[i]).thickness??'?'} in · {resolveScopePlan(l,previewSources[i]).overage??'?'}% additional overage.</p>}
     {l.consumables.map((c,j)=><div key={j} className="grid grid-cols-2 gap-2">{(['material','quantity','unit','evidence'] as const).map(k=><label className="text-xs" key={k}>Consumable {k}<input className={field} value={c[k]} onChange={e=>change(i,{consumables:l.consumables.map((v,z)=>z===j?{...v,[k]:e.target.value}:v),mappings:k==='material'||k==='unit'?Object.fromEntries(Object.entries(l.mappings).filter(([key])=>key!==`${i}:consumable:${j}`)):l.mappings})}/></label>)}</div>)}
     <button className={button} onClick={()=>change(i,{consumables:[...l.consumables,{material:'',quantity:'',unit:'',evidence:''}]})}>Add defined consumable</button>
    </details>
   </div>)}
   <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>{setLines([...lines,newScopeLine()]);invalidate();}}>Add scope line</button><button disabled={!lines.length} className={button} onClick={()=>void work(preview)}>Review material requirements</button><button className={button} onClick={cancel}>Cancel revision</button></div>
  </fieldset>}
  {assessedAt&&<p className="text-xs text-slate-500">Availability observed {new Date(assessedAt).toLocaleString()}. Incoming supply is separate from stock; lead times are estimates, not promised Production dates.</p>}
  {requirements.length>0&&<p className="text-xs font-bold uppercase">{editing?'Proposed material requirements':'Accepted material requirements'}</p>}
  {requirements.map(r=>{
   const a=assessment.find(a=>a.key===r.key),m=lines[Number(r.key.split(':')[0])]?.mappings[r.key];
   return <div key={r.key} className="space-y-2 border-t border-slate-200 pt-3 text-sm">
    <p><strong>{r.scope} · {r.material||r.role}</strong> · {r.quantity===null?'Unresolved':r.quantity.toLocaleString(undefined,{maximumFractionDigits:4})} {r.unit}{r.packageEquivalent!==null?` · ${r.packageEquivalent.toLocaleString()} packages (${r.packageEvidence})`:''}</p>
    {r.unresolved.map((u,j)=><p key={j} className="text-xs text-amber-900">{u}</p>)}
    {editing&&<details><summary className="min-h-9 cursor-pointer text-xs font-bold">Review material identity / conversion / supplier estimate</summary><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs sm:col-span-2">Exact Inventory / incoming identity<select className={field} value={supply.findIndex(s=>String(s.vendor||'')===m?.vendor&&String(s.color||'')===m?.color&&String(s.size||'')===m?.size&&String(s.category||'')===m?.category&&String(s.unit||'')===m?.unit)} onChange={e=>{const s=supply[Number(e.target.value)];mapping(r,{vendor:String(s?.vendor||''),color:String(s?.color||''),size:String(s?.size||''),category:String(s?.category||''),unit:String(s?.unit||''),factor:'',evidence:''});}}><option value={-1}>Unmapped / unknown</option>{supply.map((s,j)=><option key={j} value={j}>{[s.vendor,s.color,s.size,s.category,s.unit].filter(Boolean).join(' · ')}</option>)}</select></label>{([['factor',`${r.unit} per stock unit`],['evidence','Identity & conversion evidence'],['supplier','Supplier / package information'],['leadTimeDays','Estimated lead time (days; blank = unknown)']] as const).map(([k,label])=><label className="text-xs" key={k}>{label}<input className={field} value={m?.[k]||''} onChange={e=>mapping(r,{[k]:e.target.value})}/></label>)}</div><p className="text-xs text-slate-500">Acceptance recalculates from the referenced revision and reviewed mapping. Confirm package size and supplier lead-time source/date in the evidence.</p></details>}
    {a&&<div className="space-y-1 text-xs"><p>Available {a.available??'?'} · reserved for Job {a.reservedForJob??'?'} · reserved elsewhere {a.reservedElsewhere??'?'} · incoming {a.incoming??'?'} · shortage against on-hand {a.shortage??'?'} {r.unit}</p><p>ETA: {a.etas.join(', ')||'Unknown'} · supplier: {a.supplier||'Unknown'} · lead estimate: {a.leadTimeDays===null?'Unknown':`${a.leadTimeDays} days`}</p>{a.supplierEvidence&&<p>{a.packageInfo?`Catalog package: ${a.packageInfo}. `:''}{a.supplierEvidence}</p>}{a.unknown.map((u,j)=><p className="text-amber-900" key={j}>{u}</p>)}</div>}
   </div>;
  })}
  {unresolved.length>0&&<details><summary className="min-h-9 cursor-pointer text-xs font-bold text-amber-900">Outstanding planning questions ({unresolved.length}) — advisory</summary><ul className="list-disc space-y-1 pl-4 text-xs text-amber-900">{unresolved.map((u,i)=><li key={i}>{u}</li>)}</ul></details>}
  {editing&&requirements.length>0&&<div className="space-y-2 border-t pt-3"><label className="block text-xs font-bold">Acceptance evidence<textarea className={field} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Approval reference, commercial scope basis and outstanding questions"/></label><button className={button+' bg-blue-900 text-white'} disabled={busy||!evidence.trim()} onClick={()=>void work(async()=>{await acceptScope(bidId,proposal,lines,history[0]?.id??null,evidence);setEditing(false);await refresh();await onChanged?.();})}>Accept immutable scope revision</button></div>}
 </section>;
}
