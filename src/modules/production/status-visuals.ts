import type { ProductionStatus } from './types';

export type ProductionStatusVisual = {
  value: ProductionStatus;
  label: string;
  className: string;
  pattern?: string;
};

export const productionStatusVisuals: ProductionStatusVisual[] = [
  { value: 'not_started', label: 'Not Started', className: 'border-slate-800 bg-slate-600 text-white' },
  { value: 'on_deck', label: 'On Deck', className: 'border-blue-800 bg-blue-600 text-white' },
  { value: 'in_production', label: 'In Production', className: 'border-indigo-950 bg-indigo-800 text-white' },
  { value: 'on_hold', label: 'On Hold', className: 'border-rose-950 bg-rose-800 text-white', pattern: 'repeating-linear-gradient(135deg, transparent 0, transparent 5px, rgba(255,255,255,0.22) 5px, rgba(255,255,255,0.22) 9px)' },
  { value: 'shipped', label: 'Shipped', className: 'border-cyan-900 bg-cyan-700 text-white', pattern: 'repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 10px)' },
  { value: 'complete', label: 'Complete', className: 'border-green-950 bg-green-800 text-white' },
  { value: 'cancelled', label: 'Cancelled', className: 'border-zinc-700 bg-zinc-500 text-white' },
];

export const productionStatusVisualByValue = Object.fromEntries(
  productionStatusVisuals.map((visual) => [visual.value, visual]),
) as Record<ProductionStatus, ProductionStatusVisual>;
