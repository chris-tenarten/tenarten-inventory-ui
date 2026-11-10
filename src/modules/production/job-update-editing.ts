import type { JobUpdate } from "./types";

export type JobUpdateEditDraft = {
  body: string;
  requiresFollowUp: boolean;
  followUpAssigneeName: string;
  followUpAssigneeUserId: string | null;
};

export function canEditJobUpdate(update: Pick<JobUpdate, "resolved_at">) {
  return update.resolved_at === null;
}

export function getJobUpdateEditDraft(
  update: Pick<
    JobUpdate,
    "body" | "requires_follow_up" | "follow_up_assignee_name" | "follow_up_assignee_user_id"
  >,
): JobUpdateEditDraft {
  return {
    body: update.body,
    requiresFollowUp: update.requires_follow_up,
    followUpAssigneeName: update.follow_up_assignee_name ?? "",
    followUpAssigneeUserId: update.follow_up_assignee_user_id,
  };
}

export function getJobUpdateEditValidationError(draft: JobUpdateEditDraft) {
  if (!draft.body.trim()) return "Enter an update before saving.";
  if (draft.requiresFollowUp && !draft.followUpAssigneeName.trim()) {
    return "Select who needs to resolve this update.";
  }
  return null;
}

export function hasJobUpdateEditChanges(
  update: Pick<
    JobUpdate,
    "body" | "requires_follow_up" | "follow_up_assignee_name" | "follow_up_assignee_user_id"
  >,
  draft: JobUpdateEditDraft,
) {
  const nextAssignee = draft.requiresFollowUp
    ? draft.followUpAssigneeName.trim()
    : null;
  return (
    update.body !== draft.body.trim() ||
    update.requires_follow_up !== draft.requiresFollowUp ||
    update.follow_up_assignee_name !== nextAssignee
    || update.follow_up_assignee_user_id !== (draft.requiresFollowUp ? draft.followUpAssigneeUserId : null)
  );
}
