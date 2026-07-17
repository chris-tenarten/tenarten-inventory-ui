export type TimelineZoom = 'days' | 'weeks' | 'months' | 'year';
export type TimelineRowDensity = 'compact' | 'standard' | 'comfortable';

export type TimelinePreferences = {
  zoom: TimelineZoom;
  dayWidths: Record<TimelineZoom, number>;
  railWidth: number;
  rowDensity: TimelineRowDensity;
};

export const TIMELINE_PREFERENCES_KEY = 'tenops.productionTimelinePreferences.v1';
export const RAIL_WIDTH_MIN = 220;
export const RAIL_WIDTH_MAX = 440;

export const TIMELINE_ROW_DENSITY_OPTIONS: Array<{
  value: TimelineRowDensity;
  label: string;
  height: number;
}> = [
  { value: 'compact', label: 'Compact', height: 44 },
  { value: 'standard', label: 'Standard', height: 63 },
  { value: 'comfortable', label: 'Comfortable', height: 76 },
];

export const TIMELINE_ZOOM_OPTIONS: Array<{
  value: TimelineZoom;
  label: string;
  defaultDayWidth: number;
  minDayWidth: number;
  maxDayWidth: number;
  step: number;
  minimumDays: number;
  paddingDays: number;
}> = [
  { value: 'days', label: 'Days', defaultDayWidth: 64, minDayWidth: 32, maxDayWidth: 96, step: 8, minimumDays: 21, paddingDays: 3 },
  { value: 'weeks', label: 'Weeks', defaultDayWidth: 42, minDayWidth: 20, maxDayWidth: 64, step: 6, minimumDays: 42, paddingDays: 7 },
  { value: 'months', label: 'Months', defaultDayWidth: 20, minDayWidth: 8, maxDayWidth: 32, step: 4, minimumDays: 180, paddingDays: 30 },
  { value: 'year', label: 'Year', defaultDayWidth: 10, minDayWidth: 4, maxDayWidth: 18, step: 2, minimumDays: 365, paddingDays: 45 },
];

const zoomValues = new Set<TimelineZoom>(TIMELINE_ZOOM_OPTIONS.map((option) => option.value));

export const defaultTimelinePreferences: TimelinePreferences = {
  zoom: 'weeks',
  dayWidths: Object.fromEntries(TIMELINE_ZOOM_OPTIONS.map((option) => [option.value, option.defaultDayWidth])) as Record<TimelineZoom, number>,
  railWidth: 320,
  rowDensity: 'standard',
};

export function timelineZoomOption(zoom: TimelineZoom) {
  return TIMELINE_ZOOM_OPTIONS.find((option) => option.value === zoom) ?? TIMELINE_ZOOM_OPTIONS[1];
}

export function clampTimelineDayWidth(zoom: TimelineZoom, value: number) {
  const option = timelineZoomOption(zoom);
  return Math.min(option.maxDayWidth, Math.max(option.minDayWidth, Math.round(value)));
}

export function normalizeTimelinePreferences(value: unknown): TimelinePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultTimelinePreferences;
  const candidate = value as Partial<TimelinePreferences>;
  const zoom = typeof candidate.zoom === 'string' && zoomValues.has(candidate.zoom as TimelineZoom)
    ? candidate.zoom as TimelineZoom
    : defaultTimelinePreferences.zoom;
  const dayWidths = { ...defaultTimelinePreferences.dayWidths };
  if (candidate.dayWidths && typeof candidate.dayWidths === 'object' && !Array.isArray(candidate.dayWidths)) {
    for (const option of TIMELINE_ZOOM_OPTIONS) {
      const width = candidate.dayWidths[option.value];
      if (typeof width === 'number' && Number.isFinite(width)) dayWidths[option.value] = clampTimelineDayWidth(option.value, width);
    }
  }
  const railWidth = typeof candidate.railWidth === 'number' && Number.isFinite(candidate.railWidth)
    ? Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(candidate.railWidth)))
    : defaultTimelinePreferences.railWidth;
  const rowDensity = TIMELINE_ROW_DENSITY_OPTIONS.some((option) => option.value === candidate.rowDensity)
    ? candidate.rowDensity as TimelineRowDensity
    : defaultTimelinePreferences.rowDensity;
  return { zoom, dayWidths, railWidth, rowDensity };
}

export function parseTimelinePreferences(value: string | null) {
  if (!value) return defaultTimelinePreferences;
  try {
    return normalizeTimelinePreferences(JSON.parse(value));
  } catch {
    return defaultTimelinePreferences;
  }
}

export function fitTimelineDayWidth(zoom: TimelineZoom, rangeDays: number, calendarViewportWidth: number, paddingDays: number) {
  if (!Number.isFinite(rangeDays) || rangeDays <= 0 || !Number.isFinite(calendarViewportWidth) || calendarViewportWidth <= 0) {
    return timelineZoomOption(zoom).defaultDayWidth;
  }
  return clampTimelineDayWidth(zoom, calendarViewportWidth / Math.max(1, rangeDays + paddingDays * 2));
}
