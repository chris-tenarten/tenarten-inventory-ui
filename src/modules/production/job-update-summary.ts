import { compareProductionPersonnelNames } from "./production-personnel";

export type JobUpdateSummary = {
  total: number;
  openFollowUpCount: number;
  openFollowUpAssignees: string[];
  latestCreatedAt: string | null;
  hasUnseenActivity: boolean;
};

type SummaryRow = {
  created_at: string;
  requires_follow_up: boolean;
  resolved_at: string | null;
  follow_up_assignee_name: string | null;
};

export const EMPTY_JOB_UPDATE_SUMMARY: JobUpdateSummary = {
  total: 0,
  openFollowUpCount: 0,
  openFollowUpAssignees: [],
  latestCreatedAt: null,
  hasUnseenActivity: false,
};

export function summarizeJobUpdates(rows: SummaryRow[]): JobUpdateSummary {
  const summary: JobUpdateSummary = {
    total: rows.length,
    openFollowUpCount: 0,
    openFollowUpAssignees: [],
    latestCreatedAt: null,
    hasUnseenActivity: false,
  };

  for (const row of rows) {
    if (row.requires_follow_up && !row.resolved_at) {
      summary.openFollowUpCount += 1;
      const assignee = row.follow_up_assignee_name?.trim();
      if (assignee && !summary.openFollowUpAssignees.includes(assignee)) {
        summary.openFollowUpAssignees.push(assignee);
      }
    }
    if (!summary.latestCreatedAt || row.created_at > summary.latestCreatedAt) {
      summary.latestCreatedAt = row.created_at;
    }
  }

  summary.openFollowUpAssignees.sort(compareProductionPersonnelNames);
  return summary;
}
