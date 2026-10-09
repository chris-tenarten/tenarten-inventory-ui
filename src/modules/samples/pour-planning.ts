import type { SampleFormulationState } from './formulation';

const positive = (value: string) => value.trim() && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
export const geometryNumber = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', {maximumFractionDigits: 8});
// Retain substantially more precision than the persisted geometry/display boundary.
const dimensionalValue = (value: number) => String(Number(value.toPrecision(15)));
export function convertPourUnits(state: SampleFormulationState, unit: 'in' | 'ft'): SampleFormulationState {
  if (unit === state.dimensionUnit) return state;
  const factor = unit === 'ft' ? 1 / 12 : 12;
  const convert = (value: string) => value.trim() && Number.isFinite(Number(value)) ? dimensionalValue(Number(value) * factor) : value;
  return {...state, width: convert(state.width), length: convert(state.length), dimensionUnit: unit};
}
export function finishedGeometry(state: SampleFormulationState) {
  const w = positive(state.finishedPlateWidth), l = positive(state.finishedPlateLength), count = positive(state.finishedPlateQuantity), t = positive(state.thicknessIn);
  const area = w !== null && l !== null && count !== null ? w * l * count / 144 : null;
  return {area, volume: area !== null && t !== null ? area * t / 12 : null};
}
export function batchFractionLabel(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—';
  const inverse = Math.round(1 / value);
  if (inverse > 1 && Math.abs(value * inverse - 1) < 1e-9) return `1/${inverse} Batch`;
  return `${geometryNumber(value)} Batch${value === 1 ? '' : 'es'}`;
}
export type PourLayout = {name: string; columns: number; rows: number; rotated: boolean; widthIn: number; lengthIn: number; thicknessIn: number; area: number; volume: number; unused: number};
export function suggestPourLayouts(state: SampleFormulationState, edgeText: string, separationText: string): {layouts: PourLayout[]; issue: string | null} {
  const w = positive(state.finishedPlateWidth), l = positive(state.finishedPlateLength), n = positive(state.finishedPlateQuantity), t = positive(state.thicknessIn);
  if (w === null || l === null || n === null || t === null || !Number.isSafeInteger(n)) return {layouts: [], issue: 'Enter positive finished dimensions, thickness and a whole piece count.'};
  // Bound this small grid planner; no nesting or industrial optimization is claimed.
  if (n > 10000) return {layouts: [], issue: 'Suggestions support up to 10,000 identical rectangular pieces. Author the Working Pour directly for larger layouts.'};
  const allowance = (s: string) => s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 ? Number(s) : null;
  const edge = allowance(edgeText), gap = allowance(separationText);
  if (edge === null || gap === null) return {layouts: [], issue: 'Enter zero or a positive allowance in inches.'};
  const candidates: PourLayout[] = [];
  for (const rotated of w === l ? [false] : [false, true]) {
    const pw = rotated ? l : w, pl = rotated ? w : l;
    for (let columns = 1; columns <= n; columns++) {
      const rows = Math.ceil(n / columns), widthIn = columns * pw + (columns - 1) * gap + 2 * edge, lengthIn = rows * pl + (rows - 1) * gap + 2 * edge;
      const area = widthIn * lengthIn / 144, volume = area * t / 12;
      if (![widthIn, lengthIn, area, volume].every(Number.isFinite)) continue;
      candidates.push({name: '', columns, rows, rotated, widthIn, lengthIn, thicknessIn: t, area, volume, unused: columns * rows - n});
    }
  }
  if (!candidates.length) return {layouts: [], issue: 'These dimensions are too large to evaluate reliably.'};
  // Compact means shortest longest side, then least area. Whole grids may have spare positions.
  const compact = [...candidates].sort((a,b) => Math.max(a.widthIn,a.lengthIn)-Math.max(b.widthIn,b.lengthIn) || a.area-b.area || a.unused-b.unused)[0];
  const selected = [{...compact, name:'Compact grid'}, {...candidates.find(c=>!c.rotated&&c.rows===1)!, name:'Single row'}, {...candidates.find(c=>!c.rotated&&c.columns===1)!, name:'Single column'}];
  const seen = new Set<string>();
  return {layouts:selected.filter(c=> {const key=`${dimensionalValue(c.widthIn)}:${dimensionalValue(c.lengthIn)}`;if(seen.has(key))return false;seen.add(key);return true;}),issue:null};
}
export function applyPourLayout(state: SampleFormulationState, layout: PourLayout) {
  const divisor = state.dimensionUnit === 'ft' ? 12 : 1;
  return {width: dimensionalValue(layout.widthIn / divisor), length: dimensionalValue(layout.lengthIn / divisor)};
}
