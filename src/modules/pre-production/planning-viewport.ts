import { addCalendarDays, differenceInCalendarDays, formatScheduleDate, parseScheduleDate } from '@/modules/production/schedule';

export const MIN_DAY_WIDTH = 2;
export const MAX_DAY_WIDTH = 48;
export const RAIL_WIDTH = 240;
export type PlanningRange = { start: string; end: string };
export const dayDistance = (start: string, end: string) => differenceInCalendarDays(parseScheduleDate(end), parseScheduleDate(start));
export const shiftedDate = (date: string, days: number) => formatScheduleDate(addCalendarDays(date, days));

// Fit never compresses below 2px/day or frames more than one year. Distant
// outliers remain reachable by scrolling (ten years either side of today) or
// opening their row; they cannot collapse the useful calendar into a sliver.
export function fitPlanningRanges(ranges: PlanningRange[], availableWidth: number, today: string) {
  const starts = ranges.map(r => r.start).sort(), ends = ranges.map(r => r.end).sort();
  const start = starts[0] ?? today, end = ends.at(-1) ?? shiftedDate(today, 27);
  const span = dayDistance(start, end) + 1;
  const centers = ranges.map(r => shiftedDate(r.start, Math.floor(dayDistance(r.start, r.end) / 2))).sort();
  const center = span > 365 ? centers[Math.floor(centers.length / 2)] : shiftedDate(start, Math.floor(span / 2));
  const width = Math.max(80, availableWidth);
  const dayWidth = Math.max(MIN_DAY_WIDTH, Math.min(MAX_DAY_WIDTH, width / (Math.max(14, Math.min(365, span)) + 14)));
  return { center: center ?? today, dayWidth, limited: span > 365 || (span + 14) * MIN_DAY_WIDTH > width };
}
