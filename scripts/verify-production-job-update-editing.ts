import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canEditJobUpdate,
  getJobUpdateEditDraft,
  getJobUpdateEditValidationError,
  hasJobUpdateEditChanges,
} from "../src/modules/production/job-update-editing";
import { summarizeJobUpdates } from "../src/modules/production/job-update-summary";
import type { JobUpdate } from "../src/modules/production/types";

const update: JobUpdate = {
  id: "00000000-0000-4000-8000-000000000001",
  job_id: "00000000-0000-4000-8000-000000000002",
  author_name: "Anthony",
  body: "Original update",
  requires_follow_up: false,
  follow_up_assignee_name: null,
  resolved_at: null,
  resolved_by_name: null,
  resolution_message: null,
  edited_at: null,
  created_at: "2026-08-17T12:00:00Z",
};

const originalDraft = getJobUpdateEditDraft(update);
assert.deepEqual(originalDraft, {
  body: "Original update",
  requiresFollowUp: false,
  followUpAssigneeName: "",
});
assert.equal(canEditJobUpdate(update), true);
assert.equal(hasJobUpdateEditChanges(update, originalDraft), false);
assert.equal(getJobUpdateEditValidationError(originalDraft), null);

const assignedDraft = {
  ...originalDraft,
  requiresFollowUp: true,
  followUpAssigneeName: "Marcos",
};
assert.equal(hasJobUpdateEditChanges(update, assignedDraft), true);
assert.equal(getJobUpdateEditValidationError(assignedDraft), null);
const assigned = {
  ...update,
  requires_follow_up: true,
  follow_up_assignee_name: "Marcos",
  edited_at: "2026-08-17T12:30:00Z",
};
assert.deepEqual(summarizeJobUpdates([assigned]), {
  total: 1,
  openFollowUpCount: 1,
  openFollowUpAssignees: ["Marcos"],
  latestCreatedAt: update.created_at,
});

const reassignedDraft = {
  ...getJobUpdateEditDraft(assigned),
  followUpAssigneeName: "Anthony",
};
assert.equal(hasJobUpdateEditChanges(assigned, reassignedDraft), true);
assert.deepEqual(
  summarizeJobUpdates([
    { ...assigned, follow_up_assignee_name: "Anthony" },
  ]).openFollowUpAssignees,
  ["Anthony"],
);

const normalDraft = {
  ...getJobUpdateEditDraft(assigned),
  requiresFollowUp: false,
  followUpAssigneeName: "",
};
assert.equal(hasJobUpdateEditChanges(assigned, normalDraft), true);
const returnedToNormal = {
  ...assigned,
  requires_follow_up: false,
  follow_up_assignee_name: null,
};
assert.equal(summarizeJobUpdates([returnedToNormal]).openFollowUpCount, 0);
assert.equal(returnedToNormal.resolved_at, null);
assert.equal(returnedToNormal.resolved_by_name, null);
assert.equal(returnedToNormal.resolution_message, null);

assert.equal(
  getJobUpdateEditValidationError({
    ...originalDraft,
    requiresFollowUp: true,
  }),
  "Select who needs to resolve this update.",
);
assert.equal(
  canEditJobUpdate({ resolved_at: "2026-08-17T13:00:00Z" }),
  false,
);

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260817_002_job_update_editing.sql",
    import.meta.url,
  ),
  "utf8",
);
assert.match(migration, /for update/);
assert.match(migration, /existing_update\.resolved_at is not null/);
assert.match(migration, /and resolved_at is null/);
assert.match(migration, /edited_at = now\(\)/);
assert.match(migration, /is not distinct from/);
assert.match(migration, /desired_assignee text;/);
assert.match(
  migration,
  /if p_requires_follow_up then\s+desired_assignee := assignee;\s+else\s+desired_assignee := null;\s+end if;/,
);
assert.match(
  migration,
  /follow_up_assignee_name is not distinct from desired_assignee/,
);
assert.match(migration, /follow_up_assignee_name = desired_assignee/);
assert.doesNotMatch(
  migration,
  /is not distinct from\s+case\s+when|desired_assignee text := case/,
);
assert.doesNotMatch(migration, /resolved_at\s*=|resolved_by_name\s*=|resolution_message\s*=/);

console.log("Production Job Update editing checks passed.");
