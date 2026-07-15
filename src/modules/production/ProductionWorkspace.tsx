'use client';

import { ListFilter, RotateCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import JobFormsPanel from './components/JobFormsPanel';
import ProductionGantt from './components/ProductionGantt';
import ProductionJobInspector from './components/ProductionJobInspector';
import ProductionQueue from './components/ProductionQueue';
import ProductionTable from './components/ProductionTable';

import {
  createProductionJob,
  loadJobAttachmentCounts,
  loadProductionJob,
  loadProductionJobs,
  recordProductionScheduleAudit,
  updateProductionJob,
  updateProductionJobSchedule,
} from './jobs';

import type { ProductionJobUpdate } from './jobs';
import type {
  NewProductionJob,
  ProductionJob,
  ProductionStatus,
} from './types';
import { PRODUCTION_JOB_FOCUS_STORAGE_KEY } from './job-options';
import { inclusiveCalendarDays, laborIntensity } from './schedule';
import { getJobReadiness } from './readiness';
import { productionApprovalDecision, PRODUCTION_APPROVAL_WINDOW_MS } from './approval';

type ProductionView = 'queue' | 'spreadsheet' | 'timeline';
type ScheduleFilter = 'scheduled' | 'unscheduled';
export type StagedSchedule = {
  jobId: string;
  persistedStart: string | null;
  persistedEnd: string | null;
  proposedStart: string;
  proposedEnd: string;
};

const statusOptions: Array<{ value: ProductionStatus; label: string }> = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'on_deck', label: 'On Deck' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

const APPROVAL_PASSWORD = process.env.NEXT_PUBLIC_PRODUCTION_APPROVAL_PASSWORD?.trim();
const APPROVAL_EXPIRES_KEY = 'tenops.productionApprovalExpiresAt';
const CHANGED_BY_KEY = 'tenops.productionChangedByName';

function isScheduled(job: ProductionJob) {
  return Boolean(job.planned_start && job.planned_end);
}

function sortJobs(jobs: ProductionJob[]) {
  return [...jobs].sort((first, second) => {
    if (!first.planned_start && !second.planned_start) {
      return first.name.localeCompare(second.name);
    }
    if (!first.planned_start) return 1;
    if (!second.planned_start) return -1;
    return first.planned_start.localeCompare(second.planned_start);
  });
}

export default function ProductionWorkspace() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [selectedFormsJob, setSelectedFormsJob] = useState<ProductionJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [activeView, setActiveViewState] = useState<ProductionView>(() => {
    if (typeof window === 'undefined') return 'queue';
    const saved = window.sessionStorage.getItem('tenops.productionView');
    return saved === 'queue' || saved === 'spreadsheet' || saved === 'timeline' ? saved : 'queue';
  });
  const [selectedJobId, setSelectedJobId] = useState<string|null>(null);
  const [inspectorFocus, setInspectorFocus] = useState<string|undefined>();
  const setActiveView = (view:ProductionView) => { setActiveViewState(view); window.sessionStorage.setItem('tenops.productionView',view); };
  const [scheduleFilters, setScheduleFilters] = useState<Set<ScheduleFilter>>(
    () => new Set(),
  );
  const [statusFilters, setStatusFilters] = useState<Set<ProductionStatus>>(
    () => new Set(),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [stagedSchedule, setStagedSchedule] = useState<StagedSchedule | null>(null);
  const [scheduleSaveState, setScheduleSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [changedByName, setChangedByName] = useState(() => typeof window === 'undefined' ? '' : window.sessionStorage.getItem(CHANGED_BY_KEY) ?? '');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [approvalExpiresAt, setApprovalExpiresAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const decision = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
    if (decision.clearStoredExpiration) window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
    return decision.state === 'active' ? decision.expiration : null;
  });
  const [approvalNow, setApprovalNow] = useState(() => Date.now());
  const [auditRetry, setAuditRetry] = useState<{ updatedJob: ProductionJob; changedByName: string; changeNote: string | null } | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const scheduleSaveRef = useRef(false);
  const scheduleActionsRef = useRef<HTMLDivElement | null>(null);
  const scheduleFeedbackRef = useRef<HTMLDivElement | null>(null);
  const approvalDialogRef = useRef<HTMLDivElement | null>(null);
  const approvalInitialRef = useRef<HTMLInputElement | null>(null);
  const inspectorOpenerRef = useRef<HTMLElement | null>(null);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const focusedJobId = window.sessionStorage.getItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY);
      window.sessionStorage.removeItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY);
      const [loadedJobs, loadedCounts, focusedJob] = await Promise.all([
        loadProductionJobs(),
        loadJobAttachmentCounts().catch((error) => {
          console.error('Unable to load Production attachment counts', error);
          return {};
        }),
        focusedJobId ? loadProductionJob(focusedJobId) : Promise.resolve(null),
      ]);

      const jobsWithFocused = focusedJob && !loadedJobs.some((job) => job.id === focusedJob.id)
        ? [...loadedJobs, focusedJob]
        : loadedJobs;
      setJobs(sortJobs(jobsWithFocused));
      setAttachmentCounts(loadedCounts);
      if (focusedJob) {
        setFocusedJobId(focusedJob.id);
        setSearch(focusedJob.job_number || focusedJob.name);
        setSelectedJobId(focusedJob.id);
        setActiveView('queue');
      }
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load active jobs.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        isFilterOpen &&
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isFilterOpen]);

  useEffect(() => {
    if (!approvalDialogOpen) return;
    const timer = window.setInterval(() => setApprovalNow(Date.now()), 1000);
    requestAnimationFrame(() => approvalInitialRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setApprovalDialogOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !approvalDialogRef.current) return;
      const focusable = [...approvalDialogRef.current.querySelectorAll<HTMLElement>('input, textarea, button:not([disabled])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [approvalDialogOpen]);

  const approvalActive = Boolean(approvalExpiresAt && approvalExpiresAt > approvalNow);
  const approvalSecondsRemaining = approvalActive && approvalExpiresAt
    ? Math.max(0, Math.ceil((approvalExpiresAt - approvalNow) / 1000))
    : 0;

  useEffect(() => {
    if (!stagedSchedule) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const handleDocumentClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!link || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Discard the unsaved Production schedule change and leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      setStagedSchedule(null);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [stagedSchedule]);

  const stageSchedule = useCallback((job: ProductionJob, start: string, end: string) => {
    setScheduleMessage('');
    setScheduleSaveState('idle');
    setStagedSchedule((current) => {
      if (current && current.jobId !== job.id) {
        window.setTimeout(() => setScheduleMessage(`Save or discard the pending schedule change for ${jobs.find((item) => item.id === current.jobId)?.name ?? 'the current job'} before adjusting another job.`), 0);
        return current;
      }
      const persistedStart = current?.persistedStart ?? job.planned_start;
      const persistedEnd = current?.persistedEnd ?? job.planned_end;
      if (start === persistedStart && end === persistedEnd) return null;
      return { jobId: job.id, persistedStart, persistedEnd, proposedStart: start, proposedEnd: end };
    });
  }, [jobs]);

  const discardStagedSchedule = useCallback(() => {
    if (auditRetry) return;
    setStagedSchedule(null);
    setScheduleSaveState('idle');
    setScheduleMessage('Schedule change discarded.');
    requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
  }, [auditRetry]);

  const openApprovalDialog = useCallback(() => {
    const decision = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
    if (decision.clearStoredExpiration) window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
    if (decision.state === 'missing_configuration') {
      setApprovalExpiresAt(null);
      setScheduleSaveState('error');
      setScheduleMessage('Production approval is not configured. Save is unavailable.');
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
      return;
    }
    setApprovalExpiresAt(decision.state === 'active' ? decision.expiration : null);
    setApprovalError('');
    setApprovalPassword('');
    setChangeNote('');
    setApprovalNow(Date.now());
    setApprovalDialogOpen(true);
  }, []);

  const saveStagedSchedule = useCallback(async (audit: { changedByName: string; changeNote: string | null }) => {
    if (!stagedSchedule || scheduleSaveRef.current) return;
    scheduleSaveRef.current = true;
    setScheduleSaveState('saving');
    setScheduleMessage('');
    try {
      const approval = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
      if (approval.clearStoredExpiration) window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
      if (approval.state !== 'active') {
        setApprovalExpiresAt(null);
        setScheduleSaveState('error');
        setScheduleMessage(approval.state === 'missing_configuration'
          ? 'Production approval is not configured. Save is unavailable.'
          : 'Production approval expired. Confirm the schedule change again.');
        return;
      }
      const updated = await updateProductionJobSchedule(
        stagedSchedule.jobId,
        stagedSchedule.proposedStart,
        stagedSchedule.proposedEnd,
      );
      try {
        await recordProductionScheduleAudit({
          jobId: stagedSchedule.jobId,
          jobName: updated.name,
          changedByName: audit.changedByName,
          changeNote: audit.changeNote,
          oldStart: stagedSchedule.persistedStart,
          oldEnd: stagedSchedule.persistedEnd,
          newStart: stagedSchedule.proposedStart,
          newEnd: stagedSchedule.proposedEnd,
        });
      } catch (auditError) {
        const details = auditError as { message?: string; details?: string; hint?: string; code?: string };
        console.error('Production schedule audit insert failed', { jobId: stagedSchedule.jobId, message: details.message, details: details.details, hint: details.hint, code: details.code });
        setAuditRetry({ updatedJob: updated, ...audit });
        setScheduleSaveState('error');
        setScheduleMessage('The schedule dates were saved, but the required audit record failed. Retry audit recording; do not repeat the date update.');
        return;
      }
      setJobs((current) => sortJobs(current.map((job) => job.id === updated.id ? updated : job)));
      setStagedSchedule(null);
      setScheduleSaveState('saved');
      setScheduleMessage('Schedule change saved and audit recorded.');
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
    } catch (error) {
      const details = error as { message?: string; details?: string; hint?: string; code?: string };
      console.error('Production schedule save failed', {
        jobId: stagedSchedule.jobId,
        message: details.message,
        details: details.details,
        hint: details.hint,
        code: details.code,
      });
      setScheduleSaveState('error');
      setScheduleMessage(details.message || 'Unable to save the proposed schedule. Retry or discard it.');
    } finally {
      scheduleSaveRef.current = false;
    }
  }, [stagedSchedule]);

  const retryScheduleAudit = useCallback(async () => {
    if (!stagedSchedule || !auditRetry || scheduleSaveRef.current) return;
    scheduleSaveRef.current = true;
    setScheduleSaveState('saving');
    setScheduleMessage('');
    try {
      await recordProductionScheduleAudit({
        jobId: stagedSchedule.jobId,
        jobName: auditRetry.updatedJob.name,
        changedByName: auditRetry.changedByName,
        changeNote: auditRetry.changeNote,
        oldStart: stagedSchedule.persistedStart,
        oldEnd: stagedSchedule.persistedEnd,
        newStart: stagedSchedule.proposedStart,
        newEnd: stagedSchedule.proposedEnd,
      });
      setJobs((current) => sortJobs(current.map((job) => job.id === auditRetry.updatedJob.id ? auditRetry.updatedJob : job)));
      setAuditRetry(null);
      setStagedSchedule(null);
      setScheduleSaveState('saved');
      setScheduleMessage('Schedule change saved and audit recorded.');
    } catch (error) {
      const details = error as { message?: string; details?: string; hint?: string; code?: string };
      console.error('Production schedule audit retry failed', { jobId: stagedSchedule.jobId, message: details.message, details: details.details, hint: details.hint, code: details.code });
      setScheduleSaveState('error');
      setScheduleMessage('The schedule is saved, but audit recording still failed. Retry audit recording.');
    } finally {
      scheduleSaveRef.current = false;
    }
  }, [auditRetry, stagedSchedule]);

  const confirmApprovedSave = useCallback(() => {
    if (!stagedSchedule || scheduleSaveRef.current) return;
    const name = changedByName.trim();
    if (!name) { setApprovalError('Changed by is required.'); return; }
    const now = Date.now();
    const decision = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), now);
    if (decision.clearStoredExpiration) window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
    if (decision.state === 'missing_configuration') {
      setApprovalExpiresAt(null);
      setApprovalError('Production approval is not configured. Save is unavailable.');
      return;
    }
    if (decision.state !== 'active') {
      window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
      setApprovalExpiresAt(null);
      if (!approvalPassword) { setApprovalError('Approval password is required.'); return; }
      if (approvalPassword !== APPROVAL_PASSWORD) { setApprovalError('Incorrect approval password'); return; }
      const expiration = now + PRODUCTION_APPROVAL_WINDOW_MS;
      window.sessionStorage.setItem(APPROVAL_EXPIRES_KEY, String(expiration));
      setApprovalExpiresAt(expiration);
      setApprovalNow(now);
    }
    window.sessionStorage.setItem(CHANGED_BY_KEY, name);
    setChangedByName(name);
    setApprovalPassword('');
    setApprovalDialogOpen(false);
    void saveStagedSchedule({ changedByName: name, changeNote: changeNote.trim() || null });
  }, [approvalPassword, changeNote, changedByName, saveStagedSchedule, stagedSchedule]);

  useEffect(() => {
    if (!stagedSchedule || approvalDialogOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.confirm('Discard the pending Production schedule change?')) discardStagedSchedule();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [approvalDialogOpen, discardStagedSchedule, stagedSchedule]);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (focusedJobId && job.id !== focusedJobId) return false;
      if (statusFilters.size > 0 && !statusFilters.has(job.production_status)) {
        return false;
      }

      if (scheduleFilters.size > 0) {
        const scheduleKey: ScheduleFilter = isScheduled(job)
          ? 'scheduled'
          : 'unscheduled';
        if (!scheduleFilters.has(scheduleKey)) return false;
      }

      if (!normalizedSearch) return true;

      return [
        job.name,
        job.customer,
        job.job_number,
        job.estimate_number,
        job.work_order_number,
        job.color_plate_number,
        job.remarks,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [focusedJobId, jobs, scheduleFilters, search, statusFilters]);

  const displayedJobs = useMemo(() => filteredJobs.map((job) => (
    stagedSchedule?.jobId === job.id
      ? { ...job, planned_start: stagedSchedule.proposedStart, planned_end: stagedSchedule.proposedEnd }
      : job
  )), [filteredJobs, stagedSchedule]);
  const stagedJob = stagedSchedule ? jobs.find((job) => job.id === stagedSchedule.jobId) ?? null : null;
  const selectedJob = selectedJobId ? jobs.find(job=>job.id===selectedJobId)??null : null;
  const planningCount = jobs.filter(job=>getJobReadiness(job).state!=='ready').length;
  const notScheduledCount = jobs.filter(job=>getJobReadiness(job).state==='not_scheduled').length;
  const selectJob = (job:ProductionJob, focus?:string) => {
    if (document.activeElement instanceof HTMLElement) inspectorOpenerRef.current = document.activeElement;
    setSelectedJobId(job.id);
    setInspectorFocus(focus);
  };
  const closeInspector = () => {
    setSelectedJobId(null);
    setInspectorFocus(undefined);
    requestAnimationFrame(() => inspectorOpenerRef.current?.focus());
  };

  async function handleCreateJob(input: NewProductionJob) {
    const proposedStart = input.planned_start;
    const proposedEnd = input.planned_end;
    const created = await createProductionJob({
      ...input,
      planned_start: null,
      planned_end: null,
    });
    setJobs((current) => sortJobs([...current, created]));
    if (proposedStart && proposedEnd) stageSchedule(created, proposedStart, proposedEnd);
    return created;
  }

  async function handleUpdateJob(jobId: string, changes: ProductionJobUpdate) {
    const original = jobs.find((job) => job.id === jobId);
    if (!original) throw new Error('Production job is no longer available.');

    setJobs((current) => sortJobs(current.map((job) => (
      job.id === jobId ? { ...job, ...changes } : job
    ))));

    try {
      const updated = await updateProductionJob(jobId, changes);
      setJobs((current) =>
        sortJobs(current.map((job) => (job.id === jobId ? updated : job))),
      );
      return updated;
    } catch (error) {
      setJobs((current) => sortJobs(current.map((job) => {
        if (job.id !== jobId) return job;
        const reverted = { ...job };
        for (const key of Object.keys(changes) as Array<keyof ProductionJobUpdate>) {
          (reverted as Record<string, unknown>)[key] = original[key as keyof ProductionJob];
        }
        return reverted;
      })));

      const details = error as { message?: string; details?: string; hint?: string; code?: string };
      console.error('Production job update failed', {
        jobId,
        changedFields: Object.keys(changes),
        message: details.message,
        details: details.details,
        hint: details.hint,
        code: details.code,
      });
      throw error instanceof Error ? error : new Error(details.message || 'Unable to save production job.');
    }
  }

  function toggleScheduleFilter(value: ScheduleFilter) {
    setScheduleFilters((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleStatusFilter(value: ProductionStatus) {
    setStatusFilters((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const activeFilterCount = scheduleFilters.size + statusFilters.size;
  const jobsInQueue = jobs.filter(
    (job) => !['complete', 'cancelled'].includes(job.production_status),
  ).length;
  const unscheduledCount = jobs.filter(
    (job) =>
      !['complete', 'cancelled'].includes(job.production_status) &&
      !isScheduled(job),
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          TenOps
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          Tenarten Operations Control
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Live production visibility from operational handoff through manufacturing and completion.
        </p>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-3 border-b border-slate-300 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Production Pipeline</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use the table to manage the production queue and the Timeline to plan scheduled work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div>
              <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Jobs in Queue</span>
              <span className="ml-2 text-base font-bold text-slate-950">{jobsInQueue}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setScheduleFilters(new Set(['unscheduled']));
                setActiveView('timeline');
              }}
              className="text-left transition hover:text-amber-800"
            >
              <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Unscheduled</span>
              <span className="ml-2 text-base font-bold text-slate-950">
                {unscheduledCount} / {jobsInQueue}
              </span>
            </button>
            <div className="font-semibold text-slate-500">
              Showing {filteredJobs.length}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border border-slate-400 bg-slate-100 p-3 lg:flex-row lg:items-center">
          <div className="flex shrink-0 flex-wrap items-center gap-2"><span id="production-view-label" className="text-sm font-bold text-slate-700">View</span><div role="group" aria-labelledby="production-view-label" className="flex items-center border border-slate-400 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView('queue')}
              className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] ${
                activeView === 'queue'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView('spreadsheet')}
              className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] ${
                activeView === 'spreadsheet'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Table
            </button>
            <button type="button" onClick={()=>setActiveView('timeline')} className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] focus-visible:ring-2 focus-visible:ring-blue-600 ${activeView==='timeline'?'bg-slate-900 text-white':'bg-white text-slate-600 hover:bg-slate-100'}`}>Timeline</button>
          </div>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => { setFocusedJobId(null); setSearch(event.target.value); }}
            placeholder="Search jobs..."
            className="h-9 min-w-0 flex-1 border border-slate-400 bg-white px-3 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
          />

          <div ref={filterRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen((current) => !current)}
              className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold uppercase tracking-[0.07em] transition ${
                activeFilterCount > 0
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ListFilter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-11 z-40 w-72 border border-slate-400 bg-white p-4 shadow-xl">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Schedule</div>
                <div className="mt-2 space-y-2">
                  {(['scheduled', 'unscheduled'] as ScheduleFilter[]).map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={scheduleFilters.has(value)}
                        onChange={() => toggleScheduleFilter(value)}
                      />
                      {value === 'scheduled' ? 'Scheduled' : 'Unscheduled'}
                    </label>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-300 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Production Status</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusFilters.has(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleFilters(new Set());
                    setStatusFilters(new Set());
                  }}
                  disabled={activeFilterCount === 0}
                  className="mt-4 h-9 w-full border border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-700 disabled:opacity-40"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadJobs()}
            disabled={isLoading}
            title="Refresh jobs"
            aria-label="Refresh jobs"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-400 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadError && (
          <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {loadError}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600"><span className="font-bold text-amber-800">{planningCount} jobs are Planning Needed or Not Scheduled</span><button type="button" onClick={()=>setScheduleFilters(new Set(['unscheduled']))} className="font-bold underline focus-visible:ring-2 focus-visible:ring-slate-700">{notScheduledCount} jobs are Not Scheduled</button></div>

        {(stagedSchedule && stagedJob) && (() => {
          const hadSchedule = Boolean(stagedSchedule.persistedStart && stagedSchedule.persistedEnd);
          const before = hadSchedule ? laborIntensity(stagedJob.estimated_man_hours, stagedSchedule.persistedStart!, stagedSchedule.persistedEnd!) : null;
          const after = laborIntensity(stagedJob.estimated_man_hours, stagedSchedule.proposedStart, stagedSchedule.proposedEnd);
          const hours = (value: number | null) => value === null ? 'No labor estimate' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} h/day`;
          return (
            <div ref={scheduleActionsRef} tabIndex={-1} role="status" aria-live="polite" className="mt-4 flex flex-col gap-3 border border-amber-500 bg-amber-50 px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Schedule change pending — {stagedJob.job_number || stagedJob.name}</div>
                <div className="mt-1 text-sm font-bold text-slate-950">{hadSchedule ? `${stagedSchedule.persistedStart} – ${stagedSchedule.persistedEnd}` : 'Not scheduled'} → {stagedSchedule.proposedStart} – {stagedSchedule.proposedEnd}</div>
                <div className="mt-1 text-xs text-slate-600">{hadSchedule ? `${inclusiveCalendarDays(stagedSchedule.persistedStart!, stagedSchedule.persistedEnd!)} days · ${hours(before!.hoursPerScheduledDay)}` : 'No saved production window'} → {inclusiveCalendarDays(stagedSchedule.proposedStart, stagedSchedule.proposedEnd)} days · {hours(after.hoursPerScheduledDay)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={discardStagedSchedule} disabled={scheduleSaveState === 'saving' || Boolean(auditRetry)} title={auditRetry ? 'Audit recording must succeed before this completed date update can be cleared.' : undefined} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase tracking-[0.07em] text-slate-800 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50">Discard</button>
                {auditRetry ? <button type="button" onClick={() => void retryScheduleAudit()} disabled={scheduleSaveState === 'saving'} className="h-9 border border-red-900 bg-red-800 px-4 text-xs font-bold uppercase tracking-[0.07em] text-white hover:bg-red-900 focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50">{scheduleSaveState === 'saving' ? 'Recording…' : 'Retry audit'}</button> : <button type="button" onClick={openApprovalDialog} disabled={scheduleSaveState === 'saving'} className="h-9 border border-slate-950 bg-slate-900 px-4 text-xs font-bold uppercase tracking-[0.07em] text-white hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Save change</button>}
              </div>
            </div>
          );
        })()}
        {scheduleMessage && <div ref={scheduleFeedbackRef} tabIndex={-1} role={scheduleSaveState === 'error' ? 'alert' : 'status'} className={`mt-3 px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-700 ${scheduleSaveState === 'error' ? 'border border-red-300 bg-red-50 text-red-800' : 'border border-slate-300 bg-white text-slate-700'}`}>{scheduleMessage}</div>}

        <div className="mt-4">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center border border-slate-400 bg-white text-sm font-semibold text-slate-600">Loading active jobs…</div>
          ) : activeView === 'queue' ? <ProductionQueue jobs={displayedJobs} selectedJobId={selectedJobId} attachmentCounts={attachmentCounts} onSelectJob={selectJob}/> : activeView === 'spreadsheet' ? (
            <ProductionTable
              key={stagedSchedule ? `${stagedSchedule.jobId}:${stagedSchedule.proposedStart}:${stagedSchedule.proposedEnd}` : 'persisted'}
              jobs={displayedJobs}
              attachmentCounts={attachmentCounts}
              onCreateJob={handleCreateJob}
              onUpdateJob={handleUpdateJob}
              onOpenAttachments={(job) => selectJob(job, 'attachments')}
              onOpenForms={setSelectedFormsJob}
              stagedSchedule={stagedSchedule}
              onStageSchedule={stageSchedule}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
            />
          ) : (
            <ProductionGantt jobs={filteredJobs} stagedSchedule={stagedSchedule} onStageSchedule={stageSchedule} onSelectJob={selectJob} />
          )}
        </div>
      </div>

      {approvalDialogOpen && stagedSchedule && stagedJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div ref={approvalDialogRef} role="dialog" aria-modal="true" aria-labelledby="schedule-approval-title" className="max-h-full w-full max-w-xl overflow-y-auto border border-slate-500 bg-white p-5 shadow-2xl sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Production schedule approval</div>
            <h2 id="schedule-approval-title" className="mt-1 text-xl font-bold text-slate-950">Confirm schedule change</h2>
            <div className="mt-4 border border-slate-300 bg-slate-50 p-3 text-sm">
              <div className="font-bold text-slate-950">{stagedJob.job_number ? `${stagedJob.job_number} — ` : ''}{stagedJob.name}</div>
              <div className="mt-2 font-semibold text-slate-800">{stagedSchedule.persistedStart && stagedSchedule.persistedEnd ? `${stagedSchedule.persistedStart} – ${stagedSchedule.persistedEnd}` : 'Not scheduled'} → {stagedSchedule.proposedStart} – {stagedSchedule.proposedEnd}</div>
              <div className="mt-1 text-xs text-slate-600">{stagedSchedule.persistedStart && stagedSchedule.persistedEnd ? `${inclusiveCalendarDays(stagedSchedule.persistedStart, stagedSchedule.persistedEnd)} days → ` : ''}{inclusiveCalendarDays(stagedSchedule.proposedStart, stagedSchedule.proposedEnd)} days</div>
              {(() => { if (!stagedSchedule.persistedStart || !stagedSchedule.persistedEnd) return null; const before = laborIntensity(stagedJob.estimated_man_hours, stagedSchedule.persistedStart, stagedSchedule.persistedEnd); const after = laborIntensity(stagedJob.estimated_man_hours, stagedSchedule.proposedStart, stagedSchedule.proposedEnd); return before.hoursPerScheduledDay !== null && after.hoursPerScheduledDay !== null ? <div className="mt-1 text-xs text-slate-600">{before.hoursPerScheduledDay.toFixed(1)} h/day → {after.hoursPerScheduledDay.toFixed(1)} h/day</div> : null; })()}
            </div>
            {approvalActive ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"><span>Temporary approval active for {Math.floor(approvalSecondsRemaining / 60)}:{String(approvalSecondsRemaining % 60).padStart(2, '0')}. Explicit confirmation is still required.</span><button type="button" onClick={() => { window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY); setApprovalExpiresAt(null); setApprovalNow(Date.now()); }} className="text-xs font-bold uppercase underline focus-visible:ring-2 focus-visible:ring-blue-700">Lock approval</button></div> : approvalExpiresAt ? <div className="mt-4 border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">Approval window expired. Enter the approval password to continue.</div> : null}
            <label htmlFor="production-changed-by" className="mt-4 block text-sm font-bold text-slate-800">Changed by <span className="font-normal text-slate-500">— Recorded name for this change</span></label>
            <input ref={approvalInitialRef} id="production-changed-by" value={changedByName} onChange={(event) => { setChangedByName(event.target.value); setApprovalError(''); }} autoComplete="name" className="mt-1 h-11 w-full border border-slate-400 px-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950" />
            {!approvalActive && <><label htmlFor="production-approval-password" className="mt-4 block text-sm font-bold text-slate-800">Approval password</label><input id="production-approval-password" type="password" value={approvalPassword} onChange={(event) => { setApprovalPassword(event.target.value); setApprovalError(''); }} autoComplete="off" className="mt-1 h-11 w-full border border-slate-400 px-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950" /></>}
            <label htmlFor="production-change-note" className="mt-4 block text-sm font-bold text-slate-800">Reason / notes <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="production-change-note" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} rows={3} className="mt-1 w-full resize-y border border-slate-400 px-3 py-2 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950" />
            {approvalError && <div role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{approvalError}</div>}
            <p className="mt-3 text-xs text-slate-500">This client-side confirmation is an internal MVP guardrail, not secure authentication.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setApprovalDialogOpen(false); setApprovalPassword(''); setApprovalError(''); }} className="h-10 border border-slate-400 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-800">Cancel</button><button type="button" onClick={confirmApprovedSave} disabled={scheduleSaveState === 'saving'} className="h-10 border border-slate-950 bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Confirm and save</button></div>
          </div>
        </div>
      )}

      {selectedJob&&<ProductionJobInspector key={selectedJob.id} job={stagedSchedule?.jobId===selectedJob.id?{...selectedJob,planned_start:stagedSchedule.proposedStart,planned_end:stagedSchedule.proposedEnd}:selectedJob} onClose={closeInspector} onUpdateJob={handleUpdateJob} onStageSchedule={stageSchedule} onAttachmentsChanged={(jobId,count)=>setAttachmentCounts((current)=>({...current,[jobId]:count}))} initialFocus={inspectorFocus}/>}

      <JobFormsPanel
        job={selectedFormsJob}
        onClose={() => setSelectedFormsJob(null)}
      />

    </div>
  );
}
