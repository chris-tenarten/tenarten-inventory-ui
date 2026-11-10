import type { PlanningPhase } from "./types";
export function isPlanningEnabled(value: string | undefined): boolean;
export function normalizeLoadedJobIds(jobIds: string[]): string[];
export function rangesIntersect(firstStart: string | null, firstEnd: string | null, secondStart: string | null, secondEnd: string | null): boolean;
export function planningIntervalGeometry(intervalStart: string, intervalEnd: string, canvasStart: string, dayWidth: number): { left: number; width: number; right: number };
export function pausePlacement(phase: PlanningPhase, productionStart: string | null, productionEnd: string | null): "not_pause" | "intersects_production" | "outside_production";
export function selectCollapsedTimelinePhases(phases: PlanningPhase[], options: { canvasStart: string; canvasEnd: string; productionStart?: string | null; productionEnd?: string | null }): { visible: PlanningPhase[]; hidden: PlanningPhase[]; all: PlanningPhase[] };
export function mergePauseRanges(phases: PlanningPhase[]): Array<{ start: string; end: string; phases: PlanningPhase[] }>;
