import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalJobNumber,findJobNumberConflict,isJobNumberUniqueViolation,jobNumberConflictMessage,normalizedJobNumber} from '../src/modules/production/job-identifiers';
import {findMatchingProductionJob} from '../src/modules/production/job-import-matching';
import {emptyExtractedJobMetadata} from '../src/modules/production/job-import-provider';
import type {ProductionJob} from '../src/modules/production/types';

const job=(id:string,number:string|null,name:string):ProductionJob=>({id,name,customer:null,job_number:number,estimate_number:null,work_order_number:null,contract_value:null,deposit_date:null,color_plate_number:null,sample_submitted_date:null,approval_date:null,resin_po:null,chip_po:null,estimated_man_hours:null,estimated_calendar_days:null,requested_delivery_date:null,planned_start:null,planned_end:null,production_status:'not_started',material_status:'unknown',priority:'normal',progress_percent:0,owner_name:null,remarks:null,archived_at:null,created_at:'',updated_at:''});
const jobs=[job('hermes','26-0808','Hermes'),job('blank-a',null,'Temporary A'),job('blank-b',null,'Temporary B')];

assert.equal(canonicalJobNumber(' 26-0808 '),'26-0808');
assert.equal(canonicalJobNumber('   '),null);
assert.equal(normalizedJobNumber(' DEV-A '),'dev-a');
assert.equal(findJobNumberConflict(jobs,'26-9999'),null,'unique Job Number remains available');
assert.equal(findJobNumberConflict(jobs,'26-0808')?.id,'hermes','exact duplicate must block');
assert.equal(findJobNumberConflict(jobs,' 26-0808 ')?.id,'hermes','trim variation must block');
assert.equal(findJobNumberConflict([job('alpha','DEV-A','Alpha')],'dev-a')?.id,'alpha','case variation must block');
assert.equal(findJobNumberConflict(jobs,'   '),null,'blank Job Numbers must not conflict');
assert.equal(findJobNumberConflict(jobs,'26-0808','hermes'),null,'a Job may retain its own number');
assert.match(jobNumberConflictMessage(' 26-0808 ',jobs[0]),/Job Number 26-0808 is already in use by Hermes\./);
assert.equal(isJobNumberUniqueViolation({code:'23505',message:'duplicate key value violates unique constraint "jobs_job_number_normalized_unique"'}),true);

const importMatch=findMatchingProductionJob(jobs,{...emptyExtractedJobMetadata(),jobNumber:' 26-0808 ',jobName:'Different name'});
assert.equal(importMatch?.job.id,'hermes','import must resolve an existing canonical Job Number');
assert.equal(importMatch?.matchedBy,'job_number');

async function verifySource(){
const migration=await readFile(new URL('../supabase/migrations/20260827_009_job_number_uniqueness.sql',import.meta.url),'utf8');
const mutations=await readFile(new URL('../src/modules/production/jobs.ts',import.meta.url),'utf8');
const creator=await readFile(new URL('../src/modules/production/components/ProductionJobCreator.tsx',import.meta.url),'utf8');
const workspace=await readFile(new URL('../src/modules/production/ProductionWorkspace.tsx',import.meta.url),'utf8');
const inspector=await readFile(new URL('../src/modules/production/components/ProductionJobInspector.tsx',import.meta.url),'utf8');
assert.match(migration,/new\.job_number:=nullif\(btrim\(new\.job_number\),''\)/);
assert.match(migration,/create unique index jobs_job_number_normalized_unique[\s\S]*lower\(btrim\(job_number\)\)[\s\S]*where nullif\(btrim\(job_number\),''\) is not null/,'database boundary must enforce normalized nonblank uniqueness');
assert.doesNotMatch(migration,/estimate_number|work_order_number/,'other identifiers must not become hard-unique without evidence');
assert.match(mutations,/loadJobNumberConflict\(canonicalInput\.job_number\)/);
assert.match(mutations,/loadJobNumberConflict\(effectiveChanges\.job_number,currentJob\.id\)/);
assert.match(mutations,/isJobNumberUniqueViolation\(error\)/);
assert.match(creator,/Boolean\(blankJobNumberConflict\)/);
assert.match(creator,/Open existing Job/);
assert.match(workspace,/findJobNumberConflict\(jobs,changes\.job_number,jobId\)/);
assert.match(inspector,/findJobNumberConflict\(jobNumberOwners,draft\.job_number,job\.id\)/);
assert.match(inspector,/dirtyCount === 0 \|\| Boolean\(jobNumberConflict\)/,'Inspector Save must remain blocked for a known conflict');
console.log('Job Number uniqueness checks passed.');
}
void verifySource();
