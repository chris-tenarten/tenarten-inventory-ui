import assert from "node:assert/strict";
import {
  initialNotificationOnboardingState,
  notificationOnboardingReducer,
  type NotificationOnboardingAction,
} from "../src/components/notification-onboarding-state";
import {
  createNotificationArrivalSession,
  dismissNotificationArrival,
  observeLiveNotificationArrival,
  observeNotificationArrivals,
} from "../src/components/notification-arrival-state";

function run(actions: NotificationOnboardingAction[]) {
  return actions.reduce(notificationOnboardingReducer, initialNotificationOnboardingState);
}

const idle = { open: false, spotlight: null, arrivalNotificationId: null };
assert.deepEqual(run([{ type: "start" }]), { ...idle, spotlight: "bell" });
assert.deepEqual(run([{ type: "start" }, { type: "toggle" }]), { ...idle, open: true, spotlight: "welcome" });
assert.deepEqual(run([{ type: "start" }, { type: "toggle" }, { type: "close" }]), idle);
assert.deepEqual(run([{ type: "start" }, { type: "toggle" }, { type: "toggle" }]), idle);
assert.deepEqual(run([
  { type: "start" },
  { type: "toggle" },
  { type: "toggle" },
  { type: "toggle" },
]), { ...idle, open: true });
assert.deepEqual(run([{ type: "toggle" }, { type: "toggle" }]), idle);
assert.deepEqual(run([{ type: "start" }, { type: "cancel-spotlight" }]), idle);

const focused = run([{ type: "focus-arrival", notificationId: "mention-1" }]);
assert.deepEqual(focused, { ...idle, open: true, arrivalNotificationId: "mention-1" });
assert.deepEqual(notificationOnboardingReducer(focused, { type: "toggle" }), focused, "bell spam cannot compete with arrival attention");
assert.deepEqual(notificationOnboardingReducer(focused, { type: "finish-arrival" }), idle);
assert.deepEqual(notificationOnboardingReducer(focused, { type: "close" }), idle);
assert.deepEqual(notificationOnboardingReducer(focused, { type: "reset" }), idle);
assert.deepEqual(run([{ type: "start" }, { type: "focus-arrival", notificationId: "mention-1" }]), { ...idle, spotlight: "bell" });

const session = createNotificationArrivalSession();
const row = (id: string, notificationType: string, readAt: string | null = null) => ({ id, notificationType, readAt });
assert.equal(observeNotificationArrivals(session, [row("old", "job_update_mention")]), null, "initial unread history establishes the baseline");
assert.equal(observeNotificationArrivals(session, [row("welcome", "welcome"), row("old", "job_update_mention")]), null, "Welcome never triggers arrival attention");
assert.equal(observeNotificationArrivals(session, [row("mention", "job_update_mention"), row("old", "job_update_mention")]), "mention");
assert.equal(observeNotificationArrivals(session, [row("mention", "job_update_mention")]), null, "duplicate refetch cannot re-lock");
assert.equal(observeNotificationArrivals(session, [row("read-assignment", "job_update_assignment", "2026-08-24T00:00:00Z")]), null, "read rows do not trigger");
assert.equal(observeNotificationArrivals(session, [row("assignment", "job_update_assignment")]), "assignment");
dismissNotificationArrival(session, "assignment");
assert.equal(observeNotificationArrivals(session, [row("assignment", "job_update_assignment")]), null, "dismissal is suppressed for the mounted session");
assert.equal(observeNotificationArrivals(session, [row("legacy", "job_update_legacy_assignment_enrollment")]), "legacy", "a subsequent arrival can focus");
assert.equal(observeNotificationArrivals(session, [row("newest", "job_update_mention"), row("older", "job_update_assignment")]), "newest", "newest co-arrival wins deterministically");

const liveSession = createNotificationArrivalSession();
assert.equal(observeNotificationArrivals(liveSession, [row("old", "job_update_mention")]), null);
assert.equal(observeLiveNotificationArrival(liveSession, row("live-mention", "job_update_mention")), "live-mention", "Realtime mention triggers after baseline");
assert.equal(observeNotificationArrivals(liveSession, [row("live-mention", "job_update_mention"), row("old", "job_update_mention")]), null, "history refetch cannot duplicate a Realtime arrival");
assert.equal(observeLiveNotificationArrival(liveSession, row("live-mention", "job_update_mention")), null, "duplicate Realtime delivery cannot re-lock");
assert.equal(observeLiveNotificationArrival(liveSession, row("live-welcome", "welcome")), null);
assert.equal(observeLiveNotificationArrival(liveSession, row("live-assignment", "job_update_assignment")), "live-assignment");
dismissNotificationArrival(liveSession, "live-assignment");
assert.equal(observeLiveNotificationArrival(liveSession, row("live-assignment", "job_update_assignment")), null);
assert.equal(observeLiveNotificationArrival(liveSession, row("live-next", "job_update_mention")), "live-next", "a subsequent live arrival can focus");

const historyFirstSession = createNotificationArrivalSession();
assert.equal(observeNotificationArrivals(historyFirstSession, []), null);
assert.equal(observeNotificationArrivals(historyFirstSession, [row("history-first", "job_update_mention")]), "history-first");
assert.equal(observeLiveNotificationArrival(historyFirstSession, row("history-first", "job_update_mention")), null, "Realtime delivery after a history refresh cannot duplicate attention");

console.log("Notification onboarding state checks passed.");
