import type { ProductionJob } from '@/modules/production/types';
import type { PlanningPhase } from '@/modules/planning/types';
import type { Bid } from './types';
import { projectedWindowEligible, type BidPlanning } from './planning';

export type PlanningMode = 'intake' | 'production' | 'combined';
type Common = { key: string; title: string; start: string | null; end: string | null };
export type PlanningRecord = Common & (
  { source: 'intake'; bid: Bid; planning: BidPlanning } |
  { source: 'production'; job: ProductionJob; phases: PlanningPhase[] }
);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const planningLabel = (s: string) => s.trim().toLocaleLowerCase('en-US');
export function chronologicalPlanning(a: PlanningRecord, b: PlanningRecord) {
  return compare(a.start ?? '9999-12-31', b.start ?? '9999-12-31') ||
    (a.source === b.source ? 0 : a.source === 'production' ? -1 : 1) ||
    compare(a.end ?? '9999-12-31', b.end ?? '9999-12-31') || compare(planningLabel(a.title), planningLabel(b.title)) || compare(a.key, b.key);
}
export function normalizePlanning(bids: Bid[], windows: BidPlanning[], jobs: ProductionJob[], phases: PlanningPhase[]): PlanningRecord[] {
  const windowsById = new Map(windows.map(w => [w.id, w]));
  const phasesByJob = new Map<string, PlanningPhase[]>();
  for (const phase of phases) { const list = phasesByJob.get(phase.job_id) ?? []; list.push(phase); phasesByJob.set(phase.job_id, list); }
  for (const list of phasesByJob.values()) list.sort((a,b) => compare(a.start_date ?? '9999-12-31', b.start_date ?? '9999-12-31') || compare(a.end_date ?? '9999-12-31', b.end_date ?? '9999-12-31') || compare(a.id,b.id));
  const result: PlanningRecord[] = [];
  for (const bid of bids) {
    const planning = windowsById.get(bid.id);
    if (!planning || !projectedWindowEligible(bid.status, planning)) continue;
    result.push({ key: `intake:${bid.id}`, source: 'intake', title: bid.projectName, start: planning.projected_production_start, end: planning.projected_production_end, bid, planning });
  }
  for (const job of jobs) {
    if (['complete','shipped','cancelled'].includes(job.production_status)) continue;
    result.push({ key: job.lifecycle_key ?? `original:${job.id}`, source: 'production', title: `${job.job_number ? `${job.job_number} · ` : ''}${job.name}`, start: job.planned_start, end: job.planned_end, job, phases: phasesByJob.get(job.id) ?? [] });
  }
  return result.sort(chronologicalPlanning);
}
export const planningForMode = (records: PlanningRecord[], mode: PlanningMode) => records.filter(r => mode === 'combined' || r.source === mode);
