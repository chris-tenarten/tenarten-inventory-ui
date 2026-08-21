import type { AppRole } from '@/lib/rbac';
import type { ProductionJob } from './types';

export const ADMIN_ONLY_PRODUCTION_FIXTURE_ID = 'cba79566-3fde-4910-9cf6-45687db70b01';

export function productionJobsVisibleToRole(
  jobs: ProductionJob[],
  role: AppRole | null | undefined,
) {
  if (role === 'admin') return jobs;
  return jobs.filter((job) => job.id !== ADMIN_ONLY_PRODUCTION_FIXTURE_ID);
}
