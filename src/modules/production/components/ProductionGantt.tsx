'use client';

import { useEffect, useMemo, useState } from 'react';
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
type TimelineZoom = 'days' | 'weeks' | 'months' | 'year';

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

const LABEL_WIDTH = 320;
const DRAG_THRESHOLD_PX = 4;
const ZOOM_OPTIONS: Array<{ value: TimelineZoom; label: string; dayWidth: number; minimumDays: number; paddingDays: number }> = [
  { value: 'days', label: 'Days', dayWidth: 64, minimumDays: 21, paddingDays: 3 },
  { value: 'weeks', label: 'Weeks', dayWidth: 42, minimumDays: 42, paddingDays: 7 },
  { value: 'months', label: 'Months', dayWidth: 20, minimumDays: 180, paddingDays: 30 },
  { value: 'year', label: 'Year', dayWidth: 10, minimumDays: 365, paddingDays: 45 },
];


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
  const zoomOption = ZOOM_OPTIONS.find((option) => option.value === zoom) ?? ZOOM_OPTIONS[1];
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
  const [zoom, setZoom] = useState<TimelineZoom>('weeks');
  const displayJobs = useMemo(() => jobs.map((job) => stagedSchedules[job.id]
    ? { ...job, planned_start: stagedSchedules[job.id].proposed_planned_start, planned_end: stagedSchedules[job.id].proposed_planned_end }
    : job), [jobs, stagedSchedules]);
  const timeline = useMemo(() => createTimeline(displayJobs, zoom), [displayJobs, zoom]);
  const zoomOption = ZOOM_OPTIONS.find((option) => option.value === zoom) ?? ZOOM_OPTIONS[1];
  const dayWidth = zoomOption.dayWidth;

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
  const todayIndex = days.findIndex((day) => day.isToday);
  const activeJob = interaction ? jobs.find((job) => job.id === interaction.jobId) : null;
  const currentIntensity = activeJob && interaction
    ? laborIntensity(activeJob.estimated_man_hours, interaction.originalStart, interaction.originalEnd)
    : null;
  const proposedIntensity = activeJob && interaction
    ? laborIntensity(activeJob.estimated_man_hours, interaction.previewStart, interaction.previewEnd)
    : null;

  return (
    <div className="overflow-hidden border border-slate-400 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-300 bg-slate-50 px-4 py-2 text-[10px] font-semibold text-slate-700">
        <span id="timeline-zoom-label" className="font-bold uppercase tracking-[0.12em] text-slate-500">Zoom</span>
        <div role="group" aria-labelledby="timeline-zoom-label" className="inline-flex h-8 items-stretch border border-slate-400 bg-white">
          {ZOOM_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={zoom === option.value} disabled={Boolean(interaction)} onClick={() => setZoom(option.value)} className={`h-full border-l border-slate-300 px-3 text-[9px] font-bold uppercase tracking-[0.08em] first:border-l-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${zoom === option.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>{option.label}</button>
          ))}
        </div>
        <span className="h-5 w-px bg-slate-300" aria-hidden="true" />
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
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
          <div className="sticky top-0 z-20 flex border-b border-slate-400 bg-slate-100">
            <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-400 bg-slate-100 px-4 pb-3 pt-9" style={{ width: LABEL_WIDTH }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Project / Schedule</div>
            </div>
            <div className="relative shrink-0" style={{ width: timelineWidth }}>
              <div className="flex h-8 border-b border-slate-300">
                {days.map((day, index) => {
                  const previousDay = index > 0 ? days[index - 1] : null;
                  const showMonth = index === 0 || previousDay?.date.getMonth() !== day.date.getMonth();
                  return (
                    <div key={`month-${day.key}`} className="shrink-0" style={{ width: dayWidth }}>
                      {showMonth && <div className="whitespace-nowrap px-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{day.monthLabel}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex h-10">
                {days.map((day) => (
                  <div key={day.key} title={day.date.toLocaleDateString()} className={`flex shrink-0 flex-col items-center justify-center border-r border-slate-200 text-[10px] ${day.isToday ? 'bg-blue-100 font-bold text-blue-900' : day.isWeekend ? 'bg-slate-200/70 text-slate-500' : 'text-slate-600'}`} style={{ width: dayWidth }}>
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
              <div key={job.id} className="flex min-h-[74px] border-b border-slate-300 last:border-b-0">
                <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-400 bg-white px-4 py-3" style={{ width: LABEL_WIDTH }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-bold text-slate-950">{job.name}</div>
                      {isStaged && <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-700">Proposed</span>}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-600">{[job.job_number, job.customer].filter(Boolean).join(' • ') || 'Identifiers not assigned'}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {hasSchedule && displayStart && displayEnd
                        ? `${formatShortDate(displayStart)} – ${formatShortDate(displayEnd)} · ${intensityLabel(job, displayStart, displayEnd)}`
                        : job.requested_delivery_date
                          ? `Delivery requested ${formatShortDate(job.requested_delivery_date)}`
                          : 'Schedule not set'}
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0" style={{ width: timelineWidth }}>
                  <div className="absolute inset-0 flex">
                    {days.map((day) => <div key={`${job.id}-${day.key}`} className={`h-full shrink-0 border-r border-slate-200 ${day.isWeekend ? 'bg-slate-100' : ''}`} style={{ width: dayWidth }} />)}
                  </div>
                  {todayIndex >= 0 && <div className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-blue-600" style={{ left: todayIndex * dayWidth + dayWidth / 2 }} />}

                  {isStaged && stagedSchedule?.original_planned_start && stagedSchedule.original_planned_end && (
                    <div
                      aria-label={`Last saved schedule for ${job.name}: ${stagedSchedule.original_planned_start} through ${stagedSchedule.original_planned_end}`}
                      className="pointer-events-none absolute top-1/2 z-[2] h-9 -translate-y-1/2 border-2 border-dashed border-slate-700 bg-slate-400/35"
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
                      className={`absolute top-1/2 z-[3] h-9 -translate-y-1/2 border shadow-sm transition-[box-shadow,filter] ${statusVisual.className} ${activeInteraction ? 'z-20 brightness-110 shadow-lg outline outline-2 outline-slate-950/50' : 'hover:brightness-105 hover:shadow-md'} ${isStaged ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
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
