"use client";

import { BusinessSelect } from '@/components/BusinessWriteControls';
import {useAuth} from '@/lib/auth';
import {useState} from 'react';
import {productionBatchReadiness} from '../../../supabase/functions/_shared/sample-production-batch.mjs';
import {generateProductionBatchPdf} from './queries';
import {validateSampleForOutput,formatSampleError} from './sample-errors';
import type {SampleRecord} from './types';
export default function ProductionBatchOutput({sample,onSave,onPreview}:{sample:SampleRecord;onSave:()=>Promise<SampleRecord>;onPreview:(url:string,filename:string)=>void}) {
 const auth=useAuth();const admin=auth.profile?.isActive&&auth.profile.role==='admin';
 const [source,setSource]=useState('working');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const document=sample.issuedDocuments.find(d=>d.id===source);
 const reasons=source==='working'?productionBatchReadiness(sample).reasons:document?.batchUnavailableReasons??['Issued formulation is unavailable.'];
 async function generate(){
  if(!admin||reasons.length)return;setBusy(true);setError('');
  try {
   let request:{sampleId:string}|{documentId:string};
   if(source==='working'){
    const validation=validateSampleForOutput(sample);if(validation)throw new Error(formatSampleError(validation));
    const saved=await onSave();request={sampleId:saved.id};
   }else{if(!document)throw new Error('Choose an issued formulation.');request={documentId:document.id};}
   const blob=await generateProductionBatchPdf(request);
   onPreview(URL.createObjectURL(blob),`Production-Batch-${document?'Issue-'+document.issueNumber:'Working-NOT-ISSUED'}.pdf`);
  }catch(caught){setError(`${caught instanceof Error?caught.message:'Unable to generate Production Batch.'} No issue or inventory transaction was created.`);}finally{setBusy(false);}
 }
 if(!admin)return null;
 return <section aria-label="Production Batch Blend Sheet" className="border border-slate-300 bg-white p-4">
  <h2 className="text-sm font-bold uppercase tracking-wide">Production Batch Blend Sheet</h2>
  <p className="mt-1 text-xs text-slate-600">One Batch from the selected formulation. Package equivalents are a shop reference; generating this sheet does not consume inventory.</p>
  <label className="mt-3 block text-xs font-bold">Source formulation
   <BusinessSelect disabled={busy} value={source} onChange={e=>{setSource(e.target.value);setError('');}} className="mt-1 min-h-11 w-full border border-slate-300 bg-white px-2 text-sm">
    <option value="working">Current Draft</option>
    {sample.issuedDocuments.map(d=><option key={d.id} value={d.id}>Issue {d.issueNumber} — {new Date(d.issuedAt).toLocaleDateString()}</option>)}
   </BusinessSelect>
  </label>
  <p className={`mt-3 text-sm font-bold ${source==='working'?'text-amber-800':'text-blue-900'}`}>{source==='working'?'WORKING BATCH BLEND — NOT ISSUED':`Issued formulation · Issue ${document?.issueNumber}`}</p>
  <p className="mt-1 text-xs text-slate-600">{source==='working'?'Saves the current Draft before generating. This is not a controlled Production recipe.':'Uses only this issue’s captured formulation and package data. Current Draft edits do not affect it.'}</p>
  {reasons.length>0&&<p className="mt-2 text-sm text-slate-600">Unavailable: {reasons[0]}</p>}
  <button type="button" disabled={busy||reasons.length>0} onClick={()=>void generate()} className="mt-3 min-h-11 w-full whitespace-normal border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 sm:w-auto">{busy?'Generating…':'Generate Production Batch Blend Sheet'}</button>
  {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
 </section>;
}
