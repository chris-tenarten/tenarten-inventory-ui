import type { ManpowerReportingGroup } from './types';
export const UNGROUPED_HISTORY_KEY = '__ungrouped__';
export const HISTORY_GROUP_BATCH_SIZE = 8;

export function groupReportingDate(group: ManpowerReportingGroup): number | null {
  const match = group.display_name.match(/^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (!match) return null;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[1]), day = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : null;
}
/** Existing reporting-date/creation/name/id order, frozen when retrieval starts. */
export function orderHistoryGroups(groups: ManpowerReportingGroup[]) {
  return [...groups].sort((a, b) => {
    const ad = groupReportingDate(a), bd = groupReportingDate(b);
    if (ad !== null && bd !== null && ad !== bd) return bd - ad;
    if (ad !== null && bd === null) return -1;
    if (ad === null && bd !== null) return 1;
    return b.created_at.localeCompare(a.created_at) || a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id);
  }).map(group => group.id);
}
export function nextHistoryBatch(ordered: string[], priority: Set<string>, complete: Set<string>) {
  const remaining = ordered.filter(key => !complete.has(key));
  const queue = [...remaining.filter(key => priority.has(key)), ...remaining.filter(key => !priority.has(key))];
  if (queue[0] === UNGROUPED_HISTORY_KEY) return [UNGROUPED_HISTORY_KEY];
  const boundary = queue.indexOf(UNGROUPED_HISTORY_KEY);
  return queue.slice(0, boundary < 0 ? HISTORY_GROUP_BATCH_SIZE : Math.min(boundary, HISTORY_GROUP_BATCH_SIZE));
}
/** Immutable id cursor; provider caps cannot split a published group. Counts must
 * reconcile on every page. This is not a transactional cross-request snapshot. */
export async function readCompleteGroupBatch<T extends { id: string }>(read: (after: string | null) => PromiseLike<{ data: T[] | null; count: number | null; error: { message: string } | null }>) {
  const rows: T[] = []; let expected: number | null = null; let after: string | null = null;
  while (true) {
    const page = await read(after);
    if (page.error) throw new Error(page.error.message);
    if (page.count === null) throw new Error('Unable to verify complete reporting groups. Retry history.');
    expected ??= page.count;
    if (rows.length + page.count !== expected) throw new Error('Reporting group membership changed while loading. Refresh reporting.');
    for (const row of page.data ?? []) {
      if (after !== null && row.id <= after) throw new Error('Reporting group pagination changed. Refresh reporting.');
      rows.push(row); after = row.id;
    }
    if (rows.length === expected) return rows;
    if (!page.data?.length || rows.length > expected) throw new Error('Reporting group retrieval was incomplete. Retry history.');
  }
}
