'use client';

import { ExternalLink, File, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  createJobAttachmentDownloadUrl,
  deleteJobAttachment,
  loadJobAttachments,
  loadProductionJobActivity,
  uploadJobAttachments,
} from '../jobs';
import type { ProductionJobActivity, ProductionJobUpdate } from '../jobs';
import { getJobReadiness } from '../readiness';
import { productionStatusVisuals } from '../status-visuals';
import type { JobAttachment, JobDocumentType, MaterialStatus, ProductionJob, ProductionStatus } from '../types';
import ProductionStatusBadge from './ProductionStatusBadge';

type Props = {
  job: ProductionJob;
  onClose: () => void;
  onUpdateJob: (id: string, changes: ProductionJobUpdate) => Promise<ProductionJob>;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  onAttachmentsChanged: (jobId: string, count: number) => void;
  initialFocus?: string;
};

const sectionTitle = 'border-b border-slate-300 pb-2 text-sm font-bold uppercase tracking-wide';
const fieldClass = 'mt-1 h-9 w-full border border-slate-400 px-2 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950';

export default function ProductionJobInspector({ job, onClose, onUpdateJob, onStageSchedule, onAttachmentsChanged, initialFocus }: Props) {
  const [activity, setActivity] = useState<ProductionJobActivity[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [error, setError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<JobDocumentType>('other');
  const [scheduleDraft, setScheduleDraft] = useState(() => ({ start: job.planned_start || '', end: job.planned_end || '' }));
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadProductionJobActivity(job.id).then((changes) => { if (live) setActivity(changes); }).catch((loadError: unknown) => { if (live) setError(loadError instanceof Error ? loadError.message : 'Unable to load recent changes.'); });
    loadJobAttachments(job.id).then((files) => { if (live) setAttachments(files); }).catch((loadError: unknown) => { if (live) setAttachmentError(loadError instanceof Error ? loadError.message : 'Unable to load attachments.'); }).finally(() => { if (live) setAttachmentsLoading(false); });
    requestAnimationFrame(() => {
      const target = initialFocus ? panel.current?.querySelector<HTMLElement>(`[data-field="${initialFocus}"]`) : null;
      if (target) { target.scrollIntoView({ block: 'center' }); target.focus(); } else closeRef.current?.focus();
    });
    return () => { live = false; };
  }, [initialFocus, job.id, job.updated_at]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>('button,input,select,textarea')].filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const readiness = getJobReadiness(job);
  const updateField = async (name: keyof ProductionJobUpdate, value: unknown) => {
    try { await onUpdateJob(job.id, { [name]: value } as ProductionJobUpdate); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save change.'); }
  };
  const schedule = (key: 'start' | 'end', value: string) => {
    const next = { ...scheduleDraft, [key]: value };
    setScheduleDraft(next);
    if (next.start && next.end) onStageSchedule(job, next.start, next.end);
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setAttachmentError('');
    try {
      const uploaded = await uploadJobAttachments(job.id, [...files], documentType);
      const next = [...uploaded, ...attachments];
      setAttachments(next); onAttachmentsChanged(job.id, next.length);
      if (fileRef.current) fileRef.current.value = '';
    } catch (uploadError) { setAttachmentError(uploadError instanceof Error ? uploadError.message : 'Unable to upload attachment.'); }
    finally { setUploading(false); }
  }

  async function openAttachment(attachment: JobAttachment) {
    try { window.open(await createJobAttachmentDownloadUrl(attachment.storage_path), '_blank', 'noopener,noreferrer'); }
    catch (openError) { setAttachmentError(openError instanceof Error ? openError.message : 'Unable to open attachment.'); }
  }

  async function removeAttachment(attachment: JobAttachment) {
    if (!window.confirm(`Remove “${attachment.file_name}” from this job?`)) return;
    setDeletingId(attachment.id); setAttachmentError('');
    try { await deleteJobAttachment(attachment); const next = attachments.filter((file) => file.id !== attachment.id); setAttachments(next); onAttachmentsChanged(job.id, next.length); }
    catch (deleteError) { setAttachmentError(deleteError instanceof Error ? deleteError.message : 'Unable to remove attachment.'); }
    finally { setDeletingId(null); }
  }

  return <div className="fixed inset-0 z-[80] bg-slate-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside ref={panel} role="dialog" aria-modal="true" aria-labelledby="job-inspector-title" className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-slate-500 bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-slate-500">{job.job_number || 'Job number not recorded'}</div><h2 id="job-inspector-title" className="text-2xl font-bold text-slate-950">{job.name}</h2><div className="mt-2"><ProductionStatusBadge status={job.production_status}/></div><div className={`mt-2 inline-flex px-2 py-1 text-xs font-bold ${readiness.state === 'ready' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{readiness.label} — {readiness.guidance}</div></div><button ref={closeRef} type="button" onClick={onClose} className="h-9 border border-slate-400 px-3 font-bold hover:bg-slate-100">Close</button></div>

      <section className="mt-5"><h3 className={sectionTitle}>Planning</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Planned start<input data-field="planned-dates" type="date" value={scheduleDraft.start} onChange={(event) => setScheduleDraft((current) => ({ ...current, start: event.target.value }))} onBlur={(event) => schedule('start', event.target.value)} className={fieldClass}/></label>
        <label className="text-xs font-bold">Planned finish<input type="date" value={scheduleDraft.end} min={scheduleDraft.start || undefined} onChange={(event) => setScheduleDraft((current) => ({ ...current, end: event.target.value }))} onBlur={(event) => schedule('end', event.target.value)} className={fieldClass}/></label>
        <label className="text-xs font-bold">Requested delivery<input type="date" defaultValue={job.requested_delivery_date || ''} onBlur={(event) => void updateField('requested_delivery_date', event.target.value || null)} className={fieldClass}/></label>
        <label className="text-xs font-bold">Estimated labor<input data-field="labor" type="number" min="0" defaultValue={job.estimated_man_hours ?? ''} onBlur={(event) => void updateField('estimated_man_hours', event.target.value ? Number(event.target.value) : null)} className={fieldClass}/></label>
        <label className="text-xs font-bold">Estimated calendar days<input type="number" min="0" step="1" defaultValue={job.estimated_calendar_days ?? ''} onBlur={(event) => void updateField('estimated_calendar_days', event.target.value ? Number(event.target.value) : null)} className={fieldClass}/></label>
        <label className="text-xs font-bold">Production status<select defaultValue={job.production_status} onChange={(event) => void updateField('production_status', event.target.value as ProductionStatus)} className={fieldClass}>{productionStatusVisuals.map((visual) => <option key={visual.value} value={visual.value}>{visual.label}</option>)}</select></label>
        <label className="text-xs font-bold">Material status<select defaultValue={job.material_status} onChange={(event) => void updateField('material_status', event.target.value as MaterialStatus)} className={fieldClass}><option value="unknown">Unknown</option><option value="not_ready">Not Ready</option><option value="ready">Ready</option></select></label>
      </div></section>

      <section className="mt-5"><h3 className={sectionTitle}>Job Details</h3><dl className="mt-3 grid grid-cols-[130px_1fr] gap-2 text-sm"><dt className="font-bold">Customer</dt><dd>{job.customer || 'Not recorded'}</dd><dt className="font-bold">Estimate</dt><dd>{job.estimate_number || 'Not recorded'}</dd><dt className="font-bold">Work order</dt><dd>{job.work_order_number || 'Not recorded'}</dd><dt className="font-bold">Contract value</dt><dd>{job.contract_value === null ? 'Not recorded' : job.contract_value}</dd><dt className="font-bold">Resin / Chip PO</dt><dd>{[job.resin_po, job.chip_po].filter(Boolean).join(' / ') || 'Not recorded'}</dd><dt className="font-bold">Remarks</dt><dd className="whitespace-pre-wrap">{job.remarks || 'None'}</dd></dl></section>

      <section className="mt-5" data-field="attachments" tabIndex={-1}><div className="flex items-center justify-between border-b border-slate-300 pb-2"><h3 className="text-sm font-bold uppercase tracking-wide">Attachments</h3><span className="text-xs font-semibold text-slate-500">{attachments.length} files</span></div>
        <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs font-bold">Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value as JobDocumentType)} className="mt-1 h-9 border border-slate-400 px-2"><option value="other">Other</option><option value="estimate">Estimate</option><option value="work_order">Work Order</option><option value="blend_sheet">Blend Sheet</option><option value="shop_drawing">Shop Drawing</option><option value="cut_ticket">Cut Ticket</option><option value="color_plate">Color Plate</option><option value="sample_approval">Sample / Approval</option><option value="purchase_order">Purchase Order</option><option value="photo">Photo</option></select></label><label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-slate-900 bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-950"><Upload className="h-4 w-4"/>{uploading ? 'Uploading…' : 'Add Attachment'}<input ref={fileRef} type="file" multiple disabled={uploading} onChange={(event) => void upload(event.target.files)} className="sr-only"/></label></div>
        {attachmentError && <div role="alert" className="mt-3 text-sm font-semibold text-red-700">{attachmentError}</div>}
        <div className="mt-3 divide-y divide-slate-300 border border-slate-300">{attachmentsLoading ? <div className="p-4 text-sm text-slate-500">Loading attachments…</div> : attachments.length === 0 ? <div className="p-4 text-sm text-slate-500">No files attached yet.</div> : attachments.map((attachment) => <div key={attachment.id} className="flex items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-2"><File className="h-4 w-4 shrink-0 text-slate-500"/><div className="min-w-0"><div className="truncate text-sm font-bold" title={attachment.file_name}>{attachment.file_name}</div><div className="text-xs text-slate-500">{new Date(attachment.created_at).toLocaleDateString()}{attachment.uploaded_by ? ` · ${attachment.uploaded_by}` : ''}</div></div></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => void openAttachment(attachment)} aria-label={`Open ${attachment.file_name}`} title="Open or download" className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 hover:bg-slate-100"><ExternalLink className="h-4 w-4"/></button><button type="button" disabled={deletingId === attachment.id} onClick={() => void removeAttachment(attachment)} aria-label={`Remove ${attachment.file_name}`} title="Remove attachment" className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4"/></button></div></div>)}</div>
      </section>

      <section className="mt-5"><h3 className={sectionTitle}>Recent Changes</h3>{error && <div role="alert" className="mt-3 text-sm text-red-700">{error}</div>}<div className="mt-3 space-y-3">{activity.length === 0 && !error && <p className="text-sm text-slate-500">No recorded changes yet.</p>}{activity.map((change) => { const metadata = change.metadata as { old_values?: Record<string,string>; new_values?: Record<string,string>; change_note?: string }; return <div key={change.id} className="border-l-2 border-slate-300 pl-3 text-sm"><div className="font-bold">{change.actor_name || 'TenOps'} <span className="font-normal text-slate-500">· {new Date(change.occurred_at).toLocaleString()}</span></div><div>{change.event_type === 'production_schedule_changed' ? 'Moved production' : change.summary}</div>{metadata.old_values && metadata.new_values && <div className="text-slate-600">{metadata.old_values.planned_start}–{metadata.old_values.planned_end} → {metadata.new_values.planned_start}–{metadata.new_values.planned_end}</div>}{metadata.change_note && <div className="mt-1 text-slate-600"><b>Reason:</b> {metadata.change_note}</div>}</div>; })}</div></section>
    </aside>
  </div>;
}
