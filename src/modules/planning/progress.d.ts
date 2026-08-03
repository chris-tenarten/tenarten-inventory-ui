import type { PlanningItem, PlanningPhase } from "./types";
export type PlanningProgress = { complete: number; total: number; percent: number };
export function calculatePhaseProgress(items: PlanningItem[]): PlanningProgress;
export function calculatePlanningProgress(phases: PlanningPhase[], items: PlanningItem[]): PlanningProgress;
