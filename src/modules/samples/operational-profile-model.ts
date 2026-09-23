import { applyFormulationProfile, type SampleFormulationProfile, type SampleFormulationState } from './formulation';

export type OperationalProfile = {
  id: string; revision: number; name: string; sort_order: number; is_active: boolean;
  chip_density: number | null; dry_pool_rate: number | null; filler_rate: number | null;
  resin_rate: number | null; resin_parts: number | null; hardener_parts: number | null;
  description: string;
};
export const operationalProfileLabel = (p: OperationalProfile) => `${p.name} — ${p.resin_parts && p.hardener_parts ? `${p.resin_parts}:${p.hardener_parts}` : '?'}`;
export function missingProfileInputs(p: OperationalProfile): string[] {
  const missing: string[] = [];
  if (!(p.chip_density !== null && p.chip_density > 0)) missing.push('Chip density');
  if (!(p.dry_pool_rate !== null && p.dry_pool_rate > 0)) missing.push('expected dry-material rate');
  if (!(p.filler_rate !== null && p.filler_rate >= 0)) missing.push('Filler rate');
  if (!(p.resin_rate !== null && p.resin_rate > 0)) missing.push('Resin rate');
  if (![4, 5].includes(p.resin_parts ?? 0) || p.hardener_parts !== 1) missing.push('supported Resin:Hardener ratio (4:1 or 5:1)');
  if (p.filler_rate !== null && p.dry_pool_rate !== null && p.filler_rate >= p.dry_pool_rate) missing.push('Filler rate below expected dry-material rate');
  return missing;
}
export function captureOperationalProfile(p: OperationalProfile): SampleFormulationProfile {
  const missing = missingProfileInputs(p);
  if (missing.length) throw new Error(`${operationalProfileLabel(p)} needs ${missing.join(', ')}. The current Draft has not been changed.`);
  return { id: `operational:${p.id}`, version: p.revision, name: operationalProfileLabel(p),
    defaultChipDensityLbCft: String(p.chip_density), dryPoolOzPerCft: String(p.dry_pool_rate),
    defaultFillerOzPerCft: String(p.filler_rate), resinFlOzPerCft: String(p.resin_rate),
    resinParts: String(p.resin_parts), hardenerParts: String(p.hardener_parts), evidence: p.description };
}
export function applyOperationalProfile(state: SampleFormulationState, p: OperationalProfile) {
  return applyFormulationProfile(state, captureOperationalProfile(p));
}
