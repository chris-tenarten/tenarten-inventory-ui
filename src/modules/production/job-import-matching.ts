import type { ProductionJob } from './types';
import type { ExtractedJobMetadata } from './job-import-provider';
import { normalizedJobNumber } from './job-identifiers';

const normalized = (value: string | null | undefined) => value?.trim().toLocaleLowerCase() ?? '';

export type ProductionJobMatch = {
  job: ProductionJob;
  matchedBy: 'job_number' | 'work_order_number' | 'estimate_number' | 'plate_number' | 'customer_and_name';
};

const plateValues = (value: string | null | undefined) => new Set(
  (value ?? '').split(',').map(normalized).filter(Boolean),
);

export function findMatchingProductionJob(jobs: ProductionJob[], imported: ExtractedJobMetadata): ProductionJobMatch | null {
  const exact = (field: keyof ProductionJob, value: string) => {
    const target = normalized(value);
    return target ? jobs.find((job) => normalized(String(job[field] ?? '')) === target) : undefined;
  };
  const importedJobNumber = normalizedJobNumber(imported.jobNumber);
  const jobNumber = importedJobNumber
    ? jobs.find((job) => normalizedJobNumber(job.job_number) === importedJobNumber)
    : undefined;
  if (jobNumber) return { job: jobNumber, matchedBy: 'job_number' };
  const workOrder = exact('work_order_number', imported.workOrderNumber);
  if (workOrder) return { job: workOrder, matchedBy: 'work_order_number' };
  const estimate = exact('estimate_number', imported.estimateNumber);
  if (estimate) return { job: estimate, matchedBy: 'estimate_number' };
  const importedPlates = plateValues(imported.plateNumber);
  const plate = importedPlates.size ? jobs.find((job) => {
    const existingPlates = plateValues(job.color_plate_number);
    return [...importedPlates].some((value) => existingPlates.has(value));
  }) : undefined;
  if (plate) return { job: plate, matchedBy: 'plate_number' };
  const customer = normalized(imported.customer);
  const name = normalized(imported.jobName);
  const fallback = customer && name ? jobs.find((job) => normalized(job.customer) === customer && normalized(job.name) === name) : undefined;
  return fallback ? { job: fallback, matchedBy: 'customer_and_name' } : null;
}
