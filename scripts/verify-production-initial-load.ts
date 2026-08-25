import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8');
const jobs = readFileSync(new URL('../src/modules/production/jobs.ts', import.meta.url), 'utf8');

assert.match(workspace, /if \(!auth\.ready \|\| !productionProfileResolved\) return Promise\.resolve\(\)/);
assert.match(workspace, /jobLoadInFlightRef\.current\?\.key === loadKey/);
assert.match(workspace, /productionJobsVisibleToRole\(jobsWithFocused, productionProfileRole\)/);

const startSupportingData = workspace.indexOf('const supportingDataPromise = Promise.all([');
const awaitCoreJobs = workspace.indexOf('const [loadedJobs, focusedJob] = await Promise.all([');
const publishCoreJobs = workspace.indexOf('setJobs(sortJobs(visibleJobs));');
const makeOverviewUsable = workspace.indexOf('setIsLoading(false);', publishCoreJobs);
const awaitSupportingData = workspace.indexOf('const [[loadedCounts, summaries, updateSummaries], planningData] = await Promise.all([');
const publishSupportingData = workspace.indexOf('setAttachmentCounts(loadedCounts);');

assert.ok(startSupportingData < awaitCoreJobs, 'supporting requests should start alongside the core Job request');
assert.ok(awaitCoreJobs < publishCoreJobs, 'core Jobs must resolve before they are published');
assert.ok(publishCoreJobs < makeOverviewUsable, 'the usable Overview must contain role-filtered core Jobs');
assert.ok(makeOverviewUsable < awaitSupportingData, 'supporting summaries and Planning must not block the Overview');
assert.ok(awaitSupportingData < publishSupportingData, 'supporting state must publish only after its requests resolve');

assert.match(jobs, /loadProductionJobs[\s\S]*Promise\.all\(\[\s*query,[\s\S]*production_rework_cycles/);
assert.match(jobs, /loadProductionIntegrationSummaries[\s\S]*Promise\.all\(\[[\s\S]*manpower_entries[\s\S]*material_usage_reports/);
assert.doesNotMatch(workspace, /visibleJobs\.map\([^)]*=>\s*load(?:Production|Job|Planning)/, 'initial loading must not introduce per-Job requests');

console.log('Production initial-load critical-path checks passed.');
