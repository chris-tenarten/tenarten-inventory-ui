'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {hasProposalAccess,loadBidProposalSummaries,type BidProposalSummary} from '@/modules/proposals/queries';
import {loadSamples} from '@/modules/samples/queries';
import type {SampleRecord} from '@/modules/samples/types';
import {loadProductionJobOption,formatProductionJobOption,openProductionJob} from '@/modules/production/job-options';
import {scopeHistory} from '@/modules/intake-materials/data';
import type {ScopeCapture} from '@/modules/intake-materials/contracts';
import {capturedRecord,sourceKey} from '@/modules/intake-materials/related-records';
import type {Bid} from './types';

const link='inline-block min-h-9 py-2 text-blue-900 underline';
export default function BidRelatedRecords({bid,jobId}:{bid:Bid;jobId:string|null}){
 const auth=useAuth(),request=useRef(0);
 const [proposals,setProposals]=useState<BidProposalSummary[]>([]),[samples,setSamples]=useState<SampleRecord[]>([]),[capture,setCapture]=useState<ScopeCapture|null>(null);
 const [allowed,setAllowed]=useState<boolean|null>(null),[loading,setLoading]=useState(true),[errors,setErrors]=useState<string[]>([]),[relatedJob,setRelatedJob]=useState(jobId),[jobName,setJobName]=useState<{id:string;label:string}|null>(null);
 const refresh=useCallback(async()=>{
  const token=++request.current;setLoading(true);const problems:string[]=[];
  const [access,linkedSamples,bidRecord]=await Promise.allSettled([hasProposalAccess(),loadSamples(bid.id),supabase.from('bids').select('production_job_id').eq('id',bid.id).single()]);
  if(token!==request.current)return;
  setAllowed(access.status==='fulfilled'?access.value:false);
  if(access.status==='rejected')problems.push('Proposal access could not be checked.');
  if(linkedSamples.status==='fulfilled')setSamples(linkedSamples.value);else problems.push('Samples could not be loaded.');
  if(bidRecord.status==='fulfilled'&&!bidRecord.value.error)setRelatedJob(bidRecord.value.data?.production_job_id??null);
  else problems.push('Production relationship could not be loaded.');
  if(access.status==='fulfilled'&&access.value){
   const [linked,retained]=await Promise.allSettled([loadBidProposalSummaries(bid.id),scopeHistory(bid.id)]);
   if(token!==request.current)return;
   if(linked.status==='fulfilled')setProposals(linked.value);else problems.push('Proposals could not be loaded.');
   if(retained.status==='fulfilled')setCapture(retained.value[0]??null);else problems.push('Retained revision information is unavailable.');
  }else{setProposals([]);setCapture(null);}
  setErrors(problems);setLoading(false);
 },[bid.id]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return refresh();});const pending=request;return()=>{active=false;++pending.current;};},[refresh,bid.updatedAt]);
 const actualJob=jobId||relatedJob;
 const jobLabel=jobName?.id===actualJob?jobName.label:'';
 useEffect(()=>{let active=true;if(actualJob&&auth.can('readOperationalData'))void loadProductionJobOption(actualJob).then(job=>{if(active&&job)setJobName({id:actualJob,label:formatProductionJobOption(job)});}).catch(()=>{});return()=>{active=false;};},[actualJob,auth]);
 const acceptedId=capture?.proposal_id;
 const retained=(capture?.lines??[]).flatMap((line,i)=>line.sourceId?[{key:sourceKey(line),...capturedRecord(capture?.sources[i],line)}]:[]).filter((record,i,all)=>all.findIndex(other=>other.key===record.key)===i);
 const retainedSampleIds=new Set(retained.map(record=>record.sampleId));
 return <section aria-label="Related Records" className="mt-4 space-y-2 rounded-sm border border-slate-200 bg-white p-4 text-xs">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Related Records</h3><button type="button" disabled={loading} onClick={()=>{setLoading(true);void refresh();}} className="min-h-9 text-slate-600 underline">Refresh records</button></div>
  {loading&&<p className="text-slate-500">Loading related records…</p>}
  {errors.length>0&&<p role="status" className="text-amber-900">{errors.join(' ')} Refresh to retry.</p>}
  <div className="grid gap-3 sm:grid-cols-2">
   <div><h4 className="font-bold text-slate-700">Proposals</h4>
    {allowed===false?<p className="mt-1 text-slate-500">Proposal access is required.</p>:<>
     {acceptedId&&<p><a className={link} href={`/proposals?bid=${encodeURIComponent(bid.id)}&open=${encodeURIComponent(acceptedId)}`}>{String(capture?.proposal_reference.estimate_number||'Retained Proposal revision')}</a> <span className="font-semibold text-emerald-800">Accepted revision</span></p>}
     {proposals.filter(proposal=>proposal.id!==acceptedId).map(proposal=><p key={proposal.id}><a className={link} href={`/proposals?bid=${encodeURIComponent(bid.id)}&open=${encodeURIComponent(proposal.id)}`}>{proposal.estimateNumber}</a> · {proposal.status==='issued'?'Issued':'Draft'}</p>)}
     {!proposals.length&&!acceptedId&&!loading&&<p className="mt-1 text-slate-500">No related Proposals yet.</p>}
    </>}
   </div>
   <div><h4 className="font-bold text-slate-700">Samples / Blend Sheets</h4>
    {retained.map(record=><p key={record.key}><a className={link} href={record.sampleId?`/samples?open=${encodeURIComponent(record.sampleId)}`:`/samples?bid=${encodeURIComponent(bid.id)}`}>{record.label}</a> <span className="text-slate-500">Retained revision</span></p>)}
    {samples.filter(sample=>!retainedSampleIds.has(sample.id)).map(sample=><p key={sample.id}><a className={link} href={`/samples?bid=${encodeURIComponent(bid.id)}&open=${encodeURIComponent(sample.id)}`}>{sample.colorPlateNumber||sample.sampleName||'Sample'}</a> · {sample.approvedDate?'Approved':'Working'}</p>)}
    {!samples.length&&!retained.length&&!loading&&<p className="mt-1 text-slate-500">No related Samples yet.</p>}
   </div>
  </div>
  {actualJob&&<div className="border-t border-slate-200 pt-2"><button type="button" className={link} onClick={()=>openProductionJob(actualJob)}>Open Production Job{jobLabel?` · ${jobLabel}`:''} →</button></div>}
 </section>;
}
