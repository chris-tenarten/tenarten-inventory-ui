import type { PlanningPhase } from './types';

export type PlanningIntervalAdjustment = 'move' | 'resize-start' | 'resize-end';
export function adjustPlanningInterval(start: string, end: string, deltaDays: number, mode: PlanningIntervalAdjustment): { start: string; end: string };
export function planningProductionStartDelta(persistedStart: string | null, proposedStart: string | null): number;
export function translatedPlanningIntervals(phases: PlanningPhase[], staged: Record<string, { proposed_start_date: string; proposed_end_date: string; change_source: 'planning_timeline' | 'production_reschedule' }>, jobId: string, deltaDays: number): Array<{ phase: PlanningPhase; start: string; end: string; source: 'planning_timeline' | 'production_reschedule' }>;
export function dependentPlanningPhaseIds(phases: PlanningPhase[], rootPhaseId: string): string[];
export function planningDependencyGraphIsAcyclic(phases: PlanningPhase[], rootPhaseId: string): boolean;
export function planningCascadeDelta(originalStart: string, originalEnd: string, proposedStart: string, proposedEnd: string, mode: PlanningIntervalAdjustment): number;
export type PlanningScheduleIssue = {
  id: string;
  severity: 'warning' | 'error';
  kind: 'dependency_overlap' | 'circular_dependency' | 'invalid_dependency' | 'invalid_interval' | 'after_delivery' | 'before_preliminary_timeline' | 'after_preliminary_timeline' | 'spans_preliminary_timeline' | 'outside_preliminary_timeline';
  phase_ids: string[];
  predecessor_id: string | null;
  successor_id: string;
  message: string;
  inspector_message?: string;
};
export function evaluatePlanningSchedule(phases: PlanningPhase[], jobs: Array<{ id: string; planned_start: string | null; planned_end: string | null; requested_delivery_date: string | null }>): PlanningScheduleIssue[];
