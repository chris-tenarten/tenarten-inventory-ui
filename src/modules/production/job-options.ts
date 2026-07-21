import { supabase } from '../../lib/supabase';
import {
  formatProductionJobSelectorLabel,
  type ProductionJobReference,
} from './job-reference';

export type ProductionJobOption = ProductionJobReference & {
  customer: string | null;
  work_order_number: string | null;
  color_plate_number: string | null;
  production_status: string;
  archived_at: string | null;
  planned_start: string | null;
};

export const PRODUCTION_JOB_FOCUS_STORAGE_KEY = 'tenops_focus_production_job_id';

export function formatProductionJobOption(job: Pick<ProductionJobOption, 'name' | 'job_number'>) {
  return formatProductionJobSelectorLabel(job);
}

export async function loadProductionJobOptions(options?: {
  orderBy?: 'identity' | 'schedule';
}): Promise<ProductionJobOption[]> {
  let query = supabase
    .from('jobs')
    .select('id,name,job_number,customer,work_order_number,color_plate_number,production_status,archived_at,planned_start')
    .is('archived_at', null)
    .not('production_status', 'in', '(complete,cancelled)');

  query = options?.orderBy === 'schedule'
    ? query
        .order('planned_start', { ascending: true, nullsFirst: false })
        .order('name')
    : query
        .order('job_number', { ascending: true, nullsFirst: false })
        .order('name');

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as ProductionJobOption[];
}

export async function loadProductionJobOption(jobId: string): Promise<ProductionJobOption | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,name,job_number,customer,work_order_number,color_plate_number,production_status,archived_at,planned_start')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as ProductionJobOption | null;
}

export function openProductionJob(jobId: string) {
  window.sessionStorage.setItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY, jobId);
  window.location.assign('/');
}
