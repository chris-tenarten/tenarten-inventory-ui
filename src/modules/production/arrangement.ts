import type { ProductionJob, ProductionStatus } from './types';

export type ProductionArrangement = 'stage' | 'deadline' | 'labor';
export const PRODUCTION_ARRANGEMENT_KEY = 'tenops.productionArrangement';

const stageOrder: Record<ProductionStatus, number> = {
  in_production: 0, on_deck: 1, not_started: 2, on_hold: 3,
  complete: 4, shipped: 5, cancelled: 6,
};

const identity = (first: ProductionJob, second: ProductionJob) =>
  (first.job_number ?? '').localeCompare(second.job_number ?? '') || first.name.localeCompare(second.name) || first.id.localeCompare(second.id);
const date = (value: string | null) => value ?? '9999-12-31';

export function arrangeProductionJobs(jobs: ProductionJob[], arrangement: ProductionArrangement, today = new Date().toISOString().slice(0, 10)) {
  return [...jobs].sort((first, second) => {
    if (arrangement === 'labor') return (second.estimated_man_hours ?? -1) - (first.estimated_man_hours ?? -1) || identity(first, second);
    if (arrangement === 'deadline') {
      const firstDate = date(first.requested_delivery_date); const secondDate = date(second.requested_delivery_date);
      const firstOverdue = firstDate < today ? 0 : 1; const secondOverdue = secondDate < today ? 0 : 1;
      return firstOverdue - secondOverdue || firstDate.localeCompare(secondDate) || identity(first, second);
    }
    return stageOrder[first.production_status] - stageOrder[second.production_status]
      || date(first.requested_delivery_date).localeCompare(date(second.requested_delivery_date))
      || date(first.planned_start).localeCompare(date(second.planned_start))
      || identity(first, second);
  });
}
