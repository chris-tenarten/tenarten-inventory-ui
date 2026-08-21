import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [jobs, summary, workspace, queue, table, activityStrip, indicator, inspector, styles] = await Promise.all([
  read('src/modules/production/jobs.ts'),
  read('src/modules/production/job-update-summary.ts'),
  read('src/modules/production/ProductionWorkspace.tsx'),
  read('src/modules/production/components/ProductionQueue.tsx'),
  read('src/modules/production/components/ProductionTable.tsx'),
  read('src/modules/production/components/ActivityStrip.tsx'),
  read('src/modules/production/components/JobUpdatesIndicator.tsx'),
  read('src/modules/production/components/ProductionJobInspector.tsx'),
  read('src/app/globals.css'),
]);

assert.match(jobs, /export \{ EMPTY_JOB_UPDATE_SUMMARY, type JobUpdateSummary \}/);
assert.match(jobs, /loadJobUpdateSummaries/);
assert.match(jobs, /\.from\('job_updates'\)/);
assert.match(summary, /openFollowUpCount/);
assert.match(summary, /openFollowUpAssignees/);
assert.match(summary, /latestCreatedAt/);
assert.match(summary, /hasUnseenActivity/);

assert.match(workspace, /loadJobUpdateSummaries/);
assert.match(workspace, /jobUpdateSummaries=\{jobUpdateSummaries\}/);

assert.match(queue, /ActivityStrip/);
assert.match(queue, /onSelectJob\(job, 'job-updates'\)/);
assert.doesNotMatch(queue, /data-overview-update-attention|hasUpdateAttention/,
  'Collaboration state must not apply a persistent Production Overview row surface');
assert.doesNotMatch(queue, /data-overview-update-attention-marker/);
assert.doesNotMatch(queue, /openFollowUpCount\} open/);
assert.doesNotMatch(queue, /animate-|bounce|flash/i);

assert.match(activityStrip, /JobUpdatesIndicator/);
assert.match(activityStrip, /Paperclip/);
assert.match(activityStrip, /className="shrink-0"/);
assert.match(activityStrip, /display="overview-slots"/);
assert.match(activityStrip, /h-6 w-12/);
assert.match(activityStrip, /tabular-nums/);

assert.match(workspace, /jobUpdateSummaries=\{jobUpdateSummaries\}/);
assert.match(table, /JobUpdatesIndicator/);
assert.match(table, /jobUpdateSummaries/);
assert.match(table, /onSelectJob\(job, 'job-updates'\)/);

assert.match(indicator, /MessageSquare/);
assert.doesNotMatch(indicator, /Flag/);
assert.match(indicator, /Open Job Updates for/);
assert.match(indicator, /summary\.total/);
assert.match(indicator, /summary\.hasUnseenActivity/);
assert.doesNotMatch(indicator, /openFollowUp|Assignee|mention|assignment|needs-attention/i,
  'Mentions, assignments, and follow-ups must not drive Job Update control styling');
assert.match(indicator, />\|<\/span>/);
assert.match(indicator, /border-slate-300 bg-white[\s\S]*text-slate-600/,
  'Zero and counted Job Update controls must share the neutral base treatment');
assert.doesNotMatch(indicator, /border-blue-200 bg-blue-50\/60|text-blue-900/,
  'Update count alone must not create a blue control in light mode');
assert.doesNotMatch(styles, /\[data-job-updates-indicator\]\[data-has-updates="true"\]/,
  'Update count alone must not create a blue control in dark mode');
assert.doesNotMatch(indicator, /assigneeLabel && \(\s*<span\s+className="max-w-24 truncate border-l/);
assert.match(indicator, /const hasUpdates = summary\.total > 0/);
assert.match(indicator, /\{hasUpdates \? <>/,
  'Zero Updates must retain the chat control while omitting the count');
assert.match(indicator, /event\.stopPropagation\(\)/);
assert.match(indicator, /absolute -right-0\.5 -top-0\.5/);
assert.match(indicator, /data-job-updates-unseen-dot[\s\S]*bg-blue-600/,
  'The upper-right dot is the sole persistent blue unread indicator');

assert.match(inspector, /Job Updates \(\$\{jobUpdateCount\}\)/);
assert.match(inspector, /onSummaryChanged=\{handleJobUpdateSummaryChanged\}/);

console.log('Production Job Update discovery checks passed.');
