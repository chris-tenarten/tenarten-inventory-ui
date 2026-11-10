export const ARRIVAL_ATTENTION_TYPES = new Set([
  "job_update_mention",
  "job_update_assignment",
  "job_update_legacy_assignment_enrollment",
  "shared_task_assigned",
  "shared_task_completed",
  "inbox_message",
]);

export type ArrivalCandidate = {
  id: string;
  notificationType: string;
  readAt: string | null;
};

export type NotificationArrivalSession = {
  baselineReady: boolean;
  observedIds: Set<string>;
  dismissedIds: Set<string>;
  handledLiveIds: Set<string>;
  triggeredIds: Set<string>;
};

export function createNotificationArrivalSession(): NotificationArrivalSession {
  return { baselineReady: false, observedIds: new Set(), dismissedIds: new Set(), handledLiveIds: new Set(), triggeredIds: new Set() };
}

export function observeLiveNotificationArrival(
  session: NotificationArrivalSession,
  item: ArrivalCandidate,
): string | null {
  if (session.handledLiveIds.has(item.id) || session.triggeredIds.has(item.id)) return null;
  session.handledLiveIds.add(item.id);
  session.observedIds.add(item.id);
  const focusId = !session.dismissedIds.has(item.id)
    && item.readAt === null
    && ARRIVAL_ATTENTION_TYPES.has(item.notificationType)
    ? item.id
    : null;
  if (focusId) session.triggeredIds.add(focusId);
  return focusId;
}

export function observeNotificationArrivals(
  session: NotificationArrivalSession,
  items: ArrivalCandidate[],
): string | null {
  if (!session.baselineReady) {
    items.forEach((item) => session.observedIds.add(item.id));
    session.baselineReady = true;
    return null;
  }

  const focusId = items.find((item) =>
    !session.observedIds.has(item.id)
    && !session.dismissedIds.has(item.id)
    && item.readAt === null
    && ARRIVAL_ATTENTION_TYPES.has(item.notificationType)
  )?.id ?? null;

  // The server history is newest-first. The newest qualifying co-arrival gets
  // focus; all rows are observed now so refetches cannot create stacked locks.
  items.forEach((item) => session.observedIds.add(item.id));
  if (focusId) session.triggeredIds.add(focusId);
  return focusId;
}

export function dismissNotificationArrival(session: NotificationArrivalSession, notificationId: string) {
  session.dismissedIds.add(notificationId);
  session.observedIds.add(notificationId);
  session.triggeredIds.add(notificationId);
}
