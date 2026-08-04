import type { PlanningPhase, PlanningTimelineColor } from "./types";

export const PLANNING_OVERLAY_PALETTE: ReadonlyArray<{ key: PlanningTimelineColor; name: string; className: string; swatchClassName: string; progressClassName: string }> = [
  { key: "steel_blue", name: "Steel Blue", className: "border-blue-700 bg-blue-200/90 text-blue-950", swatchClassName: "border-blue-700 bg-blue-300", progressClassName: "bg-blue-600" },
  { key: "industrial_teal", name: "Industrial Teal", className: "border-teal-700 bg-teal-200/90 text-teal-950", swatchClassName: "border-teal-700 bg-teal-300", progressClassName: "bg-teal-600" },
  { key: "muted_violet", name: "Muted Violet", className: "border-violet-700 bg-violet-200/90 text-violet-950", swatchClassName: "border-violet-700 bg-violet-300", progressClassName: "bg-violet-600" },
  { key: "ochre_gold", name: "Ochre Gold", className: "border-amber-700 bg-amber-200/90 text-amber-950", swatchClassName: "border-amber-700 bg-amber-300", progressClassName: "bg-amber-600" },
  { key: "slate", name: "Machine Slate", className: "border-slate-700 bg-slate-300/90 text-slate-950", swatchClassName: "border-slate-700 bg-slate-400", progressClassName: "bg-slate-600" },
  { key: "rust", name: "Muted Rust", className: "border-orange-800 bg-orange-200/90 text-orange-950", swatchClassName: "border-orange-800 bg-orange-300", progressClassName: "bg-orange-600" },
  { key: "sage", name: "Industrial Sage", className: "border-lime-800 bg-lime-200/80 text-lime-950", swatchClassName: "border-lime-800 bg-lime-300", progressClassName: "bg-lime-600" },
  { key: "deep_cyan", name: "Deep Cyan", className: "border-cyan-800 bg-cyan-200/90 text-cyan-950", swatchClassName: "border-cyan-800 bg-cyan-300", progressClassName: "bg-cyan-600" },
];

export const PLANNING_PAUSE_HATCH = "repeating-linear-gradient(135deg, #111827 0 3px, #ffffff 3px 6px)";

export function orderedOverlayPhases(phases: PlanningPhase[]) {
  return phases.filter((phase) => phase.timeline_behavior === "overlay").sort((first, second) =>
    first.created_at.localeCompare(second.created_at) ||
    first.id.localeCompare(second.id));
}

export function overlayVisualIndexForPhase(phases: PlanningPhase[], phaseId?: string) {
  const ordered = orderedOverlayPhases(phases);
  const index = phaseId ? ordered.findIndex((phase) => phase.id === phaseId) : ordered.length;
  return (index < 0 ? ordered.length : index) % PLANNING_OVERLAY_PALETTE.length;
}

export function overlayVisualForPhase(phases: PlanningPhase[], phaseId?: string) {
  const assignedColor = phases.find((phase) => phase.id === phaseId)?.timeline_color;
  return PLANNING_OVERLAY_PALETTE.find((visual) => visual.key === assignedColor)
    ?? PLANNING_OVERLAY_PALETTE[overlayVisualIndexForPhase(phases, phaseId)];
}

export function overlayVisualForColor(color: PlanningTimelineColor) {
  return PLANNING_OVERLAY_PALETTE.find((visual) => visual.key === color) ?? PLANNING_OVERLAY_PALETTE[0];
}
