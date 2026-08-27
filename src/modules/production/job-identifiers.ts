import type { ProductionJob } from './types';

export type JobNumberOwner = Pick<ProductionJob,'id'|'name'|'job_number'>;

export function canonicalJobNumber(value:string|null|undefined){const trimmed=value?.trim()??'';return trimmed||null;}
export function normalizedJobNumber(value:string|null|undefined){return canonicalJobNumber(value)?.toLowerCase()??null;}

export function findJobNumberConflict<T extends JobNumberOwner>(jobs:T[],value:string|null|undefined,excludeJobId?:string):T|null{
  const normalized=normalizedJobNumber(value);if(!normalized)return null;
  return jobs.find((job)=>job.id!==excludeJobId&&normalizedJobNumber(job.job_number)===normalized)??null;
}

export function jobNumberConflictMessage(value:string|null|undefined,owner?:JobNumberOwner|null){
  const canonical=canonicalJobNumber(value)??'This Job Number';
  return owner?`Job Number ${canonical} is already in use by ${owner.name}.`:`Job Number ${canonical} is already in use.`;
}

export function isJobNumberUniqueViolation(error:unknown){
  if(!error||typeof error!=='object')return false;
  const details=error as{code?:string;message?:string;details?:string};
  return details.code==='23505'&&`${details.message??''} ${details.details??''}`.includes('jobs_job_number_normalized_unique');
}
