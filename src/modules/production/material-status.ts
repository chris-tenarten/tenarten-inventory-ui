import type { MaterialStatus } from './types';

export const materialStatusOptions: Array<{ value: MaterialStatus; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'not_ready', label: 'Not Ready' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'ready', label: 'Ready' },
];

export function materialStatusLabel(value: unknown) {
  return materialStatusOptions.find((option) => option.value === value)?.label
    ?? String(value || 'Unknown').replaceAll('_', ' ');
}

export function materialStatusBadgeClass(value: MaterialStatus) {
  if (value === 'ready') return 'bg-emerald-100 text-emerald-800';
  if (value === 'ordered') return 'bg-blue-100 text-blue-800';
  if (value === 'not_ready') return 'bg-amber-100 text-amber-900';
  return 'bg-slate-100 text-slate-700';
}
