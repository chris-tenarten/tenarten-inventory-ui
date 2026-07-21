'use client';

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  formatProductionJobOption,
  loadProductionJobOption,
  loadProductionJobOptions,
  openProductionJob,
  type ProductionJobOption,
} from '../production/job-options';
import { JobTag } from '../production/components/JobTag';
import ProductionStatusBadge from '../production/components/ProductionStatusBadge';

import {
  deleteMaterialUsageReport,
  getMaterialUsageSuggestions,
  saveMaterialUsageReport,
} from './actions';

import {
  type MaterialUsageLine,
  type MaterialUsageReport,
  type MaterialUsageSuggestions,
} from './types';
import {
  applySharedChipBlendColorPlate,
  applyCanonicalJobSelection,
  getSharedChipBlendColorPlate,
  isChipBlendMaterialType,
  resolveColorPlateDecision,
} from './canonical-job-defaults';

interface Props {
  loading: boolean;
  report: MaterialUsageReport;
  onChange(report: MaterialUsageReport): void;
  onSaved(id: string): Promise<void>;
  onDeleted(): Promise<void>;
}

const EMPTY_SUGGESTIONS: MaterialUsageSuggestions = {
  materialTypes: [],
  manufacturers: [],
  materialNames: [],
  units: [],
};

function createEmptyLine(): MaterialUsageLine {
  return {
    materialType: '',
    manufacturer: '',
    materialName: '',
    quantity: null,
    unit: '',
    plate: '',
    notes: '',
  };
}

function serializeReport(report: MaterialUsageReport): string {
  return JSON.stringify(report);
}

function getJobDisplayValue(report: MaterialUsageReport): string {
  if (report.jobId) {
    return formatProductionJobOption({
      job_number: report.jobNumberSnapshot ?? null,
      name: report.jobNameSnapshot ?? null,
    });
  }

  return report.unlistedJobName;
}

function getEditorName(): string {
  if (typeof window === 'undefined') return 'TenOps user';

  return (
    window.localStorage.getItem('tenops_user_name') ??
    window.localStorage.getItem('tenarten_user_name') ??
    'TenOps user'
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
    </svg>
  );
}

function TemporaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function MaterialUsageEditor({
  loading,
  report,
  onChange,
  onSaved,
  onDeleted,
}: Props) {
  const initialSnapshotRef = useRef(serializeReport(report));
  const jobSelectorRef = useRef<HTMLDivElement | null>(null);
  const [jobSearch, setJobSearch] = useState(getJobDisplayValue(report));
  const [jobMenuOpen, setJobMenuOpen] = useState(false);
  const [jobs, setJobs] = useState<ProductionJobOption[]>([]);
  const [suggestions, setSuggestions] = useState<MaterialUsageSuggestions>(EMPTY_SUGGESTIONS);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingJobSelection, setPendingJobSelection] = useState<{
    mode: 'reassignment' | 'comparison';
    job: ProductionJobOption;
    reportColorPlate: string;
    productionColorPlate: string;
  } | null>(null);

  const currentSnapshot = useMemo(() => serializeReport(report), [report]);
  const isDirty = currentSnapshot !== initialSnapshotRef.current;
  const normalizedJobSearch = jobSearch.trim().toLowerCase();

  const filteredJobs = useMemo(() => {
    if (!normalizedJobSearch) return jobs.slice(0, 15);

    return jobs
      .filter((job) =>
        [job.job_number, job.name, job.customer]
          .join(' ')
          .toLowerCase()
          .includes(normalizedJobSearch),
      )
      .slice(0, 15);
  }, [jobs, normalizedJobSearch]);

  const currentJobDisplay = getJobDisplayValue(report).trim();
  const temporaryLabel = jobSearch.trim() && jobSearch.trim() !== currentJobDisplay
    ? jobSearch.trim()
    : '';

  useEffect(() => {
    setJobSearch(currentJobDisplay);
  }, [currentJobDisplay]);

  useEffect(() => {
    let active = true;

    async function loadReferenceData() {
      try {
        const [jobOptions, usageSuggestions] = await Promise.all([
          loadProductionJobOptions({ orderBy: 'schedule' }),
          getMaterialUsageSuggestions(),
        ]);

        if (!active) return;
        setJobs(jobOptions);
        setSuggestions(usageSuggestions);
      } catch (caughtError) {
        if (!active) return;
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load report suggestions.');
      }
    }

    void loadReferenceData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (jobSelectorRef.current && !jobSelectorRef.current.contains(event.target as Node)) {
        setJobMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function updateReport(patch: Partial<MaterialUsageReport>) {
    onChange({ ...report, ...patch });
    setMessage(null);
    setError(null);
  }

  function updateLine(index: number, patch: Partial<MaterialUsageLine>) {
    updateReport({
      lines: report.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    });
  }

  function updateMaterialType(index: number, materialType: string) {
    const sharedColorPlate = getSharedChipBlendColorPlate(report.lines);
    updateLine(index, {
      materialType,
      ...(isChipBlendMaterialType(materialType)
        ? { plate: sharedColorPlate }
        : {}),
    });
  }

  function finalizeMaterialType(index: number, materialType: string) {
    if (!isChipBlendMaterialType(materialType) && report.lines[index].plate) {
      updateLine(index, { plate: '' });
    }
  }

  function addLine() {
    updateReport({ lines: [...report.lines, createEmptyLine()] });
  }

  function removeLine(index: number) {
    const line = report.lines[index];
    const containsData = Object.entries(line)
      .filter(([key]) => key !== 'id')
      .some(([, value]) => typeof value === 'number' || Boolean(String(value ?? '').trim()));

    if (containsData && !window.confirm('Remove this populated material line?')) return;

    updateReport({
      lines: report.lines.filter((_, lineIndex) => lineIndex !== index),
    });
  }

  function handleJobSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setJobSearch(value);
    setJobMenuOpen(true);
  }

  function commitProductionJobSelection(
    job: ProductionJobOption,
    colorPlate: string,
  ) {
    setJobSearch(formatProductionJobOption(job));
    setJobMenuOpen(false);
    setPendingJobSelection(null);
    onChange(applyCanonicalJobSelection(report, job, colorPlate));
    setMessage(null);
    setError(null);
  }

  function selectProductionJob(job: ProductionJobOption) {
    if (report.jobId === job.id) {
      setJobSearch(formatProductionJobOption(job));
      setJobMenuOpen(false);
      return;
    }

    const reportColorPlate = getSharedChipBlendColorPlate(report.lines);
    const productionColorPlate = job.color_plate_number?.trim() ?? '';
    const decision = resolveColorPlateDecision(
      reportColorPlate,
      productionColorPlate,
    );

    if (decision === 'conflict') {
      setJobMenuOpen(false);
      setPendingJobSelection({
        mode: 'reassignment',
        job,
        reportColorPlate,
        productionColorPlate,
      });
      return;
    }

    commitProductionJobSelection(
      job,
      decision === 'use_production'
        ? productionColorPlate
        : reportColorPlate,
    );
  }

  function cancelPendingJobSelection() {
    const wasReassignment = pendingJobSelection?.mode === 'reassignment';
    setPendingJobSelection(null);
    if (wasReassignment) setJobSearch(getJobDisplayValue(report));
  }

  async function checkProductionDefaults() {
    if (!report.jobId) return;

    try {
      setError(null);
      const job = await loadProductionJobOption(report.jobId);

      if (!job) {
        setError('The linked Production job could not be loaded.');
        return;
      }

      const reportColorPlate = getSharedChipBlendColorPlate(report.lines);
      const productionColorPlate = job.color_plate_number?.trim() ?? '';
      const decision = resolveColorPlateDecision(
        reportColorPlate,
        productionColorPlate,
      );

      if (decision === 'use_production') {
        updateReport({
          lines: applySharedChipBlendColorPlate(
            report.lines,
            productionColorPlate,
          ),
        });
        setMessage('Color Plate # copied from Production.');
        return;
      }

      if (decision === 'keep_report') {
        setMessage(productionColorPlate
          ? 'Material Usage and Production Color Plate # values match.'
          : 'Production does not currently have a Color Plate #; Material Usage was unchanged.');
        return;
      }

      setPendingJobSelection({
        mode: 'comparison',
        job,
        reportColorPlate,
        productionColorPlate,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error
        ? caughtError.message
        : 'Unable to compare Production defaults.');
    }
  }

  function keepPendingMaterialUsageColorPlate() {
    if (!pendingJobSelection) return;

    if (pendingJobSelection.mode === 'reassignment') {
      commitProductionJobSelection(
        pendingJobSelection.job,
        pendingJobSelection.reportColorPlate,
      );
      return;
    }

    setPendingJobSelection(null);
    setMessage('Material Usage Color Plate # kept.');
  }

  function usePendingProductionColorPlate() {
    if (!pendingJobSelection) return;

    if (pendingJobSelection.mode === 'reassignment') {
      commitProductionJobSelection(
        pendingJobSelection.job,
        pendingJobSelection.productionColorPlate,
      );
      return;
    }

    setPendingJobSelection(null);
    updateReport({
      lines: applySharedChipBlendColorPlate(
        report.lines,
        pendingJobSelection.productionColorPlate,
      ),
    });
    setMessage('Production Color Plate # applied to Material Usage.');
  }

  function selectTemporaryLabel() {
    const label = jobSearch.trim();
    if (!label) return;

    setJobSearch(label);
    setJobMenuOpen(false);
    updateReport({
      jobId: null,
      jobNumberSnapshot: null,
      jobNameSnapshot: null,
      unlistedJobName: label,
    });
  }

  function clearJobSelection() {
    setJobSearch('');
    setJobMenuOpen(false);
    updateReport({
      jobId: null,
      jobNumberSnapshot: null,
      jobNameSnapshot: null,
      unlistedJobName: '',
    });
  }

  function validateReport(): string | null {
    if (!report.jobId && !report.unlistedJobName.trim()) {
      return 'Select a Production job or confirm a temporary job label.';
    }
    if (!report.reportDate) return 'A report date is required.';
    return null;
  }

  async function handleSave() {
    const validationError = validateReport();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const id = await saveMaterialUsageReport(report, getEditorName());
      initialSnapshotRef.current = serializeReport({ ...report, id });
      setMessage('Material usage saved.');
      await onSaved(id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save material usage.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!report.id) return;
    if (!window.confirm('Delete this material usage report? This cannot be undone.')) return;

    try {
      setDeleting(true);
      setError(null);
      setMessage(null);
      await deleteMaterialUsageReport(report.id, getEditorName());
      await onDeleted();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete material usage.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <main className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading material report...</main>;
  }

  return (
    <main className="min-w-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-[1500px] p-5">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{report.id ? 'Material Usage Report' : 'New Material Usage Report'}</h2>
              {isDirty ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Unsaved</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">Record materials used for a job or production activity.</p>
          </div>

          <div className="flex items-center gap-2">
            {report.id ? (
              <button type="button" onClick={() => void handleDelete()} disabled={deleting || saving} className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
            <button type="button" onClick={() => void handleSave()} disabled={saving || deleting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Report'}
            </button>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 gap-4 border-b border-slate-200 p-5 md:grid-cols-2 lg:grid-cols-4">
            <div ref={jobSelectorRef} className="relative md:col-span-2">
              <label htmlFor="material-usage-job" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Job</label>
              <div className="relative flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                  <input id="material-usage-job" value={jobSearch} onChange={handleJobSearchChange} onFocus={() => setJobMenuOpen(true)} onKeyDown={(event) => {
                    if (event.key === 'Escape') setJobMenuOpen(false);
                    if (event.key === 'Enter' && temporaryLabel) {
                      event.preventDefault();
                      selectTemporaryLabel();
                    }
                  }} autoComplete="off" placeholder="Search Production jobs or type a job name" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                  <button type="button" onClick={() => setJobMenuOpen((current) => !current)} aria-label="Open job options" className="absolute right-0 top-0 flex h-full w-9 items-center justify-center text-slate-500 hover:text-slate-900"><ChevronDownIcon /></button>
                </div>
                {jobSearch ? <button type="button" onClick={clearJobSelection} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Clear</button> : null}
              </div>

              {jobMenuOpen ? (
                <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Production Pipeline</div>
                  <div className="max-h-72 overflow-y-auto">
                    {filteredJobs.length > 0 ? filteredJobs.map((job) => {
                      const selected = report.jobId === job.id;
                      return (
                        <button type="button" key={job.id} onClick={() => selectProductionJob(job)} className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 ${selected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                          <span className="mt-0.5 shrink-0 text-slate-400"><LinkIcon /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold text-slate-900">{formatProductionJobOption(job)}</span><ProductionStatusBadge status={job.production_status as import('../production/types').ProductionStatus} /></span>
                            {job.customer ? <span className="mt-0.5 block truncate text-xs text-slate-500">{job.customer}</span> : null}
                          </span>
                        </button>
                      );
                    }) : <div className="px-3 py-4 text-sm text-slate-500">No Production jobs match this search.</div>}
                  </div>
                  {temporaryLabel ? (
                    <div className="border-t border-slate-200 bg-slate-50 p-2">
                      <button type="button" onClick={selectTemporaryLabel} className="flex w-full items-start gap-3 rounded px-3 py-2.5 text-left text-slate-700 hover:bg-white hover:text-slate-950">
                        <span className="mt-0.5 shrink-0 text-slate-500"><TemporaryIcon /></span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Use job name</span>
                          <span className="mt-0.5 block truncate text-sm font-semibold">{temporaryLabel}</span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {report.jobId ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <JobTag
                    label={report.jobNameSnapshot?.trim() || report.jobNumberSnapshot?.trim() || 'Production Job'}
                    onClick={() => openProductionJob(report.jobId!)}
                    title={`Open Job ${report.jobNumberSnapshot?.trim() || 'details'} in Production`}
                  />
                  {jobs.find((job) => job.id === report.jobId) ? <ProductionStatusBadge status={jobs.find((job) => job.id === report.jobId)!.production_status as import('../production/types').ProductionStatus} /> : null}
                  {report.id ? (
                    <button type="button" onClick={() => void checkProductionDefaults()} className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
                      View Job Details
                    </button>
                  ) : null}
                </div>
              ) : report.unlistedJobName ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  <span aria-hidden="true">ⓘ </span>This report has not been linked to a Production Job yet.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Select a Production job, or type a label and confirm the temporary option.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="material-usage-date" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Date</label>
              <input id="material-usage-date" type="date" value={report.reportDate} onChange={(event) => updateReport({ reportDate: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            </div>

            <div>
              <label htmlFor="material-usage-work-order" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Work Order #</label>
              <input id="material-usage-work-order" value={report.workOrder} onChange={(event) => updateReport({ workOrder: event.target.value })} placeholder="Work Order #" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="material-usage-terrazzo-type" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Terrazzo Type</label>
              <input id="material-usage-terrazzo-type" value={report.terrazzoType} onChange={(event) => updateReport({ terrazzoType: event.target.value })} placeholder="For example: epoxy, precast, cementitious" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="material-usage-notes" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Report Notes</label>
              <textarea id="material-usage-notes" value={report.notes} onChange={(event) => updateReport({ notes: event.target.value })} rows={3} placeholder="Optional report-level notes" className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Materials</h3>
              <p className="mt-0.5 text-xs text-slate-500">Blank lines are ignored when the report is saved.</p>
            </div>
            <button type="button" onClick={addLine} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Add Line</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="w-12 border-b border-slate-200 px-3 py-2 text-center">#</th>
                  <th className="min-w-36 border-b border-slate-200 px-2 py-2">Type</th>
                  <th className="min-w-40 border-b border-slate-200 px-2 py-2">Manufacturer</th>
                  <th className="min-w-52 border-b border-slate-200 px-2 py-2">Material</th>
                  <th className="w-28 border-b border-slate-200 px-2 py-2">Quantity</th>
                  <th className="w-32 border-b border-slate-200 px-2 py-2">Unit</th>
                  <th className="w-40 border-b border-slate-200 px-2 py-2">
                    <span className="block">Color Plate #</span>
                    <span className="mt-0.5 block text-[9px] font-semibold normal-case tracking-normal text-slate-400">Chip Blend only</span>
                  </th>
                  <th className="min-w-56 border-b border-slate-200 px-2 py-2">Notes</th>
                  <th className="sticky right-0 z-10 w-24 min-w-24 border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {report.lines.map((line, index) => (
                  <tr key={line.id ?? `material-line-${index}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2 text-center text-xs text-slate-400">{index + 1}</td>
                    <td className="px-2 py-2"><input value={line.materialType} onChange={(event) => updateMaterialType(index, event.target.value)} onBlur={(event) => finalizeMaterialType(index, event.target.value)} list="material-type-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.manufacturer} onChange={(event) => updateLine(index, { manufacturer: event.target.value })} list="manufacturer-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.materialName} onChange={(event) => updateLine(index, { materialName: event.target.value })} list="material-name-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input type="number" min="0" step="0.001" value={line.quantity ?? ''} onChange={(event) => updateLine(index, { quantity: event.target.value === '' ? null : Number(event.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value })} list="unit-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2">
                      {isChipBlendMaterialType(line.materialType) ? (
                        <input
                          value={line.plate}
                          onChange={(event) => updateReport({
                            lines: applySharedChipBlendColorPlate(
                              report.lines,
                              event.target.value,
                            ),
                          })}
                          placeholder="Color Plate #"
                          aria-label={`Color Plate # for material line ${index + 1}`}
                          className="w-full rounded border border-blue-200 bg-blue-50/60 px-2 py-1.5 text-sm outline-none placeholder:text-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                        />
                      ) : (
                        <span className="flex h-[34px] items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-400" title="Color Plate # applies only to Chip Blend">
                          Not applicable
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2"><input value={line.notes} onChange={(event) => updateLine(index, { notes: event.target.value })} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-2 py-2 text-right">
                      <button type="button" onClick={() => removeLine(index)} className="inline-flex h-8 items-center justify-center rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-700">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={() => void handleSave()} disabled={saving || deleting} className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save Report'}</button>
          </div>
        </section>
      </div>

      <datalist id="material-type-suggestions">{suggestions.materialTypes.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="manufacturer-suggestions">{suggestions.manufacturers.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="material-name-suggestions">{suggestions.materialNames.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="unit-suggestions">{suggestions.units.map((value) => <option key={value} value={value} />)}</datalist>

      {pendingJobSelection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4" role="presentation">
          <section className="w-full max-w-lg rounded-lg border border-slate-300 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="material-usage-color-plate-conflict-title">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="material-usage-color-plate-conflict-title" className="text-base font-semibold text-slate-950">Color Plate # conflict</h2>
              <p className="mt-1 text-sm text-slate-600">
                {pendingJobSelection.mode === 'reassignment'
                  ? `${formatProductionJobOption(pendingJobSelection.job)} uses a different Color Plate # than this report. Choose a value before changing the Job.`
                  : `${formatProductionJobOption(pendingJobSelection.job)} currently uses a different Color Plate # than this historical report.`}
              </p>
            </div>
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Material Usage</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{pendingJobSelection.reportColorPlate}</div>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Production</div>
                <div className="mt-1 text-sm font-semibold text-blue-950">{pendingJobSelection.productionColorPlate}</div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={cancelPendingJobSelection} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{pendingJobSelection.mode === 'reassignment' ? 'Cancel Job Change' : 'Cancel'}</button>
              <button type="button" onClick={keepPendingMaterialUsageColorPlate} className="rounded border border-slate-400 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">Keep Material Usage</button>
              <button type="button" onClick={usePendingProductionColorPlate} className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">Use Production</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
