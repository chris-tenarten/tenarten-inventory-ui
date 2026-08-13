import assert from 'node:assert/strict';

import { arrangeProductionTimelineJobs } from '../src/modules/production/arrangement.ts';

import {
  defaultTimelinePreferences,
  fitTimelineDayWidth,
  fitRenderedTimelineScrollLeft,
  normalizeTimelinePreferences,
  parseTimelinePreferences,
  productionTimelineFitParticipates,
  productionTimelinePlanningHorizon,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
  timelineIntervalFocusScrollLeft,
} from '../src/modules/production/timeline-preferences.ts';

assert.deepEqual(parseTimelinePreferences('{broken'), defaultTimelinePreferences, 'Malformed storage must use defaults.');

const normalized = normalizeTimelinePreferences({
  zoom: 'months',
  railWidth: 9999,
  dayWidths: { days: 2, weeks: 999, months: 18, year: Number.NaN, unknown: 50 },
});

assert.equal(normalized.zoom, 'months');
assert.equal(normalized.railWidth, RAIL_WIDTH_MAX, 'Rail width must clamp to the maximum.');
assert.equal(normalized.dayWidths.days, 32, 'Days scale must clamp to its minimum.');
assert.equal(normalized.dayWidths.weeks, 64, 'Weeks scale must clamp to its maximum.');
assert.equal(normalized.dayWidths.months, 18, 'Valid mode scale must survive normalization.');
assert.equal(normalized.dayWidths.year, defaultTimelinePreferences.dayWidths.year, 'Invalid scale must use its default.');

assert.equal(normalizeTimelinePreferences({ railWidth: -1 }).railWidth, RAIL_WIDTH_MIN, 'Rail width must clamp to the minimum.');
assert.equal(normalizeTimelinePreferences({ rowDensity: 'compact' }).rowDensity, 'compact', 'Valid row density must survive normalization.');
assert.equal(normalizeTimelinePreferences({ rowDensity: 'tiny' }).rowDensity, 'standard', 'Unknown row density must use the default.');
assert.equal(fitTimelineDayWidth('weeks', 20, 1000, 2), 42, 'Fit should produce a bounded integer day width.');
assert.equal(fitTimelineDayWidth('year', 1000, 500, 2), 4, 'Fit should clamp very large ranges to the mode minimum.');
assert.equal(fitTimelineDayWidth('days', 0, 500, 2), 64, 'Fit without a meaningful range should use the mode default.');
assert.equal(fitRenderedTimelineScrollLeft({ contentLeft: 400, contentRight: 600, calendarViewportWidth: 400, maxScrollLeft: 1000, visualPadding: 32 }), 300, 'Fit should center the measured rendered bars in the calendar viewport.');
assert.equal(fitRenderedTimelineScrollLeft({ contentLeft: 0, contentRight: 100, calendarViewportWidth: 400, maxScrollLeft: 1000, visualPadding: 32 }), 0, 'Fit should clamp measured bars to the beginning of the rendered domain.');
assert.equal(fitRenderedTimelineScrollLeft({ contentLeft: 1800, contentRight: 2000, calendarViewportWidth: 400, maxScrollLeft: 1500, visualPadding: 32 }), 1500, 'Fit should clamp measured bars to the end of the rendered domain.');
assert.equal(fitRenderedTimelineScrollLeft({ contentLeft: 400, contentRight: 600, calendarViewportWidth: 400, maxScrollLeft: 5000, visualPadding: 2000 }), 300, 'Symmetric visual padding must not move the midpoint of the rendered work.');
for (const status of ['not_started', 'on_deck', 'in_production', 'on_hold', 'shipped']) {
  assert.equal(productionTimelineFitParticipates(status), true, `${status} must participate in operational Fit bounds.`);
}
for (const status of ['complete', 'cancelled']) {
  assert.equal(productionTimelineFitParticipates(status), false, `${status} must remain outside operational Fit bounds.`);
}
assert.equal(timelineIntervalFocusScrollLeft({ intervalLeft: 140, intervalRight: 240, scrollLeft: 100, viewportWidth: 300, maxScrollLeft: 1000, comfortablePadding: 30 }), null, 'A comfortably visible interval should not scroll.');
assert.equal(timelineIntervalFocusScrollLeft({ intervalLeft: 600, intervalRight: 700, scrollLeft: 100, viewportWidth: 300, maxScrollLeft: 1000, comfortablePadding: 30 }), 500, 'An offscreen interval should center in the current viewport.');
assert.equal(timelineIntervalFocusScrollLeft({ intervalLeft: 200, intervalRight: 800, scrollLeft: 0, viewportWidth: 300, maxScrollLeft: 1000, comfortablePadding: 30 }), 350, 'An interval wider than the viewport should center on its midpoint.');
assert.equal(timelineIntervalFocusScrollLeft({ intervalLeft: 10, intervalRight: 30, scrollLeft: 100, viewportWidth: 300, maxScrollLeft: 1000, comfortablePadding: 30 }), 0, 'Focus should clamp to the Timeline start.');

const planningJobs = [
  { planned_start: '2026-03-01', planned_end: '2026-03-10', production_status: 'complete' },
  { planned_start: '2026-08-05', planned_end: '2026-08-18', production_status: 'in_production' },
  { planned_start: '2026-08-25', planned_end: '2026-09-04', production_status: 'not_started' },
  { planned_start: '2026-02-01', planned_end: '2026-02-05', production_status: 'cancelled' },
];
assert.deepEqual(
  productionTimelinePlanningHorizon(planningJobs),
  { start: '2026-08-05', end: '2026-09-04' },
  'The default planning horizon must include overdue and upcoming active work without being pulled into history by completed or cancelled jobs.',
);
assert.deepEqual(
  productionTimelinePlanningHorizon([
    { planned_start: '2026-01-01', planned_end: '2026-01-05', production_status: 'complete' },
    { planned_start: '2026-08-25', planned_end: '2026-09-02', production_status: 'on_deck' },
  ]),
  { start: '2026-08-25', end: '2026-09-02' },
  'Future active work must determine the planning horizon when all earlier work is complete.',
);
assert.equal(
  productionTimelinePlanningHorizon([
    { planned_start: '2026-01-01', planned_end: '2026-01-05', production_status: 'complete' },
    { planned_start: '2026-02-01', planned_end: '2026-02-05', production_status: 'cancelled' },
  ]),
  null,
  'A schedule with no active work must fall back to the current-date context.',
);

const timelineRows = [
  { id: 'cancelled', job_number: '26-0004', name: 'Cancelled', planned_start: '2026-07-01', planned_end: '2026-07-03', production_status: 'cancelled' },
  { id: 'upcoming-b', job_number: '26-0003', name: 'Upcoming B', planned_start: '2026-08-25', planned_end: '2026-08-30', production_status: 'not_started' },
  { id: 'complete', job_number: '26-0005', name: 'Complete', planned_start: '2026-06-01', planned_end: '2026-06-05', production_status: 'complete' },
  { id: 'upcoming-a', job_number: '26-0002', name: 'Upcoming A', planned_start: '2026-08-25', planned_end: '2026-08-30', production_status: 'on_deck' },
  { id: 'overdue', job_number: '26-0001', name: 'Overdue', planned_start: '2026-08-05', planned_end: '2026-08-10', production_status: 'in_production' },
];
assert.deepEqual(
  arrangeProductionTimelineJobs(timelineRows).map((job) => job.id),
  ['overdue', 'upcoming-a', 'upcoming-b', 'complete', 'cancelled'],
  'Timeline rows must show chronological active work first, then chronological completed/cancelled history, with deterministic identity tie-breakers.',
);

console.log('Production Timeline preference checks passed.');
