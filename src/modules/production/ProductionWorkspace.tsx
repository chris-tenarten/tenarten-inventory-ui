'use client';

import { ListFilter, RotateCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import ProductionGantt from './components/ProductionGantt';
import PlanningIssuesPanel from './components/PlanningIssuesPanel';
import ProductionJobInspector from './components/ProductionJobInspector';
import ProductionQueue from './components/ProductionQueue';
import ProductionTable from './components/ProductionTable';

import {
  createProductionJob,
  archiveProductionJob,
  restoreProductionJob,
  loadJobAttachmentCounts,
  loadProductionIntegrationSummaries,
  loadProductionJob,
  loadProductionJobs,
  saveProductionScheduleBatch,
  updateProductionJob,
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
import { batchRpcArgs, hasUnsavedSchedules, orderedStagedSchedules, reconcileBatch, stageSchedule as updateStagedSchedule, type StagedSchedules } from './schedule-staging';
import type { ProductionScheduleBatchConflictDetail } from './schedule-batch-contract';
import { arrangeProductionJobs, PRODUCTION_ARRANGEMENT_KEY, type ProductionArrangement } from './arrangement';
import type { ProductionIntegrationSummary } from './jobs';

type ProductionView = 'queue' | 'spreadsheet' | 'timeline';
type ScheduleFilter = 'scheduled' | 'unscheduled';
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
  const [integrationSummaries, setIntegrationSummaries] = useState<Record<string, ProductionIntegrationSummary>>({});
  const [includeArchived, setIncludeArchived] = useState(false);
  const [arrangement, setArrangementState] = useState<ProductionArrangement>(() => typeof window === 'undefined' ? 'stage' : (window.localStorage.getItem(PRODUCTION_ARRANGEMENT_KEY) as ProductionArrangement) || 'stage');
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
  const [planningIssuesOpen, setPlanningIssuesOpen] = useState(false);
  const [stagedSchedules, setStagedSchedules] = useState<StagedSchedules>({});
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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ProductionScheduleBatchConflictDetail['conflicts']>([]);
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
      const [loadedJobs, loadedCounts, summaries, focusedJob] = await Promise.all([
        loadProductionJobs(includeArchived),
        loadJobAttachmentCounts().catch((error) => {
          console.error('Unable to load Production attachment counts', error);
          return {};
        }),
        loadProductionIntegrationSummaries().catch((error) => { console.error('Unable to load Production integration summaries', error); return {}; }),
        focusedJobId ? loadProductionJob(focusedJobId) : Promise.resolve(null),
      ]);

      const jobsWithFocused = focusedJob && !loadedJobs.some((job) => job.id === focusedJob.id)
        ? [...loadedJobs, focusedJob]
        : loadedJobs;
      setJobs(sortJobs(jobsWithFocused));
      setAttachmentCounts(loadedCounts);
      setIntegrationSummaries(summaries);
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
  }, [includeArchived]);

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
  const firstStaged = Object.values(stagedSchedules)[0];
  const stagedSchedule = useMemo(() => firstStaged ? { jobId: firstStaged.job_id, persistedStart: firstStaged.original_planned_start, persistedEnd: firstStaged.original_planned_end, proposedStart: firstStaged.proposed_planned_start!, proposedEnd: firstStaged.proposed_planned_end! } : null, [firstStaged]);

  useEffect(() => {
    if (!hasUnsavedSchedules(stagedSchedules)) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const handleDocumentClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!link || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Leave with unsaved Production schedule changes?')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      setStagedSchedules({});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [stagedSchedules]);

  const stageSchedule = useCallback((job: ProductionJob, start: string, end: string, source: 'production_timeline' | 'production_table' | 'production_inspector' = 'production_timeline') => {
    setScheduleMessage('');
    setScheduleSaveState('idle');
    setBatchId(null);
    setConflicts([]);
    setStagedSchedules((current) => updateStagedSchedule(current, job, start, end, source));
  }, []);

  const discardStagedSchedule = useCallback(() => {
    setStagedSchedules({});
    setBatchId(null);
    setConflicts([]);
    setScheduleSaveState('idle');
    setScheduleMessage('Schedule change discarded.');
    requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
  }, []);

  const openApprovalDialog = useCallback(() => {
    const decision = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
    if (decision.clearStoredExpiration) window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
    setApprovalExpiresAt(decision.state === 'active' ? decision.expiration : null);
    setApprovalError(decision.state === 'missing_configuration' ? 'Production approval is not configured. Save is unavailable.' : '');
    setApprovalPassword('');
    setChangeNote('');
    setApprovalNow(Date.now());
    setApprovalDialogOpen(true);
  }, []);

  const saveStagedSchedule = useCallback(async (audit: { changedByName: string; changeNote: string | null }) => {
    if (!hasUnsavedSchedules(stagedSchedules) || scheduleSaveRef.current) return;
    scheduleSaveRef.current = true;
    setScheduleSaveState('saving'); setScheduleMessage('');
    const activeBatchId = batchId ?? crypto.randomUUID();
    if (!batchId) setBatchId(activeBatchId);
    try {
      const approval = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
      if (approval.state !== 'active') throw new Error('Production approval expired. Confirm the batch again.');
      const result = await saveProductionScheduleBatch(batchRpcArgs(stagedSchedules, jobs, audit.changedByName, audit.changeNote, activeBatchId));
      setJobs((current) => sortJobs(reconcileBatch(current, result.updated_jobs)));
      setStagedSchedules({}); setBatchId(null); setConflicts([]);
      setScheduleSaveState('saved'); setScheduleMessage(`${result.updated_count} production schedules saved`);
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
    } catch (error) {
      const details = error as { message?: string; details?: string };
      if (details.message === 'production_schedule_conflict' && details.details) {
        try { setConflicts((JSON.parse(details.details) as ProductionScheduleBatchConflictDetail).conflicts); } catch { /* retain generic error */ }
      }
      setScheduleSaveState('error'); setScheduleMessage(details.message || 'Atomic schedule batch could not be saved. Retry with the same batch.');
    } finally { scheduleSaveRef.current = false; }
  }, [batchId, jobs, stagedSchedules]);

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

  const displayedJobs = useMemo(() => arrangeProductionJobs(filteredJobs.map((job) => (
    stagedSchedules[job.id]
      ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
      : job
  )), arrangement), [arrangement, filteredJobs, stagedSchedules]);
  const stagedJob = stagedSchedule ? jobs.find((job) => job.id === stagedSchedule.jobId) ?? null : null;
  const selectedJob = selectedJobId ? jobs.find(job=>job.id===selectedJobId)??null : null;
  const planningIssueCount = useMemo(() => {
    const activeJobs = jobs.filter((job) => !['complete', 'cancelled'].includes(job.production_status));
    return activeJobs.filter((job) => getJobReadiness(stagedSchedules[job.id]
      ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
      : job).missingFields.length > 0).length;
  }, [jobs, stagedSchedules]);
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
      const updated = await updateProductionJob(original, changes);
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
  const customerSuggestions = [...new Map(jobs
    .map((job) => job.customer?.trim())
    .filter((customer): customer is string => Boolean(customer))
    .map((customer) => [customer.toLocaleLowerCase(), customer])).values()]
    .sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }));

  return (
    <div className={`mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7 ${hasUnsavedSchedules(stagedSchedules) ? 'pb-36' : ''}`}>
      <datalist id="production-customer-suggestions">
        {customerSuggestions.map((customer) => <option key={customer} value={customer} />)}
      </datalist>
      <div>
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Production reporting</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Production Pipeline</h1>
            <p className="mt-1 text-sm text-slate-600">
              Use the table to manage the Production Pipeline and the Timeline to plan scheduled work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div>
              <span className="font-bold uppercase tracking-[0.08em] text-slate-500">Active Jobs</span>
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

        <div className="flex flex-col gap-3 rounded-sm border border-slate-200 bg-white p-2.5 shadow-sm lg:flex-row lg:items-center">
          <div className="flex shrink-0 flex-wrap items-center gap-2"><span id="production-view-label" className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">View</span><div role="group" aria-labelledby="production-view-label" className="flex items-center rounded-sm border border-slate-300 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setActiveView('queue')}
              className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] ${
                activeView === 'queue'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView('spreadsheet')}
              className={`h-8 px-4 text-[10px] font-bold uppercase tracking-[0.09em] ${
                activeView === 'spreadsheet'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              Table
            </button>
            <button type="button" onClick={()=>setActiveView('timeline')} className={`h-8 rounded-sm px-4 text-[10px] font-bold uppercase tracking-[0.09em] focus-visible:ring-2 focus-visible:ring-blue-600 ${activeView==='timeline'?'bg-slate-900 text-white shadow-sm':'text-slate-600 hover:bg-white'}`}>Timeline</button>
          </div>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => { setFocusedJobId(null); setSearch(event.target.value); }}
            placeholder="Search jobs..."
            className="h-9 min-w-0 flex-1 rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
          />

          {activeView !== 'timeline' && <div className="flex shrink-0 items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Sort</span><div className="inline-flex h-9 overflow-hidden rounded-sm border border-slate-300">{(['stage','deadline','labor'] as ProductionArrangement[]).map((value) => <button key={value} type="button" aria-pressed={arrangement === value} onClick={() => { setArrangementState(value); window.localStorage.setItem(PRODUCTION_ARRANGEMENT_KEY, value); }} className={`border-r border-slate-300 px-3 text-[10px] font-bold uppercase last:border-r-0 ${arrangement === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{value === 'stage' ? 'Status' : value}</button>)}</div></div>}

          {activeView === 'spreadsheet' && (
            <div id="production-table-columns-toolbar-slot" className="relative shrink-0" />
          )}

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
                <label className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-sm text-slate-700"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />Include Archived</label>

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
        {planningIssueCount > 0 && <div className="mt-3 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-amber-500 bg-amber-50/70 px-3 py-2 text-xs text-slate-600"><span className="font-bold text-amber-900">{planningIssueCount} {planningIssueCount === 1 ? 'job needs' : 'jobs need'} planning attention</span><button type="button" onClick={() => setPlanningIssuesOpen(true)} className="h-7 border border-amber-300 bg-white px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-900 hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-700">Review issues</button></div>}

        {stagedSchedule && (() => {
          const hadSchedule = Boolean(stagedSchedule.persistedStart && stagedSchedule.persistedEnd);
          const estimatedHours = stagedJob?.estimated_man_hours ?? null;
          const before = hadSchedule ? laborIntensity(estimatedHours, stagedSchedule.persistedStart!, stagedSchedule.persistedEnd!) : null;
          const after = laborIntensity(estimatedHours, stagedSchedule.proposedStart, stagedSchedule.proposedEnd);
          const hours = (value: number | null) => value === null ? 'No labor estimate' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} h/day`;
          return (
            <div ref={scheduleActionsRef} data-pending-schedule-actions="true" tabIndex={-1} role="status" aria-live="polite" className="fixed bottom-3 left-3 right-3 z-[90] mx-auto flex max-w-5xl flex-col gap-3 border border-amber-600 bg-amber-50 px-4 py-3 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Production planning pending</div>
                <div className="mt-1 text-sm font-bold text-slate-950">{Object.keys(stagedSchedules).length} {Object.keys(stagedSchedules).length === 1 ? 'job has' : 'jobs have'} proposed schedule changes{conflicts.length ? ` · ${conflicts.length} conflicts` : ''}</div>
                <div className="mt-1 text-sm font-bold text-slate-950">{hadSchedule ? `${stagedSchedule.persistedStart} – ${stagedSchedule.persistedEnd}` : 'Not scheduled'} → {stagedSchedule.proposedStart} – {stagedSchedule.proposedEnd}</div>
                <div className="mt-1 text-xs text-slate-600">{hadSchedule ? `${inclusiveCalendarDays(stagedSchedule.persistedStart!, stagedSchedule.persistedEnd!)} days · ${hours(before!.hoursPerScheduledDay)}` : 'No saved production window'} → {inclusiveCalendarDays(stagedSchedule.proposedStart, stagedSchedule.proposedEnd)} days · {hours(after.hoursPerScheduledDay)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setReviewOpen(true)} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase">Review changes</button>
                <button type="button" onClick={discardStagedSchedule} disabled={scheduleSaveState === 'saving'} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase">Discard all</button>
                <button type="button" onClick={openApprovalDialog} disabled={scheduleSaveState === 'saving'} className="h-9 border border-slate-950 bg-slate-900 px-4 text-xs font-bold uppercase text-white">Save all changes</button>
              </div>
            </div>
          );
        })()}
        {scheduleMessage && <div ref={scheduleFeedbackRef} tabIndex={-1} role={scheduleSaveState === 'error' ? 'alert' : 'status'} className={`mt-3 px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-700 ${scheduleSaveState === 'error' ? 'border border-red-300 bg-red-50 text-red-800' : 'border border-slate-300 bg-white text-slate-700'}`}>{scheduleMessage}</div>}

        <div className="mt-4">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center border border-slate-400 bg-white text-sm font-semibold text-slate-600">Loading active jobs…</div>
          ) : activeView === 'queue' ? <ProductionQueue jobs={displayedJobs} selectedJobId={selectedJobId} attachmentCounts={attachmentCounts} integrationSummaries={integrationSummaries} onSelectJob={selectJob}/> : activeView === 'spreadsheet' ? (
            <ProductionTable
              jobs={displayedJobs}
              attachmentCounts={attachmentCounts}
              integrationSummaries={integrationSummaries}
              onCreateJob={handleCreateJob}
              onUpdateJob={handleUpdateJob}
              onOpenAttachments={(job) => selectJob(job, 'attachments')}
              stagedSchedules={stagedSchedules}
              onStageSchedule={(job, start, end) => stageSchedule(job, start, end, 'production_table')}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
            />
          ) : (
            <ProductionGantt jobs={filteredJobs} stagedSchedules={stagedSchedules} onStageSchedule={stageSchedule} onSelectJob={selectJob} />
          )}
        </div>
      </div>

      {reviewOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="schedule-review-title" className="max-h-[80vh] w-full max-w-2xl overflow-y-auto border border-slate-500 bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 id="schedule-review-title" className="text-xl font-bold">Review proposed schedules</h2><button type="button" onClick={() => setReviewOpen(false)} className="h-9 border px-3 font-bold">Close</button></div><div className="mt-4 divide-y border">{orderedStagedSchedules(stagedSchedules, jobs).map((proposal) => { const job = jobs.find((item) => item.id === proposal.job_id); return <div key={proposal.job_id} className="p-3"><div className="font-bold">{job?.name}{job?.job_number ? ` · ${job.job_number}` : ''}</div><div className="mt-1 text-sm">{proposal.original_planned_start && proposal.original_planned_end ? `${proposal.original_planned_start} – ${proposal.original_planned_end}` : 'Not scheduled'} → {proposal.proposed_planned_start} – {proposal.proposed_planned_end}</div><div className="mt-1 text-xs text-slate-600">{proposal.changed_fields.map((field) => field === 'planned_start' ? 'Planned start' : 'Planned finish').join(', ')}</div><button type="button" onClick={() => setStagedSchedules((current) => { const next = { ...current }; delete next[proposal.job_id]; return next; })} className="mt-2 text-xs font-bold text-red-700 underline">Revert this job</button></div>; })}</div></div></div>}

      {approvalDialogOpen && stagedSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div ref={approvalDialogRef} role="dialog" aria-modal="true" aria-labelledby="schedule-approval-title" className="max-h-full w-full max-w-xl overflow-y-auto border border-slate-500 bg-white p-5 shadow-2xl sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Production schedule approval</div>
            <h2 id="schedule-approval-title" className="mt-1 text-xl font-bold text-slate-950">Confirm {Object.keys(stagedSchedules).length} schedule changes</h2>
            <div className="mt-4 border border-slate-300 bg-slate-50 p-3 text-sm">
              <div className="font-bold text-slate-950">{stagedJob?.job_number ? `${stagedJob.job_number} — ` : ''}{stagedJob?.name || 'Production job'}</div>
              <div className="mt-2 font-semibold text-slate-800">{stagedSchedule.persistedStart && stagedSchedule.persistedEnd ? `${stagedSchedule.persistedStart} – ${stagedSchedule.persistedEnd}` : 'Not scheduled'} → {stagedSchedule.proposedStart} – {stagedSchedule.proposedEnd}</div>
              <div className="mt-1 text-xs text-slate-600">{stagedSchedule.persistedStart && stagedSchedule.persistedEnd ? `${inclusiveCalendarDays(stagedSchedule.persistedStart, stagedSchedule.persistedEnd)} days → ` : ''}{inclusiveCalendarDays(stagedSchedule.proposedStart, stagedSchedule.proposedEnd)} days</div>
              {(() => { if (!stagedSchedule.persistedStart || !stagedSchedule.persistedEnd) return null; const estimatedHours = stagedJob?.estimated_man_hours ?? null; const before = laborIntensity(estimatedHours, stagedSchedule.persistedStart, stagedSchedule.persistedEnd); const after = laborIntensity(estimatedHours, stagedSchedule.proposedStart, stagedSchedule.proposedEnd); return before.hoursPerScheduledDay !== null && after.hoursPerScheduledDay !== null ? <div className="mt-1 text-xs text-slate-600">{before.hoursPerScheduledDay.toFixed(1)} h/day → {after.hoursPerScheduledDay.toFixed(1)} h/day</div> : null; })()}
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

      {selectedJob&&<ProductionJobInspector key={selectedJob.id} job={stagedSchedules[selectedJob.id]?{...selectedJob,planned_start:stagedSchedules[selectedJob.id].proposed_planned_start,planned_end:stagedSchedules[selectedJob.id].proposed_planned_end}:selectedJob} onClose={closeInspector} onUpdateJob={handleUpdateJob} onArchive={async (job) => { const archived = await archiveProductionJob(job); setJobs((current) => includeArchived ? current.map((item) => item.id === job.id ? archived : item) : current.filter((item) => item.id !== job.id)); closeInspector(); }} onRestore={async (job) => { const restored = await restoreProductionJob(job); setJobs((current) => current.map((item) => item.id === job.id ? restored : item)); closeInspector(); }} onStageSchedule={(job, start, end) => stageSchedule(job, start, end, 'production_inspector')} onAttachmentsChanged={(jobId,count)=>setAttachmentCounts((current)=>({...current,[jobId]:count}))} initialFocus={inspectorFocus}/>}
      {planningIssuesOpen && <PlanningIssuesPanel jobs={jobs} stagedSchedules={stagedSchedules} onClose={() => setPlanningIssuesOpen(false)} onUpdateJob={handleUpdateJob} onStageSchedule={(job, start, end) => stageSchedule(job, start, end, 'production_inspector')} onOpenInspector={selectJob} />}


    </div>
  );
}
