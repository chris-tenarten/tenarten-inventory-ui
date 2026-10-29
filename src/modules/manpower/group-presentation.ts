import { compareReportingGroups } from './progressive-history';
import type { ManpowerEntry, ManpowerReportingGroup } from './types';

export type GroupSort = 'reporting-date' | 'work-date' | 'job-name';
type ReportingGroup = { group: ManpowerReportingGroup | null; label: string; entries: ManpowerEntry[] };

/** Sort complete loaded membership before text search narrows displayed rows.
 * Editing timestamps and Job modification timestamps never determine this order.
 * Mixed-Job groups use their alphabetically first Job/work label; empty groups last.
 */
export function sortReportingGroups<T extends ReportingGroup>(groups: T[], sort: GroupSort): T[] {
  const decorated = groups.map(group => ({
    group,
    workDate: sort === 'work-date' ? group.entries.reduce((latest, entry) => entry.work_date > latest ? entry.work_date : latest, '') : '',
    jobName: sort === 'job-name' ? group.entries.map(entry => entry.job?.name ?? entry.unlisted_work_label ?? '').filter(Boolean).sort((a, b) => a.localeCompare(b))[0] ?? '' : '',
  }));
  return decorated.sort((a, b) => {
    if (sort === 'work-date') {
      const byDate = b.workDate.localeCompare(a.workDate);
      if (byDate) return byDate;
    }
    if (sort === 'job-name') {
      if (!a.jobName && b.jobName) return 1;
      if (a.jobName && !b.jobName) return -1;
      const byName = a.jobName.localeCompare(b.jobName);
      if (byName) return byName;
    }
    if (a.group.group && b.group.group) return compareReportingGroups(a.group.group, b.group.group);
    if (a.group.group) return -1;
    if (b.group.group) return 1;
    return a.group.label.localeCompare(b.group.label);
  }).map(item => item.group);
}
