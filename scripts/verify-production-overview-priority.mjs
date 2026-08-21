import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const queue = readFileSync(new URL('../src/modules/production/components/ProductionQueue.tsx', import.meta.url), 'utf8');
const table = readFileSync(new URL('../src/modules/production/components/ProductionTable.tsx', import.meta.url), 'utf8');
const gantt = readFileSync(new URL('../src/modules/production/components/ProductionGantt.tsx', import.meta.url), 'utf8');
const reworkBadge = readFileSync(new URL('../src/modules/production/components/ReworkBadge.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
assert.match(queue, /const overviewJobs = jobs/);
assert.doesNotMatch(queue, /prioritizeProductionOverviewJobs/);
assert.match(queue, /data-overview-needs-dates-marker/);
assert.match(queue, /onClick=\{\(\) => onScheduleJob\(job\)\}/);
assert.doesNotMatch(queue, /data-overview-update-attention-marker/);
assert.match(queue, /onOpenUpdates=\{\(\) => onSelectJob\(job, 'job-updates'\)\}/);
assert.match(queue, /flex-col items-center justify-center gap-1/);
assert.doesNotMatch(queue, /selectedJobId === job\.id \? 'bg-blue-50\/70 ring-2 ring-inset ring-blue-600'/,
  'Overview selection must not wash or ring the entire row');
assert.doesNotMatch(queue, /data-overview-selected/,
  'Overview rows must not expose a large-area selected-state styling hook');
assert.doesNotMatch(queue, /data-overview-update-attention|hasUpdateAttention/,
  'Mentions, assignments, and follow-ups must not tint an Overview row');
assert.match(queue, /selectedJobId === job\.id \? 'text-blue-800'/,
  'Overview selection may remain localized to restrained Job identity emphasis');
assert.match(queue, /data-production-overview-row/);
assert.match(styles, /\[data-production-overview-row\]:not\(\[data-overview-needs-dates="true"\]\):hover[\s\S]*background-color: var\(--surface-secondary\)/,
  'Dark Overview hover must remain subtle rather than using the global blue/slate interactive surface');
assert.match(queue, /<ReworkBadge sequence=\{job\.rework_cycle\.sequence_number\} showSequence=\{false\} \/>/,
  'Compact Overview Rework badges must omit sequence numbering');
assert.match(reworkBadge, /showSequence \? `Rework #\$\{sequence\}` : "Rework"/,
  'Detailed history must retain meaningful Rework sequence numbers');
assert.doesNotMatch(table, /prioritizeProductionOverviewJobs/);
assert.doesNotMatch(gantt, /prioritizeProductionOverviewJobs/);
console.log('Production Overview stable-order checks passed.');
