import { addCalendarDays, formatScheduleDate } from '@/modules/production/schedule';

export type BidPlanning = {
  id: string;
  updated_at: string;
  projected_production_start: string | null;
  projected_production_end: string | null;
  projected_window_updated_by: string | null;
  projected_window_updated_at: string | null;
  production_job_id: string | null;
  converted_at: string | null;
  converted_by_user_id: string | null;
};
export type WindowEdit = 'move' | 'start' | 'end';
export function adjustProjectedWindow(start: string, end: string, days: number, mode: WindowEdit) {
  const shift = (value: string) => formatScheduleDate(addCalendarDays(value, days));
  const nextStart = mode === 'end' ? start : shift(start);
  const nextEnd = mode === 'start' ? end : shift(end);
  return nextStart <= nextEnd ? { start: nextStart, end: nextEnd } : null;
}
export function projectedWindowEligible(status: string, planning: BidPlanning | undefined) {
  return status !== 'lost' && !planning?.production_job_id;
}
