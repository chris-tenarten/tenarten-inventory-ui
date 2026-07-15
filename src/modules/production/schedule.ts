const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseScheduleDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatScheduleDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(value: string | Date, days: number) {
  const result = typeof value === 'string' ? parseScheduleDate(value) : new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

export function differenceInCalendarDays(laterDate: Date, earlierDate: Date) {
  const laterUtc = Date.UTC(laterDate.getFullYear(), laterDate.getMonth(), laterDate.getDate());
  const earlierUtc = Date.UTC(earlierDate.getFullYear(), earlierDate.getMonth(), earlierDate.getDate());
  return Math.round((laterUtc - earlierUtc) / MILLISECONDS_PER_DAY);
}

export function inclusiveCalendarDays(start: string, end: string) {
  return Math.max(1, differenceInCalendarDays(parseScheduleDate(end), parseScheduleDate(start)) + 1);
}

export function laborIntensity(estimatedHours: number | null, start: string, end: string) {
  const hours = Number(estimatedHours);
  const scheduledDays = inclusiveCalendarDays(start, end);
  const hasEstimate = Number.isFinite(hours) && hours > 0;

  return {
    estimatedHours: hasEstimate ? hours : null,
    scheduledDays,
    hoursPerScheduledDay: hasEstimate && scheduledDays > 0 ? hours / scheduledDays : null,
  };
}
