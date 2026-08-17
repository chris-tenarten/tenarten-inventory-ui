import type { ProductionJob } from './types';

export type NullableNumberResult =
  | { valid: true; value: number | null }
  | { valid: false; value: null };

export function normalizeNullableNumber(value: unknown): NullableNumberResult {
  if (value === null || value === undefined) return { valid: true, value: null };
  if (typeof value === 'number') return Number.isFinite(value)
    ? { valid: true, value }
    : { valid: false, value: null };
  if (typeof value !== 'string') return { valid: false, value: null };
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, value: null };
  const parsed = Number(trimmed);
  return Number.isFinite(parsed)
    ? { valid: true, value: parsed }
    : { valid: false, value: null };
}

const nullableNumberFields = new Set<keyof ProductionJob>([
  'contract_value',
  'estimated_man_hours',
  'estimated_calendar_days',
]);

export function productionValuesEqual(field: keyof ProductionJob, previous: unknown, next: unknown) {
  if (nullableNumberFields.has(field)) {
    const previousNumber = normalizeNullableNumber(previous);
    const nextNumber = normalizeNullableNumber(next);
    return previousNumber.valid && nextNumber.valid && previousNumber.value === nextNumber.value;
  }
  return (previous ?? null) === (next ?? null);
}
