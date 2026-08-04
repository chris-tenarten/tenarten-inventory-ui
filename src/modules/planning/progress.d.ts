import type { PlanningItem, PlanningPhase } from "./types";
export type PlanningProgress = { completedItems: number; totalItems: number; completedHours: number; totalHours: number; percent: number };
export type PlanningCoverage = { plannedItems: number; plannedHours: number; activePhases: number };
export function calculatePhaseProgress(items: PlanningItem[]): PlanningProgress;
export function calculatePlanningProgress(phases: PlanningPhase[], items: PlanningItem[]): PlanningProgress;
export function calculatePlanningCoverage(phases: PlanningPhase[], items: PlanningItem[]): PlanningCoverage;
export function formatPlanningHours(hours: number): string;
