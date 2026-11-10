import { loadCompleteRows } from '@/lib/complete-rows';
import { supabase } from '../../lib/supabase';
import {
  formatProductionJobSelectorLabel,
  type ProductionJobReference,
} from './job-reference';
import { productionStatusVisualByValue } from './status-visuals';
import type { ProductionStatus } from './types';
import { productionJobPath } from './job-links';
import { OPEN_PRODUCTION_JOB_LOCAL_EVENT, OPEN_PRODUCTION_JOB_ROUTE_EVENT, type ProductionJobOpenRequest } from './job-navigation';

export type ProductionJobOption = ProductionJobReference & {
  customer: string | null;
  work_order_number: string | null;
  color_plate_number: string | null;
  production_status: string;
  archived_at: string | null;
  planned_start: string | null;
  requested_delivery_date: string | null;
};

export const PRODUCTION_JOB_FOCUS_STORAGE_KEY = 'tenops_focus_production_job_id';
export const PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY = 'tenops_focus_production_job_section';

export function formatProductionJobOption(job: Pick<ProductionJobOption, 'name' | 'job_number'>) {
  return formatProductionJobSelectorLabel(job);
}

export function formatProductionJobOptionWithStatus(job: Pick<ProductionJobOption, 'name' | 'job_number' | 'production_status' | 'archived_at'>) {
  const status = productionStatusVisualByValue[job.production_status as ProductionStatus]?.label ?? job.production_status;
  return `${formatProductionJobOption(job)} — ${status}${job.archived_at ? ' — Archived' : ''}`;
}

export async function loadProductionJobOptions(options?: {
  orderBy?: 'identity' | 'schedule';
  includeArchived?: boolean;
}): Promise<ProductionJobOption[]> {
  return loadCompleteRows((from, to) => {
    let query = supabase
      .from('jobs')
      .select('id,name,job_number,customer,work_order_number,color_plate_number,production_status,archived_at,planned_start,requested_delivery_date', { count: 'exact' });
    if (!options?.includeArchived) query = query.is('archived_at', null);

    query = options?.orderBy === 'schedule'
      ? query
          .order('planned_start', { ascending: true, nullsFirst: false })
          .order('name')
      : query
          .order('job_number', { ascending: true, nullsFirst: false })
          .order('name');

    return query.order('id').range(from, to).returns<ProductionJobOption[]>();
  });
}

export async function loadProductionJobOption(jobId: string): Promise<ProductionJobOption | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,name,job_number,customer,work_order_number,color_plate_number,production_status,archived_at,planned_start,requested_delivery_date')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as ProductionJobOption | null;
}

export function openProductionJob(jobId: string, focus?: string): boolean {
  const path = productionJobPath(jobId);
  const request: ProductionJobOpenRequest = { jobId: jobId.toLowerCase(), focus, accepted: false };
  // A mounted Production workspace can open its own Inspector without changing
  // Calendar/filter/staged state. Other routes use the persistent shell router.
  const local = new CustomEvent(OPEN_PRODUCTION_JOB_LOCAL_EVENT, { cancelable: true, detail: request });
  window.dispatchEvent(local);
  if (local.defaultPrevented) return request.accepted;
  const route = new CustomEvent(OPEN_PRODUCTION_JOB_ROUTE_EVENT, { cancelable: true, detail: request });
  window.dispatchEvent(route);
  if (route.defaultPrevented && !request.accepted) return false;
  window.sessionStorage.setItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY, request.jobId);
  if (focus) window.sessionStorage.setItem(PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY, focus);
  else window.sessionStorage.removeItem(PRODUCTION_JOB_FOCUS_SECTION_STORAGE_KEY);
  if (route.defaultPrevented) return true;
  // No running shell is available (for example an external entry point).
  // A genuine document load retains the existing authenticated deep-link path.
  window.location.assign(path);
  return true;
}
