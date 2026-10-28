import type { AppRole } from '@/lib/rbac';
import type { ProductionJob } from './types';
import { ADMIN_ONLY_PRODUCTION_FIXTURE_ID } from '../../../supabase/functions/_shared/production-job-facts.mjs';

export { ADMIN_ONLY_PRODUCTION_FIXTURE_ID };

export function productionJobsVisibleToRole<T extends Pick<ProductionJob, 'id'>>(
  jobs: T[],
  role: AppRole | null | undefined,
) {
  if (role === 'admin') return jobs;
  return jobs.filter((job) => job.id !== ADMIN_ONLY_PRODUCTION_FIXTURE_ID);
}
