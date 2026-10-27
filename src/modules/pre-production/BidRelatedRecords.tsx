'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {hasProposalAccess,loadBidProposalSummaries,type BidProposalSummary} from '@/modules/proposals/queries';
import {loadSamples} from '@/modules/samples/queries';
import type {SampleRecord} from '@/modules/samples/types';
import {loadProductionJobOption,formatProductionJobOption,openProductionJob} from '@/modules/production/job-options';
import {acceptScope,scopeHistory,governingSources} from '@/modules/intake-materials/data';
import type {ScopeCapture,SourceOption} from '@/modules/intake-materials/contracts';
import {capturedRecord,governingLines,selectionKeys,sourceKey} from '@/modules/intake-materials/related-records';
import type {Bid} from './types';

const field='mt-1 min-h-10 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm';
const button='min-h-9 rounded-sm border border-slate-300 px-3 text-xs font-bold disabled:opacity-40';
const link='inline-block py-1 text-blue-900 underline';
const stamp=(value:string)=>new Date(value).toLocaleString();
const message=(reason:unknown)=>reason instanceof Error?reason.message:String((reason as {message?:string})?.message||'Unable to load records.');

export default function BidRelatedRecords({bid,jobId,unsavedBid=false,onChanged,onDirtyChange,onBusyChange}:{bid:Bid;jobId:string|null;unsavedBid?:boolean;onChanged:()=>Promise<unknown>;onDirtyChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void}){
 const auth=useAuth();
 const [proposals,setProposals]=useState<BidProposalSummary[]>([]),[samples,setSamples]=useState<SampleRecord[]>([]),[history,setHistory]=useState<ScopeCapture[]>([]),[options,setOptions]=useState<SourceOption[]>([]);
 const [allowed,setAllowed]=useState<boolean|null>(null),[ready,setReady]=useState(false),[loading,setLoading]=useState(true),[loadErrors,setLoadErrors]=useState<string[]>([]),[error,setError]=useState('');
 const [editing,setEditing]=useState(false),[proposalId,setProposalId]=useState(''),[keys,setKeys]=useState<string[]>([]),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[jobLabel,setJobLabel]=useState('');
 const request=useRef(0),current=history[0];
 const canSelect=Boolean(allowed&&ready&&!jobId&&auth.can('accessIntake')&&auth.can('writeBusinessData')&&auth.can('production_blend.manage'));
 const selectedKeys=keys.filter(Boolean),dirty=editing&&JSON.stringify({proposalId,keys:selectedKeys})!==baseline;
 useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{if(jobId)setEditing(false);},[jobId]);
 const refresh=useCallback(async()=>{
  const token=++request.current;setLoading(true);setReady(false);
  const problems:string[]=[];
  const [access,linkedSamples]=await Promise.allSettled([hasProposalAccess(),loadSamples(bid.id)]);
  if(token!==request.current)return;
  const permitted=access.status==='fulfilled'&&access.value;
  setAllowed(access.status==='fulfilled'?access.value:false);
  if(access.status==='rejected')problems.push('Proposal access: '+message(access.reason));
  if(linkedSamples.status==='fulfilled')setSamples(linkedSamples.value);else problems.push('Samples: '+message(linkedSamples.reason));
  if(permitted){
   const [linked,captures,sources]=await Promise.allSettled([loadBidProposalSummaries(bid.id),scopeHistory(bid.id),governingSources(bid.id)]);
   if(token!==request.current)return;
   if(linked.status==='fulfilled')setProposals(linked.value);else problems.push('Proposals: '+message(linked.reason));
   if(captures.status==='fulfilled')setHistory(captures.value);else problems.push('Governing records: '+message(captures.reason));
   if(sources.status==='fulfilled')setOptions(sources.value);else problems.push('Revision choices: '+message(sources.reason));
   setReady([linked,captures,sources].every(result=>result.status==='fulfilled'));
  }else{setProposals([]);setHistory([]);setOptions([]);}
  setLoadErrors(problems);setLoading(false);
 },[bid.id]);
 useEffect(()=>{void refresh();const pending=request;return()=>{++pending.current;};},[refresh]);
 useEffect(()=>{let active=true;setJobLabel('');if(jobId&&auth.can('readOperationalData'))void loadProductionJobOption(jobId).then(job=>{if(active&&job)setJobLabel(formatProductionJobOption(job));}).catch(()=>{});return()=>{active=false;};},[jobId,auth]);
 function begin(){const next=selectionKeys(current),proposal=current?.proposal_id??'';setKeys(next.length?next:['']);setProposalId(proposal);setBaseline(JSON.stringify({proposalId:proposal,keys:next}));setError('');setEditing(true);}
 async function save(){
  if(!canSelect||busy||!dirty)return;
  setBusy(true);setError('');
  try{
   const lines=governingLines(selectedKeys,current,options);
   const caption=proposals.find(p=>p.id===proposalId)?.estimateNumber||String(current?.proposal_reference.estimate_number||'Proposal unresolved');
   await acceptScope(bid.id,proposalId,lines,current?.id??null,`Governing records selected for handoff. Accepted Proposal: ${proposalId?caption:'unresolved'}. ${selectedKeys.length} Sample / Blend revision(s) selected. Existing planning retained for unchanged references; missing handoff information is advisory.`);
   setEditing(false);await refresh();await onChanged();
  }catch(caught){setError(message(caught));}finally{setBusy(false);}
 }
 const proposalUrl=(id?:string)=>id?`/proposals?open=${encodeURIComponent(id)}`:`/proposals?bid=${encodeURIComponent(bid.id)}`;
 const sampleUrl=(id?:string|null)=>id?`/samples?open=${encodeURIComponent(id)}`:`/samples?bid=${encodeURIComponent(bid.id)}`;
 const acceptedId=current?.proposal_id;
 const governing=(current?.lines??[]).flatMap((line,i)=>line.sourceId?[{key:sourceKey(line),...capturedRecord(current.sources[i],line)}]:[]).filter((record,i,all)=>all.findIndex(other=>other.key===record.key)===i);
 const governingSampleIds=new Set(governing.map(record=>record.sampleId));
 const savedReady=bid.status==='won'&&Boolean(bid.depositReceivedDate);
 const readiness=jobId?'Converted — Production owns execution.':unsavedBid?'Save Bid changes before conversion.':dirty?'Save or cancel governing selections before conversion.':!savedReady?`Conversion needs ${[bid.status!=='won'?'saved Won status':'',!bid.depositReceivedDate?'recorded deposit':''].filter(Boolean).join(' and ')}.`:!auth.can('createProductionJob')?'Won and deposit recorded; an authorized Production user can convert.':'Won and deposit recorded — ready for conversion review.';
 const unresolved:string[]=[];
 if(allowed&&ready){
  if(!acceptedId)unresolved.push('Accepted Proposal revision is not selected.');
  if(!governing.length)unresolved.push('Governing Sample / Blend revision is not selected.');
  if(current?.unresolved.some(item=>!/Accepted Proposal revision is not selected/.test(item)))unresolved.push('Planning information remains unresolved in the retained handoff. Review the governing records in Samples / Blend Sheets before execution.');
 }
 const selectedOptions=[...options];
 (current?.lines??[]).forEach((line,i)=>{if(line.sourceId&&!selectedOptions.some(option=>sourceKey({sourceKind:option.kind,sourceId:option.id})===sourceKey(line)))selectedOptions.push({kind:line.sourceKind,id:line.sourceId,label:capturedRecord(current.sources[i],line).label+' · retained'});});
 return <section aria-label="Related Records and Handoff" className="mt-4 space-y-3 rounded-sm border border-slate-200 bg-white p-4 text-xs">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Related Records &amp; Handoff</h3><button type="button" disabled={loading||busy||editing} onClick={()=>void refresh()} className="min-h-8 text-slate-600 underline">Refresh records</button></div>
  {loading&&<p className="text-slate-500">Loading related records…</p>}
  {loadErrors.length>0&&<p role="status" className="text-amber-900">Some related records are unavailable. Ordinary Bid activity remains available. {loadErrors.join(' ')}</p>}
  {error&&<p role="alert" className="text-red-800">{error}</p>}
  <div className="grid gap-3 sm:grid-cols-2">
   <div><h4 className="font-bold text-slate-700">Proposals</h4>
    {allowed===false?<p className="mt-1 text-slate-500">Proposal access is required.</p>:<>
     {acceptedId&&<p><a className={link} href={proposalUrl(acceptedId)}>{String(current.proposal_reference.estimate_number||'Retained Proposal revision')}</a> <span className="font-bold text-emerald-800">Accepted revision</span></p>}
     {proposals.filter(p=>p.id!==acceptedId).map(p=><p key={p.id}><a className={link} href={proposalUrl(p.id)}>{p.estimateNumber}</a> · {p.status==='issued'?'Issued':'Draft'}</p>)}
     {!proposals.length&&!acceptedId&&!loading&&<p className="mt-1 text-slate-500">No linked Proposal.</p>}
     {allowed&&<a className={link} href={proposalUrl()}>Open Proposals →</a>}
    </>}
   </div>
   <div><h4 className="font-bold text-slate-700">Samples / Blend Sheets</h4>
    {governing.map(record=><p key={record.key}><a className={link} href={sampleUrl(record.sampleId)}>{record.label}</a> <span className="font-bold text-emerald-800">Governing</span></p>)}
    {samples.filter(sample=>!governingSampleIds.has(sample.id)).map(sample=><p key={sample.id}><a className={link} href={sampleUrl(sample.id)}>{sample.colorPlateNumber||sample.sampleName||'Sample'}</a> · {sample.approvedDate?'Approved':'Working'}</p>)}
    {!samples.length&&!governing.length&&!loading&&<p className="mt-1 text-slate-500">No linked Sample or Blend Sheet.</p>}
    <a className={link} href={sampleUrl()}>Open Samples / Blend Sheets →</a>
   </div>
  </div>
  <div className="border-t border-slate-200 pt-3"><p><strong>Production handoff</strong> · Deposit: {bid.depositReceivedDate||'Not recorded'}</p><p className="mt-1 text-slate-600">{readiness}</p>
   {jobId?<button type="button" className={link} onClick={()=>openProductionJob(jobId)}>Open Production Job{jobLabel?` · ${jobLabel}`:''} →</button>:<a className={link} href="#bid-production-handoff">Review conversion →</a>}
  </div>
  {unresolved.length>0&&<div className="border-t border-slate-200 pt-3"><p className="font-bold text-amber-900">Unresolved handoff information · advisory</p><ul className="mt-1 list-disc space-y-1 pl-4 text-slate-600">{unresolved.map(item=><li key={item}>{item}</li>)}</ul><p className="mt-1 text-slate-500">Missing records or material-planning information do not block ordinary Bid activity or change the Won + deposit gate.</p></div>}
  {current&&<details className="border-t border-slate-200 pt-2"><summary className="min-h-8 cursor-pointer text-slate-600">Handoff provenance · selection r{current.revision} · {current.accepted_by_name}</summary>
   {history.map(capture=><div key={capture.id} className="mt-2 border-l-2 border-slate-200 pl-2"><p>Selection r{capture.revision} · {stamp(capture.accepted_at)} · {capture.accepted_by_name}</p><p>{String(capture.proposal_reference.estimate_number||'Proposal unresolved')}</p>{capture.lines.filter(line=>line.sourceId).map((line,i)=><p key={i}>{capturedRecord(capture.sources[capture.lines.indexOf(line)],line).label}</p>)}</div>)}
  </details>}
  {canSelect&&!editing&&<button type="button" className={button} onClick={begin}>Select governing records</button>}
  {editing&&!jobId&&<fieldset disabled={busy} className="space-y-3 border-t border-slate-200 pt-3">
   <p className="text-slate-600">Select existing approved revisions. Saving records their handoff provenance; documents and formulations stay in their owning modules.</p>
   <label className="block font-semibold">Accepted Proposal revision<select className={field} value={proposalId} onChange={event=>setProposalId(event.target.value)}><option value="">Unresolved / not selected</option>{acceptedId&&!proposals.some(p=>p.id===acceptedId)&&<option value={acceptedId}>{String(current.proposal_reference.estimate_number||'Retained Proposal')}</option>}{proposals.filter(p=>p.status==='issued').map(p=><option key={p.id} value={p.id}>{p.estimateNumber}</option>)}</select></label>
   {keys.map((key,i)=><div key={i} className="flex items-end gap-2"><label className="min-w-0 flex-1 font-semibold">Governing Sample / Blend revision {i+1}<select className={field} value={key} onChange={event=>setKeys(old=>old.map((value,index)=>index===i?event.target.value:value))}><option value="">Unresolved / not selected</option>{selectedOptions.map(option=><option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.label}</option>)}</select></label><button type="button" className={button} onClick={()=>setKeys(old=>old.filter((_,index)=>index!==i))} aria-label={`Remove governing record ${i+1}`}>Remove</button></div>)}
   <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>setKeys(old=>[...old,''])}>Add governing record</button><button type="button" className={button+' bg-blue-900 text-white'} disabled={!canSelect||!dirty||busy} onClick={()=>void save()}>Save governing records</button><button type="button" className={button} onClick={()=>setEditing(false)}>Cancel selection</button></div>
  </fieldset>}
 </section>;
}
