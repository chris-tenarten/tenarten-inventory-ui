'use client';

import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as DisclosureRight, CircleX, Layers, LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import type { StagedSchedules } from '../schedule-staging';
import {
  addCalendarDays,
  differenceInCalendarDays,
  formatScheduleDate,
  inclusiveCalendarDays,
  laborIntensity,
  parseScheduleDate,
} from '../schedule';
import type { ProductionJob } from '../types';
import { arrangeProductionTimelineJobs } from '../arrangement';
import { productionStatusVisuals, productionStatusVisualByValue } from '../status-visuals';
import {
  clampTimelineDayWidth,
  defaultTimelinePreferences,
  fitRenderedTimelineScrollLeft,
  parseTimelinePreferences,
  productionTimelineFitParticipates,
  productionTimelinePlanningHorizon,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
  TIMELINE_PREFERENCES_KEY,
  TIMELINE_ROW_DENSITY_OPTIONS,
  TIMELINE_ZOOM_OPTIONS,
  timelineIntervalFocusScrollLeft,
  timelineZoomOption,
} from '../timeline-preferences';
import type { TimelinePreferences, TimelineZoom } from '../timeline-preferences';
import type { PlanningItem, PlanningPhase } from '@/modules/planning/types';
import { calculatePhaseProgress } from '@/modules/planning/progress.mjs';
import {
  COLLAPSED_PHASE_DISPLAY_EVENT,
  COLLAPSED_PHASE_DISPLAY_STORAGE_KEY,
  readCollapsedPhaseDisplayMode,
  type CollapsedPhaseDisplayMode,
} from '@/modules/planning/collapsed-phase-display';
import { adjustPlanningInterval, planningPhaseWithStagedDates, type StagedPlanningSchedules } from '@/modules/planning/schedule-staging';
import { dependentPlanningPhaseIds, evaluatePlanningSchedule, planningCascadeDelta, planningDependencyGraphIsAcyclic, type PlanningScheduleIssue } from '@/modules/planning/schedule-model.mjs';
import { overlayVisualForPhase, PLANNING_PAUSE_HATCH } from '@/modules/planning/phase-visuals';
import { mergePauseRanges, planningIntervalGeometry, rangesIntersect, selectCollapsedTimelinePhases } from '@/modules/planning/timeline-model.mjs';
import { useAccountPreferences } from '@/lib/account-preferences';

type ProductionGanttProps = {
  jobs: ProductionJob[];
  stagedSchedules: StagedSchedules;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  onSelectJob: (job: ProductionJob, focus?: string) => void;
  planningPhases?: PlanningPhase[];
  planningItems?: PlanningItem[];
  stagedPlanningSchedules?: StagedPlanningSchedules;
  onStagePlanningSchedules?: (changes: Array<{ phase: PlanningPhase; start: string; end: string }>) => void;
  planningEnabled?: boolean;
  onSelectPlanningPhase?: (job: ProductionJob, card: PlanningPhase) => void;
  planningIssues?: PlanningScheduleIssue[];
  onPreviewPlanningIssuesChange?: (issues: PlanningScheduleIssue[] | null) => void;
  onDependencyIssueFocus?: (issueId: string | null) => void;
};

type TimelineDay = {
  date: Date;
  key: string;
  dayNumber: number;
  weekday: string;
  monthLabel: string;
  isWeekend: boolean;
  isToday: boolean;
};

type InteractionMode = 'move' | 'resize-start' | 'resize-end';

type ScheduleInteraction = {
  jobId: string;
  pointerId: number;
  mode: InteractionMode;
  originClientX: number;
  pointerX: number;
  pointerY: number;
  originalStart: string;
  originalEnd: string;
  previewStart: string;
  previewEnd: string;
  hasMoved: boolean;
  dayWidth: number;
};
type PhaseScheduleInteraction = Omit<ScheduleInteraction, 'jobId'> & {
  phaseId: string;
  cascadeOriginals: Record<string, { start: string; end: string }>;
};

const DRAG_THRESHOLD_PX = 4;
const PAN_BUTTON_SPEED = 520;
const DOMAIN_EDGE_VIEWPORTS = 1.25;
type TimelineScrollMetrics = {
  scrollLeft: number;
  maxScrollLeft: number;
  viewportWidth: number;
  scrollWidth: number;
};

type CanvasPan = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
};
type NavigatorDrag = { pointerId: number; startX: number; startScrollLeft: number };

type ExecutionLabelMode = 'hidden' | 'title' | 'percent';

function PhaseExecutionLabels({ title, percent }: { title: string; percent: number }) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const metricRef = useRef<HTMLSpanElement>(null);
  const [mode, setMode] = useState<ExecutionLabelMode>('hidden');

  useLayoutEffect(() => {
    const metric = metricRef.current;
    const titleElement = titleRef.current;
    const container = metric?.parentElement;
    const phaseBar = container?.parentElement;
    if (!metric || !container || !titleElement || !phaseBar) return;
    const update = () => {
      const barWidth = phaseBar.getBoundingClientRect().width;
      const nextMode: ExecutionLabelMode = barWidth < 48
        ? 'hidden'
        : barWidth >= 112
          ? 'percent'
          : 'title';
      setMode((current) => current === nextMode ? current : nextMode);
    };
    const observer = new ResizeObserver(update);
    observer.observe(phaseBar);
    observer.observe(container);
    update();
    return () => observer.disconnect();
  }, []);

  return <>
    <span ref={titleRef} data-planning-phase-title className={`${mode === 'hidden' ? 'hidden' : 'block'} min-w-0 truncate px-1 text-white`} style={{ textShadow: '0 1px 2px rgba(15, 23, 42, 0.95), 0 0 2px rgba(15, 23, 42, 0.85)' }}>{title}</span>
    <span ref={metricRef} data-planning-execution-metric data-mode={mode} className={`${mode === 'percent' ? 'ml-auto inline-flex' : 'hidden'} shrink-0 px-1 tabular-nums text-[8px] text-white`} style={{ textShadow: '0 1px 2px rgba(15, 23, 42, 0.95), 0 0 2px rgba(15, 23, 42, 0.85)' }}>{percent}%</span>
  </>;
}


function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatShortDate(value: string | null) {
  if (!value) return 'Not set';
  return parseScheduleDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatHours(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function scheduledDaysLabel(days: number) {
  return `${days} scheduled day${days === 1 ? '' : 's'}`;
}

function intensityLabel(job: ProductionJob, start: string, end: string) {
  const intensity = laborIntensity(job.estimated_man_hours, start, end);
  if (intensity.estimatedHours === null) return 'No labor estimate';
  if (intensity.hoursPerScheduledDay === null) return 'No scheduled days';
  return `${formatHours(intensity.hoursPerScheduledDay)} labor-hours per scheduled day`;
}

function proposedDates(interaction: Pick<ScheduleInteraction, 'mode' | 'originClientX' | 'dayWidth' | 'originalStart' | 'originalEnd'>, clientX: number) {
  const deltaDays = Math.round((clientX - interaction.originClientX) / interaction.dayWidth);
  return adjustPlanningInterval(interaction.originalStart, interaction.originalEnd, deltaDays, interaction.mode);
}

function createTimeline(jobs: ProductionJob[], zoom: TimelineZoom, extension: { past: number; future: number }) {
  const zoomOption = timelineZoomOption(zoom);
  const today = startOfLocalDay(new Date());
  const timelineDates = jobs.flatMap((job) => [job.planned_start, job.planned_end, job.requested_delivery_date]
    .filter((value): value is string => Boolean(value))
    .map(parseScheduleDate));
  const earliestJobDate = timelineDates.length > 0
    ? new Date(Math.min(...timelineDates.map((date) => date.getTime())))
    : today;
  const latestJobDate = timelineDates.length > 0
    ? new Date(Math.max(...timelineDates.map((date) => date.getTime())))
    : addCalendarDays(today, 28);
  const baseEarliest = addCalendarDays(earliestJobDate < today ? earliestJobDate : today, -zoomOption.paddingDays);
  const earliest = addCalendarDays(baseEarliest, -extension.past);
  const minimumEnd = addCalendarDays(baseEarliest, zoomOption.minimumDays - 1);
  const paddedLatest = addCalendarDays(latestJobDate > today ? latestJobDate : today, zoomOption.paddingDays);
  const baseLatest = paddedLatest > minimumEnd ? paddedLatest : minimumEnd;
  const latest = addCalendarDays(baseLatest, extension.future);
  const totalDays = differenceInCalendarDays(latest, earliest) + 1;
  const days: TimelineDay[] = [];

  for (let index = 0; index < totalDays; index += 1) {
    const date = addCalendarDays(earliest, index);
    days.push({
      date,
      key: formatScheduleDate(date),
      dayNumber: date.getDate(),
      weekday: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      monthLabel: date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: differenceInCalendarDays(date, today) === 0,
    });
  }

  return { start: earliest, days };
}

export default function ProductionGantt({ jobs, stagedSchedules, onStageSchedule, onSelectJob, planningPhases = [], planningItems = [], stagedPlanningSchedules = {}, onStagePlanningSchedules, planningEnabled = false, onSelectPlanningPhase, planningIssues = [], onPreviewPlanningIssuesChange, onDependencyIssueFocus }: ProductionGanttProps) {
  const accountPreferences = useAccountPreferences();
  const [interaction, setInteraction] = useState<ScheduleInteraction | null>(null);
  const [phaseInteraction, setPhaseInteraction] = useState<PhaseScheduleInteraction | null>(null);
  const [preferences, setPreferences] = useState<TimelinePreferences>(defaultTimelinePreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [scrollMetrics, setScrollMetrics] = useState<TimelineScrollMetrics>({ scrollLeft: 0, maxScrollLeft: 0, viewportWidth: 0, scrollWidth: 0 });
  const [canvasPan, setCanvasPan] = useState<CanvasPan | null>(null);
  const [navigatorDrag, setNavigatorDrag] = useState<NavigatorDrag | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(() => new Set());
  const [hoveredPlanningPhaseId, setHoveredPlanningPhaseId] = useState<string | null>(null);
  const [selectedDependencyIssueId, setSelectedDependencyIssueId] = useState<string | null>(null);
  const [selectedPhaseWarningId, setSelectedPhaseWarningId] = useState<string | null>(null);
  const [collapsedPhaseDisplay, setCollapsedPhaseDisplay] = useState<CollapsedPhaseDisplayMode>('fill');
  const [mobileReadOnly, setMobileReadOnly] = useState(false);
  const [mobileLandscape, setMobileLandscape] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'fit' | 'today' | null>(null);
  const [domainExtension, setDomainExtension] = useState({ past: 0, future: 0 });
  const ganttRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const navigatorTrackRef = useRef<HTMLDivElement | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const panDirectionRef = useRef(0);
  const lastPanTimeRef = useRef(0);
  const timelinePointerInsideRef = useRef(false);
  const initialViewportPositionedRef = useRef(false);
  const domainExtensionPendingRef = useRef(false);
  const pendingPrependWidthRef = useRef(0);
  const programmaticNavigationRef = useRef(false);
  const navigationReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const phaseElementRefs = useRef(new Map<string, HTMLDivElement>());
  const zoom = preferences.zoom;
  const railWidth = mobileReadOnly ? mobileLandscape ? 220 : 176 : preferences.railWidth;
  const rowDensityIndex = Math.max(0, TIMELINE_ROW_DENSITY_OPTIONS.findIndex((option) => option.value === preferences.rowDensity));
  const rowDensityOption = TIMELINE_ROW_DENSITY_OPTIONS[rowDensityIndex];
  const displayJobRowHeight = mobileLandscape ? 44 : rowDensityOption.height;
  const displayJobs = useMemo(() => arrangeProductionTimelineJobs(jobs.map((job) => stagedSchedules[job.id]
    ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
    : job)), [jobs, stagedSchedules]);
  const scheduledJobs = useMemo(() => displayJobs.filter((job) => job.planned_start && job.planned_end), [displayJobs]);
  const timeline = useMemo(() => createTimeline(displayJobs, zoom, domainExtension), [displayJobs, domainExtension, zoom]);
  const zoomOption = timelineZoomOption(zoom);
  const dayWidth = preferences.dayWidths[zoom];
  const effectivePlanningPhases = useMemo(() => {
    const staged = planningPhases.map((phase) => planningPhaseWithStagedDates(phase, stagedPlanningSchedules));
    if (!phaseInteraction) return staged;
    const delta = planningCascadeDelta(phaseInteraction.originalStart, phaseInteraction.originalEnd, phaseInteraction.previewStart, phaseInteraction.previewEnd, phaseInteraction.mode);
    return staged.map((phase) => {
      if (phase.id === phaseInteraction.phaseId) return { ...phase, start_date: phaseInteraction.previewStart, end_date: phaseInteraction.previewEnd };
      const original = phaseInteraction.cascadeOriginals[phase.id];
      if (!original || delta === 0) return phase;
      const shifted = adjustPlanningInterval(original.start, original.end, delta, 'move');
      return { ...phase, start_date: shifted.start, end_date: shifted.end };
    });
  }, [phaseInteraction, planningPhases, stagedPlanningSchedules]);
  const livePlanningIssues = useMemo(() => evaluatePlanningSchedule(effectivePlanningPhases, displayJobs), [displayJobs, effectivePlanningPhases]);
  const visiblePlanningIssues = phaseInteraction ? livePlanningIssues : planningIssues;
  const phasesByJob = useMemo(() => {
    const grouped = new Map<string, PlanningPhase[]>();
    effectivePlanningPhases.forEach((card) => {
      const current = grouped.get(card.job_id) ?? [];
      current.push(card);
      grouped.set(card.job_id, current);
    });
    return grouped;
  }, [effectivePlanningPhases]);

  useEffect(() => {
    onPreviewPlanningIssuesChange?.(phaseInteraction ? livePlanningIssues : null);
  }, [livePlanningIssues, onPreviewPlanningIssuesChange, phaseInteraction]);

  useEffect(() => {
    if (!selectedDependencyIssueId && !selectedPhaseWarningId) return;
    function closePopover(event: globalThis.PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-planning-warning-popover]')) return;
      setSelectedDependencyIssueId(null);
      setSelectedPhaseWarningId(null);
      onDependencyIssueFocus?.(null);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setSelectedDependencyIssueId(null);
      setSelectedPhaseWarningId(null);
      onDependencyIssueFocus?.(null);
    }
    document.addEventListener('pointerdown', closePopover);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePopover);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onDependencyIssueFocus, selectedDependencyIssueId, selectedPhaseWarningId]);

  useEffect(() => {
    const narrowQuery = window.matchMedia('(max-width: 767px)');
    const touchQuery = window.matchMedia('(pointer: coarse) and (max-width: 1023px)');
    const landscapeQuery = window.matchMedia('(orientation: landscape) and (max-width: 1023px) and (max-height: 600px)');
    const syncMobileMode = () => {
      setMobileReadOnly(narrowQuery.matches || touchQuery.matches || landscapeQuery.matches);
      setMobileLandscape(landscapeQuery.matches);
    };
    syncMobileMode();
    narrowQuery.addEventListener('change', syncMobileMode);
    touchQuery.addEventListener('change', syncMobileMode);
    landscapeQuery.addEventListener('change', syncMobileMode);
    return () => {
      narrowQuery.removeEventListener('change', syncMobileMode);
      touchQuery.removeEventListener('change', syncMobileMode);
      landscapeQuery.removeEventListener('change', syncMobileMode);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const localPreferences = parseTimelinePreferences(window.localStorage.getItem(TIMELINE_PREFERENCES_KEY));
      setPreferences({
        ...localPreferences,
        zoom: accountPreferences.accountScoped ? accountPreferences.preferences.timeline_zoom ?? defaultTimelinePreferences.zoom : localPreferences.zoom,
        rowDensity: accountPreferences.accountScoped ? accountPreferences.preferences.timeline_row_density ?? defaultTimelinePreferences.rowDensity : localPreferences.rowDensity,
      });
      setCollapsedPhaseDisplay(accountPreferences.accountScoped
        ? accountPreferences.preferences.collapsed_phase_display ?? 'fill'
        : readCollapsedPhaseDisplayMode());
      setPreferencesLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [accountPreferences.accountScoped, accountPreferences.preferences.collapsed_phase_display, accountPreferences.preferences.timeline_row_density, accountPreferences.preferences.timeline_zoom]);

  useEffect(() => {
    if (accountPreferences.accountScoped) return;
    const syncCollapsedPhaseDisplay = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== COLLAPSED_PHASE_DISPLAY_STORAGE_KEY) return;
      setCollapsedPhaseDisplay(readCollapsedPhaseDisplayMode());
    };
    window.addEventListener('storage', syncCollapsedPhaseDisplay);
    window.addEventListener(COLLAPSED_PHASE_DISPLAY_EVENT, syncCollapsedPhaseDisplay);
    return () => {
      window.removeEventListener('storage', syncCollapsedPhaseDisplay);
      window.removeEventListener(COLLAPSED_PHASE_DISPLAY_EVENT, syncCollapsedPhaseDisplay);
    };
  }, [accountPreferences.accountScoped]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const devicePreferences = accountPreferences.accountScoped ? {
      ...preferences,
      zoom: defaultTimelinePreferences.zoom,
      rowDensity: defaultTimelinePreferences.rowDensity,
    } : preferences;
    window.localStorage.setItem(TIMELINE_PREFERENCES_KEY, JSON.stringify(devicePreferences));
  }, [accountPreferences.accountScoped, preferences, preferencesLoaded]);

  const updateScrollMetrics = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    setScrollMetrics({
      scrollLeft: Math.min(element.scrollLeft, maxScrollLeft),
      maxScrollLeft,
      viewportWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    });
  }, []);

  const releaseProgrammaticNavigation = useCallback(() => {
    if (navigationReleaseTimerRef.current) clearTimeout(navigationReleaseTimerRef.current);
    navigationReleaseTimerRef.current = setTimeout(() => {
      programmaticNavigationRef.current = false;
      navigationReleaseTimerRef.current = null;
    }, 450);
  }, []);

  const focusTimelineWorkspace = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const shellHeader = document.querySelector<HTMLElement>('[data-shell-header]');
    const headerHeight = shellHeader?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: window.scrollY + workspace.getBoundingClientRect().top - headerHeight, behavior: 'smooth' });
  }, []);

  const extendTimelineAtEdge = useCallback((element: HTMLDivElement) => {
    if (domainExtensionPendingRef.current || programmaticNavigationRef.current) return;
    const calendarViewport = Math.max(1, element.clientWidth - railWidth);
    const threshold = calendarViewport * DOMAIN_EDGE_VIEWPORTS;
    const chunkDays = Math.max(28, Math.ceil(calendarViewport / dayWidth));
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    if (element.scrollLeft <= threshold) {
      domainExtensionPendingRef.current = true;
      pendingPrependWidthRef.current = chunkDays * dayWidth;
      setDomainExtension((current) => ({ ...current, past: current.past + chunkDays }));
    } else if (maxScrollLeft - element.scrollLeft <= threshold) {
      domainExtensionPendingRef.current = true;
      setDomainExtension((current) => ({ ...current, future: current.future + chunkDays }));
    }
  }, [dayWidth, railWidth]);

  const handleTimelineScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    updateScrollMetrics();
    if (!programmaticNavigationRef.current) setNavigationMode(null);
    extendTimelineAtEdge(element);
  }, [extendTimelineAtEdge, updateScrollMetrics]);

  useLayoutEffect(() => {
    if (!domainExtensionPendingRef.current) return;
    const element = scrollRef.current;
    if (element && pendingPrependWidthRef.current > 0) element.scrollLeft += pendingPrependWidthRef.current;
    pendingPrependWidthRef.current = 0;
    domainExtensionPendingRef.current = false;
    updateScrollMetrics();
  }, [domainExtension, updateScrollMetrics]);

  useEffect(() => () => {
    if (navigationReleaseTimerRef.current) clearTimeout(navigationReleaseTimerRef.current);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    updateScrollMetrics();
    const observer = new ResizeObserver(updateScrollMetrics);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    window.addEventListener('resize', updateScrollMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScrollMetrics);
    };
  }, [dayWidth, railWidth, timeline.days.length, updateScrollMetrics]);

  useEffect(() => {
    if (!preferencesLoaded || initialViewportPositionedRef.current) return;

    const positionInitialViewport = (remainingAttempts: number) => {
      const element = scrollRef.current;
      if (!element) return;
      const calendarViewport = element.clientWidth - railWidth;
      if (calendarViewport <= 0) {
        if (remainingAttempts > 0) requestAnimationFrame(() => positionInitialViewport(remainingAttempts - 1));
        return;
      }

      const horizon = productionTimelinePlanningHorizon(displayJobs);
      const focusDate = horizon?.start ?? formatScheduleDate(startOfLocalDay(new Date()));
      const focusOffset = differenceInCalendarDays(parseScheduleDate(focusDate), timeline.start);
      const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollLeft = Math.min(maxScrollLeft, Math.max(0, (focusOffset - zoomOption.paddingDays) * dayWidth));
      initialViewportPositionedRef.current = true;
      updateScrollMetrics();
    };

    const frame = requestAnimationFrame(() => positionInitialViewport(3));
    return () => cancelAnimationFrame(frame);
  }, [dayWidth, displayJobs, preferencesLoaded, railWidth, timeline.start, updateScrollMetrics, zoomOption.paddingDays]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, [contenteditable="true"]')) return;
      if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey && timelinePointerInsideRef.current) {
        event.preventDefault();
        setSpacePressed(true);
      }
    }
    function handleKeyUp(event: globalThis.KeyboardEvent) {
      if (event.code === 'Space') setSpacePressed(false);
    }
    function handleBlur() { setSpacePressed(false); }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!interaction) return;
    const activeInteraction = interaction;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeInteraction.pointerId) return;
      setInteraction((current) => {
        if (!current || current.pointerId !== event.pointerId) return current;
        const hasMoved = current.hasMoved || Math.abs(event.clientX - current.originClientX) >= DRAG_THRESHOLD_PX;
        if (!hasMoved) return { ...current, pointerX: event.clientX, pointerY: event.clientY };
        const dates = proposedDates(current, event.clientX);
        return {
          ...current,
          pointerX: event.clientX,
          pointerY: event.clientY,
          previewStart: dates.start,
          previewEnd: dates.end,
          hasMoved: true,
        };
      });
    }

    function finishPointer(event: PointerEvent, cancelled: boolean) {
      if (event.pointerId !== activeInteraction.pointerId) return;
      const hasMoved = activeInteraction.hasMoved || Math.abs(event.clientX - activeInteraction.originClientX) >= DRAG_THRESHOLD_PX;
      const finalDates = hasMoved ? proposedDates(activeInteraction, event.clientX) : null;
      setInteraction(null);
      if (
        !cancelled &&
        finalDates &&
        (finalDates.start !== activeInteraction.originalStart || finalDates.end !== activeInteraction.originalEnd)
      ) {
        const job = jobs.find((item) => item.id === activeInteraction.jobId);
        if (job) onStageSchedule(job, finalDates.start, finalDates.end);
      } else if (!cancelled && !hasMoved && activeInteraction.mode === 'move') {
        const job = jobs.find((item) => item.id === activeInteraction.jobId);
        if (job) onSelectJob(job);
      }
    }

    const handlePointerUp = (event: PointerEvent) => finishPointer(event, false);
    const handlePointerCancel = (event: PointerEvent) => finishPointer(event, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [interaction, jobs, onSelectJob, onStageSchedule]);

  useEffect(() => {
    if (!phaseInteraction) return;
    const activeInteraction = phaseInteraction;
    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeInteraction.pointerId) return;
      setPhaseInteraction((current) => {
        if (!current || current.pointerId !== event.pointerId) return current;
        const hasMoved = current.hasMoved || Math.abs(event.clientX - current.originClientX) >= DRAG_THRESHOLD_PX;
        if (!hasMoved) return { ...current, pointerX: event.clientX, pointerY: event.clientY };
        const dates = proposedDates(current, event.clientX);
        return { ...current, pointerX: event.clientX, pointerY: event.clientY, previewStart: dates.start, previewEnd: dates.end, hasMoved: true };
      });
    }
    function finishPointer(event: PointerEvent, cancelled: boolean) {
      if (event.pointerId !== activeInteraction.pointerId) return;
      const hasMoved = activeInteraction.hasMoved || Math.abs(event.clientX - activeInteraction.originClientX) >= DRAG_THRESHOLD_PX;
      const dates = hasMoved ? proposedDates(activeInteraction, event.clientX) : null;
      setPhaseInteraction(null);
      const persistedPhase = planningPhases.find((phase) => phase.id === activeInteraction.phaseId);
      if (!cancelled && dates && persistedPhase && onStagePlanningSchedules && (dates.start !== activeInteraction.originalStart || dates.end !== activeInteraction.originalEnd)) {
        const delta = planningCascadeDelta(activeInteraction.originalStart, activeInteraction.originalEnd, dates.start, dates.end, activeInteraction.mode);
        const changes = [{ phase: persistedPhase, start: dates.start, end: dates.end }];
        Object.entries(activeInteraction.cascadeOriginals).forEach(([phaseId, original]) => {
          const dependent = planningPhases.find((phase) => phase.id === phaseId);
          if (!dependent || delta === 0) return;
          const shifted = adjustPlanningInterval(original.start, original.end, delta, 'move');
          changes.push({ phase: dependent, start: shifted.start, end: shifted.end });
        });
        onStagePlanningSchedules(changes);
      } else if (!cancelled && !hasMoved && activeInteraction.mode === 'move' && persistedPhase) {
        const job = jobs.find((candidate) => candidate.id === persistedPhase.job_id);
        if (job) onSelectPlanningPhase?.(job, persistedPhase);
      }
    }
    const pointerUp = (event: PointerEvent) => finishPointer(event, false);
    const pointerCancel = (event: PointerEvent) => finishPointer(event, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerCancel);
    return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerCancel); };
  }, [jobs, onSelectPlanningPhase, onStagePlanningSchedules, phaseInteraction, planningPhases]);

  function startInteraction(event: ReactPointerEvent, job: ProductionJob, mode: InteractionMode) {
    if (mobileReadOnly) {
      event.preventDefault();
      event.stopPropagation();
      if (mode === 'move') onSelectJob(job);
      return;
    }
    const proposed = stagedSchedules[job.id];
    const start = proposed?.proposed_planned_start ?? job.planned_start;
    const end = proposed?.proposed_planned_end ?? job.planned_end;
    if (!start || !end) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({
      jobId: job.id,
      pointerId: event.pointerId,
      mode,
      originClientX: event.clientX,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originalStart: start,
      originalEnd: end,
      previewStart: start,
      previewEnd: end,
      hasMoved: false,
      dayWidth,
    });
  }

  function startPhaseInteraction(event: ReactPointerEvent, phase: PlanningPhase, mode: InteractionMode) {
    if (mobileReadOnly) {
      event.preventDefault();
      event.stopPropagation();
      if (mode === 'move') {
        const job = jobs.find((candidate) => candidate.id === phase.job_id);
        if (job) onSelectPlanningPhase?.(job, planningPhases.find((candidate) => candidate.id === phase.id) ?? phase);
      }
      return;
    }
    if (!phase.start_date || !phase.end_date || phase.timeline_behavior === 'planning_only') return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const jobPhases = effectivePlanningPhases.filter((candidate) => candidate.job_id === phase.job_id);
    const canCascade = mode !== 'resize-start' && planningDependencyGraphIsAcyclic(jobPhases, phase.id);
    const cascadeIds = canCascade ? dependentPlanningPhaseIds(jobPhases, phase.id) : [];
    const cascadeOriginals = Object.fromEntries(jobPhases
      .filter((candidate) => cascadeIds.includes(candidate.id) && candidate.start_date && candidate.end_date)
      .map((candidate) => [candidate.id, { start: candidate.start_date!, end: candidate.end_date! }]));
    setPhaseInteraction({ phaseId: phase.id, pointerId: event.pointerId, mode, originClientX: event.clientX, pointerX: event.clientX, pointerY: event.clientY, originalStart: phase.start_date, originalEnd: phase.end_date, previewStart: phase.start_date, previewEnd: phase.end_date, hasMoved: false, dayWidth, cascadeOriginals });
  }

  function handlePhaseScheduleKey(event: KeyboardEvent<HTMLButtonElement>, phase: PlanningPhase, mode: InteractionMode) {
    if (!phase.start_date || !phase.end_date) return;
    if (mobileReadOnly) {
      if ((event.key === 'Enter' || event.key === ' ') && mode === 'move') {
        event.preventDefault();
        const job = jobs.find((candidate) => candidate.id === phase.job_id);
        if (job) onSelectPlanningPhase?.(job, planningPhases.find((candidate) => candidate.id === phase.id) ?? phase);
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && mode === 'move') {
      event.preventDefault();
      const job = jobs.find((candidate) => candidate.id === phase.job_id);
      if (job) onSelectPlanningPhase?.(job, planningPhases.find((candidate) => candidate.id === phase.id) ?? phase);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -1 : 1;
    const { start, end } = adjustPlanningInterval(phase.start_date, phase.end_date, delta, mode);
    const persisted = planningPhases.find((candidate) => candidate.id === phase.id);
    if (!persisted || !onStagePlanningSchedules) return;
    const jobPhases = effectivePlanningPhases.filter((candidate) => candidate.job_id === phase.job_id);
    const canCascade = mode !== 'resize-start' && planningDependencyGraphIsAcyclic(jobPhases, phase.id);
    const cascadeIds = canCascade ? dependentPlanningPhaseIds(jobPhases, phase.id) : [];
    const cascadeDelta = planningCascadeDelta(phase.start_date, phase.end_date, start, end, mode);
    const changes = [{ phase: persisted, start, end }];
    jobPhases.filter((candidate) => cascadeIds.includes(candidate.id) && candidate.start_date && candidate.end_date).forEach((candidate) => {
      const dependent = planningPhases.find((original) => original.id === candidate.id);
      if (!dependent || cascadeDelta === 0) return;
      const shifted = adjustPlanningInterval(candidate.start_date!, candidate.end_date!, cascadeDelta, 'move');
      changes.push({ phase: dependent, start: shifted.start, end: shifted.end });
    });
    onStagePlanningSchedules(changes);
  }

  function focusDependencyIssue(issue: PlanningScheduleIssue) {
    setSelectedDependencyIssueId(issue.id);
    setSelectedPhaseWarningId(null);
    onDependencyIssueFocus?.(issue.id);
    requestAnimationFrame(() => {
      issue.phase_ids.forEach((phaseId) => phaseElementRefs.current.get(phaseId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }));
    });
  }

  function focusPhaseWarnings(phaseId: string, issues: PlanningScheduleIssue[]) {
    setSelectedPhaseWarningId(phaseId);
    setSelectedDependencyIssueId(issues[0]?.id ?? null);
    onDependencyIssueFocus?.(issues[0]?.id ?? null);
    requestAnimationFrame(() => {
      new Set(issues.flatMap((issue) => issue.phase_ids)).forEach((relatedId) => phaseElementRefs.current.get(relatedId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }));
    });
  }

  function handleScheduleKey(event: KeyboardEvent<HTMLButtonElement>, job: ProductionJob, mode: InteractionMode) {
    const proposed = stagedSchedules[job.id];
    const baselineStart = proposed?.proposed_planned_start ?? job.planned_start;
    const baselineEnd = proposed?.proposed_planned_end ?? job.planned_end;
    if (!baselineStart || !baselineEnd) return;
    if (mobileReadOnly) {
      if ((event.key === 'Enter' || event.key === ' ') && mode === 'move') {
        event.preventDefault();
        onSelectJob(job);
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && mode === 'move') {
      event.preventDefault();
      onSelectJob(job);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -1 : 1;
    let start = baselineStart;
    let end = baselineEnd;
    if (mode === 'move') {
      start = formatScheduleDate(addCalendarDays(start, delta));
      end = formatScheduleDate(addCalendarDays(end, delta));
    } else if (mode === 'resize-start') {
      const candidate = formatScheduleDate(addCalendarDays(start, delta));
      start = candidate > end ? end : candidate;
    } else {
      const candidate = formatScheduleDate(addCalendarDays(end, delta));
      end = candidate < start ? start : candidate;
    }
    if (start !== baselineStart || end !== baselineEnd) onStageSchedule(job, start, end);
  }

  function updateDayWidth(nextWidth: number) {
    setNavigationMode(null);
    const element = scrollRef.current;
    const calendarViewport = Math.max(1, (element?.clientWidth ?? 0) - railWidth);
    const centeredDay = element ? (element.scrollLeft + calendarViewport / 2) / dayWidth : 0;
    const width = clampTimelineDayWidth(zoom, nextWidth);
    setPreferences((current) => ({ ...current, dayWidths: { ...current.dayWidths, [zoom]: width } }));
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = Math.max(0, centeredDay * width - calendarViewport / 2);
      updateScrollMetrics();
    });
  }

  function changeZoom(nextZoom: TimelineZoom) {
    if (interaction) return;
    setNavigationMode(null);
    setPreferences((current) => ({ ...current, zoom: nextZoom }));
    if (accountPreferences.accountScoped) void accountPreferences.setPreference('timeline_zoom', nextZoom);
    requestAnimationFrame(updateScrollMetrics);
  }

  function fitTimeline() {
    const element = scrollRef.current;
    if (!element) return;
    const renderedBars = Array.from(element.querySelectorAll<HTMLElement>('[data-production-bar][data-fit-participant="true"]'));
    if (renderedBars.length === 0) return;
    const contentLeft = Math.min(...renderedBars.map((bar) => bar.offsetLeft));
    const contentRight = Math.max(...renderedBars.map((bar) => bar.offsetLeft + bar.offsetWidth));
    const calendarViewport = Math.max(1, element.clientWidth - railWidth);
    programmaticNavigationRef.current = true;
    setNavigationMode('fit');
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const maxScrollLeft = Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
      scrollRef.current.scrollLeft = fitRenderedTimelineScrollLeft({
        contentLeft,
        contentRight,
        calendarViewportWidth: calendarViewport,
        maxScrollLeft,
        visualPadding: Math.min(48, calendarViewport * 0.08),
      });
      updateScrollMetrics();
      focusTimelineWorkspace();
      releaseProgrammaticNavigation();
    });
  }

  function goToToday() {
    const element = scrollRef.current;
    const index = timeline.days.findIndex((day) => day.isToday);
    if (!element || index < 0) return;
    const calendarViewport = Math.max(1, element.clientWidth - railWidth);
    programmaticNavigationRef.current = true;
    setNavigationMode('today');
    element.scrollTo({ left: Math.max(0, index * dayWidth + dayWidth / 2 - calendarViewport / 2), behavior: 'smooth' });
    focusTimelineWorkspace();
    releaseProgrammaticNavigation();
  }

  function focusJobProductionInterval(job: ProductionJob) {
    const displayedJob = displayJobs.find((candidate) => candidate.id === job.id);
    if (!displayedJob?.planned_start || !displayedJob.planned_end) return;
    const focusWhenMeasured = (remainingAttempts: number) => {
      const element = scrollRef.current;
      if (!element) return;
      const calendarViewport = element.clientWidth - railWidth;
      if (calendarViewport <= 0) {
        if (remainingAttempts > 0) requestAnimationFrame(() => focusWhenMeasured(remainingAttempts - 1));
        return;
      }
      const intervalLeft = differenceInCalendarDays(parseScheduleDate(displayedJob.planned_start!), timeline.start) * dayWidth + 3;
      const intervalWidth = Math.max(18, inclusiveCalendarDays(displayedJob.planned_start!, displayedJob.planned_end!) * dayWidth - 6);
      const target = timelineIntervalFocusScrollLeft({
        intervalLeft,
        intervalRight: intervalLeft + intervalWidth,
        scrollLeft: element.scrollLeft,
        viewportWidth: calendarViewport,
        maxScrollLeft: Math.max(0, element.scrollWidth - element.clientWidth),
        comfortablePadding: Math.min(48, calendarViewport * 0.1),
      });
      if (target !== null) element.scrollTo({ left: target, behavior: 'smooth' });
    };
    requestAnimationFrame(() => focusWhenMeasured(2));
  }

  function startRailResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    railResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: railWidth };
  }

  function moveRailResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const resize = railResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    const width = Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(resize.startWidth + event.clientX - resize.startX)));
    setPreferences((current) => ({ ...current, railWidth: width }));
  }

  function finishRailResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    railResizeRef.current = null;
    updateScrollMetrics();
  }

  function isInteractivePanTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"], [data-timeline-interactive="true"]'));
  }

  function isTimelinePanCanvas(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('[data-timeline-pan-canvas="true"]'));
  }

  function startCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    const shouldPan = event.button === 1 || (event.button === 0 && (spacePressed || isTimelinePanCanvas(event.target)));
    if (!shouldPan || isInteractivePanTarget(event.target)) return;
    setNavigationMode(null);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCanvasPan({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      startScrollTop: event.currentTarget.scrollTop,
    });
  }

  function moveCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canvasPan || canvasPan.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = canvasPan.startScrollLeft - (event.clientX - canvasPan.startX);
    event.currentTarget.scrollTop = canvasPan.startScrollTop - (event.clientY - canvasPan.startY);
  }

  function finishCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canvasPan || canvasPan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setCanvasPan(null);
    updateScrollMetrics();
  }

  function startNavigatorDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !scrollRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setNavigationMode(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    setNavigatorDrag({ pointerId: event.pointerId, startX: event.clientX, startScrollLeft: scrollRef.current.scrollLeft });
  }

  function moveNavigatorDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!navigatorDrag || navigatorDrag.pointerId !== event.pointerId || !scrollRef.current || !navigatorTrackRef.current) return;
    event.preventDefault();
    const trackWidth = navigatorTrackRef.current.clientWidth;
    const calendarViewport = Math.max(1, scrollMetrics.viewportWidth - railWidth);
    const thumbWidth = Math.max(28, Math.min(trackWidth, trackWidth * calendarViewport / Math.max(calendarViewport, timelineWidth)));
    const travel = Math.max(1, trackWidth - thumbWidth);
    scrollRef.current.scrollLeft = navigatorDrag.startScrollLeft + (event.clientX - navigatorDrag.startX) / travel * scrollMetrics.maxScrollLeft;
  }

  function finishNavigatorDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!navigatorDrag || navigatorDrag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setNavigatorDrag(null);
    updateScrollMetrics();
  }

  function clickNavigatorTrack(event: ReactPointerEvent<HTMLDivElement>) {
    if (!scrollRef.current || !navigatorTrackRef.current || event.target !== event.currentTarget) return;
    setNavigationMode(null);
    const rect = navigatorTrackRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    scrollRef.current.scrollTo({ left: fraction * scrollMetrics.maxScrollLeft, behavior: 'smooth' });
  }

  const stopContinuousPan = useCallback(() => {
    panDirectionRef.current = 0;
    lastPanTimeRef.current = 0;
    if (panFrameRef.current !== null) cancelAnimationFrame(panFrameRef.current);
    panFrameRef.current = null;
  }, []);

  function startContinuousPan(direction: -1 | 1) {
    stopContinuousPan();
    setNavigationMode(null);
    panDirectionRef.current = direction;
    if (scrollRef.current) scrollRef.current.scrollLeft += direction * 28;
    function step(time: number) {
      const element = scrollRef.current;
      if (!element || panDirectionRef.current === 0) {
        stopContinuousPan();
        return;
      }
      if (lastPanTimeRef.current > 0) element.scrollLeft += panDirectionRef.current * PAN_BUTTON_SPEED * (time - lastPanTimeRef.current) / 1000;
      lastPanTimeRef.current = time;
      panFrameRef.current = requestAnimationFrame(step);
    }
    panFrameRef.current = requestAnimationFrame(step);
  }

  useEffect(() => stopContinuousPan, [stopContinuousPan]);

  if (jobs.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center border border-slate-400 bg-white px-6 py-12 text-center shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
        <div>
          <div className="text-lg font-bold text-slate-900">No production records found</div>
          <div className="mt-2 text-sm text-slate-600">Create a production record or adjust the current filters.</div>
        </div>
      </div>
    );
  }

  const { start, days } = timeline;
  const timelineWidth = days.length * dayWidth;
  const calendarViewportWidth = Math.max(1, scrollMetrics.viewportWidth - railWidth);
  const navigatorTrackWidth = Math.max(1, calendarViewportWidth - 84);
  const navigatorThumbWidth = Math.max(28, Math.min(navigatorTrackWidth, navigatorTrackWidth * calendarViewportWidth / Math.max(calendarViewportWidth, timelineWidth)));
  const navigatorThumbLeft = scrollMetrics.maxScrollLeft > 0
    ? scrollMetrics.scrollLeft / scrollMetrics.maxScrollLeft * Math.max(0, navigatorTrackWidth - navigatorThumbWidth)
    : 0;
  const hasHorizontalOverflow = scrollMetrics.maxScrollLeft > 1;
  const todayIndex = days.findIndex((day) => day.isToday);
  const canvasStartKey = formatScheduleDate(start);
  const canvasEndKey = days.at(-1)?.key ?? canvasStartKey;
  const activeJob = interaction ? jobs.find((job) => job.id === interaction.jobId) : null;
  const currentIntensity = activeJob && interaction
    ? laborIntensity(activeJob.estimated_man_hours, interaction.originalStart, interaction.originalEnd)
    : null;
  const proposedIntensity = activeJob && interaction
    ? laborIntensity(activeJob.estimated_man_hours, interaction.previewStart, interaction.previewEnd)
    : null;
  const expandableJobIds = displayJobs.filter((job) => (phasesByJob.get(job.id) ?? []).some((card) => card.timeline_behavior !== 'planning_only' && card.start_date && card.end_date)).map((job) => job.id);
  const allExpandableJobsExpanded = expandableJobIds.length > 0 && expandableJobIds.every((jobId) => expandedJobs.has(jobId));

  return (
    <div ref={ganttRef} data-production-gantt data-mobile-read-only={mobileReadOnly ? 'true' : undefined} data-mobile-landscape={mobileLandscape ? 'true' : undefined} className="scroll-mt-16 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div ref={workspaceRef} className="scroll-mt-16 border-b border-slate-200 bg-white px-3 py-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-800">Planning Timeline</h3>
      </div>
      <div data-gantt-toolbar className="z-40 grid min-w-0 grid-cols-3 items-center gap-1.5 border-b border-slate-200 bg-white p-2 text-[10px] font-semibold text-slate-700 shadow-sm md:block md:p-0">
        <div data-gantt-controls className="contents md:flex md:min-w-0 md:items-center md:gap-1.5 md:px-2 md:py-1.5">
        {mobileReadOnly && <span data-mobile-read-only-label className="col-span-3 inline-flex h-7 items-center justify-center border border-slate-300 bg-slate-100 px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600 md:h-8">{mobileLandscape ? 'Read only' : 'Mobile view · Read only'}</span>}
        <span id="timeline-zoom-label" className="hidden font-bold uppercase tracking-[0.12em] text-slate-500 md:inline">Zoom</span>
        <div data-gantt-zoom-step className="hidden h-7 overflow-hidden rounded-sm border border-slate-300 bg-white md:inline-flex">
          <button type="button" aria-label="Zoom Timeline out" title="Zoom out" disabled={Boolean(interaction) || dayWidth <= zoomOption.minDayWidth} onClick={() => updateDayWidth(dayWidth - zoomOption.step)} className="inline-flex h-full w-7 items-center justify-center border-r border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:opacity-40"><Minus className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <button type="button" aria-label="Zoom Timeline in" title="Zoom in" disabled={Boolean(interaction) || dayWidth >= zoomOption.maxDayWidth} onClick={() => updateDayWidth(dayWidth + zoomOption.step)} className="inline-flex h-full w-7 items-center justify-center text-slate-700 hover:bg-slate-50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:opacity-40"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
        <div data-gantt-zoom-modes role="group" aria-labelledby="timeline-zoom-label" className="col-span-3 grid h-8 min-w-0 grid-cols-4 items-stretch rounded-sm border border-slate-300 bg-slate-50 p-0.5 md:h-7 md:flex-1 lg:flex-none">
          {TIMELINE_ZOOM_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={zoom === option.value} disabled={Boolean(interaction)} onClick={() => changeZoom(option.value)} className={`h-full min-w-0 rounded-sm px-0.5 text-[8px] font-bold uppercase tracking-[0.03em] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 md:px-3 md:text-[9px] md:tracking-[0.08em] ${zoom === option.value ? 'tenops-selected-surface shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{option.label}</button>
          ))}
        </div>
        <button type="button" aria-pressed={navigationMode === 'fit'} onClick={fitTimeline} disabled={Boolean(interaction)} className={`inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-sm border px-1 text-[8px] font-bold uppercase tracking-[0.04em] focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40 md:h-7 md:gap-1 md:px-2 md:text-[9px] md:tracking-[0.06em] ${navigationMode === 'fit' ? 'tenops-selected-surface border-transparent shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />Fit</button>
        <button type="button" aria-pressed={navigationMode === 'today'} onClick={goToToday} disabled={Boolean(interaction)} className={`inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-sm border px-1 text-[8px] font-bold uppercase tracking-[0.04em] focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40 md:h-7 md:gap-1 md:px-2 md:text-[9px] md:tracking-[0.06em] ${navigationMode === 'today' ? 'tenops-selected-surface border-transparent shadow-sm' : 'border-blue-300 bg-white text-blue-600 hover:bg-blue-50'}`}><LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />Today</button>
        {expandableJobIds.length > 0 && <button type="button" onClick={() => setExpandedJobs(allExpandableJobsExpanded ? new Set() : new Set(expandableJobIds))} className="h-8 min-w-0 rounded-sm border border-slate-300 bg-white px-1 text-[8px] font-bold uppercase tracking-[0.03em] text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 md:h-7 md:px-2 md:text-[9px] md:tracking-[0.06em]">{allExpandableJobsExpanded ? 'Collapse all' : 'Expand all'}</button>}
        <label data-gantt-row-density className="hidden h-7 items-center gap-1.5 pl-1 text-[9px] font-bold uppercase tracking-[0.06em] text-slate-500 md:ml-auto md:inline-flex" title={`Timeline rows: ${rowDensityOption.label}`}>
          <span>Rows</span>
          <input
            type="range"
            min="0"
            max={TIMELINE_ROW_DENSITY_OPTIONS.length - 1}
            step="1"
            value={rowDensityIndex}
            aria-label="Timeline row density"
            aria-valuetext={rowDensityOption.label}
            onChange={(event) => {
              const option = TIMELINE_ROW_DENSITY_OPTIONS[Number(event.currentTarget.value)];
              if (option) {
                setPreferences((current) => ({ ...current, rowDensity: option.value }));
                if (accountPreferences.accountScoped) void accountPreferences.setPreference('timeline_row_density', option.value);
              }
            }}
            className="timeline-density-slider w-16 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>
        </div>
        <div data-gantt-legend className="hidden min-w-0 items-center gap-3 overflow-x-auto border-t border-slate-200 px-2 py-1 text-[8px] md:flex" aria-label="Timeline legend">
        <span className="font-bold uppercase tracking-[0.12em] text-slate-500">Legend</span>
        {productionStatusVisuals.map((visual) => (
          <span key={visual.value} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden="true"
              className={`h-3 w-5 border ${visual.timelineClassName ?? visual.className}`}
              style={(visual.timelinePattern ?? visual.pattern) ? { backgroundImage: visual.timelinePattern ?? visual.pattern } : undefined}
            />
            {visual.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className="h-3 w-3 rotate-45 border-2 border-violet-800 bg-violet-200" />
          Requested delivery
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className="h-4 w-px bg-blue-600" />
          Today
        </span>
        <span className="whitespace-nowrap text-slate-500">h/day = estimated labor ÷ scheduled calendar days</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleTimelineScroll}
        onWheel={(event) => {
          if (!event.shiftKey || event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          setNavigationMode(null);
          event.currentTarget.scrollLeft += event.deltaY || event.deltaX;
        }}
        onPointerDown={startCanvasPan}
        onPointerMove={moveCanvasPan}
        onPointerUp={finishCanvasPan}
        onPointerCancel={finishCanvasPan}
        onLostPointerCapture={finishCanvasPan}
        onPointerEnter={() => { timelinePointerInsideRef.current = true; }}
        onPointerLeave={() => { timelinePointerInsideRef.current = false; if (!canvasPan) setSpacePressed(false); }}
        className={`relative max-h-[calc(100dvh-9rem)] overflow-auto ${canvasPan ? 'cursor-grabbing select-none' : spacePressed ? 'cursor-grab' : ''}`}
      >
        <div style={{ minWidth: railWidth + timelineWidth }}>
          <div data-gantt-header className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-100/90">
            <div data-gantt-header-rail className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-300 bg-slate-100 px-4 pb-3 pt-9" style={{ width: railWidth }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Project / Schedule</div>
              <button
                type="button"
                aria-label="Resize Timeline project rail"
                title="Drag to resize project rail"
                onPointerDown={startRailResize}
                onPointerMove={moveRailResize}
                onPointerUp={finishRailResize}
                onPointerCancel={finishRailResize}
                onLostPointerCapture={finishRailResize}
                onDoubleClick={() => setPreferences((current) => ({ ...current, railWidth: defaultTimelinePreferences.railWidth }))}
                className="absolute inset-y-0 right-0 z-40 hidden w-2 translate-x-1/2 cursor-col-resize touch-none bg-transparent outline-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-slate-400/0 hover:after:bg-blue-600 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 focus-visible:after:bg-blue-600 md:block"
              />
            </div>
            <div className="relative shrink-0" style={{ width: timelineWidth }}>
              <div className="flex h-8 border-b border-slate-300">
                {days.map((day, index) => {
                  const previousDay = index > 0 ? days[index - 1] : null;
                  const showMonth = index === 0 || previousDay?.date.getMonth() !== day.date.getMonth();
                  return (
                    <div key={`month-${day.key}`} data-month-boundary={day.dayNumber === 1 ? 'true' : undefined} className={`shrink-0 ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''}`} style={{ width: dayWidth }}>
                      {showMonth && <div className="whitespace-nowrap px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{day.monthLabel}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex h-10">
                {days.map((day) => (
                  <div key={day.key} data-gantt-header-day data-today={day.isToday ? 'true' : undefined} data-weekend={day.isWeekend ? 'true' : undefined} data-month-boundary={day.dayNumber === 1 ? 'true' : undefined} title={day.date.toLocaleDateString()} className={`flex shrink-0 flex-col items-center justify-center border-r border-slate-200 text-[10px] ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''} ${day.isToday ? 'bg-blue-100 font-bold text-blue-900' : day.isWeekend ? 'bg-slate-200/70 text-slate-500' : 'text-slate-600'}`} style={{ width: dayWidth }}>
                    {(zoom === 'days' || zoom === 'weeks') && <span>{day.weekday}</span>}
                    {(zoom === 'days' || zoom === 'weeks' || (zoom === 'months' && (day.date.getDay() === 1 || day.dayNumber === 1))) && <span className="text-xs font-bold">{day.dayNumber}</span>}
                    {zoom === 'year' && day.dayNumber === 1 && <span className="text-[8px] font-bold uppercase">{day.date.toLocaleDateString(undefined, { month: 'narrow' })}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {scheduledJobs.map((job) => {
            const hasSchedule = Boolean(job.planned_start && job.planned_end);
            const hasDeliveryMilestone = Boolean(!hasSchedule && job.requested_delivery_date);
            const activeInteraction = interaction?.jobId === job.id ? interaction : null;
            const displayStart = activeInteraction?.previewStart || job.planned_start;
            const displayEnd = activeInteraction?.previewEnd || job.planned_end;
            const startOffset = hasSchedule && displayStart
              ? differenceInCalendarDays(parseScheduleDate(displayStart), start)
              : 0;
            const duration = hasSchedule && displayStart && displayEnd
              ? inclusiveCalendarDays(displayStart, displayEnd)
              : 0;
            const barWidth = Math.max(18, duration * dayWidth - 6);
            const handleWidth = Math.min(12, Math.max(5, barWidth / 3));
            const deliveryOffset = hasDeliveryMilestone
              ? differenceInCalendarDays(parseScheduleDate(job.requested_delivery_date!), start)
              : 0;
            const intensity = displayStart && displayEnd ? laborIntensity(job.estimated_man_hours, displayStart, displayEnd) : null;
            const stagedSchedule = stagedSchedules[job.id];
            const isStaged = Boolean(stagedSchedule);
            const statusVisual = productionStatusVisualByValue[job.production_status];
            const jobPhases = phasesByJob.get(job.id) ?? [];
            const timelinePhases = jobPhases.filter((card) => card.timeline_behavior !== 'planning_only' && card.start_date && card.end_date)
              .sort((first, second) => first.start_date!.localeCompare(second.start_date!) || first.id.localeCompare(second.id));
            const collapsedPhases = selectCollapsedTimelinePhases(timelinePhases, { canvasStart: canvasStartKey, canvasEnd: canvasEndKey, productionStart: displayStart, productionEnd: displayEnd });
            const visibleOverlays = collapsedPhases.visible.filter((card) => card.timeline_behavior === 'overlay');
            const visiblePauses = collapsedPhases.visible.filter((card) => card.timeline_behavior === 'pause');
            const mergedPauses = mergePauseRanges(visiblePauses);
            const hasCollapsedFillLayers = collapsedPhaseDisplay === 'fill' && (visibleOverlays.length > 0 || mergedPauses.length > 0);
            const inCanvasPhases = timelinePhases.filter((card) => rangesIntersect(card.start_date, card.end_date, canvasStartKey, canvasEndKey));
            const outOfRangeCount = timelinePhases.length - inCanvasPhases.length;
            const isExpanded = expandedJobs.has(job.id);
            const laneHeight = mobileLandscape ? 32 : Math.max(32, rowDensityOption.height - 12);
            const dependencyPairs = inCanvasPhases.flatMap((blocked) => {
              const blocker = inCanvasPhases.find((candidate) => candidate.id === blocked.blocked_by_phase_id);
              return blocker ? [{ blocker, blocked }] : [];
            });
            const selectedIssue = visiblePlanningIssues.find((issue) => issue.id === selectedDependencyIssueId);
            const selectedPhaseIssues = selectedPhaseWarningId ? visiblePlanningIssues.filter((issue) => issue.phase_ids.includes(selectedPhaseWarningId)) : [];
            const highlightedPhaseIds = new Set([
              ...(hoveredPlanningPhaseId ? dependencyPairs.flatMap(({ blocker, blocked }) => blocker.id === hoveredPlanningPhaseId || blocked.id === hoveredPlanningPhaseId ? [blocker.id, blocked.id] : []) : []),
              ...(selectedIssue?.phase_ids ?? []),
              ...selectedPhaseIssues.flatMap((issue) => issue.phase_ids),
            ]);
            const phaseTitle = (card: PlanningPhase) => [
              card.title,
              card.status.replaceAll('_', ' '),
              card.owner ? `Owner: ${card.owner}` : null,
              `${card.start_date} through ${card.end_date}`,
              card.timeline_behavior === 'pause' ? 'Pause' : 'Overlay',
              card.blocked_by_phase_id ? `Depends on: ${jobPhases.find((candidate) => candidate.id === card.blocked_by_phase_id)?.title ?? 'Unavailable Phase'}` : null,
              card.blocked_by_phase_id && jobPhases.find((candidate) => candidate.id === card.blocked_by_phase_id)?.status !== 'done' ? `Waiting for: ${jobPhases.find((candidate) => candidate.id === card.blocked_by_phase_id)?.title ?? 'Unavailable Phase'}` : null,
            ].filter(Boolean).join(' · ');

            return (
              <Fragment key={job.id}>
              <div data-gantt-job-row className="flex border-b border-slate-300 last:border-b-0" style={{ minHeight: displayJobRowHeight }}>
                <div data-gantt-job-rail className={`relative sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-400 bg-white ${preferences.rowDensity === 'compact' ? 'px-3 py-1' : preferences.rowDensity === 'comfortable' ? 'px-4 py-3' : 'px-4 py-2'}`} style={{ width: railWidth }}>
                  <div className="min-w-0 flex-1 pr-16">
                    <div className="flex items-center gap-2">
                      <div title={job.name} className={`flex min-w-0 items-center gap-1.5 truncate font-bold text-slate-950 ${preferences.rowDensity === 'compact' ? 'text-xs' : 'text-[13px]'}`}><span className="truncate">{job.name}</span>{job.rework_cycle ? <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.06em] text-violet-700">Rework #{job.rework_cycle.sequence_number}</span> : null}</div>
                      {isStaged && <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-700">Proposed</span>}
                    </div>
                    <div className={`truncate text-slate-600 ${preferences.rowDensity === 'compact' ? 'text-[10px]' : 'mt-0.5 text-[11px]'}`}>{[job.job_number, job.customer].filter(Boolean).join(' • ') || 'Identifiers not assigned'}</div>
                    {preferences.rowDensity !== 'compact' && (
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {hasSchedule && displayStart && displayEnd
                          ? `${formatShortDate(displayStart)} – ${formatShortDate(displayEnd)}`
                          : job.requested_delivery_date
                            ? `Delivery requested ${formatShortDate(job.requested_delivery_date)}`
                            : 'Schedule not set'}
                      </div>
                    )}
                    {outOfRangeCount > 0 && <div className="text-[8px] font-semibold text-slate-500" title="These dated Phases remain available in the Inspector but do not expand the Production Timeline.">{outOfRangeCount} Phase{outOfRangeCount === 1 ? '' : 's'} outside Timeline</div>}
                  </div>
                  {planningEnabled && <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {inCanvasPhases.length > 0 && <button type="button" aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} Planning lanes for ${job.name}`} title={isExpanded ? 'Hide Planning lanes' : 'Show Planning lanes'} onClick={() => setExpandedJobs((current) => { const next = new Set(current); if (next.has(job.id)) next.delete(job.id); else next.add(job.id); return next; })} className={`inline-flex h-7 w-7 items-center justify-center border focus-visible:ring-2 focus-visible:ring-blue-600 ${isExpanded ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{isExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <DisclosureRight className="h-4 w-4" aria-hidden="true" />}</button>}
                    <button type="button" onClick={() => { onSelectJob(job,'planning'); focusJobProductionInterval(job); }} className={`relative inline-flex h-7 w-7 items-center justify-center border bg-white focus-visible:ring-2 focus-visible:ring-blue-600 ${jobPhases.length ? 'border-blue-300 text-blue-800 hover:bg-blue-50' : 'border-slate-300 text-slate-400 hover:bg-slate-50'}`} aria-label={jobPhases.length ? `Open Planning for ${job.name} — ${jobPhases.length} Phase${jobPhases.length === 1 ? '' : 's'}` : `No Planning Phases for ${job.name}`} title={jobPhases.length ? `Open Planning — ${jobPhases.length} Phase${jobPhases.length === 1 ? '' : 's'}` : 'No Planning Phases'}><Layers className="h-4 w-4" aria-hidden="true" />{jobPhases.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-800 px-1 text-center text-[8px] font-bold leading-4 text-white tabular-nums">{jobPhases.length}</span>}</button>
                  </div>}
                </div>

                <div
                  data-timeline-pan-canvas="true"
                  data-gantt-canvas
                  className={`relative shrink-0 ${canvasPan ? 'cursor-grabbing' : 'cursor-move'}`}
                  style={{ width: timelineWidth }}
                >
                  <div className="absolute inset-0 flex">
                    {days.map((day) => <div key={`${job.id}-${day.key}`} data-gantt-day-cell data-weekend={day.isWeekend ? 'true' : undefined} data-month-boundary={day.dayNumber === 1 ? 'true' : undefined} className={`h-full shrink-0 border-r border-slate-200 ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''} ${day.isWeekend ? 'bg-slate-100' : ''}`} style={{ width: dayWidth }} />)}
                  </div>
                  {todayIndex >= 0 && <div data-gantt-today className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-blue-600" style={{ left: todayIndex * dayWidth + dayWidth / 2 }} />}

                  {isStaged && stagedSchedule?.original_planned_start && stagedSchedule.original_planned_end && (
                    <div
                      aria-label={`Last saved schedule for ${job.name}: ${stagedSchedule.original_planned_start} through ${stagedSchedule.original_planned_end}`}
                      className="pointer-events-none absolute top-1/2 z-[2] h-8 -translate-y-1/2 border-2 border-dashed border-slate-700 bg-slate-400/35"
                      style={{
                        left: differenceInCalendarDays(parseScheduleDate(stagedSchedule.original_planned_start), start) * dayWidth + 3,
                        width: Math.max(18, inclusiveCalendarDays(stagedSchedule.original_planned_start, stagedSchedule.original_planned_end) * dayWidth - 6),
                      }}
                    >
                      <span className="sr-only">Ghost bar showing the last saved schedule.</span>
                    </div>
                  )}

                  {hasSchedule && displayStart && displayEnd && (
                    <div
                      data-timeline-interactive="true"
                      data-production-bar
                      data-fit-participant={productionTimelineFitParticipates(job.production_status) ? 'true' : 'false'}
                      className={`absolute top-1/2 z-[3] h-8 -translate-y-1/2 border shadow-sm transition-[box-shadow,filter] ${statusVisual.timelineClassName ?? statusVisual.className} ${activeInteraction ? 'z-20 brightness-110 shadow-lg outline outline-2 outline-slate-950/50' : 'hover:brightness-105 hover:shadow-md'} ${isStaged ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
                      style={{ left: startOffset * dayWidth + 3, width: barWidth, backgroundImage: statusVisual.timelinePattern ?? statusVisual.pattern }}
                      title={`${job.name}: ${statusVisual.label}; ${displayStart} through ${displayEnd}; ${intensityLabel(job, displayStart, displayEnd)}`}
                    >
                      <button
                        type="button"
                        aria-label={`Resize ${job.name} start date. Use left and right arrow keys for one-day adjustments.`}
                        onPointerDown={(event) => startInteraction(event, job, 'resize-start')}
                        onKeyDown={(event) => handleScheduleKey(event, job, 'resize-start')}
                        onDragStart={(event) => event.preventDefault()}
                        className="group/handle absolute inset-y-0 left-0 z-20 border-r border-white/20 bg-black/10 outline-none hover:bg-white/30 focus-visible:bg-white/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                        style={{ width: handleWidth, cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}
                      >
                        <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/75 shadow-sm" />
                      </button>
                      <button
                        type="button"
                        aria-label={mobileReadOnly ? `Open ${job.name}` : `Move ${job.name}. Use left and right arrow keys for one-day adjustments.`}
                        onPointerDown={(event) => startInteraction(event, job, 'move')}
                        onKeyDown={(event) => handleScheduleKey(event, job, 'move')}
                        onDragStart={(event) => event.preventDefault()}
                        className="absolute inset-y-0 z-10 flex min-w-0 items-center gap-2 overflow-hidden px-1.5 text-left text-[10px] font-bold uppercase tracking-[0.05em] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                        style={{ left: handleWidth, right: handleWidth, cursor: mobileReadOnly ? 'pointer' : activeInteraction?.mode === 'move' ? 'grabbing' : 'grab', pointerEvents: 'auto', touchAction: mobileReadOnly ? 'manipulation' : 'none' }}
                      >
                        {duration >= 2 && !hasCollapsedFillLayers && <span className="pointer-events-none truncate">{job.name}{job.rework_cycle ? ` · REWORK #${job.rework_cycle.sequence_number}` : ''}</span>}
                        {isStaged && duration >= 3 && !hasCollapsedFillLayers && <span className="pointer-events-none shrink-0 bg-amber-100/95 px-1 text-[8px] text-amber-950">Unsaved</span>}
                        {duration >= 5 && !hasCollapsedFillLayers && intensity?.hoursPerScheduledDay !== null && intensity?.hoursPerScheduledDay !== undefined && (
                          <span className="pointer-events-none ml-auto shrink-0 border-l border-white/30 pl-2 text-[9px] normal-case tracking-normal">{formatHours(intensity.hoursPerScheduledDay)} h/day</span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Resize ${job.name} finish date. Use left and right arrow keys for one-day adjustments.`}
                        onPointerDown={(event) => startInteraction(event, job, 'resize-end')}
                        onKeyDown={(event) => handleScheduleKey(event, job, 'resize-end')}
                        onDragStart={(event) => event.preventDefault()}
                        className="group/handle absolute inset-y-0 right-0 z-20 border-l border-white/20 bg-black/10 outline-none hover:bg-white/30 focus-visible:bg-white/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                        style={{ width: handleWidth, cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}
                      >
                        <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/75 shadow-sm" />
                      </button>
                    </div>
                  )}

                  {hasSchedule && mergedPauses.map((pauseRange) => {
                    const pauseGeometry = planningIntervalGeometry(pauseRange.start, pauseRange.end, formatScheduleDate(start), dayWidth);
                    const intersectsProduction = rangesIntersect(pauseRange.start, pauseRange.end, displayStart, displayEnd);
                    return <div key={pauseRange.phases.map((phase) => phase.id).join('-')} data-collapsed-planning-pause="true" aria-label={pauseRange.phases.map(phaseTitle).join('; ')} title={pauseRange.phases.map(phaseTitle).join('; ')} className={`pointer-events-none absolute border border-slate-950 bg-white ${collapsedPhaseDisplay === 'fill' ? 'top-1/2 z-[4] h-8 -translate-y-1/2' : `top-[calc(50%+10px)] z-[5] h-1.5 ${intersectsProduction ? '' : 'opacity-80'}`}`} style={{ left: pauseGeometry.left, width: pauseGeometry.width, backgroundImage: PLANNING_PAUSE_HATCH }} />;
                  })}
                  {hasSchedule && visibleOverlays.map((card) => {
                    const cardGeometry = planningIntervalGeometry(card.start_date!, card.end_date!, formatScheduleDate(start), dayWidth);
                    const visual = overlayVisualForPhase(jobPhases, card.id);
                    return <button key={card.id} type="button" data-timeline-interactive="true" data-collapsed-planning-phase="true" data-collapsed-phase-display={collapsedPhaseDisplay} onClick={(event) => { event.stopPropagation(); onSelectPlanningPhase?.(job, card); }} title={phaseTitle(card)} aria-label={`Open Phase ${card.title}`} className={`absolute border outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${collapsedPhaseDisplay === 'fill' ? 'top-1/2 z-[4] h-8 -translate-y-1/2 opacity-70 hover:opacity-80 focus-visible:opacity-[0.85]' : 'top-[calc(50%+10px)] z-[5] h-1.5'} ${visual.className}`} style={{ left: cardGeometry.left, width: cardGeometry.width }}><span className="sr-only">Planning overlay: {card.title}</span></button>;
                  })}
                  {hasSchedule && displayStart && displayEnd && hasCollapsedFillLayers && (
                    <>
                      <div
                        data-collapsed-production-status-rail="true"
                        className={`pointer-events-none absolute top-1/2 z-[5] h-1 -translate-y-4 border-x border-t ${statusVisual.timelineClassName ?? statusVisual.className}`}
                        style={{ left: startOffset * dayWidth + 3, width: barWidth, backgroundImage: statusVisual.timelinePattern ?? statusVisual.pattern }}
                        aria-hidden="true"
                      />
                      <div
                        data-collapsed-production-label="true"
                        className="pointer-events-none absolute top-1/2 z-[6] flex h-8 min-w-0 -translate-y-1/2 items-center gap-2 overflow-hidden px-1.5 text-left text-[10px] font-bold uppercase tracking-[0.05em] text-slate-950"
                        style={{ left: startOffset * dayWidth + 3 + handleWidth, width: Math.max(0, barWidth - handleWidth * 2) }}
                        aria-hidden="true"
                      >
                        {duration >= 2 && <span className="truncate">{job.name}{job.rework_cycle ? ` · REWORK #${job.rework_cycle.sequence_number}` : ''}</span>}
                        {isStaged && duration >= 3 && <span className="shrink-0 bg-amber-100/95 px-1 text-[8px] text-amber-950">Unsaved</span>}
                        {duration >= 5 && intensity?.hoursPerScheduledDay !== null && intensity?.hoursPerScheduledDay !== undefined && (
                          <span className="ml-auto shrink-0 border-l border-white/50 px-1.5 text-[9px] normal-case tracking-normal">{formatHours(intensity.hoursPerScheduledDay)} h/day</span>
                        )}
                      </div>
                      <div
                        data-collapsed-production-handle="start"
                        className="pointer-events-none absolute top-1/2 z-[6] h-8 -translate-y-1/2 border-r border-white/30 bg-black/10"
                        style={{ left: startOffset * dayWidth + 3, width: handleWidth }}
                        aria-hidden="true"
                      >
                        <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/90 shadow-sm" />
                      </div>
                      <div
                        data-collapsed-production-handle="finish"
                        className="pointer-events-none absolute top-1/2 z-[6] h-8 -translate-y-1/2 border-l border-white/30 bg-black/10"
                        style={{ left: startOffset * dayWidth + 3 + barWidth - handleWidth, width: handleWidth }}
                        aria-hidden="true"
                      >
                        <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/90 shadow-sm" />
                      </div>
                    </>
                  )}
                  {hasDeliveryMilestone && (
                    <div className="absolute top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2" style={{ left: deliveryOffset * dayWidth + dayWidth / 2 }} title={`Requested delivery: ${job.requested_delivery_date}`}>
                      <div className="h-5 w-5 rotate-45 border-2 border-violet-800 bg-violet-200 shadow-sm" />
                      <div className="absolute left-5 top-1/2 w-40 -translate-y-1/2 pl-2 text-[10px] font-bold uppercase tracking-[0.05em] text-violet-900">Delivery</div>
                    </div>
                  )}
                  {!hasSchedule && !hasDeliveryMilestone && <div className="absolute left-4 top-1/2 z-[2] -translate-y-1/2"><span className="inline-flex border border-dashed border-slate-400 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Schedule not set</span></div>}
                </div>
              </div>
              {isExpanded && inCanvasPhases.map((phase, phaseIndex) => (
                <div key={`${job.id}-${phase.id}`} data-gantt-phase-row className="flex border-b border-slate-200 bg-slate-50/50" style={{ minHeight: laneHeight }}>
                  <div data-gantt-phase-rail className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-300 bg-slate-50 pl-10 pr-3 text-[10px] font-bold text-slate-700" style={{ width: railWidth }}><span className="truncate">{phase.title}</span></div>
                  <div data-timeline-pan-canvas="true" data-gantt-phase-canvas className="relative shrink-0 cursor-move" style={{ width: timelineWidth }}>
                    <div className="absolute inset-0 flex">{days.map((day) => <div key={`${job.id}-${phase.id}-${day.key}`} data-gantt-day-cell data-weekend={day.isWeekend ? 'true' : undefined} data-month-boundary={day.dayNumber === 1 ? 'true' : undefined} className={`h-full shrink-0 border-r border-slate-200 ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''} ${day.isWeekend ? 'bg-slate-100' : ''}`} style={{ width: dayWidth }} />)}</div>
                    {todayIndex >= 0 && <div data-gantt-today className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-blue-600" style={{ left: todayIndex * dayWidth + dayWidth / 2 }} />}
                    {dependencyPairs.filter(({ blocked }) => blocked.id === phase.id).map(({ blocker, blocked }) => {
                      const blockerIndex = inCanvasPhases.findIndex((candidate) => candidate.id === blocker.id);
                      const blockerGeometry = planningIntervalGeometry(blocker.start_date!, blocker.end_date!, formatScheduleDate(start), dayWidth);
                      const blockedGeometry = planningIntervalGeometry(blocked.start_date!, blocked.end_date!, formatScheduleDate(start), dayWidth);
                      const blockerX = blockerGeometry.right;
                      const blockedX = blockedGeometry.left;
                      const rowDistance = Math.abs(phaseIndex - blockerIndex);
                      const blockerAbove = blockerIndex < phaseIndex;
                      const svgTop = blockerAbove ? -rowDistance * laneHeight : 0;
                      const svgHeight = rowDistance * laneHeight + laneHeight;
                      const blockerY = blockerAbove ? laneHeight / 2 : rowDistance * laneHeight + laneHeight / 2;
                      const blockedY = blockerAbove ? rowDistance * laneHeight + laneHeight / 2 : laneHeight / 2;
                      const sourceExitX = blockerX + 10;
                      const destinationNodeSize = 6;
                      const destinationNodeX = blockedX - destinationNodeSize / 2;
                      const destinationApproachX = destinationNodeX - 10;
                      const routingY = Math.round((blockerY + blockedY) / 2);
                      const highlighted = highlightedPhaseIds.has(blocker.id) && highlightedPhaseIds.has(blocked.id);
                      const issue = visiblePlanningIssues.find((candidate) => candidate.predecessor_id === blocker.id && candidate.successor_id === blocked.id);
                      const connectorColor = issue?.severity === 'error' ? '#dc2626' : issue?.severity === 'warning' ? '#d97706' : highlighted ? '#475569' : '#94a3b8';
                      const markerId = `planning-arrow-${job.id}-${blocker.id}-${blocked.id}`;
                      const path = `M ${blockerX} ${blockerY} H ${sourceExitX} V ${routingY} H ${destinationApproachX} V ${blockedY} H ${destinationNodeX}`;
                      const issueIsOpen = issue?.id === selectedDependencyIssueId && !selectedPhaseWarningId;
                      const issueAnchorX = Math.round((sourceExitX + destinationApproachX) / 2);
                      const issueDialogLeft = issueAnchorX + 280 > timelineWidth ? -260 : 16;
                      return <svg key={`${blocker.id}-${blocked.id}`} data-planning-connector-state={issue ? 'issue' : highlighted ? 'highlighted' : 'normal'} aria-hidden={issue ? undefined : true} className={`pointer-events-none absolute left-0 overflow-visible ${issueIsOpen ? 'z-40' : 'z-[4]'}`} width={timelineWidth} height={svgHeight} style={{ top: svgTop }}><defs><marker id={markerId} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto" overflow="visible"><path d="M0,0 L8,4 L0,8 Z" fill={connectorColor} /></marker></defs><path d={path} fill="none" stroke={connectorColor} strokeWidth={highlighted || issue ? 2.5 : 1.5} markerEnd={`url(#${markerId})`} /><rect x={destinationNodeX} y={blockedY - destinationNodeSize / 2} width={destinationNodeSize} height={destinationNodeSize} fill={connectorColor} />{issue && <><path d={path} fill="none" stroke="transparent" strokeWidth="12" pointerEvents="stroke" className="cursor-pointer" onClick={(event) => { event.stopPropagation(); focusDependencyIssue(issue); }} /><foreignObject x={issueAnchorX - 7} y={routingY - 7} width={issueIsOpen ? 304 : 14} height={issueIsOpen ? 148 : 14} className="pointer-events-auto overflow-visible"><div data-planning-warning-popover className="relative h-3.5 w-3.5"><button type="button" title={issue.message} aria-expanded={issueIsOpen} aria-label={`${issue.severity === 'error' ? 'Scheduling error' : 'Scheduling warning'}: ${issue.message}`} onClick={(event) => { event.stopPropagation(); focusDependencyIssue(issue); }} className={`absolute inset-0 flex items-center justify-center rounded-full bg-white p-0 leading-none shadow-sm focus-visible:ring-2 focus-visible:ring-blue-700 ${issue.severity === 'error' ? 'text-red-600' : 'text-orange-600'}`}>{issue.severity === 'error' ? <CircleX className="h-2.5 w-2.5 shrink-0" /> : <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}</button>{issueIsOpen && <div role="dialog" aria-label={issue.severity === 'error' ? 'Dependency error details' : 'Dependency warning details'} className={`absolute top-0 z-50 w-64 border bg-white p-3 text-left text-xs shadow-xl ${issue.severity === 'error' ? 'border-red-300' : 'border-orange-300'}`} style={{ left: issueDialogLeft }}><div className={`flex items-center gap-1.5 font-bold ${issue.severity === 'error' ? 'text-red-800' : 'text-orange-800'}`}>{issue.severity === 'error' ? <CircleX className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{issue.severity === 'error' ? 'Dependency Error' : 'Dependency Warning'}</div><p className="mt-2 leading-5 text-slate-800">{issue.message}</p><p className="mt-1 text-slate-600">Dependency remains intact. {issue.severity === 'error' ? 'Resolve before saving.' : 'Review before saving.'}</p></div>}</div></foreignObject></>}</svg>;
                    })}
                    {(() => {
                      const geometry = planningIntervalGeometry(phase.start_date!, phase.end_date!, formatScheduleDate(start), dayWidth);
                      const isHighlighted = highlightedPhaseIds.has(phase.id);
                      const isStagedPhase = Boolean(stagedPlanningSchedules[phase.id]);
                      const stagedPhase = stagedPlanningSchedules[phase.id];
                      const phaseIssues = visiblePlanningIssues.filter((issue) => issue.phase_ids.includes(phase.id) && issue.kind !== 'dependency_overlap' && issue.kind !== 'circular_dependency');
                      const phaseSeverity = phaseIssues.some((issue) => issue.severity === 'error') ? 'error' : phaseIssues.some((issue) => issue.severity === 'warning') ? 'warning' : null;
                      const phaseIssuePopoverOpen = selectedPhaseWarningId === phase.id;
                      const visual = phase.timeline_behavior === 'overlay' ? overlayVisualForPhase(jobPhases, phase.id) : null;
                      const phaseProgress = calculatePhaseProgress(planningItems.filter((item) => item.phase_id === phase.id));
                      const barClass = phase.timeline_behavior === 'pause' ? 'border-slate-950 bg-white text-slate-950' : visual!.className;
                      const activePhaseInteraction = phaseInteraction?.phaseId === phase.id ? phaseInteraction : null;
                      const handleWidth = Math.max(6, Math.min(10, Math.floor(geometry.width / 3)));
                      const savedGeometry = stagedPhase ? planningIntervalGeometry(stagedPhase.original_start_date, stagedPhase.original_end_date, formatScheduleDate(start), dayWidth) : null;
                      return <>{savedGeometry && <div aria-label={`Last saved schedule for ${phase.title}`} className="pointer-events-none absolute top-1/2 z-[2] h-6 -translate-y-1/2 border-2 border-dashed border-slate-700 bg-slate-400/25" style={{ left: savedGeometry.left, width: savedGeometry.width }} />}<div data-planning-phase-bar ref={(element) => { if (element) phaseElementRefs.current.set(phase.id, element); else phaseElementRefs.current.delete(phase.id); }} className={`absolute top-1/2 h-6 overflow-visible -translate-y-1/2 border shadow-sm transition-[box-shadow,filter] ${phaseIssuePopoverOpen ? 'z-50' : 'z-[3]'} ${activePhaseInteraction ? 'z-20 brightness-110 shadow-lg outline outline-2 outline-slate-950/50' : 'hover:brightness-105 hover:shadow-md'} ${isHighlighted ? 'ring-2 ring-slate-500 ring-offset-1' : ''} ${isStagedPhase ? 'ring-2 ring-amber-300 ring-offset-1' : ''} ${phaseSeverity === 'error' ? 'outline outline-2 outline-red-600 outline-offset-1' : phaseSeverity === 'warning' ? 'outline outline-2 outline-orange-500 outline-offset-1' : ''} ${barClass}`} style={{ left: geometry.left, width: geometry.width, backgroundImage: phase.timeline_behavior === 'pause' ? PLANNING_PAUSE_HATCH : undefined }}>
                        {visual && phaseProgress.percent > 0 && <div aria-hidden="true" data-planning-progress-fill className={`pointer-events-none absolute inset-y-0 left-0 z-[1] ${visual.progressClassName}`} style={{ width: `${phaseProgress.percent}%` }} />}
                        {visual && phaseProgress.percent > 0 && phaseProgress.percent < 100 && <div aria-hidden="true" data-planning-progress-boundary className="pointer-events-none absolute inset-y-0 z-[9] w-0.5 -translate-x-0.5 bg-slate-950/80" style={{ left: `${phaseProgress.percent}%` }} />}
                        <button type="button" data-timeline-interactive="true" aria-label={`Resize ${phase.title} start date. Use left and right arrow keys for one-day adjustments.`} onPointerDown={(event) => startPhaseInteraction(event, phase, 'resize-start')} onKeyDown={(event) => handlePhaseScheduleKey(event, phase, 'resize-start')} onDragStart={(event) => event.preventDefault()} className="group/handle absolute inset-y-0 left-0 z-20 border-r border-white/20 bg-black/10 outline-none hover:bg-white/30 focus-visible:bg-white/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" style={{ width: handleWidth, cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}><span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/75 shadow-sm" /></button>
                        <button type="button" data-timeline-interactive="true" onPointerDown={(event) => startPhaseInteraction(event, phase, 'move')} onKeyDown={(event) => handlePhaseScheduleKey(event, phase, 'move')} onMouseEnter={() => setHoveredPlanningPhaseId(phase.id)} onMouseLeave={() => setHoveredPlanningPhaseId(null)} onFocus={() => setHoveredPlanningPhaseId(phase.id)} onBlur={() => setHoveredPlanningPhaseId(null)} onDragStart={(event) => event.preventDefault()} title={phaseTitle(phase)} aria-label={mobileReadOnly ? `Open Phase ${phase.title}` : `Move ${phase.title}. Use left and right arrow keys for one-day adjustments.`} className={`absolute inset-y-0 z-10 flex min-w-0 items-center gap-1 overflow-hidden px-1.5 text-left font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${preferences.rowDensity === 'compact' ? 'text-[6px]' : 'text-[6.5px]'}`} style={{ left: handleWidth, right: handleWidth, cursor: mobileReadOnly ? 'pointer' : activePhaseInteraction?.mode === 'move' ? 'grabbing' : 'grab', pointerEvents: 'auto', touchAction: mobileReadOnly ? 'manipulation' : 'none' }}>{visual && phaseProgress.totalItems > 0 ? <PhaseExecutionLabels title={phase.title} percent={phaseProgress.percent} /> : <span data-planning-phase-title className="min-w-0 truncate px-1 text-white" style={{ textShadow: '0 1px 2px rgba(15, 23, 42, 0.95), 0 0 2px rgba(15, 23, 42, 0.85)' }}>{phase.title}</span>}{isStagedPhase && geometry.width >= 140 && <span data-planning-staged-badge className="shrink-0 bg-amber-100/95 px-1 text-[8px] uppercase text-amber-950">Unsaved</span>}</button>
                        <button type="button" data-timeline-interactive="true" aria-label={`Resize ${phase.title} finish date. Use left and right arrow keys for one-day adjustments.`} onPointerDown={(event) => startPhaseInteraction(event, phase, 'resize-end')} onKeyDown={(event) => handlePhaseScheduleKey(event, phase, 'resize-end')} onDragStart={(event) => event.preventDefault()} className="group/handle absolute inset-y-0 right-0 z-20 border-l border-white/20 bg-black/10 outline-none hover:bg-white/30 focus-visible:bg-white/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" style={{ width: handleWidth, cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}><span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/75 shadow-sm" /></button>
                        {phaseIssues.length > 0 && <div data-planning-warning-popover className="absolute top-1/2 z-40 -translate-y-1/2" style={{ left: handleWidth + 2 }}><button type="button" data-timeline-interactive="true" aria-expanded={phaseIssuePopoverOpen} aria-label={`${phaseSeverity === 'error' ? 'Scheduling errors' : 'Scheduling warnings'} for ${phase.title}`} title={phaseIssues.map((issue) => issue.message).join('\n')} onClick={(event) => { event.stopPropagation(); focusPhaseWarnings(phase.id, phaseIssues); }} className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/95 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-700 ${phaseSeverity === 'error' ? 'text-red-600' : 'text-orange-600'}`}>{phaseSeverity === 'error' ? <CircleX className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}</button>{phaseIssuePopoverOpen && <div role="dialog" aria-label={`Scheduling feedback for ${phase.title}`} className={`absolute left-6 top-0 z-50 w-72 border bg-white p-3 text-left text-xs shadow-xl ${phaseSeverity === 'error' ? 'border-red-300' : 'border-orange-300'}`}><div className={`flex items-center gap-1.5 font-bold ${phaseSeverity === 'error' ? 'text-red-800' : 'text-orange-800'}`}>{phaseSeverity === 'error' ? <CircleX className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{phaseSeverity === 'error' ? 'Scheduling Feedback' : 'Scheduling Warnings'}</div><ul className="mt-2 space-y-2 text-slate-800">{phaseIssues.map((issue) => <li key={issue.id} className="border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">{issue.message}</li>)}</ul><p className="mt-2 text-slate-600">{phaseSeverity === 'error' ? 'Resolve errors before saving.' : 'Review before saving.'}</p></div>}</div>}
                      </div></>;
                    })()}
                  </div>
                </div>
              ))}
              </Fragment>
            );
          })}
        </div>
        {hasHorizontalOverflow && (
          <div
            aria-label="Timeline horizontal navigator"
            data-gantt-navigator
            className="sticky bottom-0 left-0 z-30 flex h-9 border-t border-slate-300 bg-slate-100/95 shadow-[0_-2px_6px_rgba(15,23,42,0.08)] backdrop-blur"
            style={{ width: scrollMetrics.viewportWidth }}
            data-timeline-interactive="true"
          >
            <div data-gantt-navigator-label className="flex shrink-0 items-center border-r border-slate-300 px-3 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500" style={{ width: railWidth }}>Timeline navigation</div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
              <button
                type="button"
                aria-label="Pan Timeline left"
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); startContinuousPan(-1); }}
                onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); stopContinuousPan(); }}
                onPointerCancel={stopContinuousPan}
                onLostPointerCapture={stopContinuousPan}
                onClick={(event) => { if (event.detail === 0 && scrollRef.current) scrollRef.current.scrollBy({ left: -80, behavior: 'smooth' }); }}
                className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
              ><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /></button>
              <div ref={navigatorTrackRef} data-gantt-navigator-track onPointerDown={clickNavigatorTrack} className="relative h-3 min-w-0 flex-1 cursor-pointer rounded-full bg-slate-300/80">
                <button
                  type="button"
                  data-gantt-navigator-thumb
                  aria-label="Drag to navigate Timeline horizontally"
                  onPointerDown={startNavigatorDrag}
                  onPointerMove={moveNavigatorDrag}
                  onPointerUp={finishNavigatorDrag}
                  onPointerCancel={finishNavigatorDrag}
                  onLostPointerCapture={finishNavigatorDrag}
                  className={`absolute top-0 h-3 touch-none rounded-full border border-slate-600 bg-slate-600 outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600 ${navigatorDrag ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ left: navigatorThumbLeft, width: navigatorThumbWidth }}
                />
              </div>
              <button
                type="button"
                aria-label="Pan Timeline right"
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); startContinuousPan(1); }}
                onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); stopContinuousPan(); }}
                onPointerCancel={stopContinuousPan}
                onLostPointerCapture={stopContinuousPan}
                onClick={(event) => { if (event.detail === 0 && scrollRef.current) scrollRef.current.scrollBy({ left: 80, behavior: 'smooth' }); }}
                className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
              ><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </div>

      {interaction?.hasMoved && activeJob && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed z-[100] w-72 border border-slate-700 bg-slate-950 p-3 text-xs text-white shadow-2xl"
          style={{
            left: Math.max(12, Math.min(interaction.pointerX + 14, typeof window === 'undefined' ? interaction.pointerX + 14 : window.innerWidth - 304)),
            top: Math.max(12, interaction.pointerY - 148),
          }}
        >
          <div className="font-bold uppercase tracking-[0.1em] text-slate-300">{interaction.mode === 'move' ? 'Move production window' : interaction.mode === 'resize-start' ? 'Adjust planned start' : 'Adjust planned finish'}</div>
          <div className="mt-2 grid grid-cols-[58px_1fr] gap-x-2 gap-y-1">
            <span className="text-slate-400">Current</span>
            <span>{formatShortDate(interaction.originalStart)} – {formatShortDate(interaction.originalEnd)}</span>
            <span />
            <span className="text-slate-400">{scheduledDaysLabel(currentIntensity?.scheduledDays ?? 0)} · {intensityLabel(activeJob, interaction.originalStart, interaction.originalEnd)}</span>
            <span className="text-slate-400">Proposed</span>
            <span>{formatShortDate(interaction.previewStart)} – {formatShortDate(interaction.previewEnd)}</span>
            <span />
            <span className="font-semibold text-white">{scheduledDaysLabel(proposedIntensity?.scheduledDays ?? 0)} · {intensityLabel(activeJob, interaction.previewStart, interaction.previewEnd)}</span>
          </div>
          <div className="mt-2 border-t border-slate-700 pt-2 text-slate-400">
            Estimated labor: {proposedIntensity?.estimatedHours === null ? 'Not provided' : `${formatHours(proposedIntensity?.estimatedHours ?? 0)} hours`}
          </div>
        </div>
      )}
      {phaseInteraction?.hasMoved && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed z-[100] w-72 border border-slate-700 bg-slate-950 p-3 text-xs text-white shadow-2xl" style={{ left: Math.max(12, Math.min(phaseInteraction.pointerX + 14, typeof window === 'undefined' ? phaseInteraction.pointerX + 14 : window.innerWidth - 304)), top: Math.max(12, phaseInteraction.pointerY - 148) }}>
          <div className="font-bold uppercase tracking-[0.1em] text-slate-300">{phaseInteraction.mode === 'move' ? 'Move Planning Phase' : phaseInteraction.mode === 'resize-start' ? 'Adjust Phase start' : 'Adjust Phase finish'}</div>
          <div className="mt-2 grid grid-cols-[58px_1fr] gap-x-2 gap-y-1"><span className="text-slate-400">Current</span><span>{formatShortDate(phaseInteraction.originalStart)} – {formatShortDate(phaseInteraction.originalEnd)}</span><span /><span className="text-slate-400">{scheduledDaysLabel(inclusiveCalendarDays(phaseInteraction.originalStart, phaseInteraction.originalEnd))}</span><span className="text-slate-400">Proposed</span><span>{formatShortDate(phaseInteraction.previewStart)} – {formatShortDate(phaseInteraction.previewEnd)}</span><span /><span className="font-semibold text-white">{scheduledDaysLabel(inclusiveCalendarDays(phaseInteraction.previewStart, phaseInteraction.previewEnd))}</span></div>
        </div>
      )}
    </div>
  );
}
