import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [workspace, table, queue, inspector, badge, creator, provider, matching, detector, composite, generic] = await Promise.all([
  readFile(new URL('../src/modules/production/ProductionWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionTable.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionQueue.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionJobInspector.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/UnscheduledBadge.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/components/ProductionJobCreator.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/job-import-provider.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/job-import-matching.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/providers/document-family-detector.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/providers/composite-extraction-provider.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/production/providers/generic-identifier-parser.ts', import.meta.url), 'utf8'),
]);

assert.match(workspace, /<ProductionJobCreator[\s\S]*?open=\{jobCreatorOpen\}/);
assert.match(workspace, /onCreateJob=\{handleCreateJob\}/);
assert.match(workspace, /setJobCreatorOpen\(true\)/);
assert.match(workspace, /New Job/);
assert.match(workspace, /Production Job Created/);
assert.match(workspace, /Open Timeline to Schedule Job/);
assert.match(workspace, /const canonicalJob = await loadProductionJob\(job\.id\)/);
assert.match(workspace, /candidate\.id === canonicalJob\.id \? canonicalJob : candidate/);
assert.match(workspace, /openJobScheduling\(canonicalJob\)/);
assert.doesNotMatch(workspace, /setCreatedJob\(null\); openJobScheduling\(job\)/);
assert.match(workspace, /Return to Production/);
assert.match(workspace, /selectJob\(job, 'planned-dates'\)/);
assert.match(workspace, /setStatusFilters\(new Set\(\)\)/);
assert.match(workspace, /setScheduleFilters\(new Set\(\)\)/);
assert.match(workspace, /onCreated=\{\(job\) => \{ setCreatedJobScheduleError\(''\); setCreatedJob\(job\); \}\}/);
assert.match(workspace, /onScheduleJob=\{openJobScheduling\}/);
assert.match(queue, /<UnscheduledBadge ariaLabel=\{`\$\{job\.name\} needs planned dates`\} onClick=\{\(\) => onScheduleJob\(job\)\}/);
assert.match(table, /<UnscheduledBadge iconOnly ariaLabel=\{`\$\{job\.name\} needs planned dates`\} onClick=\{\(\) => onScheduleJob\(job\)\}/);
assert.match(inspector, /<UnscheduledBadge onClick=\{\(\) => onScheduleJob\(job\)\}/);
assert.match(badge, /Open Timeline to schedule this job/);
assert.match(badge, /event\.stopPropagation\(\)/);
assert.doesNotMatch(table, /onCreateJob/);
assert.doesNotMatch(table, /\+ Add Job/);
assert.doesNotMatch(table, /Save New Job/);
assert.match(creator, /Create Blank Job/);
assert.match(creator, /validateDraft\(draft\)/);
assert.match(creator, /await onCreateJob\(toNewJob\(draft\)\)/);
assert.match(creator, /Create from Existing Documents/);
assert.match(creator, /deterministicJobMetadataExtractionProvider\.extractJobMetadata\(files\)/);
assert.match(creator, /estimate_number: metadata\.estimateNumber\.trim\(\) \|\| null/);
assert.match(creator, /\['estimateNumber','Estimate number'\]/);
assert.match(creator, /\['estimate_number', match\.job\.estimate_number, extracted\.estimateNumber\]/);
assert.match(creator, /findMatchingProductionJob\(jobs, extracted\)/);
assert.match(creator, /await onAttachFiles\(created\.id, files\)/);
assert.match(creator, /const updated = await onUpdateJob[\s\S]*?await onAttachFiles\(updated\.id, files\)/);
assert.match(creator, /Retry document upload/);
assert.match(creator, /was created, but one or more documents were not retained/);
assert.match(creator, /was updated, but one or more documents were not retained/);
assert.match(creator, /operationInFlightRef/);
assert.match(creator, /if \(!beginOperation\(\)\) return;/);
assert.match(creator, /Attaching Documents…/);
assert.match(creator, /disabled=\{saveState === 'saving'\}[\s\S]*?Attach Uploaded Documents/);
assert.match(creator, /tenops-selected-surface/);
assert.match(inspector, /onChange=\{\(event\) => schedule\("start", event\.target\.value\)\}/);
assert.match(inspector, /onChange=\{\(event\) => schedule\("end", event\.target\.value\)\}/);
assert.doesNotMatch(inspector, /onBlur=\{\(event\) => schedule\(/);
assert.match(provider, /interface JobMetadataExtractionProvider/);
assert.match(detector, /shop_work_order/);
assert.match(detector, /sample_work_order/);
assert.match(detector, /material_quantity_sheet/);
assert.match(detector, /purchase_order/);
assert.match(composite, /detectProductionDocumentFamily/);
assert.match(composite, /parsers\[family\]\(document\.text\)/);
assert.match(composite, /extractGenericIdentifiers/);
assert.match(generic, /setMedium/);
assert.match(generic, /estimateNumber/);
assert.match(matching, /job_number/);
assert.match(matching, /work_order_number/);
assert.match(matching, /estimate_number/);
assert.match(matching, /plate_number/);
assert.match(matching, /customer_and_name/);

console.log('Production Job creation workflow checks passed.');
