const JOB_UPDATE_VIEWED_AT_KEY = 'tenops.jobUpdatesViewedAt';

export type JobUpdateViewedAt = Record<string, string>;

export function loadJobUpdateViewedAt(): JobUpdateViewedAt {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(JOB_UPDATE_VIEWED_AT_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([jobId, value]) => jobId.length > 0 && typeof value === 'string' && value.length > 0,
      ),
    ) as JobUpdateViewedAt;
  } catch {
    return {};
  }
}

export function markJobUpdatesViewed(
  jobId: string,
  latestCreatedAt: string | null,
): JobUpdateViewedAt {
  const current = loadJobUpdateViewedAt();
  if (!latestCreatedAt) return current;
  const next = { ...current, [jobId]: latestCreatedAt };
  try {
    window.localStorage.setItem(JOB_UPDATE_VIEWED_AT_KEY, JSON.stringify(next));
  } catch {
    // The in-memory result still clears the dot for this open page.
  }
  return next;
}

export function hasUnviewedJobUpdates(
  latestCreatedAt: string | null,
  viewedAt: string | undefined,
) {
  return Boolean(latestCreatedAt && (!viewedAt || latestCreatedAt > viewedAt));
}
