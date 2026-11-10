import { productionJobPath, requestedProductionJob } from './job-links';

export const OPEN_PRODUCTION_JOB_LOCAL_EVENT = 'tenops:open-production-job-local';
export const OPEN_PRODUCTION_JOB_ROUTE_EVENT = 'tenops:open-production-job-route';
export const LEAVE_PRODUCTION_JOB_EVENT = 'tenops:leave-production-job';
export type ProductionJobOpenRequest = { jobId: string; focus?: string; accepted: boolean };

export function productionJobOpenRequest(event: Event): ProductionJobOpenRequest | null {
  const detail = (event as CustomEvent<Partial<ProductionJobOpenRequest>>).detail;
  if (!detail || typeof detail.jobId !== 'string' || typeof detail.accepted !== 'boolean' ||
    (detail.focus !== undefined && (typeof detail.focus !== 'string' || detail.focus.length > 256))) return null;
  try {
    const id = requestedProductionJob(productionJobPath(detail.jobId).slice(1)).jobId;
    return id === detail.jobId ? detail as ProductionJobOpenRequest : null;
  } catch { return null; }
}
