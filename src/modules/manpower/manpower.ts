import { loadCompleteLabor } from './pagination';
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
  id, work_date, worker_id, task_id, product_category_id, job_id, rework_cycle_id, reporting_group_id, unlisted_work_label,
  am_hours, pm_hours, notes, entered_by, created_at, updated_at,
  worker:manpower_workers!worker_id(id, display_name),
  task:manpower_tasks!task_id(id, display_name),
  job:jobs(id, name, job_number, production_status, archived_at),
  rework_cycle:production_rework_cycles!manpower_entries_rework_matches_job_fkey(id, job_id, sequence_number, production_status),
  reporting_group:manpower_reporting_groups(id, display_name, created_at, updated_at)
`;

export async function loadManpowerEntries(): Promise<ManpowerEntry[]> {
  return await loadCompleteLabor((from, to) => supabase
    .from('manpower_entries')
    .select(ENTRY_COLUMNS, { count: 'exact' })
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, to)) as unknown as ManpowerEntry[];
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

// One PostgREST PATCH = one database statement/transaction. Never split into batches.
// Bound UUID query length and keep returned rows below the hosted response limit.
export const MAX_BULK_PRODUCT_ENTRIES = 100;
export async function updateManpowerProductCategory(ids: string[], categoryId: string): Promise<ManpowerEntry[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) throw new Error('Select at least one labor row.');
  if (uniqueIds.length > MAX_BULK_PRODUCT_ENTRIES) throw new Error(`Select at most ${MAX_BULK_PRODUCT_ENTRIES} rows per category application. No request was sent.`);
  if (!categoryId) throw new Error('Select an active Product Category.');
  const { data, error, count } = await supabase.from('manpower_entries')
    .update({ product_category_id: categoryId }, { count: 'exact' })
    .in('id', uniqueIds).select(ENTRY_COLUMNS);
  if (error) throw error;
  const updated = (data ?? []) as unknown as ManpowerEntry[];
  const returned = new Set(updated.map((entry) => entry.id));
  // RLS/deletion can omit rows without a SQL error. Never call that complete success.
  if (count !== uniqueIds.length || returned.size !== uniqueIds.length || updated.length !== uniqueIds.length ||
      uniqueIds.some((id) => !returned.has(id)) || updated.some((entry) => entry.product_category_id !== categoryId)) {
    throw new Error(`${updated.length} of ${uniqueIds.length} requested rows returned; complete category application was not confirmed. Some rows may have changed.`);
  }
  return updated;
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

export async function loadProductCategories(): Promise<ManpowerReference[]> {
  const { data, error } = await supabase.from('manpower_product_categories')
    .select('id,display_name,sort_order,is_active,created_at,updated_at').order('sort_order').order('display_name').order('id');
  if (error) throw error;
  return data ?? [];
}

export async function saveProductCategory(id: string | null, changes: Pick<ManpowerReference, 'display_name' | 'sort_order' | 'is_active'>, expectedUpdatedAt?: string): Promise<void> {
  const table = supabase.from('manpower_product_categories');
  const payload = { display_name: changes.display_name.trim(), sort_order: changes.sort_order, is_active: changes.is_active };
  const result = id ? await table.update(payload).eq('id', id).eq('updated_at', expectedUpdatedAt ?? '').select('id').single() : await table.insert(payload).select('id').single();
  if (result.error) throw result.error;
}

// Existing guarded category UPDATE path, deliberately without upsert or labor writes.
// Multiple requests are not atomic: callers must refresh after any failure.
export async function saveProductCategoryOrder(before: ManpowerReference[], desired: ManpowerReference[], addedName?: string): Promise<void> {
  const fingerprint = (rows: ManpowerReference[]) => JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)).map(c => [c.id, c.updated_at]));
  if (fingerprint(await loadProductCategories()) !== fingerprint(before)) throw new Error('Categories changed. Refresh and try again.');
  if (desired.length !== before.length || new Set(desired.map(c => c.id)).size !== before.length) throw new Error('Category identity cannot change.');
  for (const next of desired) {
    const previous = before.find(c => c.id === next.id);
    if (!previous) throw new Error('Category identity cannot change.');
    const changes: Partial<Pick<ManpowerReference, 'display_name' | 'sort_order' | 'is_active'>> = {};
    for (const key of ['display_name', 'sort_order', 'is_active'] as const) {
      if (next[key] !== previous[key]) Object.assign(changes, { [key]: next[key] });
    }
    if (!Object.keys(changes).length) continue;
    const { error } = await supabase.from('manpower_product_categories').update(changes)
      .eq('id', next.id).eq('updated_at', previous.updated_at).select('id').single();
    if (error) throw error;
  }
  if (addedName) await saveProductCategory(null, { display_name: addedName, sort_order: desired.filter(c => c.is_active).length + 1, is_active: true });
  const verified = await loadProductCategories();
  if (verified.length !== desired.length + (addedName ? 1 : 0) || desired.some(c => {
    const row = verified.find(v => v.id === c.id);
    return !row || row.display_name !== c.display_name || row.sort_order !== c.sort_order || row.is_active !== c.is_active;
  }) || (addedName && !verified.some(c => !before.some(b => b.id === c.id) && c.display_name === addedName && c.is_active && c.sort_order === desired.filter(d => d.is_active).length + 1))) {
    throw new Error('The saved category list could not be confirmed.');
  }
}
