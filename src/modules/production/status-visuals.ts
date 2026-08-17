import type { ProductionStatus } from './types';

export type ProductionStatusVisual = {
  value: ProductionStatus;
  label: string;
  className: string;
  pattern?: string;
  timelineClassName?: string;
  timelinePattern?: string;
};

export const productionStatusVisuals: ProductionStatusVisual[] = [
  { value: 'not_started', label: 'Not Started', className: 'production-status-not-started' },
  {
    value: 'on_deck',
    label: 'On Deck',
    className: 'production-status-on-deck',
    pattern: 'repeating-linear-gradient(135deg, #2f855a 0, #2f855a 8px, #f8fafc 8px, #f8fafc 14px)',
  },
  { value: 'in_production', label: 'In Production', className: 'production-status-in-production' },
  {
    value: 'on_hold',
    label: 'On Hold',
    className: 'production-status-on-hold',
    pattern: 'repeating-linear-gradient(135deg, transparent 0, transparent 6px, rgba(255,255,255,0.24) 6px, rgba(255,255,255,0.24) 10px)',
  },
  {
    value: 'shipped',
    label: 'Shipped',
    className: 'production-status-shipped',
    pattern: 'repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(255,255,255,0.1) 8px, rgba(255,255,255,0.1) 10px)',
  },
  {
    value: 'complete',
    label: 'Complete',
    className: 'production-status-complete',
    pattern: 'repeating-linear-gradient(135deg, #7c3aed 0, #7c3aed 8px, #f8fafc 8px, #f8fafc 14px)',
  },
  { value: 'cancelled', label: 'Cancelled', className: 'production-status-cancelled' },
];

export const productionStatusVisualByValue = Object.fromEntries(
  productionStatusVisuals.map((visual) => [visual.value, visual]),
) as Record<ProductionStatus, ProductionStatusVisual>;
