import assert from "node:assert/strict";
import {
  initialNotificationOnboardingState,
  notificationOnboardingReducer,
  type NotificationOnboardingAction,
} from "../src/components/notification-onboarding-state";

function run(actions: NotificationOnboardingAction[]) {
  return actions.reduce(notificationOnboardingReducer, initialNotificationOnboardingState);
}

assert.deepEqual(run([{ type: "start" }]), { open: false, spotlight: "bell" });
assert.deepEqual(run([{ type: "start" }, { type: "toggle" }]), { open: true, spotlight: "welcome" });
assert.deepEqual(run([{ type: "start" }, { type: "toggle" }, { type: "close" }]), { open: false, spotlight: null });
assert.deepEqual(run([{ type: "start" }, { type: "toggle" }, { type: "toggle" }]), { open: false, spotlight: null });
assert.deepEqual(run([
  { type: "start" },
  { type: "toggle" },
  { type: "toggle" },
  { type: "toggle" },
]), { open: true, spotlight: null });
assert.deepEqual(run([{ type: "toggle" }, { type: "toggle" }]), { open: false, spotlight: null });
assert.deepEqual(run([{ type: "start" }, { type: "cancel-spotlight" }]), { open: false, spotlight: null });

console.log("Notification onboarding state checks passed.");
