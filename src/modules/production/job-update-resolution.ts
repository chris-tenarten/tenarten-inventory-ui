import type { JobUpdate } from "./types";

export function getResolutionResolverName(
  update: Pick<JobUpdate, "follow_up_assignee_name">,
  locallySelectedName: string | undefined,
  fallbackName: string,
) {
  if (locallySelectedName !== undefined) return locallySelectedName;
  return update.follow_up_assignee_name?.trim() || fallbackName;
}
