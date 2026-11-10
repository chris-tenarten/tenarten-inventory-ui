import { addCalendarDays, differenceInCalendarDays, formatScheduleDate, parseScheduleDate } from './schedule';
import type { ProductionJob } from './types';
import { ACTIVE_PRODUCTION_STATUSES } from '../../../supabase/functions/_shared/production-job-facts.mjs';

export type WorkloadView = 'active' | 'on_deck' | 'all_scheduled';
const activeStatuses = new Set(ACTIVE_PRODUCTION_STATUSES);
export function normalizeWorkloadView(value: string | null): WorkloadView {
  return value === 'on_deck' || value === 'all_scheduled' ? value : 'active';
}

export type WorkloadJob = Pick<ProductionJob, 'id' | 'name' | 'job_number' | 'production_status' | 'planned_start' | 'planned_end' | 'archived_at'>;
export type WorkloadSegment<T extends WorkloadJob> = {
  job: T;
  startColumn: number;
  endColumn: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatScheduleDate(parseScheduleDate(value)) === value);
}

/** A view of saved Production dates, using the Timeline's inclusive local-day semantics. */
export function workloadMonth<T extends WorkloadJob>(month: Date, jobs: readonly T[], view: WorkloadView = 'active') {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = formatScheduleDate(first);
  const end = formatScheduleDate(last);
  const gridStart = addCalendarDays(first, -first.getDay());
  const weekCount = Math.ceil((first.getDay() + last.getDate()) / 7);
  const scheduled = jobs.filter(job => !job.archived_at
    && (view === 'all_scheduled' || (view === 'on_deck' ? job.production_status === 'on_deck' : activeStatuses.has(job.production_status)))
    && validDate(job.planned_start) && validDate(job.planned_end)
    && job.planned_start <= job.planned_end
    && job.planned_start <= end && job.planned_end >= start)
    .sort((a, b) => a.planned_start!.localeCompare(b.planned_start!)
      || b.planned_end!.localeCompare(a.planned_end!) || a.id.localeCompare(b.id));

  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = addCalendarDays(gridStart, index * 7);
    const days = Array.from({ length: 7 }, (_, day) => formatScheduleDate(addCalendarDays(weekStart, day)));
    const laneEnds: number[] = [];
    const segments: WorkloadSegment<T>[] = [];
    for (const job of scheduled) {
      const clippedStart = [job.planned_start!, start, days[0]].sort().at(-1)!;
      const clippedEnd = [job.planned_end!, end, days[6]].sort()[0];
      if (clippedStart > clippedEnd) continue;
      const startColumn = differenceInCalendarDays(parseScheduleDate(clippedStart), weekStart);
      const endColumn = differenceInCalendarDays(parseScheduleDate(clippedEnd), weekStart);
      const free = laneEnds.findIndex(laneEnd => laneEnd < startColumn);
      const lane = free < 0 ? laneEnds.length : free;
      laneEnds[lane] = endColumn;
      segments.push({ job, startColumn, endColumn, lane,
        continuesBefore: job.planned_start! < clippedStart,
        continuesAfter: job.planned_end! > clippedEnd });
    }
    return { days, segments };
  });
  return { start, end, weeks, scheduled };
}

export function workloadDayJobs<T extends WorkloadJob>(segments: WorkloadSegment<T>[], column: number) {
  return segments.filter(segment => segment.startColumn <= column && segment.endColumn >= column);
}
