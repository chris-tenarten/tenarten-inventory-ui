import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [jobs, workspace, queue, inspector] = await Promise.all([
  read('src/modules/production/jobs.ts'),
  read('src/modules/production/ProductionWorkspace.tsx'),
  read('src/modules/production/components/ProductionQueue.tsx'),
  read('src/modules/production/components/ProductionJobInspector.tsx'),
]);

assert.match(jobs, /export type JobUpdateSummary/);
assert.match(jobs, /loadJobUpdateSummaries/);
assert.match(jobs, /\.from\('job_updates'\)/);
assert.match(jobs, /openFollowUpCount/);
assert.match(jobs, /latestCreatedAt/);

assert.match(workspace, /loadJobUpdateSummaries/);
assert.match(workspace, /jobUpdateSummaries=\{jobUpdateSummaries\}/);

assert.match(queue, /MessageSquare/);
assert.match(queue, /Flag/);
assert.match(queue, /updateSummary\.total > 0/);
assert.match(queue, /Open Job Updates for/);
assert.match(queue, /openFollowUpCount/);
assert.match(queue, /onSelectJob\(job, 'job-updates'\)/);
assert.doesNotMatch(queue, /hasUnviewedJobUpdates/);
assert.doesNotMatch(queue, /markJobUpdatesViewed/);
assert.doesNotMatch(queue, /job-update-view-state/);
assert.doesNotMatch(queue, /New updates/);
assert.doesNotMatch(queue, /bg-blue-600/);
assert.doesNotMatch(queue, /openFollowUpCount\} open/);
assert.doesNotMatch(queue, /animate-|bounce|flash/i);

assert.match(inspector, /Job Updates \(\$\{jobUpdateCount\}\)/);
assert.match(inspector, /onSummaryChanged=\{handleJobUpdateSummaryChanged\}/);

console.log('Production Job Update discovery checks passed.');
