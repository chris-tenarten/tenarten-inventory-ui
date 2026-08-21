import assert from "node:assert/strict";
import { summarizeJobUpdates } from "../src/modules/production/job-update-summary";
import { getResolutionResolverName } from "../src/modules/production/job-update-resolution";

const row = (overrides = {}) => ({
  created_at: "2026-08-17T12:00:00Z",
  requires_follow_up: false,
  resolved_at: null,
  follow_up_assignee_name: null,
  ...overrides,
});

assert.deepEqual(summarizeJobUpdates([row()]), {
  total: 1,
  openFollowUpCount: 0,
  openFollowUpAssignees: [],
  latestCreatedAt: "2026-08-17T12:00:00Z",
  hasUnseenActivity: false,
});
assert.deepEqual(
  summarizeJobUpdates([
    row({ requires_follow_up: true, follow_up_assignee_name: "Marcos" }),
  ]).openFollowUpAssignees,
  ["Marcos"],
);
assert.deepEqual(
  summarizeJobUpdates([
    row({ requires_follow_up: true, follow_up_assignee_name: "Marcos" }),
    row({ requires_follow_up: true, follow_up_assignee_name: "Marcos" }),
  ]),
  {
    total: 2,
    openFollowUpCount: 2,
    openFollowUpAssignees: ["Marcos"],
    latestCreatedAt: "2026-08-17T12:00:00Z",
    hasUnseenActivity: false,
  },
);
assert.deepEqual(
  summarizeJobUpdates([
    row({ requires_follow_up: true, follow_up_assignee_name: "Marcos" }),
    row({ requires_follow_up: true, follow_up_assignee_name: "Anthony" }),
  ]).openFollowUpAssignees,
  ["Anthony", "Marcos"],
);
assert.deepEqual(
  summarizeJobUpdates([
    row({ requires_follow_up: true, follow_up_assignee_name: null }),
    row({
      requires_follow_up: true,
      resolved_at: "2026-08-17T13:00:00Z",
      follow_up_assignee_name: "Marcos",
    }),
  ]),
  {
    total: 2,
    openFollowUpCount: 1,
    openFollowUpAssignees: [],
    latestCreatedAt: "2026-08-17T12:00:00Z",
    hasUnseenActivity: false,
  },
);

console.log("Production Job Update assignment summary checks passed.");

const assignedUpdate = { follow_up_assignee_name: "Marcos" };
assert.equal(getResolutionResolverName(assignedUpdate, undefined, "Anthony"), "Marcos");
assert.equal(getResolutionResolverName(assignedUpdate, "Chris", "Anthony"), "Chris");
assert.equal(
  getResolutionResolverName({ follow_up_assignee_name: null }, undefined, "Anthony"),
  "Anthony",
);

console.log("Production Job Update resolver default checks passed.");
