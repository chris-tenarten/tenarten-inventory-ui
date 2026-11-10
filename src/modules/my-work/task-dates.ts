import type { WorkTask } from './types';

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** My Work due dates are local calendar dates, never UTC instants. */
export function dueBucket(task: Pick<WorkTask, 'dueDate'>, upcomingDays?: number, now = new Date()) {
  if (!task.dueDate) return 'undated' as const;
  const todayKey = localDateKey(now);
  if (task.dueDate < todayKey) return 'overdue' as const;
  if (task.dueDate === todayKey) return 'today' as const;
  if (upcomingDays !== undefined) {
    const end = new Date(now);
    end.setDate(end.getDate() + upcomingDays);
    if (task.dueDate > localDateKey(end)) return 'later' as const;
  }
  return 'upcoming' as const;
}

export function taskDetailHref(taskId: string) {
  return `/my-work?taskId=${encodeURIComponent(taskId)}`;
}
