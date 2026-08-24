import type { ProductionReworkCycle } from './types';

export const PRODUCTION_REWORK_TERMINAL_STATUSES = ['complete', 'cancelled'] as const;

export function isActiveProductionRework(
  cycle: Pick<ProductionReworkCycle, 'production_status'>,
) {
  return !PRODUCTION_REWORK_TERMINAL_STATUSES.includes(
    cycle.production_status as (typeof PRODUCTION_REWORK_TERMINAL_STATUSES)[number],
  );
}
