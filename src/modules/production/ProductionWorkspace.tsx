'use client';

import { AlertTriangle, Camera, ChevronDown, ChevronUp, Flag, ListFilter, Plus, RotateCw } from 'lucide-react';
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
import ProductionJobCreator from './components/ProductionJobCreator';
import ProductionQueue from './components/ProductionQueue';
import ProductionTable from './components/ProductionTable';
import UnscheduledBadge from './components/UnscheduledBadge';
import ScheduleReviewDialog from './components/ScheduleReviewDialog';
import MonthlySnapshot from './components/MonthlySnapshot';
import CreateReworkDialog from './components/CreateReworkDialog';

import {
  createProductionJob,
  archiveProductionJob,
  restoreProductionJob,
  loadJobAttachmentCounts,
  loadJobUpdateSummaries,
  loadProductionIntegrationSummaries,
  loadProductionJob,
  loadProductionJobs,
  saveProductionReworkMixedScheduleBatch,
  uploadJobAttachments,
  updateProductionJob,
} from './jobs';

import { EMPTY_JOB_UPDATE_SUMMARY, type JobUpdateSummary, type ProductionJobUpdate } from './jobs';
import type {
  NewProductionJob,
  ProductionJob,
  ProductionStatus,
} from './types';
import { PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY, PRODUCTION_JOB_FOCUS_STORAGE_KEY } from './job-options';
import { inclusiveCalendarDays, laborIntensity } from './schedule';
import { getJobNonblockingPlanningIssues, getJobSchedulingIssues } from './readiness';
import { isProductionApprovalPasswordAccepted, productionApprovalDecision, PRODUCTION_APPROVAL_WINDOW_MS } from './approval';
import { batchRpcArgs, hasUnsavedSchedules, rebaseStagedScheduleVersion, reconcileBatch, scheduleSaveBlockedByInspector, stageSchedule as updateStagedSchedule, type InspectorOrdinarySaveState, type StagedSchedules } from './schedule-staging';
import { describeProductionScheduleSaveError, type ProductionScheduleBatchConflictDetail } from './schedule-batch-contract';
import { arrangeProductionJobs, PRODUCTION_ARRANGEMENT_KEY, type ProductionArrangement } from './arrangement';
import { hasUnsavedPlanningSchedules, planningPhaseWithStagedDates, productionStartDelta, rebaseStagedPlanningVersion, schedulingIssues, stagePlanningSchedule as updateStagedPlanningSchedule, translateJobPlanningSchedules, type StagedPlanningSchedules } from '@/modules/planning/schedule-staging';
import type { PlanningScheduleIssue } from '@/modules/planning/schedule-model.mjs';
import SchedulingFeedbackPanel from '@/modules/planning/SchedulingFeedbackPanel';
import type { ProductionIntegrationSummary } from './jobs';
import { useLanguage } from '@/lib/language';
import { loadPlanningItems, loadPlanningPhases } from '@/modules/planning/data';
import type { PlanningItem, PlanningPhase } from '@/modules/planning/types';
import { isPlanningEnabled } from '@/modules/planning/timeline-model.mjs';
import { useAuth } from '@/lib/auth';
import { useAccountPreferences } from '@/lib/account-preferences';
import { productionJobsVisibleToRole } from './fixture-visibility';

type ProductionView = 'queue' | 'spreadsheet' | 'timeline';
type DashboardMode = 'pipeline' | 'snapshot';
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
const planningEnabled = isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING);

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
  const auth = useAuth();
  const accountPreferences = useAccountPreferences();
  const accountPreferencesScoped = accountPreferences.accountScoped;
  const setAccountPreference = accountPreferences.setPreference;
  const { language, tr } = useLanguage();
  const [dashboardMode, setDashboardModeState] = useState<DashboardMode>(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'snapshot' ? 'snapshot' : 'pipeline');
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [reworkTargetJob, setReworkTargetJob] = useState<ProductionJob | null>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [jobUpdateSummaries, setJobUpdateSummaries] = useState<Record<string, JobUpdateSummary>>({});
  const [integrationSummaries, setIntegrationSummaries] = useState<Record<string, ProductionIntegrationSummary>>({});
  const [planningPhases, setPlanningPhases] = useState<PlanningPhase[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const planningPhasesRef = useRef<PlanningPhase[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [arrangement, setArrangementState] = useState<ProductionArrangement>(() => accountPreferences.accountScoped || typeof window === 'undefined' ? 'stage' : (window.localStorage.getItem(PRODUCTION_ARRANGEMENT_KEY) as ProductionArrangement) || 'stage');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [activeView, setActiveViewState] = useState<ProductionView>(() => {
    if (accountPreferences.accountScoped || typeof window === 'undefined') return 'queue';
    const saved = window.sessionStorage.getItem('tenops.productionView');
    return saved === 'queue' || saved === 'spreadsheet' || saved === 'timeline' ? saved : 'queue';
  });
  const [selectedJobId, setSelectedJobId] = useState<string|null>(null);
  const [inspectorOrdinarySaveState, setInspectorOrdinarySaveState] = useState<InspectorOrdinarySaveState | null>(null);
  const [inspectorFocus, setInspectorFocus] = useState<string|undefined>();
  const setActiveView = useCallback((view:ProductionView, persist = true) => {
    setActiveViewState(view);
    if (!persist) return;
    if (accountPreferencesScoped) {
      const storedView = view === 'queue' ? 'overview' : view === 'spreadsheet' ? 'table' : 'timeline';
      void setAccountPreference('production_view', storedView);
    } else window.sessionStorage.setItem('tenops.productionView', view);
  }, [accountPreferencesScoped, setAccountPreference]);
  const [scheduleFilters, setScheduleFilters] = useState<Set<ScheduleFilter>>(
    () => new Set(),
  );
  const [statusFilters, setStatusFilters] = useState<Set<ProductionStatus>>(
    () => new Set(),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [planningIssuesOpen, setPlanningIssuesOpen] = useState(false);
  const [attentionCenterOpen, setAttentionCenterOpen] = useState(false);
  const [planningIssuesCategory, setPlanningIssuesCategory] = useState<'scheduling' | 'nonblocking'>('nonblocking');
  const [jobCreatorOpen, setJobCreatorOpen] = useState(false);
  const [jobCreatorReturnView, setJobCreatorReturnView] = useState<ProductionView>('queue');
  const [createdJob, setCreatedJob] = useState<ProductionJob | null>(null);
  const [createdJobScheduleError, setCreatedJobScheduleError] = useState('');
  const [stagedSchedules, setStagedSchedules] = useState<StagedSchedules>({});
  const [stagedPlanningSchedules, setStagedPlanningSchedules] = useState<StagedPlanningSchedules>({});
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
  const [previewPlanningIssues, setPreviewPlanningIssues] = useState<PlanningScheduleIssue[] | null>(null);
  const [focusedPlanningIssueId, setFocusedPlanningIssueId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ProductionScheduleBatchConflictDetail['conflicts']>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const scheduleSaveRef = useRef(false);
  const scheduleActionsRef = useRef<HTMLDivElement | null>(null);
  const scheduleFeedbackRef = useRef<HTMLDivElement | null>(null);
  const approvalDialogRef = useRef<HTMLDivElement | null>(null);
  const approvalInitialRef = useRef<HTMLInputElement | null>(null);
  const inspectorOpenerRef = useRef<HTMLElement | null>(null);

  const setDashboardMode = useCallback((mode: DashboardMode, history: 'push' | 'replace' = 'push') => {
    setDashboardModeState(mode);
    const url = new URL(window.location.href);
    if (mode === 'snapshot') url.searchParams.set('view', 'snapshot'); else url.searchParams.delete('view');
    window.history[history === 'push' ? 'pushState' : 'replaceState'](null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (accountPreferences.accountScoped) {
      const nextArrangement = accountPreferences.preferences.production_arrangement;
      setArrangementState(nextArrangement === 'stage' || nextArrangement === 'deadline' || nextArrangement === 'labor' ? nextArrangement : 'stage');
      const nextView = accountPreferences.preferences.production_view;
      setActiveViewState(nextView === 'table' ? 'spreadsheet' : nextView === 'timeline' ? 'timeline' : 'queue');
      return;
    }
    const localArrangement = window.localStorage.getItem(PRODUCTION_ARRANGEMENT_KEY);
    setArrangementState(localArrangement === 'deadline' || localArrangement === 'labor' ? localArrangement : 'stage');
    const localView = window.sessionStorage.getItem('tenops.productionView');
    setActiveViewState(localView === 'spreadsheet' || localView === 'timeline' ? localView : 'queue');
  }, [accountPreferences.accountScoped, accountPreferences.preferences.production_arrangement, accountPreferences.preferences.production_view]);

  useEffect(() => {
    const syncMode = () => setDashboardModeState(new URLSearchParams(window.location.search).get('view') === 'snapshot' ? 'snapshot' : 'pipeline');
    window.addEventListener('popstate', syncMode);
    return () => window.removeEventListener('popstate', syncMode);
  }, []);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const focusedJobId = window.sessionStorage.getItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY);
      const focusedSection = window.sessionStorage.getItem(PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY) ?? undefined;
      window.sessionStorage.removeItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY);
      window.sessionStorage.removeItem(PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY);
      const [loadedJobs, loadedCounts, summaries, updateSummaries, focusedJob] = await Promise.all([
        loadProductionJobs(includeArchived),
        loadJobAttachmentCounts().catch((error) => {
          console.error('Unable to load Production attachment counts', error);
          return {};
        }),
        loadProductionIntegrationSummaries().catch((error) => { console.error('Unable to load Production integration summaries', error); return {}; }),
        loadJobUpdateSummaries().catch((error) => {
          console.error('Unable to load Production Job Update summaries', error);
          return {};
        }),
        focusedJobId ? loadProductionJob(focusedJobId) : Promise.resolve(null),
      ]);

      const jobsWithFocused = focusedJob && !loadedJobs.some((job) => job.id === focusedJob.id)
        ? [...loadedJobs, focusedJob]
        : loadedJobs;
      const visibleJobs = productionJobsVisibleToRole(jobsWithFocused, auth.profile?.isActive ? auth.profile.role : null);
      const visibleFocusedJob = focusedJob && visibleJobs.some((job) => job.id === focusedJob.id) ? focusedJob : null;
      const loadedPlanningPhases = planningEnabled ? await loadPlanningPhases(visibleJobs.map((job) => job.id)) : [];
      const loadedPlanningItems = planningEnabled ? await loadPlanningItems(loadedPlanningPhases.map((phase) => phase.id)) : [];
      setJobs(sortJobs(visibleJobs));
      setAttachmentCounts(loadedCounts);
      setIntegrationSummaries(summaries);
      setJobUpdateSummaries(updateSummaries);
      setPlanningPhases(loadedPlanningPhases);
      setPlanningItems(loadedPlanningItems);
      if (visibleFocusedJob) {
        setFocusedJobId(visibleFocusedJob.id);
        setSearch(visibleFocusedJob.job_number || visibleFocusedJob.name);
        setSelectedJobId(visibleFocusedJob.id);
        setInspectorFocus(focusedSection);
        setActiveView('queue', false);
      }
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load active jobs.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [auth.profile?.isActive, auth.profile?.role, includeArchived, setActiveView]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    planningPhasesRef.current = planningPhases;
  }, [planningPhases]);

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
  const hasPendingSchedules = hasUnsavedSchedules(stagedSchedules) || hasUnsavedPlanningSchedules(stagedPlanningSchedules);
  const inspectorBlocksScheduleSave = scheduleSaveBlockedByInspector(inspectorOrdinarySaveState, stagedSchedules);
  const stagedPlanningIssues = useMemo(() => schedulingIssues(
    planningPhases.map((phase) => planningPhaseWithStagedDates(phase, stagedPlanningSchedules)),
    jobs.map((job) => stagedSchedules[job.id] ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end } : job),
  ), [jobs, planningPhases, stagedPlanningSchedules, stagedSchedules]);
  const activePlanningIssues = previewPlanningIssues ?? stagedPlanningIssues;
  const schedulingErrors = activePlanningIssues.filter((issue) => issue.severity === 'error');

  useEffect(() => {
    if (!hasPendingSchedules) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const handleDocumentClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!link || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Leave with unsaved Production or Planning schedule changes?')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      setStagedSchedules({});
      setStagedPlanningSchedules({});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [hasPendingSchedules]);

  const stageSchedule = useCallback((job: ProductionJob, start: string, end: string, source: 'production_timeline' | 'production_table' | 'production_inspector' = 'production_timeline') => {
    setScheduleMessage('');
    setScheduleSaveState('idle');
    setBatchId(null);
    setConflicts([]);
    const previousStart = stagedSchedules[job.id]?.proposed_planned_start ?? job.planned_start;
    const nextProduction = updateStagedSchedule(stagedSchedules, job, start, end, source);
    const nextStart = nextProduction[job.id]?.proposed_planned_start ?? job.planned_start;
    const incrementalDelta = productionStartDelta({ ...job, planned_start: previousStart }, nextStart);
    setStagedSchedules(nextProduction);
    if (!job.rework_cycle) setStagedPlanningSchedules((current) => translateJobPlanningSchedules(current, planningPhases, job.id, incrementalDelta));
  }, [planningPhases, stagedSchedules]);

  const discardStagedSchedule = useCallback(() => {
    setStagedSchedules({});
    setStagedPlanningSchedules({});
    setBatchId(null);
    setConflicts([]);
    setScheduleSaveState('idle');
    setScheduleMessage('Schedule change discarded.');
    requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
  }, []);

  const revertStagedJob = useCallback((jobId: string) => {
    const job = jobs.find((candidate) => candidate.id === jobId);
    const proposal = stagedSchedules[jobId];
    if (!job || !proposal) return;
    const reverseDelta = productionStartDelta({ ...job, planned_start: proposal.proposed_planned_start }, proposal.original_planned_start);
    setStagedSchedules((current) => { const next = { ...current }; delete next[jobId]; return next; });
    setStagedPlanningSchedules((current) => translateJobPlanningSchedules(current, planningPhases, jobId, reverseDelta));
  }, [jobs, planningPhases, stagedSchedules]);

  const stagePlanningSchedules = useCallback((changes: Array<{ phase: PlanningPhase; start: string; end: string }>) => {
    setScheduleMessage(''); setScheduleSaveState('idle'); setBatchId(null); setConflicts([]);
    setStagedPlanningSchedules((current) => changes.reduce(
      (next, change) => updateStagedPlanningSchedule(next, change.phase, change.start, change.end, 'planning_timeline'),
      current,
    ));
  }, []);

  const saveStagedSchedule = useCallback(async (audit: { changedByName: string; changeNote: string | null }) => {
    if (inspectorBlocksScheduleSave) {
      setScheduleSaveState('idle');
      setScheduleMessage('Save the open Inspector job details before saving schedule changes. Proposed dates remain staged.');
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
      return;
    }
    if (!hasPendingSchedules || scheduleSaveRef.current || schedulingErrors.length > 0) return;
    scheduleSaveRef.current = true;
    setScheduleSaveState('saving'); setScheduleMessage('');
    const activeBatchId = batchId ?? crypto.randomUUID();
    if (!batchId) setBatchId(activeBatchId);
    try {
      if (!(auth.isAuthenticated && auth.profile?.isActive)) {
        const approval = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
        if (approval.state !== 'active') throw new Error('Production approval expired. Confirm the batch again.');
      }
      const reworkJobIds = new Set(jobs.filter((job) => job.rework_cycle).map((job) => job.id));
      const ordinaryStaged = Object.fromEntries(Object.entries(stagedSchedules).filter(([jobId]) => !reworkJobIds.has(jobId)));
      const reworkStaged = Object.fromEntries(Object.entries(stagedSchedules).filter(([jobId]) => reworkJobIds.has(jobId)));
      const jobArgs = hasUnsavedSchedules(ordinaryStaged) ? batchRpcArgs(ordinaryStaged, jobs, audit.changedByName, audit.changeNote, activeBatchId) : null;
      const reworkProposals = Object.values(reworkStaged).map((proposal) => {
        const cycle = jobs.find((job) => job.id === proposal.job_id)?.rework_cycle;
        if (!cycle) throw new Error('Active Rework lifecycle is no longer available.');
        return { rework_cycle_id: cycle.id, original_planned_start: proposal.original_planned_start, original_planned_end: proposal.original_planned_end, original_updated_at: proposal.original_updated_at, proposed_planned_start: proposal.proposed_planned_start, proposed_planned_end: proposal.proposed_planned_end, change_source: proposal.change_source };
      });
      const result = await saveProductionReworkMixedScheduleBatch({
        p_job_proposals: jobArgs?.p_proposals ?? [],
        p_rework_proposals: reworkProposals,
        p_phase_proposals: Object.values(stagedPlanningSchedules).map((proposal) => ({
          phase_id: proposal.phase_id,
          original_start_date: proposal.original_start_date,
          original_end_date: proposal.original_end_date,
          original_updated_at: proposal.original_updated_at,
          proposed_start_date: proposal.proposed_start_date,
          proposed_end_date: proposal.proposed_end_date,
          change_source: proposal.change_source,
        })),
        p_changed_by: audit.changedByName,
        p_change_note: audit.changeNote,
        p_batch_id: activeBatchId,
      });
      let nextJobs = reconcileBatch(jobs, result.updated_jobs);
      if (result.updated_reworks.length) {
        const updatedById = new Map(result.updated_reworks.map((cycle) => [cycle.id, cycle]));
        nextJobs = nextJobs.map((job) => job.rework_cycle && updatedById.has(job.rework_cycle.id) ? { ...job, rework_cycle: updatedById.get(job.rework_cycle.id)!, planned_start: updatedById.get(job.rework_cycle.id)!.planned_start, planned_end: updatedById.get(job.rework_cycle.id)!.planned_end, updated_at: updatedById.get(job.rework_cycle.id)!.updated_at } : job);
      }
      setJobs(sortJobs(nextJobs));
      setPlanningPhases((current) => { const updated = new Map(result.updated_phases.map((phase) => [phase.id, phase])); return current.map((phase) => updated.get(phase.id) ?? phase); });
      setStagedSchedules({}); setStagedPlanningSchedules({}); setBatchId(null); setConflicts([]);
      setScheduleSaveState('saved'); setScheduleMessage(`${result.updated_count} schedule changes saved`);
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
    } catch (error) {
      const feedback = describeProductionScheduleSaveError(error);
      setConflicts(feedback.conflicts);
      setScheduleSaveState('error');
      setScheduleMessage(feedback.message);
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
    } finally { scheduleSaveRef.current = false; }
  }, [auth.isAuthenticated, auth.profile?.isActive, batchId, hasPendingSchedules, inspectorBlocksScheduleSave, jobs, schedulingErrors.length, stagedPlanningSchedules, stagedSchedules]);

  const requestScheduleSave = useCallback(() => {
    if (inspectorBlocksScheduleSave) {
      setScheduleSaveState('idle');
      setScheduleMessage('Save the open Inspector job details before saving schedule changes. Proposed dates remain staged.');
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
      return;
    }
    if (schedulingErrors.length > 0) {
      setScheduleSaveState('error');
      setScheduleMessage('Resolve scheduling errors before saving. Warnings do not block Save All.');
      requestAnimationFrame(() => scheduleFeedbackRef.current?.focus());
      return;
    }
    if (auth.isAuthenticated && auth.profile?.isActive) {
      void saveStagedSchedule({ changedByName: auth.profile.displayName, changeNote: null });
      return;
    }
    const decision = productionApprovalDecision(APPROVAL_PASSWORD, window.sessionStorage.getItem(APPROVAL_EXPIRES_KEY), Date.now());
    if (decision.clearStoredExpiration) window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY);
    setApprovalExpiresAt(decision.state === 'active' ? decision.expiration : null);
    setApprovalError(decision.state === 'missing_configuration' ? 'Production approval is not configured. Save is unavailable.' : '');
    setApprovalPassword('');
    setChangeNote('');
    setApprovalNow(Date.now());
    setApprovalDialogOpen(true);
  }, [auth.isAuthenticated, auth.profile, inspectorBlocksScheduleSave, saveStagedSchedule, schedulingErrors.length]);

  const confirmApprovedSave = useCallback(() => {
    if (inspectorBlocksScheduleSave) {
      setApprovalError('Save the open Inspector job details before confirming schedule changes.');
      return;
    }
    if (!hasPendingSchedules || scheduleSaveRef.current || schedulingErrors.length > 0) return;
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
      if (!isProductionApprovalPasswordAccepted(approvalPassword, APPROVAL_PASSWORD)) { setApprovalError('Incorrect approval password'); return; }
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
  }, [approvalPassword, changeNote, changedByName, hasPendingSchedules, inspectorBlocksScheduleSave, saveStagedSchedule, schedulingErrors.length]);

  useEffect(() => {
    if (!hasPendingSchedules || approvalDialogOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.confirm('Discard the pending Production schedule change?')) discardStagedSchedule();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [approvalDialogOpen, discardStagedSchedule, hasPendingSchedules]);

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
  const activeReadinessJobs = useMemo(() => jobs
    .filter((job) => !['complete', 'cancelled'].includes(job.production_status))
    .map((job) => stagedSchedules[job.id]
      ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
      : job), [jobs, stagedSchedules]);
  const schedulingAttentionJobs = useMemo(() => activeReadinessJobs.filter((job) => getJobSchedulingIssues(job).length > 0), [activeReadinessJobs]);
  const ordinaryAttentionJobs = useMemo(() => activeReadinessJobs.filter((job) =>
    getJobNonblockingPlanningIssues(job).length > 0 || (jobUpdateSummaries[job.id]?.openFollowUpCount ?? 0) > 0
  ), [activeReadinessJobs, jobUpdateSummaries]);
  const selectJob = (job:ProductionJob, focus?:string) => {
    if (document.activeElement instanceof HTMLElement) inspectorOpenerRef.current = document.activeElement;
    setSelectedJobId(job.id);
    setInspectorFocus(focus);
  };
  const openJobScheduling = (job: ProductionJob) => {
    setDashboardMode('pipeline', 'replace');
    setSearch('');
    setFocusedJobId(job.id);
    setStatusFilters(new Set());
    setScheduleFilters(new Set());
    setActiveView('timeline', false);
    selectJob(job, 'planned-dates');
  };
  const openCreatedJobScheduling = async (job: ProductionJob) => {
    setCreatedJobScheduleError('');
    try {
      const canonicalJob = await loadProductionJob(job.id);
      if (!canonicalJob) throw new Error('The newly created Production Job could not be loaded.');

      setJobs((current) => sortJobs(current.some((candidate) => candidate.id === canonicalJob.id)
        ? current.map((candidate) => candidate.id === canonicalJob.id ? canonicalJob : candidate)
        : [...current, canonicalJob]));
      setCreatedJob(null);
      openJobScheduling(canonicalJob);
    } catch (error) {
      setCreatedJobScheduleError(error instanceof Error ? error.message : 'Unable to open this Production Job for scheduling.');
    }
  };
  const closeInspector = () => {
    setSelectedJobId(null);
    setFocusedJobId(null);
    setInspectorFocus(undefined);
    requestAnimationFrame(() => inspectorOpenerRef.current?.focus());
  };
  const handleJobUpdateSummaryChanged = useCallback(
    (jobId: string, summary: JobUpdateSummary) => {
      setJobUpdateSummaries((current) => ({ ...current, [jobId]: summary }));
    },
    [],
  );
  const handlePlanningPhasesChanged = useCallback((jobId: string, nextPhases: PlanningPhase[]) => {
    setPlanningPhases((current) => [...current.filter((phase) => phase.job_id !== jobId), ...nextPhases]);
    setStagedPlanningSchedules((current) => nextPhases.reduce(rebaseStagedPlanningVersion, current));
  }, []);
  const handlePlanningItemsChanged = useCallback((jobId: string, nextItems: PlanningItem[]) => {
    const phaseIds = new Set(planningPhasesRef.current.filter((phase) => phase.job_id === jobId).map((phase) => phase.id));
    setPlanningItems((current) => [...current.filter((item) => !phaseIds.has(item.phase_id)), ...nextItems]);
  }, []);

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
      if (original.rework_cycle && changes.production_status && ['complete', 'cancelled'].includes(changes.production_status)) {
        await loadJobs();
        return updated;
      }
      setJobs((current) =>
        sortJobs(current.map((job) => (job.id === jobId ? updated : job))),
      );
      setStagedSchedules((current) =>
        rebaseStagedScheduleVersion(current, updated),
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
  const jobsInQueue = activeReadinessJobs.length;
  const scheduledCount = activeReadinessJobs.filter(isScheduled).length;
  const customerSuggestions = [...new Map(jobs
    .map((job) => job.customer?.trim())
    .filter((customer): customer is string => Boolean(customer))
    .map((customer) => [customer.toLocaleLowerCase(), customer])).values()]
    .sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }));

  return (
    <div className={`mx-auto min-w-0 w-full max-w-[1800px] overflow-x-clip px-2 py-3 sm:px-5 sm:py-7 ${hasPendingSchedules ? 'pb-36' : ''}`}>
      <datalist id="production-customer-suggestions">
        {customerSuggestions.map((customer) => <option key={customer} value={customer} />)}
      </datalist>
      <div className="mb-3 min-w-0 sm:mb-4 sm:flex sm:flex-wrap sm:items-center sm:gap-2" aria-label={tr('Dashboard mode', 'Modo del panel')}>
        <span className="mr-1 hidden text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 sm:inline">{tr('Dashboard', 'Panel')}</span>
        <div className="grid w-full min-w-0 grid-cols-2 rounded-sm border border-slate-300 bg-slate-50 p-1 sm:inline-flex sm:w-auto">
          <button type="button" aria-pressed={dashboardMode === 'pipeline'} onClick={() => setDashboardMode('pipeline')} className={`min-h-8 min-w-0 px-1.5 text-[9px] font-bold uppercase leading-tight tracking-[0.05em] sm:h-8 sm:px-3 sm:text-[10px] sm:tracking-[0.08em] ${dashboardMode === 'pipeline' ? 'tenops-selected-surface shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{tr('Production Pipeline', 'Flujo de producción')}</button>
          <button type="button" aria-pressed={dashboardMode === 'snapshot'} onClick={() => setDashboardMode('snapshot')} className={`inline-flex min-h-8 min-w-0 items-center justify-center gap-1 px-1.5 text-[9px] font-bold uppercase leading-tight tracking-[0.05em] sm:h-8 sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-[0.08em] ${dashboardMode === 'snapshot' ? 'tenops-selected-surface shadow-sm' : 'text-slate-600 hover:bg-white'}`}><Camera className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" />{tr('Monthly Snapshot', 'Resumen mensual')}</button>
        </div>
      </div>
      {dashboardMode === 'snapshot' ? <MonthlySnapshot /> : <div>
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{tr('Production reporting', 'Control de producción')}</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{tr('Production Pipeline', 'Flujo de producción')}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {tr('Use the table to manage the Production Pipeline and the Timeline to plan scheduled work.', 'Use la tabla para administrar el flujo de producción y el cronograma para planificar el trabajo programado.')}
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-1.5 text-xs sm:items-end">
              <button
                type="button"
                onClick={() => { setJobCreatorReturnView(activeView); setJobCreatorOpen(true); }}
                className="tenops-selected-surface inline-flex h-10 items-center justify-center gap-1.5 border px-3 text-[10px] font-bold uppercase tracking-[0.07em] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {tr('New Job', 'Nuevo trabajo')}
              </button>
            </div>
          </div>

        </div>

        <div data-production-toolbar className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-sm border border-slate-200 bg-white p-2 shadow-sm lg:flex lg:flex-wrap lg:items-center lg:gap-3 lg:p-2.5">
          <div data-production-toolbar-group="view" className="col-span-3 min-w-0 lg:col-auto lg:flex lg:shrink-0 lg:flex-wrap lg:items-center lg:gap-2"><span id="production-view-label" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 lg:mb-0 lg:text-xs">{tr('View', 'Vista')}</span><div role="group" aria-labelledby="production-view-label" className="grid min-w-0 grid-cols-3 items-center rounded-sm border border-slate-300 bg-slate-50 p-1 lg:flex">
            <button
              type="button"
              onClick={() => setActiveView('queue')}
              className={`h-9 min-w-0 px-1 text-[9px] font-bold uppercase tracking-[0.05em] sm:text-[10px] lg:px-4 lg:tracking-[0.09em] ${
                activeView === 'queue'
                  ? 'tenops-selected-surface shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {tr('Overview', 'Resumen')}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('spreadsheet')}
              className={`h-9 min-w-0 px-1 text-[9px] font-bold uppercase tracking-[0.05em] sm:text-[10px] lg:px-4 lg:tracking-[0.09em] ${
                activeView === 'spreadsheet'
                  ? 'tenops-selected-surface shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {tr('Table', 'Tabla')}
            </button>
            <button type="button" onClick={()=>setActiveView('timeline')} className={`h-9 min-w-0 rounded-sm px-1 text-[9px] font-bold uppercase tracking-[0.05em] focus-visible:ring-2 focus-visible:ring-blue-600 sm:text-[10px] lg:px-4 lg:tracking-[0.09em] ${activeView==='timeline'?'tenops-selected-surface shadow-sm':'text-slate-600 hover:bg-white'}`}>{tr('Timeline', 'Cronograma')}</button>
          </div>
          </div>

          <input
            data-production-search
            type="search"
            value={search}
            onChange={(event) => { setFocusedJobId(null); setSearch(event.target.value); }}
            placeholder={tr('Search jobs...', 'Buscar trabajos...')}
            className="col-span-3 h-10 min-w-0 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100 lg:col-auto lg:min-w-64 lg:flex-[1_1_20rem]"
          />

          {activeView !== 'timeline' && <div className="col-span-3 min-w-0 lg:col-auto lg:flex lg:shrink-0 lg:items-center lg:gap-2"><span id="production-sort-label" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 lg:mb-0">{tr('Sort', 'Ordenar')}</span><div role="group" aria-labelledby="production-sort-label" className="grid h-10 min-w-0 grid-cols-3 overflow-hidden rounded-sm border border-slate-300 lg:inline-flex lg:flex-none">{(['stage','deadline','labor'] as ProductionArrangement[]).map((value) => <button key={value} type="button" aria-pressed={arrangement === value} onClick={() => { setArrangementState(value); if (accountPreferences.accountScoped) void accountPreferences.setPreference('production_arrangement', value); else window.localStorage.setItem(PRODUCTION_ARRANGEMENT_KEY, value); }} className={`min-w-0 border-r border-slate-300 px-1 text-[9px] font-bold uppercase last:border-r-0 sm:text-[10px] lg:px-3 ${arrangement === value ? 'tenops-selected-surface' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{language === 'es' ? ({ stage: 'Estado', deadline: 'Entrega', labor: 'Mano de obra' } as const)[value] : value === 'stage' ? 'Status' : value}</button>)}</div></div>}

          {activeView === 'spreadsheet' && (
            <div id="production-table-columns-toolbar-slot" className="relative min-w-0 lg:shrink-0" />
          )}

          <div ref={filterRef} className={`relative min-w-0 lg:shrink-0 ${activeView === 'spreadsheet' ? '' : 'col-span-2'}`}>
            <button
              type="button"
              onClick={() => setIsFilterOpen((current) => !current)}
              className={`inline-flex h-10 w-full items-center justify-center gap-2 border px-3 text-xs font-bold uppercase tracking-[0.07em] transition lg:w-auto ${
                activeFilterCount > 0
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ListFilter className="h-4 w-4" />
              {tr('Filters', 'Filtros')}
              {activeFilterCount > 0 && (
                <span className="tenops-compact-type flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="fixed left-2 right-2 top-32 z-40 border border-slate-400 bg-white p-4 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-72">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{tr('Schedule', 'Programación')}</div>
                <div className="mt-2 space-y-2">
                  {(['scheduled', 'unscheduled'] as ScheduleFilter[]).map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={scheduleFilters.has(value)}
                        onChange={() => toggleScheduleFilter(value)}
                      />
                      {value === 'scheduled' ? tr('Scheduled', 'Programado') : tr('Unscheduled', 'Sin programar')}
                    </label>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-300 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{tr('Production Status', 'Estado de producción')}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusFilters.has(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                      />
                      {language === 'es' ? ({ not_started: 'No iniciado', on_deck: 'Próximo', in_production: 'En producción', on_hold: 'En pausa', shipped: 'Enviado', complete: 'Terminado', cancelled: 'Cancelado' } as Record<ProductionStatus, string>)[option.value] : option.label}
                    </label>
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-sm text-slate-700"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />{tr('Include Archived', 'Incluir archivados')}</label>

                <button
                  type="button"
                  onClick={() => {
                    setScheduleFilters(new Set());
                    setStatusFilters(new Set());
                  }}
                  disabled={activeFilterCount === 0}
                  className="mt-4 h-9 w-full border border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-700 disabled:opacity-40"
                >
                  {tr('Clear Filters', 'Limpiar filtros')}
                </button>
              </div>
            )}
          </div>

          <button
            data-production-refresh
            type="button"
            onClick={() => void loadJobs()}
            disabled={isLoading}
            title={tr('Refresh jobs', 'Actualizar trabajos')}
            aria-label={tr('Refresh jobs', 'Actualizar trabajos')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-slate-400 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadError && (
          <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {loadError}
          </div>
        )}
        <div className="relative mt-3">
        <div data-production-attention-strip data-operational-tone={schedulingAttentionJobs.length > 0 ? 'attention' : undefined} className={`flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 text-xs ${schedulingAttentionJobs.length > 0 ? 'border-l-2 border-amber-500 bg-amber-50/70 text-slate-600' : 'border border-slate-200 bg-white text-slate-600'}`}>
          <button type="button" onClick={() => setAttentionCenterOpen((value) => !value)} aria-expanded={attentionCenterOpen} className="inline-flex min-h-7 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-blue-700">
            {schedulingAttentionJobs.length > 0 ? <span data-scheduling-attention-count className="inline-flex items-center gap-1.5 font-bold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{schedulingAttentionJobs.length} Unscheduled</span> : <span className="font-semibold text-slate-600">All active jobs scheduled</span>}
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="font-semibold text-slate-600">{ordinaryAttentionJobs.length} need attention</span>
            {attentionCenterOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[10px] font-bold text-slate-600">
            <div className="whitespace-nowrap">
              <span className="uppercase tracking-[0.06em]">{tr('Active Jobs', 'Trabajos activos')}</span>
              <span className="ml-1 text-xs text-slate-950">{jobsInQueue}</span>
            </div>
            <span aria-hidden="true" className="hidden text-slate-400 sm:inline">•</span>
            <div className="whitespace-nowrap">
              <span className="uppercase tracking-[0.06em]">{tr('Scheduled', 'Programados')}</span>
              <span className="ml-1 text-xs text-slate-950">{scheduledCount}</span>
            </div>
            <span aria-hidden="true" className="hidden text-slate-400 sm:inline">•</span>
            <div className="whitespace-nowrap">
              <span className="uppercase tracking-[0.06em]">{tr('Showing', 'Mostrando')}</span>
              <span className="ml-1 text-xs text-slate-950">{filteredJobs.length}</span>
            </div>
          </div>
        </div>
        {attentionCenterOpen && <div data-production-attention-center className="absolute left-0 top-full z-30 mt-1 w-full max-w-xl border border-slate-300 bg-white p-2 shadow-xl">
          {schedulingAttentionJobs.length > 0 && <section><h3 className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">Scheduling — Priority</h3>{schedulingAttentionJobs.map((job) => <button key={job.id} type="button" onClick={() => { setAttentionCenterOpen(false); selectJob(job, 'planned-dates'); }} className="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-2 py-2 text-left hover:bg-amber-50"><span className="truncate text-xs font-bold text-slate-900">{job.job_number ? `${job.job_number} · ` : ''}{job.name}</span><span className="shrink-0 text-[10px] text-amber-800">No production schedule</span></button>)}</section>}
          <section className={schedulingAttentionJobs.length ? 'mt-2 border-t border-slate-200 pt-1' : ''}><h3 className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Needs Attention</h3>{ordinaryAttentionJobs.map((job) => { const followUps = jobUpdateSummaries[job.id]?.openFollowUpCount ?? 0; const details = getJobNonblockingPlanningIssues(job).length; return <button key={job.id} type="button" onClick={() => { setAttentionCenterOpen(false); if (followUps > 0) selectJob(job, 'job-updates'); else { setPlanningIssuesCategory('nonblocking'); setPlanningIssuesOpen(true); } }} className="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-2 py-2 text-left hover:bg-slate-50"><span className="truncate text-xs font-bold text-slate-900">{job.job_number ? `${job.job_number} · ` : ''}{job.name}</span><span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-600">{followUps > 0 ? <><Flag className="h-3 w-3" />{followUps} unresolved {followUps === 1 ? 'Update' : 'Updates'}</> : `${details} missing ${details === 1 ? 'detail' : 'details'}`}</span></button>})}{ordinaryAttentionJobs.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">No other Production items need attention.</p>}</section>
        </div>}
        </div>

        <SchedulingFeedbackPanel issues={hasPendingSchedules || previewPlanningIssues ? activePlanningIssues : []} focusedIssueId={focusedPlanningIssueId} />

        {hasPendingSchedules && (() => {
          if (!stagedSchedule) return <div ref={scheduleActionsRef} data-pending-schedule-actions="true" tabIndex={-1} role="status" aria-live="polite" className="fixed bottom-3 left-3 right-3 z-[90] mx-auto flex max-w-5xl flex-col gap-3 border border-amber-600 bg-amber-50 px-4 py-3 shadow-2xl lg:flex-row lg:items-center lg:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Planning schedule pending</div><div className="mt-1 text-sm font-bold text-slate-950">{Object.keys(stagedPlanningSchedules).length} Planning Phase change{Object.keys(stagedPlanningSchedules).length === 1 ? '' : 's'} ready for review</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setReviewOpen(true)} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase">Review changes</button><button type="button" onClick={discardStagedSchedule} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase">Discard all</button><button type="button" onClick={requestScheduleSave} disabled={schedulingErrors.length > 0} className="h-9 border border-slate-950 bg-slate-900 px-4 text-xs font-bold uppercase text-white">Save all changes</button></div></div>;
          const hadSchedule = Boolean(stagedSchedule.persistedStart && stagedSchedule.persistedEnd);
          const estimatedHours = stagedJob?.estimated_man_hours ?? null;
          const before = hadSchedule ? laborIntensity(estimatedHours, stagedSchedule.persistedStart!, stagedSchedule.persistedEnd!) : null;
          const after = laborIntensity(estimatedHours, stagedSchedule.proposedStart, stagedSchedule.proposedEnd);
          const hours = (value: number | null) => value === null ? 'No labor estimate' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} h/day`;
          return (
            <div ref={scheduleActionsRef} data-pending-schedule-actions="true" tabIndex={-1} role="status" aria-live="polite" className="fixed bottom-3 left-3 right-3 z-[90] mx-auto flex max-w-5xl flex-col gap-3 border border-amber-600 bg-amber-50 px-4 py-3 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Production planning pending</div>
                <div className="mt-1 text-sm font-bold text-slate-950">{Object.keys(stagedSchedules).length} Production · {Object.keys(stagedPlanningSchedules).length} Planning changes{conflicts.length ? ` · ${conflicts.length} conflicts` : ''}</div>
                <div className="mt-1 text-sm font-bold text-slate-950">{hadSchedule ? `${stagedSchedule.persistedStart} – ${stagedSchedule.persistedEnd}` : 'Not scheduled'} → {stagedSchedule.proposedStart} – {stagedSchedule.proposedEnd}</div>
                <div className="mt-1 text-xs text-slate-600">{hadSchedule ? `${inclusiveCalendarDays(stagedSchedule.persistedStart!, stagedSchedule.persistedEnd!)} days · ${hours(before!.hoursPerScheduledDay)}` : 'No saved production window'} → {inclusiveCalendarDays(stagedSchedule.proposedStart, stagedSchedule.proposedEnd)} days · {hours(after.hoursPerScheduledDay)}</div>
                {inspectorBlocksScheduleSave && <div className="mt-1 text-xs font-bold text-amber-900">Save the open Inspector job details first. Proposed dates will remain staged.</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setReviewOpen(true)} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase">Review changes</button>
                <button type="button" onClick={discardStagedSchedule} disabled={scheduleSaveState === 'saving'} className="h-9 border border-slate-500 bg-white px-4 text-xs font-bold uppercase">Discard all</button>
                <button type="button" onClick={requestScheduleSave} disabled={scheduleSaveState === 'saving' || schedulingErrors.length > 0 || inspectorBlocksScheduleSave} title={inspectorBlocksScheduleSave ? 'Save the open Inspector job details first' : undefined} className="h-9 border border-slate-950 bg-slate-900 px-4 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-50">Save all changes</button>
              </div>
            </div>
          );
        })()}
        {scheduleMessage && <div ref={scheduleFeedbackRef} tabIndex={-1} role={scheduleSaveState === 'error' ? 'alert' : 'status'} className={`mt-3 px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-700 ${scheduleSaveState === 'error' ? 'border border-red-300 bg-red-50 text-red-800' : 'border border-slate-300 bg-white text-slate-700'}`}>{scheduleMessage}</div>}

        <div className="mt-4">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center border border-slate-400 bg-white text-sm font-semibold text-slate-600">Loading active jobs…</div>
          ) : activeView === 'queue' ? <ProductionQueue jobs={displayedJobs} selectedJobId={selectedJobId} attachmentCounts={attachmentCounts} integrationSummaries={integrationSummaries} jobUpdateSummaries={jobUpdateSummaries} onSelectJob={selectJob} onScheduleJob={openJobScheduling} onCreateRework={setReworkTargetJob}/> : activeView === 'spreadsheet' ? (
            <ProductionTable
              jobs={displayedJobs}
              attachmentCounts={attachmentCounts}
              integrationSummaries={integrationSummaries}
              jobUpdateSummaries={jobUpdateSummaries}
              onUpdateJob={handleUpdateJob}
              onOpenAttachments={(job) => selectJob(job, 'attachments')}
              onCreateRework={setReworkTargetJob}
              stagedSchedules={stagedSchedules}
              onStageSchedule={(job, start, end) => stageSchedule(job, start, end, 'production_table')}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
            />
          ) : (
            <ProductionGantt jobs={filteredJobs} stagedSchedules={stagedSchedules} onStageSchedule={stageSchedule} onSelectJob={selectJob} planningPhases={planningPhases} planningItems={planningItems} stagedPlanningSchedules={stagedPlanningSchedules} onStagePlanningSchedules={stagePlanningSchedules} planningEnabled={planningEnabled} onSelectPlanningPhase={(job, phase) => selectJob(job, `planning:${phase.id}`)} planningIssues={activePlanningIssues} onPreviewPlanningIssuesChange={setPreviewPlanningIssues} onDependencyIssueFocus={setFocusedPlanningIssueId} />
          )}
        </div>
      </div>}

      {reviewOpen && <ScheduleReviewDialog jobs={jobs} phases={planningPhases} production={stagedSchedules} planning={stagedPlanningSchedules} issues={activePlanningIssues} onClose={() => setReviewOpen(false)} onRevertJob={revertStagedJob} onRevertPhase={(phaseId) => { setStagedPlanningSchedules((current) => { const next = { ...current }; delete next[phaseId]; return next; }); }} />}

      <ProductionJobCreator
        open={jobCreatorOpen}
        onClose={() => setJobCreatorOpen(false)}
        onCreateJob={handleCreateJob}
        jobs={jobs}
        attachmentCounts={attachmentCounts}
        jobUpdateSummaries={jobUpdateSummaries}
        planningPhaseCounts={planningPhases.reduce<Record<string, number>>((counts, phase) => ({ ...counts, [phase.job_id]: (counts[phase.job_id] ?? 0) + 1 }), {})}
        onUpdateJob={handleUpdateJob}
        onAttachFiles={async (jobId, files) => {
          const uploaded = await uploadJobAttachments(jobId, files, 'work_order');
          setAttachmentCounts((current) => ({ ...current, [jobId]: (current[jobId] ?? 0) + uploaded.length }));
        }}
        onOpenJob={(job) => selectJob(job, 'attachments')}
        onCreated={(job) => { setCreatedJobScheduleError(''); setCreatedJob(job); }}
      />

      {createdJob && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="production-job-created-title" className="w-full max-w-lg rounded-sm border border-slate-300 bg-white p-5 shadow-2xl sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Production</div>
            <h2 id="production-job-created-title" className="mt-1 text-xl font-bold text-slate-950">Production Job Created</h2>
            <p className="mt-2 text-sm text-slate-600">The Production Job was created successfully.</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{createdJob.job_number ? `${createdJob.job_number} · ` : ''}{createdJob.name}</p>
            <div className="mt-4 border border-amber-300 bg-amber-50 px-3 py-3">
              <UnscheduledBadge />
              <p className="mt-2 text-sm text-amber-900">This Production Job will not appear on the Timeline until it has been scheduled.</p>
            </div>
            {createdJobScheduleError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{createdJobScheduleError}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setActiveView(jobCreatorReturnView, false); setCreatedJob(null); }} className="h-10 whitespace-nowrap border border-slate-400 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 sm:flex-1">Return to Production</button>
              <button type="button" onClick={() => void openCreatedJobScheduling(createdJob)} className="h-10 whitespace-nowrap border border-blue-900 bg-blue-900 px-4 text-sm font-bold text-white hover:bg-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:flex-1">Open Timeline to Schedule Job</button>
            </div>
          </div>
        </div>
      )}

      {approvalDialogOpen && hasPendingSchedules && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div ref={approvalDialogRef} role="dialog" aria-modal="true" aria-labelledby="schedule-approval-title" className="max-h-full w-full max-w-xl overflow-y-auto border border-slate-500 bg-white p-5 shadow-2xl sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Preliminary Timeline approval</div>
            <h2 id="schedule-approval-title" className="mt-1 text-xl font-bold text-slate-950">Confirm {Object.keys(stagedSchedules).length + Object.keys(stagedPlanningSchedules).length} schedule changes</h2>
            <div className="mt-4 border border-slate-300 bg-slate-50 p-3 text-sm">
              <div className="font-bold text-slate-950">{Object.keys(stagedSchedules).length} Production schedule change{Object.keys(stagedSchedules).length === 1 ? '' : 's'}</div>
              <div className="mt-1 font-bold text-slate-950">{Object.keys(stagedPlanningSchedules).length} Planning Phase change{Object.keys(stagedPlanningSchedules).length === 1 ? '' : 's'}</div>
              {stagedSchedule && <div className="mt-2 text-xs text-slate-600">{stagedSchedule.persistedStart && stagedSchedule.persistedEnd ? `${stagedSchedule.persistedStart} – ${stagedSchedule.persistedEnd}` : 'Not scheduled'} → {stagedSchedule.proposedStart} – {stagedSchedule.proposedEnd}</div>}
            </div>
            {approvalActive ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"><span>Temporary approval active for {Math.floor(approvalSecondsRemaining / 60)}:{String(approvalSecondsRemaining % 60).padStart(2, '0')}. Explicit confirmation is still required.</span><button type="button" onClick={() => { window.sessionStorage.removeItem(APPROVAL_EXPIRES_KEY); setApprovalExpiresAt(null); setApprovalNow(Date.now()); }} className="text-xs font-bold uppercase underline focus-visible:ring-2 focus-visible:ring-blue-700">Lock approval</button></div> : approvalExpiresAt ? <div className="mt-4 border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">Approval window expired. Enter the approval password to continue.</div> : null}
            <label htmlFor="production-changed-by" className="mt-4 block text-sm font-bold text-slate-800">Changed by <span className="font-normal text-slate-500">— Recorded name for this change</span></label>
            <input ref={approvalInitialRef} id="production-changed-by" value={changedByName} onChange={(event) => { setChangedByName(event.target.value); setApprovalError(''); }} autoComplete="name" className="mt-1 h-11 w-full border border-slate-400 px-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950" />
            {!approvalActive && <><label htmlFor="production-approval-password" className="mt-4 block text-sm font-bold text-slate-800">Approval password</label><input id="production-approval-password" type="password" value={approvalPassword} onChange={(event) => { setApprovalPassword(event.target.value); setApprovalError(''); }} autoComplete="off" className="mt-1 h-11 w-full border border-slate-400 px-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950" /></>}
            <label htmlFor="production-change-note" className="mt-4 block text-sm font-bold text-slate-800">Reason / notes <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="production-change-note" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} rows={3} className="mt-1 w-full resize-y border border-slate-400 px-3 py-2 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950" />
            {approvalError && <div role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{approvalError}</div>}
            <p className="mt-3 text-xs text-slate-500">This client-side confirmation is an internal MVP guardrail, not secure authentication.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setApprovalDialogOpen(false); setApprovalPassword(''); setApprovalError(''); }} className="h-10 border border-slate-400 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-800">Cancel</button><button type="button" onClick={confirmApprovedSave} disabled={scheduleSaveState === 'saving' || schedulingErrors.length > 0 || inspectorBlocksScheduleSave} className="h-10 border border-slate-950 bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Confirm and save</button></div>
          </div>
        </div>
      )}

      {selectedJob && <ProductionJobInspector
        key={selectedJob.id}
        job={stagedSchedules[selectedJob.id] ? { ...selectedJob, planned_start: stagedSchedules[selectedJob.id].proposed_planned_start, planned_end: stagedSchedules[selectedJob.id].proposed_planned_end } : selectedJob}
        jobUpdateSummary={jobUpdateSummaries[selectedJob.id] ?? EMPTY_JOB_UPDATE_SUMMARY}
        onJobUpdateSummaryChanged={handleJobUpdateSummaryChanged}
        onClose={closeInspector}
        onUpdateJob={handleUpdateJob}
        onArchive={async (job) => { const archived = await archiveProductionJob(job); setJobs((current) => includeArchived ? current.map((item) => item.id === job.id ? archived : item) : current.filter((item) => item.id !== job.id)); closeInspector(); }}
        onRestore={async (job) => { const restored = await restoreProductionJob(job); setJobs((current) => current.map((item) => item.id === job.id ? restored : item)); closeInspector(); }}
        onStageSchedule={(job, start, end) => stageSchedule(job, start, end, 'production_inspector')}
        scheduleIsStaged={Boolean(stagedSchedules[selectedJob.id])}
        onOrdinarySaveStateChange={setInspectorOrdinarySaveState}
        onAttachmentsChanged={(jobId, count) => setAttachmentCounts((current) => ({ ...current, [jobId]: count }))}
        onPlanningPhasesChanged={handlePlanningPhasesChanged}
        onPlanningItemsChanged={handlePlanningItemsChanged}
        stagedPlanningSchedules={stagedPlanningSchedules}
        planningPhases={planningPhases}
        planningIssues={activePlanningIssues}
        initialFocus={inspectorFocus}
        onScheduleJob={openJobScheduling}
        onCreateRework={setReworkTargetJob}
      />}
      {reworkTargetJob && <CreateReworkDialog job={reworkTargetJob} onClose={() => setReworkTargetJob(null)} onCreated={async () => { setReworkTargetJob(null); await loadJobs(); }} />}
      {planningIssuesOpen && <PlanningIssuesPanel category={planningIssuesCategory} jobs={jobs} stagedSchedules={stagedSchedules} onClose={() => setPlanningIssuesOpen(false)} onUpdateJob={handleUpdateJob} onStageSchedule={(job, start, end) => stageSchedule(job, start, end, 'production_inspector')} onOpenInspector={selectJob} />}


    </div>
  );
}
