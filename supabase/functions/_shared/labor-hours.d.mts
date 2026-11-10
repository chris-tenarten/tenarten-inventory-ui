export type LaborHoursInput = { am_hours: number | string | null; pm_hours: number | string | null };
export function entryHundredths(entry: LaborHoursInput): number;
export function laborHours(entries: LaborHoursInput[]): number;
