import assert from 'node:assert/strict';

import {
  defaultTimelinePreferences,
  fitTimelineDayWidth,
  normalizeTimelinePreferences,
  parseTimelinePreferences,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
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

console.log('Production Timeline preference checks passed.');
