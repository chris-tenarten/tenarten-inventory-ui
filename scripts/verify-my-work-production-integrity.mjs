import { access, readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const baselinePath = new URL('../.tmp-my-work-integrity-baseline.json', import.meta.url);
const mode = process.argv.includes('--snapshot') ? 'snapshot' : process.argv.includes('--compare') ? 'compare' : 'inspect';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Read-only My Work production verification requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. Keep the service-role key in a local environment file or secret store; never commit it.');
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function fetchAll(table, columns, configure = (query) => query, optionalMissing = false) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const query = configure(supabase.from(table).select(columns).range(from, from + 999));
    const { data, error } = await query;
    if (error && optionalMissing && error.code === 'PGRST205') return null;
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

const [tasks, users, jobs, preferences, notifications, optionalAttachments] = await Promise.all([
  fetchAll('work_tasks', 'id,visibility,creator_user_id,assignee_user_id,context_type,context_id,completed_at,created_at,updated_at'),
  fetchAll('app_users', 'user_id'),
  fetchAll('jobs', 'id'),
  fetchAll('work_task_preferences', 'task_id,user_id,color_key,updated_at'),
  fetchAll(
    'account_notifications',
    'id,user_id,notification_type,metadata,created_at',
    (query) => query.in('notification_type', ['shared_task_assigned', 'shared_task_completed']),
  ),
  fetchAll('work_task_attachments', 'id,task_id,uploader_user_id,storage_path,content_type,byte_size,created_at', (query) => query, true),
]);
const attachments = optionalAttachments ?? [];

const taskIds = new Set(tasks.map((task) => task.id));
const userIds = new Set(users.map((user) => user.user_id));
const jobIds = new Set(jobs.map((job) => job.id));
const issues = {
  duplicateTaskIds: tasks.map((task) => task.id).filter((id, index, values) => values.indexOf(id) !== index),
  missingCreators: tasks.filter((task) => !userIds.has(task.creator_user_id)).map((task) => task.id),
  missingAssignees: tasks.filter((task) => !userIds.has(task.assignee_user_id)).map((task) => task.id),
  invalidPrivateRelationships: tasks.filter((task) => task.visibility === 'private' && task.creator_user_id !== task.assignee_user_id).map((task) => task.id),
  invalidSharedRelationships: tasks.filter((task) => task.visibility === 'shared' && task.creator_user_id === task.assignee_user_id).map((task) => task.id),
  invalidContextPairs: tasks.filter((task) => Boolean(task.context_type) !== Boolean(task.context_id)).map((task) => task.id),
  orphanJobContexts: tasks.filter((task) => task.context_type === 'job' && !jobIds.has(task.context_id)).map((task) => task.id),
  orphanPreferences: preferences.filter((preference) => !taskIds.has(preference.task_id)).map((preference) => `${preference.task_id}:${preference.user_id}`),
  preferenceUsersMissing: preferences.filter((preference) => !userIds.has(preference.user_id)).map((preference) => `${preference.task_id}:${preference.user_id}`),
  orphanTaskNotifications: notifications.filter((notification) => {
    const taskId = notification.metadata?.task_id;
    return typeof taskId !== 'string' || !taskIds.has(taskId);
  }).map((notification) => notification.id),
  notificationUsersMissing: notifications.filter((notification) => !userIds.has(notification.user_id)).map((notification) => notification.id),
  duplicateAttachmentIds: attachments.map((attachment) => attachment.id).filter((id, index, values) => values.indexOf(id) !== index),
  orphanAttachments: attachments.filter((attachment) => !taskIds.has(attachment.task_id)).map((attachment) => attachment.id),
  attachmentUploadersMissing: attachments.filter((attachment) => !userIds.has(attachment.uploader_user_id)).map((attachment) => attachment.id),
  invalidAttachmentPaths: attachments.filter((attachment) => !attachment.storage_path.startsWith(`${attachment.task_id}/${attachment.id}/`)).map((attachment) => attachment.id),
};

const participantIds = [...new Set(tasks.flatMap((task) => [task.creator_user_id, task.assignee_user_id]))].sort();
const accounts = participantIds.map((userId) => {
  const related = tasks.filter((task) => task.creator_user_id === userId || task.assignee_user_id === userId);
  const created = related.map((task) => task.created_at).filter(Boolean).sort();
  return {
    userId,
    total: related.length,
    open: related.filter((task) => !task.completed_at).length,
    completed: related.filter((task) => Boolean(task.completed_at)).length,
    private: related.filter((task) => task.visibility === 'private').length,
    shared: related.filter((task) => task.visibility === 'shared').length,
    oldestCreatedAt: created.at(0) ?? null,
    newestCreatedAt: created.at(-1) ?? null,
  };
});

const snapshot = {
  format: 'tenops-my-work-integrity-v1',
  generatedAt: new Date().toISOString(),
  sourceUrl: new URL(url).origin,
  tasks: tasks.map((task) => ({
    id: task.id,
    visibility: task.visibility,
    creatorUserId: task.creator_user_id,
    assigneeUserId: task.assignee_user_id,
    contextType: task.context_type,
    contextId: task.context_id,
    completedAt: task.completed_at,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  })).sort((left, right) => left.id.localeCompare(right.id)),
  preferences: preferences.map((preference) => ({ taskId: preference.task_id, userId: preference.user_id, colorKey: preference.color_key, updatedAt: preference.updated_at })).sort((left, right) => `${left.taskId}:${left.userId}`.localeCompare(`${right.taskId}:${right.userId}`)),
  notificationRelationships: notifications.map((notification) => ({ id: notification.id, userId: notification.user_id, type: notification.notification_type, taskId: notification.metadata?.task_id ?? null, createdAt: notification.created_at })).sort((left, right) => left.id.localeCompare(right.id)),
  attachments: attachments.map((attachment) => ({ id: attachment.id, taskId: attachment.task_id, uploaderUserId: attachment.uploader_user_id, storagePath: attachment.storage_path, contentType: attachment.content_type, byteSize: attachment.byte_size, createdAt: attachment.created_at })).sort((left, right) => left.id.localeCompare(right.id)),
};

const summary = {
  mode,
  source: snapshot.sourceUrl,
  counts: {
    tasks: tasks.length,
    open: tasks.filter((task) => !task.completed_at).length,
    completed: tasks.filter((task) => Boolean(task.completed_at)).length,
    private: tasks.filter((task) => task.visibility === 'private').length,
    shared: tasks.filter((task) => task.visibility === 'shared').length,
    preferences: preferences.length,
    taskNotifications: notifications.length,
    attachments: attachments.length,
  },
  attachmentSchemaAvailable: optionalAttachments !== null,
  accounts,
  issues,
};

if (mode === 'snapshot') {
  await writeFile(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  summary.baseline = 'Local git-ignored baseline written to .tmp-my-work-integrity-baseline.json';
}

if (mode === 'compare') {
  try {
    await access(baselinePath);
  } catch {
    throw new Error('No local baseline exists. Run with --snapshot first.');
  }
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const previous = new Map(baseline.tasks.map((task) => [task.id, task]));
  const current = new Map(snapshot.tasks.map((task) => [task.id, task]));
  summary.comparison = {
    missingTaskIds: [...previous.keys()].filter((id) => !current.has(id)),
    newTaskIds: [...current.keys()].filter((id) => !previous.has(id)),
    ownershipChanges: snapshot.tasks.filter((task) => {
      const prior = previous.get(task.id);
      return prior && (prior.creatorUserId !== task.creatorUserId || prior.assigneeUserId !== task.assigneeUserId);
    }).map((task) => task.id),
    sharingChanges: snapshot.tasks.filter((task) => {
      const prior = previous.get(task.id);
      return prior && prior.visibility !== task.visibility;
    }).map((task) => task.id),
    completionChanges: snapshot.tasks.filter((task) => {
      const prior = previous.get(task.id);
      return prior && prior.completedAt !== task.completedAt;
    }).map((task) => task.id),
    taskCountDifference: snapshot.tasks.length - baseline.tasks.length,
  };
}

console.log(JSON.stringify(summary, null, 2));

if (Object.values(issues).some((values) => values.length > 0)) process.exitCode = 1;
