'use client';

import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProductionJobUpdate } from '../jobs';
import { getJobReadiness, planningIssueLabels, type PlanningIssueField } from '../readiness';
import type { StagedSchedules } from '../schedule-staging';
import type { ProductionJob } from '../types';
import { productionValuesEqual } from '../update-normalization';

type IssueFilter = 'all' | 'schedule' | 'labor' | 'details';
type OrdinaryDraft = { job_number: string; customer: string; requested_delivery_date: string; estimated_man_hours: string };
type ScheduleDraft = { start: string; end: string };

type Props = {
  jobs: ProductionJob[];
  stagedSchedules: StagedSchedules;
  onClose: () => void;
  onUpdateJob: (jobId: string, changes: ProductionJobUpdate) => Promise<ProductionJob>;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  onOpenInspector: (job: ProductionJob, focus?: string) => void;
};

const fieldClass = 'mt-1 h-9 w-full rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

function ordinaryDraft(job: ProductionJob): OrdinaryDraft {
  return {
    job_number: job.job_number ?? '',
    customer: job.customer ?? '',
    requested_delivery_date: job.requested_delivery_date ?? '',
    estimated_man_hours: job.estimated_man_hours === null ? '' : String(job.estimated_man_hours),
  };
}

function effectiveJob(job: ProductionJob, stagedSchedules: StagedSchedules) {
  const staged = stagedSchedules[job.id];
  return staged ? { ...job, planned_start: staged.proposed_planned_start, planned_end: staged.proposed_planned_end } : job;
}

function matchesFilter(fields: PlanningIssueField[], filter: IssueFilter) {
  if (filter === 'all') return true;
  if (filter === 'schedule') return fields.includes('planned_start') || fields.includes('planned_end');
  if (filter === 'labor') return fields.includes('estimated_man_hours');
  return fields.some((field) => field === 'job_number' || field === 'customer' || field === 'requested_delivery_date');
}

export default function PlanningIssuesPanel({ jobs, stagedSchedules, onClose, onUpdateJob, onStageSchedule, onOpenInspector }: Props) {
  const [filter, setFilter] = useState<IssueFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OrdinaryDraft>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const activeJobs = useMemo(() => jobs.filter((job) => !['complete', 'cancelled'].includes(job.production_status)), [jobs]);
  const issueRows = useMemo(() => activeJobs.map((job) => {
    const effective = effectiveJob(job, stagedSchedules);
    return { job, effective, readiness: getJobReadiness(effective) };
  }).filter((row) => row.readiness.state !== 'ready'), [activeJobs, stagedSchedules]);
  const filteredRows = useMemo(() => issueRows.filter((row) => matchesFilter(row.readiness.missingFields, filter)), [filter, issueRows]);

  const dirtyOrdinaryIds = useMemo(() => Object.entries(drafts).filter(([jobId, draft]) => {
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) return false;
    const hours = draft.estimated_man_hours === '' ? null : Number(draft.estimated_man_hours);
    return !productionValuesEqual('job_number', job.job_number, draft.job_number || null)
      || !productionValuesEqual('customer', job.customer, draft.customer || null)
      || !productionValuesEqual('requested_delivery_date', job.requested_delivery_date, draft.requested_delivery_date || null)
      || !productionValuesEqual('estimated_man_hours', job.estimated_man_hours, hours);
  }).map(([jobId]) => jobId), [drafts, jobs]);
  const dirtyScheduleIds = useMemo(() => Object.entries(scheduleDrafts).filter(([jobId, draft]) => {
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job || stagedSchedules[jobId]) return false;
    return draft.start !== (job.planned_start ?? '') || draft.end !== (job.planned_end ?? '');
  }).map(([jobId]) => jobId), [jobs, scheduleDrafts, stagedSchedules]);
  const dirtyCount = new Set([...dirtyOrdinaryIds, ...dirtyScheduleIds]).size;

  const requestClose = useCallback(() => {
    if (dirtyCount > 0 && !window.confirm(`Discard unsaved planning drafts for ${dirtyCount} ${dirtyCount === 1 ? 'job' : 'jobs'} and close?`)) return;
    onClose();
  }, [dirtyCount, onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button,input')].filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [requestClose]);

  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  function expand(job: ProductionJob) {
    setExpandedId((current) => current === job.id ? null : job.id);
    setDrafts((current) => current[job.id] ? current : { ...current, [job.id]: ordinaryDraft(job) });
    setScheduleDrafts((current) => current[job.id] ? current : { ...current, [job.id]: { start: job.planned_start ?? '', end: job.planned_end ?? '' } });
  }

  function updateDraft(job: ProductionJob, field: keyof OrdinaryDraft, value: string) {
    setDrafts((current) => ({ ...current, [job.id]: { ...(current[job.id] ?? ordinaryDraft(job)), [field]: value } }));
    setMessages((current) => ({ ...current, [job.id]: '' }));
  }

  function discardJob(job: ProductionJob) {
    setDrafts((current) => ({ ...current, [job.id]: ordinaryDraft(job) }));
    setScheduleDrafts((current) => ({ ...current, [job.id]: { start: job.planned_start ?? '', end: job.planned_end ?? '' } }));
    setErrors((current) => ({ ...current, [job.id]: '' }));
    setMessages((current) => ({ ...current, [job.id]: '' }));
  }

  async function saveOrdinary(job: ProductionJob) {
    const draft = drafts[job.id] ?? ordinaryDraft(job);
    const hours = draft.estimated_man_hours === '' ? null : Number(draft.estimated_man_hours);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      setErrors((current) => ({ ...current, [job.id]: 'Enter a valid non-negative labor estimate, or leave it blank.' }));
      return;
    }
    const candidate: ProductionJobUpdate = {
      job_number: draft.job_number.trim() || null,
      customer: draft.customer.trim() || null,
      requested_delivery_date: draft.requested_delivery_date || null,
      estimated_man_hours: hours,
    };
    const changes = Object.fromEntries(Object.entries(candidate).filter(([field, value]) => !productionValuesEqual(field as keyof ProductionJobUpdate, job[field as keyof ProductionJob], value))) as ProductionJobUpdate;
    if (!Object.keys(changes).length) return;
    setSavingId(job.id); setErrors((current) => ({ ...current, [job.id]: '' })); setMessages((current) => ({ ...current, [job.id]: '' }));
    try {
      const updated = await onUpdateJob(job.id, changes);
      setDrafts((current) => ({ ...current, [job.id]: ordinaryDraft(updated) }));
      setMessages((current) => ({ ...current, [job.id]: 'Planning details saved.' }));
    } catch (error) {
      setErrors((current) => ({ ...current, [job.id]: error instanceof Error ? error.message : 'Unable to save planning details.' }));
    } finally {
      setSavingId(null);
    }
  }

  function updateSchedule(job: ProductionJob, field: keyof ScheduleDraft, value: string) {
    setScheduleDrafts((current) => ({ ...current, [job.id]: { ...(current[job.id] ?? { start: job.planned_start ?? '', end: job.planned_end ?? '' }), [field]: value } }));
  }

  function stageDates(job: ProductionJob) {
    const draft = scheduleDrafts[job.id];
    if (!draft?.start || !draft.end) return;
    if (draft.end < draft.start) {
      setErrors((current) => ({ ...current, [job.id]: 'Planned finish must be on or after planned start.' }));
      return;
    }
    onStageSchedule(job, draft.start, draft.end);
    setErrors((current) => ({ ...current, [job.id]: '' }));
    setMessages((current) => ({ ...current, [job.id]: 'Schedule changes staged for review.' }));
  }

  const filters: Array<{ value: IssueFilter; label: string }> = [
    { value: 'all', label: `All ${issueRows.length}` },
    { value: 'schedule', label: 'Missing schedule' },
    { value: 'labor', label: 'Missing labor' },
    { value: 'details', label: 'Missing details' },
  ];

  return <div className="fixed inset-0 z-[70] bg-slate-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="planning-issues-title" onMouseDown={(event) => event.stopPropagation()} className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-slate-300 bg-slate-50 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-300 bg-white px-5 py-4">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Production planning</div><h2 id="planning-issues-title" className="mt-1 text-xl font-bold text-slate-950">Planning Issues</h2><p className="mt-1 text-sm text-slate-600">Resolve missing details and stage schedule dates without leaving the Production workspace.</p></div>
        <button ref={closeRef} type="button" onClick={requestClose} aria-label="Close Planning Issues" className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-700"><X className="h-4 w-4" aria-hidden="true" /></button>
      </header>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-5 py-3" role="group" aria-label="Filter planning issues">
        {filters.map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)} className={`h-8 border px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] focus-visible:ring-2 focus-visible:ring-blue-700 ${filter === option.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{option.label}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filteredRows.map(({ job, readiness }) => {
            const expanded = expandedId === job.id;
            const draft = drafts[job.id] ?? ordinaryDraft(job);
            const scheduleDraft = scheduleDrafts[job.id] ?? { start: job.planned_start ?? '', end: job.planned_end ?? '' };
            const missing = readiness.missingFields;
            const ordinaryDirty = dirtyOrdinaryIds.includes(job.id);
            const scheduleDirty = dirtyScheduleIds.includes(job.id);
            return <section key={job.id} className="border border-slate-300 bg-white">
              <div className="flex items-center gap-3 p-3">
                <button type="button" onClick={() => expand(job)} aria-expanded={expanded} aria-controls={`planning-issue-${job.id}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-700">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="sr-only">{expanded ? 'Collapse' : 'Fix'} {job.name}</span></button>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2"><span className="truncate text-sm font-bold text-slate-950">{job.name}</span><span className="text-xs font-semibold text-slate-500">{job.job_number || 'Job number missing'}</span></div><div className="mt-0.5 truncate text-xs text-slate-600">{job.customer || 'Customer missing'} · Missing: {missing.map((field) => planningIssueLabels[field]).join(', ')}</div></div>
                <span className="shrink-0 bg-amber-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-900">{readiness.label}</span>
                <button type="button" onClick={() => expand(job)} className="h-8 shrink-0 border border-slate-300 bg-white px-2.5 text-[10px] font-bold uppercase text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-700">{expanded ? 'Close' : 'Fix'}</button>
                <button type="button" onClick={() => onOpenInspector(job, missing.includes('planned_start') || missing.includes('planned_end') ? 'planned-dates' : missing.includes('estimated_man_hours') ? 'labor' : undefined)} className="h-8 shrink-0 border border-slate-300 bg-white px-2.5 text-[10px] font-bold uppercase text-blue-800 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-700">Open Inspector</button>
              </div>
              {expanded && <div id={`planning-issue-${job.id}`} className="border-t border-slate-200 bg-slate-50 p-3">
                {errors[job.id] && <div role="alert" className="mb-3 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{errors[job.id]}</div>}
                {messages[job.id] && <div role="status" className="mb-3 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{messages[job.id]}</div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {missing.includes('job_number') && <label className="text-xs font-bold text-slate-700">Job number<input value={draft.job_number} onChange={(event) => updateDraft(job, 'job_number', event.target.value)} className={fieldClass} /></label>}
                  {missing.includes('customer') && <label className="text-xs font-bold text-slate-700">Customer<input value={draft.customer} onChange={(event) => updateDraft(job, 'customer', event.target.value)} className={fieldClass} /></label>}
                  {missing.includes('requested_delivery_date') && <label className="text-xs font-bold text-slate-700">Requested delivery<input type="date" value={draft.requested_delivery_date} onChange={(event) => updateDraft(job, 'requested_delivery_date', event.target.value)} className={fieldClass} /></label>}
                  {missing.includes('estimated_man_hours') && <label className="text-xs font-bold text-slate-700">Labor estimate<input type="number" min="0" step="0.25" value={draft.estimated_man_hours} onChange={(event) => updateDraft(job, 'estimated_man_hours', event.target.value)} className={fieldClass} /></label>}
                  {missing.includes('planned_start') && <label className="text-xs font-bold text-slate-700">Planned start<input type="date" value={scheduleDraft.start} onChange={(event) => updateSchedule(job, 'start', event.target.value)} onBlur={() => stageDates(job)} className={fieldClass} /></label>}
                  {missing.includes('planned_end') && <label className="text-xs font-bold text-slate-700">Planned finish<input type="date" min={scheduleDraft.start || undefined} value={scheduleDraft.end} onChange={(event) => updateSchedule(job, 'end', event.target.value)} onBlur={() => stageDates(job)} className={fieldClass} /></label>}
                </div>
                {(ordinaryDirty || scheduleDirty) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-3"><span className="text-xs font-bold text-amber-800">{scheduleDirty ? 'Complete both planned dates to stage the schedule. ' : ''}{ordinaryDirty ? 'Ordinary details are unsaved.' : ''}</span><div className="flex gap-2"><button type="button" onClick={() => discardJob(job)} disabled={savingId === job.id} className="h-8 border border-slate-400 bg-white px-3 text-[10px] font-bold uppercase text-slate-700 disabled:opacity-50">Discard</button>{ordinaryDirty && <button type="button" onClick={() => void saveOrdinary(job)} disabled={savingId === job.id} className="h-8 border border-slate-900 bg-slate-900 px-3 text-[10px] font-bold uppercase text-white disabled:opacity-50">{savingId === job.id ? 'Saving…' : 'Save details'}</button>}</div></div>}
                {stagedSchedules[job.id] && <div className="mt-3 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Schedule changes are staged and await the global Review / Save All workflow.</div>}
              </div>}
            </section>;
          })}
          {filteredRows.length === 0 && <div className="border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">No jobs match this issue filter.</div>}
        </div>
      </div>
      {dirtyCount > 0 && <div className="border-t border-amber-300 bg-amber-50 px-5 py-3 text-xs font-bold text-amber-900">{dirtyCount} {dirtyCount === 1 ? 'job has' : 'jobs have'} unsaved planning drafts.</div>}
    </aside>
  </div>;
}
