'use client';

import { ChevronLeft, ChevronRight, LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { productionStatusVisuals, productionStatusVisualByValue } from '../status-visuals';
import {
  clampTimelineDayWidth,
  defaultTimelinePreferences,
  fitTimelineDayWidth,
  parseTimelinePreferences,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
  TIMELINE_PREFERENCES_KEY,
  TIMELINE_ROW_DENSITY_OPTIONS,
  TIMELINE_ZOOM_OPTIONS,
  timelineZoomOption,
} from '../timeline-preferences';
import type { TimelinePreferences, TimelineZoom } from '../timeline-preferences';

type ProductionGanttProps = {
  jobs: ProductionJob[];
  stagedSchedules: StagedSchedules;
  onStageSchedule: (job: ProductionJob, start: string, end: string) => void;
  onSelectJob: (job: ProductionJob, focus?: string) => void;
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

const DRAG_THRESHOLD_PX = 4;
const FIT_PADDING_DAYS = 2;
const PAN_BUTTON_SPEED = 520;

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

function proposedDates(interaction: ScheduleInteraction, clientX: number) {
  const deltaDays = Math.round((clientX - interaction.originClientX) / interaction.dayWidth);

  if (interaction.mode === 'move') {
    return {
      start: formatScheduleDate(addCalendarDays(interaction.originalStart, deltaDays)),
      end: formatScheduleDate(addCalendarDays(interaction.originalEnd, deltaDays)),
    };
  }

  if (interaction.mode === 'resize-start') {
    const candidate = formatScheduleDate(addCalendarDays(interaction.originalStart, deltaDays));
    return { start: candidate > interaction.originalEnd ? interaction.originalEnd : candidate, end: interaction.originalEnd };
  }

  const candidate = formatScheduleDate(addCalendarDays(interaction.originalEnd, deltaDays));
  return { start: interaction.originalStart, end: candidate < interaction.originalStart ? interaction.originalStart : candidate };
}

function createTimeline(jobs: ProductionJob[], zoom: TimelineZoom) {
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
  const earliest = addCalendarDays(earliestJobDate < today ? earliestJobDate : today, -zoomOption.paddingDays);
  const minimumEnd = addCalendarDays(earliest, zoomOption.minimumDays - 1);
  const paddedLatest = addCalendarDays(latestJobDate > today ? latestJobDate : today, zoomOption.paddingDays);
  const latest = paddedLatest > minimumEnd ? paddedLatest : minimumEnd;
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

export default function ProductionGantt({ jobs, stagedSchedules, onStageSchedule, onSelectJob }: ProductionGanttProps) {
  const [interaction, setInteraction] = useState<ScheduleInteraction | null>(null);
  const [preferences, setPreferences] = useState<TimelinePreferences>(defaultTimelinePreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [scrollMetrics, setScrollMetrics] = useState<TimelineScrollMetrics>({ scrollLeft: 0, maxScrollLeft: 0, viewportWidth: 0, scrollWidth: 0 });
  const [canvasPan, setCanvasPan] = useState<CanvasPan | null>(null);
  const [navigatorDrag, setNavigatorDrag] = useState<NavigatorDrag | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const ganttRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const navigatorTrackRef = useRef<HTMLDivElement | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const panDirectionRef = useRef(0);
  const lastPanTimeRef = useRef(0);
  const timelinePointerInsideRef = useRef(false);
  const railResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const zoom = preferences.zoom;
  const railWidth = preferences.railWidth;
  const rowDensityIndex = Math.max(0, TIMELINE_ROW_DENSITY_OPTIONS.findIndex((option) => option.value === preferences.rowDensity));
  const rowDensityOption = TIMELINE_ROW_DENSITY_OPTIONS[rowDensityIndex];
  const displayJobs = useMemo(() => jobs.map((job) => stagedSchedules[job.id]
    ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
    : job), [jobs, stagedSchedules]);
  const timeline = useMemo(() => createTimeline(displayJobs, zoom), [displayJobs, zoom]);
  const zoomOption = timelineZoomOption(zoom);
  const dayWidth = preferences.dayWidths[zoom];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPreferences(parseTimelinePreferences(window.localStorage.getItem(TIMELINE_PREFERENCES_KEY)));
      setPreferencesLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem(TIMELINE_PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences, preferencesLoaded]);

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

  function startInteraction(event: ReactPointerEvent, job: ProductionJob, mode: InteractionMode) {
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

  function handleScheduleKey(event: KeyboardEvent<HTMLButtonElement>, job: ProductionJob, mode: InteractionMode) {
    const proposed = stagedSchedules[job.id];
    const baselineStart = proposed?.proposed_planned_start ?? job.planned_start;
    const baselineEnd = proposed?.proposed_planned_end ?? job.planned_end;
    if (!baselineStart || !baselineEnd) return;
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
    setPreferences((current) => ({ ...current, zoom: nextZoom }));
    requestAnimationFrame(updateScrollMetrics);
  }

  function fitTimeline() {
    const element = scrollRef.current;
    if (!element) return;
    const relevantDates = displayJobs.flatMap((job) => [job.planned_start, job.planned_end, job.requested_delivery_date]
      .filter((value): value is string => Boolean(value))
      .map(parseScheduleDate));
    if (relevantDates.length === 0) return;
    const earliest = new Date(Math.min(...relevantDates.map((date) => date.getTime())));
    const latest = new Date(Math.max(...relevantDates.map((date) => date.getTime())));
    const rangeDays = differenceInCalendarDays(latest, earliest) + 1;
    const calendarViewport = Math.max(1, element.clientWidth - railWidth);
    const width = fitTimelineDayWidth(zoom, rangeDays, calendarViewport, FIT_PADDING_DAYS);
    setPreferences((current) => ({ ...current, dayWidths: { ...current.dayWidths, [zoom]: width } }));
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const earliestOffset = differenceInCalendarDays(earliest, timeline.start);
      scrollRef.current.scrollLeft = Math.max(0, (earliestOffset - FIT_PADDING_DAYS) * width);
      updateScrollMetrics();
      ganttRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function goToToday() {
    const element = scrollRef.current;
    const index = timeline.days.findIndex((day) => day.isToday);
    if (!element || index < 0) return;
    const calendarViewport = Math.max(1, element.clientWidth - railWidth);
    element.scrollTo({ left: Math.max(0, index * dayWidth + dayWidth / 2 - calendarViewport / 2), behavior: 'smooth' });
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
  const activeJob = interaction ? jobs.find((job) => job.id === interaction.jobId) : null;
  const currentIntensity = activeJob && interaction
    ? laborIntensity(activeJob.estimated_man_hours, interaction.originalStart, interaction.originalEnd)
    : null;
  const proposedIntensity = activeJob && interaction
    ? laborIntensity(activeJob.estimated_man_hours, interaction.previewStart, interaction.previewEnd)
    : null;

  return (
    <div ref={ganttRef} className="scroll-mt-16 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="z-40 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 shadow-sm">
        <span id="timeline-zoom-label" className="font-bold uppercase tracking-[0.12em] text-slate-500">Zoom</span>
        <div className="inline-flex h-8 overflow-hidden rounded-sm border border-slate-300 bg-white">
          <button type="button" aria-label="Zoom Timeline out" title="Zoom out" disabled={Boolean(interaction) || dayWidth <= zoomOption.minDayWidth} onClick={() => updateDayWidth(dayWidth - zoomOption.step)} className="inline-flex h-full w-8 items-center justify-center border-r border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:opacity-40"><Minus className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <button type="button" aria-label="Zoom Timeline in" title="Zoom in" disabled={Boolean(interaction) || dayWidth >= zoomOption.maxDayWidth} onClick={() => updateDayWidth(dayWidth + zoomOption.step)} className="inline-flex h-full w-8 items-center justify-center text-slate-700 hover:bg-slate-50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:opacity-40"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
        <div role="group" aria-labelledby="timeline-zoom-label" className="inline-flex h-8 items-stretch rounded-sm border border-slate-300 bg-slate-50 p-0.5">
          {TIMELINE_ZOOM_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={zoom === option.value} disabled={Boolean(interaction)} onClick={() => changeZoom(option.value)} className={`h-full rounded-sm px-3 text-[9px] font-bold uppercase tracking-[0.08em] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${zoom === option.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{option.label}</button>
          ))}
        </div>
        <button type="button" onClick={fitTimeline} disabled={Boolean(interaction)} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40"><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />Fit</button>
        <button type="button" onClick={goToToday} disabled={Boolean(interaction)} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-blue-300 bg-white px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-blue-600 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40"><LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />Today</button>
        <label className="inline-flex h-8 items-center gap-2 px-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500" title={`Timeline rows: ${rowDensityOption.label}`}>
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
              if (option) setPreferences((current) => ({ ...current, rowDensity: option.value }));
            }}
            className="timeline-density-slider w-16 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Timeline legend">
        <span className="font-bold uppercase tracking-[0.12em] text-slate-500">Legend</span>
        {productionStatusVisuals.map((visual) => (
          <span key={visual.value} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden="true"
              className={`h-3 w-5 border ${visual.className}`}
              style={visual.pattern ? { backgroundImage: visual.pattern } : undefined}
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
        onScroll={updateScrollMetrics}
        onWheel={(event) => {
          if (!event.shiftKey || event.ctrlKey || event.metaKey) return;
          event.preventDefault();
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
          <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-100/90">
            <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-300 bg-slate-100 px-4 pb-3 pt-9" style={{ width: railWidth }}>
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
                className="absolute inset-y-0 right-0 z-40 w-2 translate-x-1/2 cursor-col-resize touch-none bg-transparent outline-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-slate-400/0 hover:after:bg-blue-600 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 focus-visible:after:bg-blue-600"
              />
            </div>
            <div className="relative shrink-0" style={{ width: timelineWidth }}>
              <div className="flex h-8 border-b border-slate-300">
                {days.map((day, index) => {
                  const previousDay = index > 0 ? days[index - 1] : null;
                  const showMonth = index === 0 || previousDay?.date.getMonth() !== day.date.getMonth();
                  return (
                    <div key={`month-${day.key}`} className={`shrink-0 ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''}`} style={{ width: dayWidth }}>
                      {showMonth && <div className="whitespace-nowrap px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{day.monthLabel}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex h-10">
                {days.map((day) => (
                  <div key={day.key} title={day.date.toLocaleDateString()} className={`flex shrink-0 flex-col items-center justify-center border-r border-slate-200 text-[10px] ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''} ${day.isToday ? 'bg-blue-100 font-bold text-blue-900' : day.isWeekend ? 'bg-slate-200/70 text-slate-500' : 'text-slate-600'}`} style={{ width: dayWidth }}>
                    {(zoom === 'days' || zoom === 'weeks') && <span>{day.weekday}</span>}
                    {(zoom === 'days' || zoom === 'weeks' || (zoom === 'months' && (day.date.getDay() === 1 || day.dayNumber === 1))) && <span className="text-xs font-bold">{day.dayNumber}</span>}
                    {zoom === 'year' && day.dayNumber === 1 && <span className="text-[8px] font-bold uppercase">{day.date.toLocaleDateString(undefined, { month: 'narrow' })}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {displayJobs.filter((job) => job.planned_start && job.planned_end).map((job) => {
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

            return (
              <div key={job.id} className="flex border-b border-slate-300 last:border-b-0" style={{ minHeight: rowDensityOption.height }}>
                <div className={`sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-400 bg-white ${preferences.rowDensity === 'compact' ? 'px-3 py-1' : preferences.rowDensity === 'comfortable' ? 'px-4 py-3' : 'px-4 py-2'}`} style={{ width: railWidth }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div title={job.name} className={`truncate font-bold text-slate-950 ${preferences.rowDensity === 'compact' ? 'text-xs' : 'text-[13px]'}`}>{job.name}</div>
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
                  </div>
                </div>

                <div
                  data-timeline-pan-canvas="true"
                  className={`relative shrink-0 ${canvasPan ? 'cursor-grabbing' : 'cursor-move'}`}
                  style={{ width: timelineWidth }}
                >
                  <div className="absolute inset-0 flex">
                    {days.map((day) => <div key={`${job.id}-${day.key}`} className={`h-full shrink-0 border-r border-slate-200 ${day.dayNumber === 1 ? 'border-l-2 border-l-slate-500' : ''} ${day.isWeekend ? 'bg-slate-100' : ''}`} style={{ width: dayWidth }} />)}
                  </div>
                  {todayIndex >= 0 && <div className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-blue-600" style={{ left: todayIndex * dayWidth + dayWidth / 2 }} />}

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
                      className={`absolute top-1/2 z-[3] h-8 -translate-y-1/2 border shadow-sm transition-[box-shadow,filter] ${statusVisual.className} ${activeInteraction ? 'z-20 brightness-110 shadow-lg outline outline-2 outline-slate-950/50' : 'hover:brightness-105 hover:shadow-md'} ${isStaged ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
                      style={{ left: startOffset * dayWidth + 3, width: barWidth, backgroundImage: statusVisual.pattern }}
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
                        aria-label={`Move ${job.name}. Use left and right arrow keys for one-day adjustments.`}
                        onPointerDown={(event) => startInteraction(event, job, 'move')}
                        onKeyDown={(event) => handleScheduleKey(event, job, 'move')}
                        onDragStart={(event) => event.preventDefault()}
                        className="absolute inset-y-0 z-10 flex min-w-0 items-center gap-2 overflow-hidden px-1.5 text-left text-[10px] font-bold uppercase tracking-[0.05em] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                        style={{ left: handleWidth, right: handleWidth, cursor: activeInteraction?.mode === 'move' ? 'grabbing' : 'grab', pointerEvents: 'auto', touchAction: 'none' }}
                      >
                        {duration >= 2 && <span className="pointer-events-none truncate">{job.name}</span>}
                        {isStaged && duration >= 3 && <span className="pointer-events-none shrink-0 bg-amber-100/95 px-1 text-[8px] text-amber-950">Unsaved</span>}
                        {duration >= 5 && intensity?.hoursPerScheduledDay !== null && intensity?.hoursPerScheduledDay !== undefined && (
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

                  {hasDeliveryMilestone && (
                    <div className="absolute top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2" style={{ left: deliveryOffset * dayWidth + dayWidth / 2 }} title={`Requested delivery: ${job.requested_delivery_date}`}>
                      <div className="h-5 w-5 rotate-45 border-2 border-violet-800 bg-violet-200 shadow-sm" />
                      <div className="absolute left-5 top-1/2 w-40 -translate-y-1/2 pl-2 text-[10px] font-bold uppercase tracking-[0.05em] text-violet-900">Delivery</div>
                    </div>
                  )}
                  {!hasSchedule && !hasDeliveryMilestone && <div className="absolute left-4 top-1/2 z-[2] -translate-y-1/2"><span className="inline-flex border border-dashed border-slate-400 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">Schedule not set</span></div>}
                </div>
              </div>
            );
          })}
        </div>
        {hasHorizontalOverflow && (
          <div
            aria-label="Timeline horizontal navigator"
            className="sticky bottom-0 left-0 z-30 flex h-9 border-t border-slate-300 bg-slate-100/95 shadow-[0_-2px_6px_rgba(15,23,42,0.08)] backdrop-blur"
            style={{ width: scrollMetrics.viewportWidth }}
            data-timeline-interactive="true"
          >
            <div className="flex shrink-0 items-center border-r border-slate-300 px-3 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500" style={{ width: railWidth }}>Timeline navigation</div>
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
              <div ref={navigatorTrackRef} onPointerDown={clickNavigatorTrack} className="relative h-3 min-w-0 flex-1 cursor-pointer rounded-full bg-slate-300/80">
                <button
                  type="button"
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

      {displayJobs.some((job) => !job.planned_start || !job.planned_end) && (
        <section className="border-t border-slate-400 bg-slate-50 p-4" aria-labelledby="not-scheduled-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="not-scheduled-heading" className="text-sm font-bold uppercase tracking-[0.1em] text-slate-800">Not Scheduled</h3>
            <span className="text-xs font-semibold text-slate-500">{displayJobs.filter((job) => !job.planned_start || !job.planned_end).length} need dates</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {displayJobs.filter((job) => !job.planned_start || !job.planned_end).map((job) => (
              <button key={job.id} type="button" onClick={() => onSelectJob(job, 'planned-dates')} className="flex min-w-0 items-center justify-between gap-3 border border-slate-300 bg-white px-3 py-2 text-left hover:border-blue-600 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-700">
                <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-950">{job.job_number ? `${job.job_number} — ` : ''}{job.name}</span><span className="block truncate text-xs text-slate-600">Add planned start and finish dates to place this job on the Timeline.</span></span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-800">Complete setup</span>
              </button>
            ))}
          </div>
        </section>
      )}

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
    </div>
  );
}
