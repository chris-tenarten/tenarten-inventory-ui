import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [jobs, workspace, queue, table, activityStrip, indicator, inspector] = await Promise.all([
  read('src/modules/production/jobs.ts'),
  read('src/modules/production/ProductionWorkspace.tsx'),
  read('src/modules/production/components/ProductionQueue.tsx'),
  read('src/modules/production/components/ProductionTable.tsx'),
  read('src/modules/production/components/ActivityStrip.tsx'),
  read('src/modules/production/components/JobUpdatesIndicator.tsx'),
  read('src/modules/production/components/ProductionJobInspector.tsx'),
]);

assert.match(jobs, /export type JobUpdateSummary/);
assert.match(jobs, /loadJobUpdateSummaries/);
assert.match(jobs, /\.from\('job_updates'\)/);
assert.match(jobs, /openFollowUpCount/);
assert.match(jobs, /latestCreatedAt/);

assert.match(workspace, /loadJobUpdateSummaries/);
assert.match(workspace, /jobUpdateSummaries=\{jobUpdateSummaries\}/);

assert.match(queue, /ActivityStrip/);
assert.match(queue, /onSelectJob\(job, 'job-updates'\)/);
assert.doesNotMatch(queue, /hasUnviewedJobUpdates/);
assert.doesNotMatch(queue, /markJobUpdatesViewed/);
assert.doesNotMatch(queue, /job-update-view-state/);
assert.doesNotMatch(queue, /New updates/);
assert.doesNotMatch(queue, /bg-blue-600/);
assert.doesNotMatch(queue, /openFollowUpCount\} open/);
assert.doesNotMatch(queue, /animate-|bounce|flash/i);

assert.match(activityStrip, /JobUpdatesIndicator/);
assert.match(activityStrip, /Paperclip/);
assert.match(activityStrip, /className="w-24"/);
assert.match(activityStrip, /display="overview-slots"/);
assert.match(activityStrip, /h-6 w-12/);
assert.match(activityStrip, /tabular-nums/);

assert.match(workspace, /jobUpdateSummaries=\{jobUpdateSummaries\}/);
assert.match(table, /JobUpdatesIndicator/);
assert.match(table, /jobUpdateSummaries/);
assert.match(table, /onSelectJob\(job, 'job-updates'\)/);

assert.match(indicator, /MessageSquare/);
assert.match(indicator, /Flag/);
assert.match(indicator, /Open Job Updates for/);
assert.match(indicator, /summary\.total/);
assert.match(indicator, /summary\.openFollowUpCount/);
assert.match(indicator, /overview-slots/);
assert.match(indicator, /w-12/);
assert.match(indicator, /event\.stopPropagation\(\)/);
assert.doesNotMatch(indicator, /absolute -right-1 -top-1/);

assert.match(inspector, /Job Updates \(\$\{jobUpdateCount\}\)/);
assert.match(inspector, /onSummaryChanged=\{handleJobUpdateSummaryChanged\}/);

console.log('Production Job Update discovery checks passed.');
