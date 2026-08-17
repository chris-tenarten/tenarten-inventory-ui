'use client';

import { FileText, Plus, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { NewProductionJob, ProductionJob } from '../types';
import type { JobUpdateSummary, ProductionJobUpdate } from '../jobs';
import { findMatchingProductionJob, type ProductionJobMatch } from '../job-import-matching';
import { deterministicJobMetadataExtractionProvider, type ExtractedJobMetadata } from '../job-import-provider';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreateJob: (input: NewProductionJob) => Promise<ProductionJob>;
  jobs: ProductionJob[];
  attachmentCounts: Record<string, number>;
  jobUpdateSummaries: Record<string, JobUpdateSummary>;
  planningPhaseCounts: Record<string, number>;
  onUpdateJob: (jobId: string, changes: ProductionJobUpdate) => Promise<ProductionJob>;
  onAttachFiles: (jobId: string, files: File[]) => Promise<void>;
  onOpenJob: (job: ProductionJob) => void;
  onCreated: (job: ProductionJob) => void;
};

type CreatorMethod = 'choose' | 'blank' | 'import';
type ImportStep = 'upload' | 'extracting' | 'review' | 'duplicate' | 'updating';

type BlankJobDraft = {
  name: string;
  customer: string;
  jobNumber: string;
  estimateNumber: string;
  workOrderNumber: string;
  depositDate: string;
  requestedDeliveryDate: string;
  plannedStart: string;
  plannedEnd: string;
  estimatedManHours: string;
  estimatedCalendarDays: string;
  colorPlateNumber: string;
  sampleSubmittedDate: string;
  approvalDate: string;
  remarks: string;
};

const emptyDraft = (): BlankJobDraft => ({
  name: '', customer: '', jobNumber: '', estimateNumber: '', workOrderNumber: '',
  depositDate: '', requestedDeliveryDate: '', plannedStart: '', plannedEnd: '',
  estimatedManHours: '', estimatedCalendarDays: '', colorPlateNumber: '',
  sampleSubmittedDate: '', approvalDate: '', remarks: '',
});

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateDraft(draft: BlankJobDraft) {
  if (!draft.name.trim()) return 'Project name is required.';
  if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) return 'Planned finish cannot be before planned start.';
  if (draft.estimatedManHours.trim()) {
    const hours = Number(draft.estimatedManHours);
    if (!Number.isFinite(hours) || hours < 0) return 'Estimated man hours must be zero or greater.';
  }
  if (draft.estimatedCalendarDays.trim()) {
    const days = Number(draft.estimatedCalendarDays);
    if (!Number.isInteger(days) || days < 0) return 'Estimated calendar days must be a whole number.';
  }
  return '';
}

function toNewJob(draft: BlankJobDraft): NewProductionJob {
  return {
    name: draft.name.trim(),
    customer: draft.customer.trim() || null,
    job_number: draft.jobNumber.trim() || null,
    estimate_number: draft.estimateNumber.trim() || null,
    work_order_number: draft.workOrderNumber.trim() || null,
    deposit_date: draft.depositDate || null,
    requested_delivery_date: draft.requestedDeliveryDate || null,
    planned_start: draft.plannedStart || null,
    planned_end: draft.plannedEnd || null,
    estimated_man_hours: optionalNumber(draft.estimatedManHours),
    estimated_calendar_days: optionalNumber(draft.estimatedCalendarDays),
    color_plate_number: draft.colorPlateNumber.trim() || null,
    sample_submitted_date: draft.sampleSubmittedDate || null,
    approval_date: draft.approvalDate || null,
    remarks: draft.remarks.trim() || null,
  };
}

const inputClass = 'mt-1 h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-xs font-bold text-slate-700';

export default function ProductionJobCreator({ open, onClose, onCreateJob, jobs, attachmentCounts, jobUpdateSummaries, planningPhaseCounts, onUpdateJob, onAttachFiles, onOpenJob, onCreated }: Props) {
  const [method, setMethod] = useState<CreatorMethod>('choose');
  const [draft, setDraft] = useState<BlankJobDraft>(emptyDraft);
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState('');
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [extracted, setExtracted] = useState<ExtractedJobMetadata | null>(null);
  const [match, setMatch] = useState<ProductionJobMatch | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<keyof ProductionJobUpdate>>(new Set());
  const [retentionRecoveryJob, setRetentionRecoveryJob] = useState<ProductionJob | null>(null);
  const [retentionRecoveryCompletesCreation, setRetentionRecoveryCompletesCreation] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const operationInFlightRef = useRef(false);
  const initialDraft = useMemo(emptyDraft, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  useEffect(() => {
    if (!open) return;
    if (method === 'blank') requestAnimationFrame(() => nameRef.current?.focus());
  }, [method, open]);

  if (!open) return null;

  const update = <K extends keyof BlankJobDraft>(field: K, value: BlankJobDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError('');
  };
  const reset = () => {
    setMethod('choose'); setDraft(emptyDraft()); setError(''); setImportStep('upload');
    setFiles([]); setExtracted(null); setMatch(null); setSelectedUpdates(new Set()); setRetentionRecoveryJob(null); setRetentionRecoveryCompletesCreation(false);
  };
  const requestClose = () => {
    if (operationInFlightRef.current) return;
    if ((dirty || files.length > 0) && !window.confirm('Discard this new Production Job draft?')) return;
    reset();
    onClose();
  };
  const beginOperation = () => {
    if (operationInFlightRef.current) return false;
    operationInFlightRef.current = true;
    setSaveState('saving');
    setError('');
    return true;
  };
  const endOperation = () => {
    operationInFlightRef.current = false;
    setSaveState('idle');
  };
  const create = async () => {
    const validationError = validateDraft(draft);
    if (validationError) { setError(validationError); return; }
    if (!beginOperation()) return;
    try {
      const created = await onCreateJob(toNewJob(draft));
      reset(); onClose(); onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create job.');
    } finally {
      endOperation();
    }
  };

  const beginExtraction = async () => {
    if (!files.length) { setError('Add at least one PDF or image.'); return; }
    if (operationInFlightRef.current) return;
    operationInFlightRef.current = true;
    setImportStep('extracting'); setError('');
    try {
      const result = await deterministicJobMetadataExtractionProvider.extractJobMetadata(files);
      setExtracted(result); setImportStep('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read job information from these documents.');
      setImportStep('upload');
    } finally {
      operationInFlightRef.current = false;
    }
  };
  const updateExtracted = (field: keyof ExtractedJobMetadata, value: string) => setExtracted((current) => current ? { ...current, [field]: value } : current);
  const importedNewJob = (metadata: ExtractedJobMetadata): NewProductionJob => ({
    name: metadata.jobName.trim(), customer: metadata.customer.trim() || null,
    job_number: metadata.jobNumber.trim() || null, estimate_number: metadata.estimateNumber.trim() || null,
    work_order_number: metadata.workOrderNumber.trim() || null, deposit_date: null,
    color_plate_number: metadata.plateNumber.trim() || null, sample_submitted_date: null,
    approval_date: null, estimated_man_hours: null, estimated_calendar_days: null,
    requested_delivery_date: metadata.requestedDelivery || null, planned_start: null,
    planned_end: null, remarks: null,
  });
  const reviewImport = () => {
    if (!extracted?.jobName.trim()) { setError('Job name is required.'); return; }
    const found = findMatchingProductionJob(jobs, extracted);
    if (found) { setMatch(found); setImportStep('duplicate'); return; }
    void createImportedJob();
  };
  const createImportedJob = async () => {
    if (!extracted) return;
    if (!beginOperation()) return;
    try {
      const created = await onCreateJob(importedNewJob(extracted));
      try {
        await onAttachFiles(created.id, files);
        reset(); onClose(); onCreated(created);
      } catch {
        setRetentionRecoveryJob(created);
        setRetentionRecoveryCompletesCreation(true);
        setError('The Production Job was created, but one or more documents were not retained. Retry document upload before closing, or upload them from the Job Files tab.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to import job.'); }
    finally { endOperation(); }
  };
  const attachToMatch = async () => {
    if (!match) return;
    if (!beginOperation()) return;
    try { await onAttachFiles(match.job.id, files); const job = match.job; reset(); onClose(); onOpenJob(job); }
    catch { setRetentionRecoveryJob(match.job); setRetentionRecoveryCompletesCreation(false); setError('The Production Job remains available, but one or more documents were not retained. Retry document upload before closing, or upload them from the Job Files tab.'); }
    finally { endOperation(); }
  };
  const availableUpdates = match && extracted ? ([
    ['job_number', match.job.job_number, extracted.jobNumber],
    ['name', match.job.name, extracted.jobName],
    ['customer', match.job.customer, extracted.customer],
    ['estimate_number', match.job.estimate_number, extracted.estimateNumber],
    ['work_order_number', match.job.work_order_number, extracted.workOrderNumber],
    ['color_plate_number', match.job.color_plate_number, extracted.plateNumber],
    ['requested_delivery_date', match.job.requested_delivery_date, extracted.requestedDelivery],
  ] as Array<[keyof ProductionJobUpdate, string | null, string]>).filter(([, current, imported]) => imported.trim() && imported.trim() !== (current ?? '').trim()) : [];
  const applyUpdates = async () => {
    if (!match || !extracted || selectedUpdates.size === 0) return;
    const source = importedNewJob(extracted);
    const changes = Object.fromEntries([...selectedUpdates].map((field) => [field, source[field as keyof NewProductionJob]])) as ProductionJobUpdate;
    if (!beginOperation()) return;
    try {
      const updated = await onUpdateJob(match.job.id, changes);
      try {
        await onAttachFiles(updated.id, files);
        reset(); onClose(); onOpenJob(updated);
      } catch {
        setRetentionRecoveryJob(updated);
        setRetentionRecoveryCompletesCreation(false);
        setError('The Production Job was updated, but one or more documents were not retained. Retry document upload before closing, or upload them from the Job Files tab.');
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update job details.'); }
    finally { endOperation(); }
  };
  const retryDocumentRetention = async () => {
    if (!retentionRecoveryJob) return;
    if (!beginOperation()) return;
    try {
      await onAttachFiles(retentionRecoveryJob.id, files);
      const job = retentionRecoveryJob;
      const completesCreation = retentionRecoveryCompletesCreation;
      reset(); onClose();
      if (completesCreation) onCreated(job); else onOpenJob(job);
    } catch {
      setError('One or more documents still could not be retained. Retry again, or upload them from the Job Files tab.');
    } finally {
      endOperation();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="production-job-creator-title" className="flex max-h-full w-full max-w-3xl flex-col border border-slate-400 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-300 px-4 py-3 sm:px-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Production · New Job</div>
            <h2 id="production-job-creator-title" className="mt-1 text-xl font-bold text-slate-950">{method === 'choose' ? 'Create New Production Job' : method === 'blank' ? 'Create Blank Job' : 'Create from Existing Documents'}</h2>
            <p className="mt-1 text-xs text-slate-600">{method === 'choose' ? 'How would you like to begin?' : method === 'blank' ? 'Enter the available job information.' : 'Review supporting documents before creating or updating the canonical Production Job.'}</p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close New Job" className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"><X className="h-4 w-4" /></button>
        </header>
        {method === 'choose' && <div className="grid gap-3 overflow-y-auto px-4 py-5 sm:grid-cols-2 sm:px-5">
          <button type="button" onClick={() => setMethod('blank')} className="min-h-36 border border-slate-300 bg-white p-4 text-left hover:border-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"><Plus className="h-5 w-5 text-blue-800" /><div className="mt-3 text-base font-bold text-slate-950">Create Blank Job</div><p className="mt-1 text-sm text-slate-600">Start with an empty Production Job and enter the details manually.</p></button>
          <button type="button" onClick={() => setMethod('import')} className="min-h-36 border border-slate-300 bg-white p-4 text-left hover:border-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"><Upload className="h-5 w-5 text-blue-800" /><div className="mt-3 text-base font-bold text-slate-950">Create from Existing Documents</div><p className="mt-1 text-sm text-slate-600">Upload existing Production documents to prefill a new Production Job.</p></button>
        </div>}
        {method === 'blank' && <>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <section>
            <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Job identity</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Project name<input ref={nameRef} value={draft.name} onChange={(e) => update('name', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Customer<input value={draft.customer} onChange={(e) => update('customer', e.target.value)} list="production-customer-suggestions" autoComplete="off" className={inputClass} /></label>
              <label className={labelClass}>Job number<input value={draft.jobNumber} onChange={(e) => update('jobNumber', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Estimate number<input value={draft.estimateNumber} onChange={(e) => update('estimateNumber', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Work order<input value={draft.workOrderNumber} onChange={(e) => update('workOrderNumber', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Color plate<input value={draft.colorPlateNumber} onChange={(e) => update('colorPlateNumber', e.target.value)} className={inputClass} /></label>
            </div>
          </section>
          <section className="mt-5">
            <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Dates and estimates</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>Deposit date<input type="date" value={draft.depositDate} onChange={(e) => update('depositDate', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Requested delivery<input type="date" value={draft.requestedDeliveryDate} onChange={(e) => update('requestedDeliveryDate', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Sample submitted<input type="date" value={draft.sampleSubmittedDate} onChange={(e) => update('sampleSubmittedDate', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Approval date<input type="date" value={draft.approvalDate} onChange={(e) => update('approvalDate', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Planned start<input type="date" value={draft.plannedStart} onChange={(e) => update('plannedStart', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Planned finish<input type="date" min={draft.plannedStart || undefined} value={draft.plannedEnd} onChange={(e) => update('plannedEnd', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Estimated labor<input type="number" min="0" step="0.25" value={draft.estimatedManHours} onChange={(e) => update('estimatedManHours', e.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Estimated calendar days<input type="number" min="0" step="1" value={draft.estimatedCalendarDays} onChange={(e) => update('estimatedCalendarDays', e.target.value)} className={inputClass} /></label>
            </div>
          </section>
          <label className={`${labelClass} mt-5 block`}>Remarks<textarea value={draft.remarks} onChange={(e) => update('remarks', e.target.value)} rows={3} className="mt-1 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></label>
          {error && <div role="alert" className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div>}
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-300 bg-slate-50 px-4 py-3 sm:px-5">
          <button type="button" onClick={() => { setDraft(emptyDraft()); setError(''); setMethod('choose'); }} disabled={saveState === 'saving'} className="h-10 border border-slate-400 bg-white px-4 text-xs font-bold uppercase tracking-[0.07em] text-slate-700 hover:bg-slate-100 disabled:opacity-50">Back</button>
          <button type="button" onClick={() => void create()} disabled={saveState === 'saving'} className="inline-flex h-10 items-center gap-2 border border-blue-900 bg-blue-900 px-5 text-xs font-bold uppercase tracking-[0.07em] text-white hover:bg-blue-950 disabled:opacity-50"><Plus className="h-4 w-4" />{saveState === 'saving' ? 'Creating…' : 'Create Job'}</button>
        </footer>
        </>}
        {method === 'import' && <>
          <div className="overflow-y-auto px-4 py-4 sm:px-5">
            {importStep === 'upload' && <section>
              <h3 className="text-sm font-bold text-slate-950">1. Upload documents</h3>
              <p className="mt-1 text-xs text-slate-600">PDF and image files are accepted. Files remain supporting attachments to the Production Job.</p>
              <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-400 bg-slate-50 px-4 text-center hover:border-blue-700 hover:bg-blue-50"><Upload className="h-5 w-5 text-slate-500" /><span className="mt-2 text-sm font-bold text-slate-800">Add production documents</span><input type="file" multiple accept="application/pdf,image/*" className="sr-only" onChange={(event) => { const selected = [...(event.target.files ?? [])]; setFiles((current) => [...current, ...selected]); setError(''); event.target.value = ''; }} /></label>
              <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 border border-slate-200 px-3 py-2 text-xs"><FileText className="h-4 w-4 shrink-0 text-slate-500" /><span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{file.name}</span><span className="shrink-0 text-slate-500">{Math.ceil(file.size / 1024)} KB</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-slate-500 hover:text-red-700"><X className="h-4 w-4" /></button></li>)}</ul>
            </section>}
            {importStep === 'extracting' && <div className="py-12 text-center"><div className="font-bold text-slate-900">Preparing document review…</div><p className="mt-2 text-sm text-slate-600">Reading the uploaded Production documents.</p></div>}
            {importStep === 'review' && extracted && <section>
              <h3 className="text-lg font-bold text-slate-950">Review Production Job</h3>
              <p className="mt-1 text-sm text-slate-600">Review the information below before creating or updating the canonical Production Job.</p>

              <div className="mt-5 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Job information</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{([
                ['jobNumber','Job number'],
                ['jobName','Job name'],
                ['customer','Customer'],
                ['estimateNumber','Estimate number'],
                ['workOrderNumber','Work order number'],
                ['plateNumber','Plate number'],
                ['requestedDelivery','Requested delivery'],
              ] as Array<[Exclude<keyof ExtractedJobMetadata, 'confidence'>,string]>).map(([field,label]) => <label key={field} className={labelClass}>
                {label}
                <input
                  type={field === 'requestedDelivery' ? 'date' : 'text'}
                  value={extracted[field]}
                  placeholder={field === 'requestedDelivery' ? undefined : 'Enter manually if needed'}
                  onChange={(event) => updateExtracted(field, event.target.value)}
                  className={inputClass}
                />
                {!extracted[field] && <span className="mt-1 block text-[10px] font-normal text-slate-500">Not found in the uploaded documents. Enter manually if needed.</span>}
              </label>)}</div>

              <details className="mt-5 border border-slate-300 bg-slate-50">
                <summary className="cursor-pointer px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600">Additional information</summary>
                <div className="border-t border-slate-300 bg-white px-3 py-4">
                  <p className="mb-3 text-xs text-slate-600">Optional information detected in the uploaded documents. Review or edit it for reference.</p>
                  <div className="grid gap-3 sm:grid-cols-2">{([
                    ['productType','Product type'],
                    ['resin','Resin'],
                    ['thickness','Thickness'],
                    ['pieces','Pieces'],
                    ['location','Location'],
                  ] as Array<[Exclude<keyof ExtractedJobMetadata, 'confidence'>,string]>).map(([field,label]) => <label key={field} className={labelClass}>
                    {label}
                    <input value={extracted[field]} placeholder="Enter manually if needed" onChange={(event) => updateExtracted(field, event.target.value)} className={inputClass} />
                  </label>)}</div>
                  <div className="mt-4 border-l-2 border-slate-400 bg-slate-50 px-3 py-2 text-xs text-slate-600">This additional information is available during review but is not saved to the Production Job because the current canonical Production schema has no corresponding fields.</div>
                </div>
              </details>
            </section>}
            {importStep === 'duplicate' && match && <section>
              <h3 className="text-lg font-bold text-slate-950">Production Job Already Exists</h3><p className="mt-1 text-sm text-slate-600">A matching Production Job was found by {match.matchedBy.replaceAll('_', ' ')}.</p>
              <div className="mt-4 border border-slate-300 bg-slate-50 p-3 text-sm"><div className="font-bold text-slate-950">{match.job.job_number ? `${match.job.job_number} — ` : ''}{match.job.name}</div><div className="mt-1 text-slate-600">{match.job.customer || 'No customer'} · Work Order {match.job.work_order_number || 'not recorded'}</div><div className="mt-3 text-xs font-semibold text-slate-600">{attachmentCounts[match.job.id] ?? 0} attachments · {jobUpdateSummaries[match.job.id]?.total ?? 0} updates · {planningPhaseCounts[match.job.id] ?? 0} Planning Phases</div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={saveState === 'saving'} onClick={() => { const job = match.job; reset(); onClose(); onOpenJob(job); }} className="border border-slate-400 bg-white p-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50"><b>Open Existing Job</b><span className="mt-1 block text-xs text-slate-600">Cancel this import and open the matched Job.</span></button><button type="button" disabled={saveState === 'saving'} onClick={() => void attachToMatch()} className="border border-blue-800 bg-blue-50 p-3 text-left text-sm text-blue-950 hover:bg-blue-100 disabled:opacity-50"><b>{saveState === 'saving' ? 'Attaching Documents…' : 'Attach Uploaded Documents'}</b><span className="mt-1 block text-xs">{saveState === 'saving' ? 'Keeping these documents with the existing Production Job.' : 'Attach files without changing Job details.'}</span></button><button type="button" disabled={saveState === 'saving'} onClick={() => setImportStep('updating')} className="border border-slate-400 bg-white p-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50"><b>Update Job Details</b><span className="mt-1 block text-xs text-slate-600">Choose individual imported values to apply.</span></button><button type="button" disabled={saveState === 'saving'} onClick={() => { setMatch(null); setImportStep('review'); }} className="border border-slate-300 bg-white p-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50"><b>Cancel</b><span className="mt-1 block text-xs text-slate-600">Return to review without making changes.</span></button></div>
            </section>}
            {importStep === 'updating' && match && <section><h3 className="text-lg font-bold text-slate-950">Review Job Detail Updates</h3><p className="mt-1 text-sm text-slate-600">Nothing changes unless you explicitly select and confirm a value.</p><div className="mt-4 space-y-2">{availableUpdates.length ? availableUpdates.map(([field,current,imported]) => { const selected = selectedUpdates.has(field); return <label key={field} className={`grid cursor-pointer grid-cols-[auto_1fr] gap-3 border p-3 text-sm transition focus-within:ring-2 focus-within:ring-blue-600 ${selected ? 'tenops-selected-surface' : 'border-slate-300 bg-white hover:bg-slate-50'}`}><input type="checkbox" checked={selected} disabled={saveState === 'saving'} onChange={(event) => setSelectedUpdates((selection) => { const next = new Set(selection); if (event.target.checked) next.add(field); else next.delete(field); return next; })} /><span><b className="block">{field.replaceAll('_',' ')}</b><span className={`block text-xs ${selected ? 'text-white/75' : 'text-slate-500'}`}>Current: {current || 'Blank'}</span><span className={`block text-xs font-semibold ${selected ? 'text-white' : 'text-blue-900'}`}>Imported: {imported}</span></span></label>; }) : <p className="border border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">No different supported values were found.</p>}</div></section>}
            {error && <div role="alert" className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div>}
            {retentionRecoveryJob && <button type="button" onClick={() => void retryDocumentRetention()} disabled={saveState === 'saving'} className="mt-3 h-10 border border-blue-900 bg-blue-900 px-4 text-xs font-bold uppercase text-white disabled:opacity-50">{saveState === 'saving' ? 'Retrying…' : 'Retry document upload'}</button>}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-slate-50 px-4 py-3 sm:px-5"><button type="button" onClick={() => { if (importStep === 'upload') { setFiles([]); setMethod('choose'); } else if (importStep === 'review') setImportStep('upload'); else if (importStep === 'updating') setImportStep('duplicate'); }} disabled={saveState === 'saving' || importStep === 'extracting' || importStep === 'duplicate'} className="h-10 border border-slate-400 bg-white px-4 text-xs font-bold uppercase text-slate-700 disabled:opacity-40">Back</button>{importStep === 'upload' && <button type="button" onClick={() => void beginExtraction()} disabled={!files.length} className="h-10 border border-blue-900 bg-blue-900 px-5 text-xs font-bold uppercase text-white disabled:opacity-40">Review documents</button>}{importStep === 'review' && <button type="button" onClick={reviewImport} disabled={saveState === 'saving'} className="h-10 border border-blue-900 bg-blue-900 px-5 text-xs font-bold uppercase text-white disabled:opacity-40">{saveState === 'saving' ? 'Creating…' : 'Check & Create Job'}</button>}{importStep === 'updating' && <button type="button" onClick={() => void applyUpdates()} disabled={saveState === 'saving' || selectedUpdates.size === 0} className="h-10 border border-blue-900 bg-blue-900 px-5 text-xs font-bold uppercase text-white disabled:opacity-40">{saveState === 'saving' ? 'Updating…' : 'Confirm selected updates'}</button>}</footer>
        </>}
      </div>
    </div>
  );
}
