'use client';

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  deleteMaterialUsageReport,
  getMaterialUsageSuggestions,
  getProductionJobOptions,
  saveMaterialUsageReport,
} from './actions';

import {
  type MaterialUsageLine,
  type MaterialUsageReport,
  type MaterialUsageSuggestions,
  type ProductionJobOption,
} from './types';

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
  plates: [],
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
    return [report.jobNumberSnapshot, report.jobNameSnapshot]
      .filter(Boolean)
      .join(' — ');
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

  const currentSnapshot = useMemo(() => serializeReport(report), [report]);
  const isDirty = currentSnapshot !== initialSnapshotRef.current;
  const normalizedJobSearch = jobSearch.trim().toLowerCase();

  const filteredJobs = useMemo(() => {
    if (!normalizedJobSearch) return jobs.slice(0, 15);

    return jobs
      .filter((job) =>
        [job.jobNumber, job.name, job.customer]
          .join(' ')
          .toLowerCase()
          .includes(normalizedJobSearch),
      )
      .slice(0, 15);
  }, [jobs, normalizedJobSearch]);

  const temporaryLabel = !report.jobId && jobSearch.trim() ? jobSearch.trim() : '';

  useEffect(() => {
    let active = true;

    async function loadReferenceData() {
      try {
        const [jobOptions, usageSuggestions] = await Promise.all([
          getProductionJobOptions(),
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
    updateReport({
      jobId: null,
      jobNumberSnapshot: null,
      jobNameSnapshot: null,
      unlistedJobName: '',
    });
  }

  function selectProductionJob(job: ProductionJobOption) {
    setJobSearch([job.jobNumber, job.name].filter(Boolean).join(' — '));
    setJobMenuOpen(false);
    updateReport({
      jobId: job.id,
      jobNumberSnapshot: job.jobNumber || null,
      jobNameSnapshot: job.name || null,
      unlistedJobName: '',
    });
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
                  }} autoComplete="off" placeholder="Search Production jobs or type a temporary label" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                  <button type="button" onClick={() => setJobMenuOpen((current) => !current)} aria-label="Open job options" className="absolute right-0 top-0 flex h-full w-9 items-center justify-center text-slate-500 hover:text-slate-900"><ChevronDownIcon /></button>
                </div>
                {jobSearch ? <button type="button" onClick={clearJobSelection} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Clear</button> : null}
              </div>

              {jobMenuOpen ? (
                <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Production Queue</div>
                  <div className="max-h-72 overflow-y-auto">
                    {filteredJobs.length > 0 ? filteredJobs.map((job) => {
                      const selected = report.jobId === job.id;
                      return (
                        <button type="button" key={job.id} onClick={() => selectProductionJob(job)} className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 ${selected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                          <span className="mt-0.5 shrink-0 text-slate-400"><LinkIcon /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">{job.jobNumber ? `${job.jobNumber} — ` : ''}{job.name || 'Untitled Production Job'}</span>
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
                          <span className="block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Use temporary job label</span>
                          <span className="mt-0.5 block truncate text-sm font-semibold">{temporaryLabel}</span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-1 text-xs text-slate-500">
                {report.jobId ? 'Linked to the canonical Production job.' : report.unlistedJobName ? `Temporary label: ${report.unlistedJobName}` : 'Select a Production job, or type a label and confirm the temporary option.'}
              </p>
            </div>

            <div>
              <label htmlFor="material-usage-date" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Date</label>
              <input id="material-usage-date" type="date" value={report.reportDate} onChange={(event) => updateReport({ reportDate: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            </div>

            <div>
              <label htmlFor="material-usage-work-order" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-600">Work Order</label>
              <input id="material-usage-work-order" value={report.workOrder} onChange={(event) => updateReport({ workOrder: event.target.value })} placeholder="Optional" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
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
                  <th className="w-32 border-b border-slate-200 px-2 py-2">Plate</th>
                  <th className="min-w-56 border-b border-slate-200 px-2 py-2">Notes</th>
                  <th className="sticky right-0 z-10 w-24 min-w-24 border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {report.lines.map((line, index) => (
                  <tr key={line.id ?? `material-line-${index}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2 text-center text-xs text-slate-400">{index + 1}</td>
                    <td className="px-2 py-2"><input value={line.materialType} onChange={(event) => updateLine(index, { materialType: event.target.value })} list="material-type-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.manufacturer} onChange={(event) => updateLine(index, { manufacturer: event.target.value })} list="manufacturer-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.materialName} onChange={(event) => updateLine(index, { materialName: event.target.value })} list="material-name-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input type="number" min="0" step="0.001" value={line.quantity ?? ''} onChange={(event) => updateLine(index, { quantity: event.target.value === '' ? null : Number(event.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value })} list="unit-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
                    <td className="px-2 py-2"><input value={line.plate} onChange={(event) => updateLine(index, { plate: event.target.value })} list="plate-suggestions" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200" /></td>
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
      <datalist id="plate-suggestions">{suggestions.plates.map((value) => <option key={value} value={value} />)}</datalist>
    </main>
  );
}