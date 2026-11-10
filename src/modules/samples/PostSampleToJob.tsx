'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DocumentViewer from '@/components/documents/DocumentViewer';
import { Paperclip, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { JobDocumentType } from '@/modules/production/types';
import { assertCanPublishSampleToJob, postSampleToJob, searchPublishJobs, type PublishJob } from './post-to-job';
import JobUpdateMentionTextarea, { type SelectedMention } from '@/modules/production/components/JobUpdateMentionTextarea';
import { loadJobUpdateCollaborators } from '@/modules/production/jobs';
import type { JobUpdateCollaborator } from '@/modules/production/types';

export type PostDocumentSource = {
  id: string;
  label: string;
  documentType: JobDocumentType;
  filename: string;
  inputKey: string;
  generate(): Promise<Blob>;
  unavailableReason?: string;
  configureLabel?: string;
  onConfigure?: () => void;
  description?: string;
};
type Props = { url?: string; filename?: string; documentType?: JobDocumentType; documents?: PostDocumentSource[]; disabled?: boolean; onOpen?: () => Promise<void> };
export default function PostSampleToJob({ url, filename, documentType, documents, disabled, onOpen }: Props) {
  const auth = useAuth();
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<PublishJob[]>([]), [selected, setSelected] = useState<PublishJob | null>(null);
  const [searching, setSearching] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [body, setBody] = useState(''), [mentions, setMentions] = useState<SelectedMention[]>([]);
  const [collaborators, setCollaborators] = useState<JobUpdateCollaborator[]>([]);
  const [documentId, setDocumentId] = useState('work_order');
  const [documentPreview, setDocumentPreview] = useState<{url:string;filename:string}|null>(null);
  const [stage, setStage] = useState('');
  const requests = useRef(new Map<string, string>()), generated = useRef(new Map<string, Promise<File>>());
  const locked = useRef(false);
  const fixed: PostDocumentSource = {id:'preview',label:filename??'Generated PDF',documentType:documentType??'work_order',filename:filename??'Sample.pdf',inputKey:url??'',generate:async()=>{const response=await fetch(url!);if(!response.ok)throw new Error('Unable to read the generated PDF. Reopen its preview and retry.');return response.blob();}};
  const choices = documents ?? [fixed];
  const document = choices.find(item=>item.id===documentId) ?? choices[0];
  const sourceKey = document ? `${document.id}:${document.inputKey}` : '';
  const currentKey = useRef(sourceKey);currentKey.current=sourceKey;
  useEffect(()=>()=>{if(documentPreview)URL.revokeObjectURL(documentPreview.url);},[documentPreview]);
  useEffect(()=>{setMessage('');setError('');setDocumentPreview(null);},[sourceKey]);
  const canAttach = auth.can('writeBusinessData') && auth.can('uploadSupportingFiles') && (auth.can('postJobUpdate'));
  useEffect(() => {
    if (!open) return;
    let active = true;
    loadJobUpdateCollaborators().then(rows => { if (active) setCollaborators(rows); }).catch(() => { if (active) setError('Mention suggestions unavailable. You can post without mentions.'); });
    const timer = setTimeout(() => {
      setSearching(true); setError('');
      searchPublishJobs(query).then(rows => { if (active) setJobs(rows); }).catch(() => { if (active) { setJobs([]); setError('Unable to load Jobs. Try searching again.'); } }).finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query]);
  if (!canAttach) return null;
  async function capture(source: PostDocumentSource, key: string) {
    if (source.unavailableReason) throw new Error(source.unavailableReason);
    let bytes = generated.current.get(key);
    if (!bytes) {
      bytes = source.generate().then(async blob=>{
        if ((await blob.slice(0,5).text()) !== '%PDF-') throw new Error('The generated document is not a PDF.');
        return new File([blob],source.filename,{type:'application/pdf'});
      }).catch(error=>{generated.current.delete(key);throw error;});
      generated.current.set(key,bytes);
    }
    const file=await bytes;
    if(currentKey.current!==key)throw new Error('Document inputs changed. Review the current settings and retry.');
    return file;
  }
  async function previewDocument() {
    if(!document || locked.current)return;
    locked.current=true;setBusy(true);setStage('Generating preview…');setError('');
    try {const file=await capture(document,sourceKey);setDocumentPreview({url:URL.createObjectURL(file),filename:file.name});}
    catch(caught){setError((caught as {message?:string})?.message||'Unable to preview document.');}
    finally{locked.current=false;setBusy(false);setStage('');}
  }
  async function confirm() {
    if (!selected || !document || locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    const key=sourceKey,source=document,destination=selected;
    try {
      setStage('Validating…');await assertCanPublishSampleToJob(destination.id);
      setStage('Generating document…');const file=await capture(source,key);
      const requestKey=`${destination.id}:${key}`;
      const requestId = requests.current.get(requestKey) ?? crypto.randomUUID();
      requests.current.set(requestKey, requestId);
      setStage('Posting…');
      await postSampleToJob({jobId:destination.id,requestId,file,documentType:source.documentType,body,mentionedUserIds:mentions.map(mention=>mention.userId)});
      setMessage(`Update posted to ${destination.name}.`);
    } catch (caught) { setError((caught as { message?: string })?.message || 'Unable to post Update. Please retry.'); }
    finally { locked.current = false; setBusy(false);setStage(''); }
  }
  return <>
    <button type="button" disabled={disabled} onClick={() => {setOpen(true);if(onOpen)void onOpen().catch(caught=>setError((caught as {message?:string})?.message||'Unable to load document choices.'));}} className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap border border-blue-500/70 bg-blue-950 px-3 text-xs font-bold text-white hover:border-blue-400 hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-40"><span className="inline-flex items-center gap-1" aria-hidden="true"><Upload className="h-4 w-4" /><Paperclip className="h-4 w-4" /></span><span>Post to Job</span></button>
    {open && createPortal(<div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!busy) setOpen(false); } }}>
      <section role="dialog" aria-modal="true" aria-label="Post Sample PDF to Job" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto border border-slate-300 bg-white p-5 text-slate-950 shadow-xl">
        <h2 className="text-lg font-bold">Post to Job</h2>
        {documents && <label className="mt-3 block text-sm font-bold">Document<select aria-label="Document" disabled={busy} value={document?.id??''} onChange={event=>{setDocumentId(event.target.value);setMessage('');}} className="mt-1 h-10 w-full border border-slate-400 bg-white px-2 font-normal">{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        <p className="mt-2 break-all text-sm text-slate-600">{document?.filename}</p>
        {document?.description&&<p className="mt-1 text-xs text-slate-600">{document.description}</p>}
        {document?.unavailableReason&&<div className="mt-2 text-sm text-amber-800"><p>{document.unavailableReason}</p>{document.onConfigure&&<button type="button" disabled={busy} className="mt-2 underline" onClick={()=>{setOpen(false);document.onConfigure?.();}}>{document.configureLabel??'Review document settings'}</button>}</div>}
        {documents&&<button type="button" disabled={busy||!document||Boolean(document.unavailableReason)} onClick={()=>void previewDocument()} className="mt-3 h-9 border border-slate-400 px-3 text-xs font-bold disabled:opacity-40">Preview Document</button>}
        <label className="mt-4 block text-sm font-bold">Search Jobs<input autoFocus disabled={busy || Boolean(message)} value={query} onChange={event => { setQuery(event.target.value); setSelected(null); setMessage(''); setJobs([]); }} className="mt-1 h-10 w-full border border-slate-400 px-3 font-normal" placeholder="Job, customer or number" /></label>
        <div className="mt-3 max-h-60 overflow-auto" aria-busy={searching}>
          {searching ? <p className="text-sm">Loading Jobs…</p> : jobs.length ? jobs.map(job => <button key={job.id} type="button" disabled={busy || Boolean(message)} aria-pressed={selected?.id === job.id} onClick={() => { setSelected(job); setMessage(''); }} className={`mb-2 block w-full border p-3 text-left ${selected?.id === job.id ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}><span className="block text-sm font-bold">{job.name}</span><span className="block text-xs text-slate-600">{[job.customer, job.job_number].filter(Boolean).join(' · ')}</span></button>) : <p className="text-sm text-slate-600">No matching Jobs available.</p>}
        </div>
        <div className="mt-3"><label htmlFor="sample-update-message" className="text-sm font-bold">Message (optional)</label><JobUpdateMentionTextarea id="sample-update-message" value={body} mentions={mentions} collaborators={collaborators} disabled={busy || Boolean(message)} placeholder="Add a message or @mention" onChange={(value, nextMentions) => { setBody(value); setMentions(nextMentions); }} /></div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm text-green-800">{message} Open the Job’s Updates to view it.</p>}
        <div className="mt-4 flex justify-end gap-2"><button disabled={busy} type="button" onClick={() => setOpen(false)} className="h-9 border border-slate-400 px-3 text-sm">{message ? 'Done' : 'Cancel'}</button><button type="button" disabled={!selected || !document || Boolean(document.unavailableReason) || busy || Boolean(message)} onClick={() => void confirm()} className="h-9 bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? stage || 'Posting…' : 'Post Update'}</button></div>
      </section>
    </div>,globalThis.document.body)}
    {documentPreview&&createPortal(<div className="fixed inset-0 z-[160]"><DocumentViewer title="Sample posting document" filename={documentPreview.filename} mimeType="application/pdf" url={documentPreview.url} onClose={()=>setDocumentPreview(null)}/></div>,globalThis.document.body)}
  </>;
}
