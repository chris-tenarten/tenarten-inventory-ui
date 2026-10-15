'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { JobDocumentType } from '@/modules/production/types';
import { postSampleToJob, searchPublishJobs, type PublishJob } from './post-to-job';
import JobUpdateMentionTextarea, { type SelectedMention } from '@/modules/production/components/JobUpdateMentionTextarea';
import { loadJobUpdateCollaborators } from '@/modules/production/jobs';
import type { JobUpdateCollaborator } from '@/modules/production/types';

export default function PostSampleToJob({ url, filename, documentType }: { url: string; filename: string; documentType: JobDocumentType }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<PublishJob[]>([]), [selected, setSelected] = useState<PublishJob | null>(null);
  const [searching, setSearching] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [body, setBody] = useState(''), [mentions, setMentions] = useState<SelectedMention[]>([]);
  const [collaborators, setCollaborators] = useState<JobUpdateCollaborator[]>([]);
  const requests = useRef(new Map<string, string>());
  const locked = useRef(false), snapshot = useRef<Promise<File> | null>(null);
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
  async function confirm() {
    if (!selected || locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try {
      // Keep one immutable snapshot for this preview. Never regenerate the Sample.
      snapshot.current ??= fetch(url).then(async response => {
        if (!response.ok) throw new Error('Unable to read the generated PDF. Reopen its preview and retry.');
        const bytes = await response.blob();
        if ((await bytes.slice(0, 5).text()) !== '%PDF-') throw new Error('The generated document is not a PDF.');
        return new File([bytes], filename, { type: 'application/pdf' });
      }).catch(error => { snapshot.current = null; throw error; });
      const requestId = requests.current.get(selected.id) ?? crypto.randomUUID();
      requests.current.set(selected.id, requestId);
      await postSampleToJob({jobId:selected.id,requestId,file:await snapshot.current,documentType,body,mentionedUserIds:mentions.map(mention=>mention.userId)});
      setMessage(`Update posted to ${selected.name}.`);
    } catch (caught) { setError((caught as { message?: string })?.message || 'Unable to post Update. Please retry.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="h-9 border border-slate-600 px-3 text-xs font-bold">Post to Job</button>
    {open && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!busy) setOpen(false); } }}>
      <section role="dialog" aria-modal="true" aria-label="Post Sample PDF to Job" className="w-full max-w-lg border border-slate-300 bg-white p-5 text-slate-950 shadow-xl">
        <h2 className="text-lg font-bold">Post to Job</h2><p className="mt-1 break-all text-sm text-slate-600">{filename}</p>
        <label className="mt-4 block text-sm font-bold">Search Jobs<input autoFocus disabled={busy || Boolean(message)} value={query} onChange={event => { setQuery(event.target.value); setSelected(null); setMessage(''); setJobs([]); }} className="mt-1 h-10 w-full border border-slate-400 px-3 font-normal" placeholder="Job, customer or number" /></label>
        <div className="mt-3 max-h-60 overflow-auto" aria-busy={searching}>
          {searching ? <p className="text-sm">Loading Jobs…</p> : jobs.length ? jobs.map(job => <button key={job.id} type="button" disabled={busy || Boolean(message)} aria-pressed={selected?.id === job.id} onClick={() => { setSelected(job); setMessage(''); }} className={`mb-2 block w-full border p-3 text-left ${selected?.id === job.id ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}><span className="block text-sm font-bold">{job.name}</span><span className="block text-xs text-slate-600">{[job.customer, job.job_number].filter(Boolean).join(' · ')}</span></button>) : <p className="text-sm text-slate-600">No matching Jobs available.</p>}
        </div>
        <div className="mt-3"><label htmlFor="sample-update-message" className="text-sm font-bold">Message (optional)</label><JobUpdateMentionTextarea id="sample-update-message" value={body} mentions={mentions} collaborators={collaborators} disabled={busy || Boolean(message)} placeholder="Add a message or @mention" onChange={(value, nextMentions) => { setBody(value); setMentions(nextMentions); }} /></div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm text-green-800">{message} Open the Job’s Updates to view it.</p>}
        <div className="mt-4 flex justify-end gap-2"><button disabled={busy} type="button" onClick={() => setOpen(false)} className="h-9 border border-slate-400 px-3 text-sm">{message ? 'Done' : 'Cancel'}</button><button type="button" disabled={!selected || busy || Boolean(message)} onClick={() => void confirm()} className="h-9 bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Posting…' : 'Post Update'}</button></div>
      </section>
    </div>}
  </>;
}
