import { supabase } from '../../lib/supabase';
import { isActiveProductionRework } from '../production/rework';
import type {
  ManpowerEntry,
  ManpowerEntryInput,
  ManpowerJob,
  ManpowerReworkCycle,
  ManpowerReference,
  ManpowerReportingGroup,
} from './types';

const ENTRY_COLUMNS = `
  id, work_date, worker_id, task_id, job_id, rework_cycle_id, reporting_group_id, unlisted_work_label,
  am_hours, pm_hours, notes, entered_by, created_at, updated_at,
  worker:manpower_workers!worker_id(id, display_name),
  task:manpower_tasks!task_id(id, display_name),
  job:jobs(id, name, job_number, production_status, archived_at),
  rework_cycle:production_rework_cycles!manpower_entries_rework_matches_job_fkey(id, job_id, sequence_number, production_status),
  reporting_group:manpower_reporting_groups(id, display_name, created_at, updated_at)
`;

export async function loadManpowerEntries(): Promise<ManpowerEntry[]> {
  const { data, error } = await supabase
    .from('manpower_entries')
    .select(ENTRY_COLUMNS)
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ManpowerEntry[];
}

export async function loadManpowerJobs(): Promise<ManpowerJob[]> {
  const [jobs, reworks] = await Promise.all([
    supabase.from('jobs').select('id,name,job_number,production_status,archived_at').is('archived_at', null).order('name'),
    supabase.from('production_rework_cycles').select('id,job_id,sequence_number,production_status').order('sequence_number', { ascending: false }),
  ]);
  if (jobs.error) throw jobs.error;
  if (reworks.error) throw reworks.error;
  const activeByJob = new Map<string, ManpowerReworkCycle>();
  for (const cycle of (reworks.data ?? []) as ManpowerReworkCycle[]) {
    if (isActiveProductionRework(cycle) && !activeByJob.has(cycle.job_id)) activeByJob.set(cycle.job_id, cycle);
  }
  return ((jobs.data ?? []) as Omit<ManpowerJob, 'active_rework_cycle'>[]).map((job) => ({
    ...job,
    active_rework_cycle: activeByJob.get(job.id) ?? null,
  }));
}

export async function loadManpowerReportingGroups(): Promise<ManpowerReportingGroup[]> {
  const { data, error } = await supabase
    .from('manpower_reporting_groups')
    .select('id,display_name,created_at,updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ManpowerReportingGroup[];
}

export async function createManpowerReportingGroup(
  displayName: string,
): Promise<ManpowerReportingGroup> {
  const { data, error } = await supabase
    .from('manpower_reporting_groups')
    .insert({ display_name: displayName.trim() })
    .select('id,display_name,created_at,updated_at')
    .single();
  if (error) throw error;
  return data as ManpowerReportingGroup;
}

export async function updateManpowerReportingGroup(
  id: string,
  displayName: string,
): Promise<ManpowerReportingGroup> {
  const { data, error } = await supabase
    .from('manpower_reporting_groups')
    .update({ display_name: displayName.trim() })
    .eq('id', id)
    .select('id,display_name,created_at,updated_at')
    .single();
  if (error) throw error;
  return data as ManpowerReportingGroup;
}

export async function deleteEmptyManpowerReportingGroup(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_empty_manpower_reporting_group', {
    p_group_id: id,
  });
  if (error) throw error;
}

export async function loadManpowerReferences(
  table: 'manpower_workers' | 'manpower_tasks',
): Promise<ManpowerReference[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id,display_name,sort_order,is_active,created_at,updated_at')
    .order('sort_order')
    .order('display_name');
  if (error) throw error;
  return (data ?? []) as ManpowerReference[];
}

export async function createManpowerReference(
  table: 'manpower_workers' | 'manpower_tasks',
  displayName: string,
  sortOrder: number,
): Promise<ManpowerReference> {
  const { data, error } = await supabase
    .from(table)
    .insert({ display_name: displayName.trim(), sort_order: sortOrder })
    .select('id,display_name,sort_order,is_active,created_at,updated_at')
    .single();
  if (error) throw error;
  return data as ManpowerReference;
}

export async function updateManpowerReference(
  table: 'manpower_workers' | 'manpower_tasks',
  id: string,
  changes: Partial<Pick<ManpowerReference, 'display_name' | 'sort_order' | 'is_active'>>,
): Promise<ManpowerReference> {
  const payload = {
    ...changes,
    ...(changes.display_name === undefined ? {} : { display_name: changes.display_name.trim() }),
  };
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select('id,display_name,sort_order,is_active,created_at,updated_at')
    .single();
  if (error) throw error;
  return data as ManpowerReference;
}

export async function createManpowerEntry(input: ManpowerEntryInput): Promise<ManpowerEntry> {
  const { data, error } = await supabase
    .from('manpower_entries')
    .insert(input)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as ManpowerEntry;
}

export async function updateManpowerEntry(
  id: string,
  changes: Partial<ManpowerEntryInput>,
): Promise<ManpowerEntry> {
  const { data, error } = await supabase
    .from('manpower_entries')
    .update(changes)
    .eq('id', id)
    .select(ENTRY_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as ManpowerEntry;
}

export type ManpowerBulkUpdateResult = {
  updated: ManpowerEntry[];
  failures: Array<{ id: string; message: string }>;
};

export type ManpowerBulkDeleteResult = {
  deletedIds: string[];
  failures: Array<{ id: string; message: string }>;
};

export async function deleteManpowerEntries(ids: string[]): Promise<ManpowerBulkDeleteResult> {
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const { data, error } = await supabase
        .from('manpower_entries')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data || data.id !== id) {
        throw new Error('Supabase did not confirm that the selected entry was deleted.');
      }
      return data.id;
    }),
  );
  return results.reduce<ManpowerBulkDeleteResult>((summary, result, index) => {
    if (result.status === 'fulfilled') summary.deletedIds.push(result.value);
    else summary.failures.push({ id: ids[index], message: caughtMessage(result.reason) });
    return summary;
  }, { deletedIds: [], failures: [] });
}

function caughtMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  if (caught && typeof caught === 'object' && 'message' in caught) return String(caught.message);
  return 'Unknown delete error';
}

export async function updateManpowerEntries(
  ids: string[],
  changes: Partial<ManpowerEntryInput>,
): Promise<ManpowerBulkUpdateResult> {
  const results = await Promise.allSettled(
    ids.map((id) => updateManpowerEntry(id, changes)),
  );

  return results.reduce<ManpowerBulkUpdateResult>(
    (summary, result, index) => {
      if (result.status === 'fulfilled') {
        summary.updated.push(result.value);
      } else {
        summary.failures.push({
          id: ids[index],
          message:
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown update error',
        });
      }
      return summary;
    },
    { updated: [], failures: [] },
  );
}

export async function updateManpowerGroupIdentity(
  ids: string[],
  identity: Pick<ManpowerEntryInput, 'job_id' | 'rework_cycle_id' | 'unlisted_work_label'>,
): Promise<ManpowerEntry[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('manpower_entries')
    .update(identity)
    .in('id', ids)
    .select(ENTRY_COLUMNS);
  if (error) throw error;
  if ((data?.length ?? 0) !== ids.length) throw new Error('The manpower group identity update was not confirmed for every entry.');
  return (data ?? []) as unknown as ManpowerEntry[];
}
