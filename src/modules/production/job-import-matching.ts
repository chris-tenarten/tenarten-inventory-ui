import type { ProductionJob } from './types';
import type { ExtractedJobMetadata } from './job-import-provider';

const normalized = (value: string | null | undefined) => value?.trim().toLocaleLowerCase() ?? '';

export type ProductionJobMatch = {
  job: ProductionJob;
  matchedBy: 'job_number' | 'work_order_number' | 'plate_number' | 'customer_and_name';
};

export function findMatchingProductionJob(jobs: ProductionJob[], imported: ExtractedJobMetadata): ProductionJobMatch | null {
  const exact = (field: keyof ProductionJob, value: string) => {
    const target = normalized(value);
    return target ? jobs.find((job) => normalized(String(job[field] ?? '')) === target) : undefined;
  };
  const jobNumber = exact('job_number', imported.jobNumber);
  if (jobNumber) return { job: jobNumber, matchedBy: 'job_number' };
  const workOrder = exact('work_order_number', imported.workOrderNumber);
  if (workOrder) return { job: workOrder, matchedBy: 'work_order_number' };
  const plate = exact('color_plate_number', imported.plateNumber);
  if (plate) return { job: plate, matchedBy: 'plate_number' };
  const customer = normalized(imported.customer);
  const name = normalized(imported.jobName);
  const fallback = customer && name ? jobs.find((job) => normalized(job.customer) === customer && normalized(job.name) === name) : undefined;
  return fallback ? { job: fallback, matchedBy: 'customer_and_name' } : null;
}
