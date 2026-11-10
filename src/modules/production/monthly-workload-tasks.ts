import type { WorkTask } from '@/modules/my-work/types';
import { dueBucket } from '@/modules/my-work/task-dates';
import { formatScheduleDate, parseScheduleDate } from './schedule';
import { workloadDayJobs, type WorkloadJob, type WorkloadSegment } from './monthly-workload';

export type WorkloadContents = 'jobs' | 'tasks' | 'both';
export function normalizeWorkloadContents(value: string | null): WorkloadContents {
  return value === 'tasks' || value === 'both' ? value : 'jobs';
}

/** The existing participant RPC is authoritative; retain its privacy boundary in presentation too. */
export function workloadTasks(tasks: readonly WorkTask[], userId: string, start: string, end: string) {
  const authorized = tasks.filter(task => Boolean(userId) && (task.visibility === 'private'
    ? task.creatorUserId === userId && task.assigneeUserId === userId
    : task.assigneeUserId === userId || task.creatorUserId === userId));
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && formatScheduleDate(parseScheduleDate(date)) === date;
  const dated = authorized.filter(task => valid(task.dueDate) && task.dueDate >= start && task.dueDate <= end)
    .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { dated, undated: authorized.filter(task => !valid(task.dueDate)).length };
}

/** Both can reserve task rows independently; single-content views retain their full capacity. */
export function workloadDayItems<T extends WorkloadJob>(segments: WorkloadSegment<T>[], column: number, tasks: readonly WorkTask[], date: string, capacity: number, taskCapacity?: number) {
  const jobs = workloadDayJobs(segments, column);
  const shownJobs = jobs.filter(segment => segment.lane < capacity);
  const dayTasks = tasks.filter(task => task.dueDate === date);
  const available = taskCapacity === undefined
    ? Array.from({ length: capacity }, (_, lane) => lane).filter(lane => !shownJobs.some(segment => segment.lane === lane))
    : Array.from({ length: taskCapacity }, (_, lane) => lane);
  const shownTasks = dayTasks.slice(0, available.length).map((task, index) => ({ task, lane: available[index] }));
  return { jobs, tasks: dayTasks, shownTasks, hidden: jobs.length - shownJobs.length + dayTasks.length - shownTasks.length };
}

export function workloadTaskState(task: WorkTask, now = new Date()) {
  return task.completedAt ? 'completed' : dueBucket(task, undefined, now);
}
