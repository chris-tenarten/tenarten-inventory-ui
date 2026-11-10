export type WorkloadDensity = 'compact' | 'default' | 'expanded';

export function normalizeWorkloadDensity(value: string | null): WorkloadDensity {
  return value === 'compact' || value === 'expanded' ? value : 'default';
}

// The same readable items and spacing apply at every density.
export const WORKLOAD_BAR_HEIGHT = 25;
export const WORKLOAD_LANE_STEP = 29;
export const WORKLOAD_BAR_TOP = 25;
const BOTTOM_CLEARANCE = 4;

/** Capacity follows actual week height, including room for the final focus outline. */
export function workloadLaneCapacity(rowHeight: number) {
  return Math.max(0, Math.floor((rowHeight - WORKLOAD_BAR_TOP - WORKLOAD_BAR_HEIGHT - BOTTOM_CLEARANCE) / WORKLOAD_LANE_STEP) + 1);
}
