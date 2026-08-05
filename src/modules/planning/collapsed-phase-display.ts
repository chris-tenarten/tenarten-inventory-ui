export const COLLAPSED_PHASE_DISPLAY_STORAGE_KEY = "tenops.planning.collapsed-phase-display.v1";
export const COLLAPSED_PHASE_DISPLAY_EVENT = "tenops:planning-collapsed-phase-display";

export const COLLAPSED_PHASE_DISPLAY_MODES = ["compact", "fill"] as const;
export type CollapsedPhaseDisplayMode = (typeof COLLAPSED_PHASE_DISPLAY_MODES)[number];

export function isCollapsedPhaseDisplayMode(value: unknown): value is CollapsedPhaseDisplayMode {
  return COLLAPSED_PHASE_DISPLAY_MODES.includes(value as CollapsedPhaseDisplayMode);
}

export function readCollapsedPhaseDisplayMode(): CollapsedPhaseDisplayMode {
  if (typeof window === "undefined") return "fill";
  try {
    const stored = window.localStorage.getItem(COLLAPSED_PHASE_DISPLAY_STORAGE_KEY);
    return isCollapsedPhaseDisplayMode(stored) ? stored : "fill";
  } catch {
    return "fill";
  }
}

export function writeCollapsedPhaseDisplayMode(mode: CollapsedPhaseDisplayMode) {
  try {
    window.localStorage.setItem(COLLAPSED_PHASE_DISPLAY_STORAGE_KEY, mode);
  } catch {
    // The current view still updates when browser storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<CollapsedPhaseDisplayMode>(COLLAPSED_PHASE_DISPLAY_EVENT, { detail: mode }));
}
