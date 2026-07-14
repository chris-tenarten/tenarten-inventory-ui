import { supabase } from '../../lib/supabase';

export type ProductionJobOption = {
  id: string;
  name: string;
  job_number: string | null;
  production_status: string;
  archived_at: string | null;
};

export const PRODUCTION_JOB_FOCUS_STORAGE_KEY = 'tenops_focus_production_job_id';

export function formatProductionJobOption(job: Pick<ProductionJobOption, 'name' | 'job_number'>) {
  return job.job_number ? `${job.job_number} — ${job.name}` : job.name;
}

export async function loadProductionJobOptions(): Promise<ProductionJobOption[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,name,job_number,production_status,archived_at')
    .is('archived_at', null)
    .not('production_status', 'in', '(complete,cancelled)')
    .order('job_number', { ascending: true, nullsFirst: false })
    .order('name');

  if (error) throw error;
  return (data ?? []) as ProductionJobOption[];
}

export async function loadProductionJobOption(jobId: string): Promise<ProductionJobOption | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,name,job_number,production_status,archived_at')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw error;
  return data as ProductionJobOption | null;
}

export function openProductionJob(jobId: string) {
  window.sessionStorage.setItem(PRODUCTION_JOB_FOCUS_STORAGE_KEY, jobId);
  window.location.assign('/');
}
