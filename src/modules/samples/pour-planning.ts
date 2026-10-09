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
export type PourConstraints = {adjustWidth: boolean; adjustLength: boolean; maxWidth: string; maxLength: string; arrangement: 'auto'|'fixed'; columns: string; rotate: boolean};
export const defaultPourConstraints: PourConstraints = {adjustWidth:true,adjustLength:true,maxWidth:'',maxLength:'',arrangement:'auto',columns:'2',rotate:true};
export function suggestPourLayouts(state: SampleFormulationState, edgeText: string, separationText: string, constraints?: PourConstraints): {layouts: PourLayout[]; issue: string | null} {
  const w = positive(state.finishedPlateWidth), l = positive(state.finishedPlateLength), n = positive(state.finishedPlateQuantity), t = positive(state.thicknessIn);
  if (w === null || l === null || n === null || t === null || !Number.isSafeInteger(n)) return {layouts: [], issue: 'Enter positive finished dimensions, thickness and a whole piece count.'};
  // Bound this small grid planner; no nesting or industrial optimization is claimed.
  if (n > 10000) return {layouts: [], issue: 'Suggestions support up to 10,000 identical rectangular pieces. Author the Working Pour directly for larger layouts.'};
  const allowance = (s: string) => s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 ? Number(s) : null;
  const edge = allowance(edgeText), gap = allowance(separationText);
  if (edge === null || gap === null) return {layouts: [], issue: 'Enter zero or a positive allowance in inches.'};
  const maxWidth = constraints?.maxWidth.trim() ? positive(constraints.maxWidth) : Infinity;
  const maxLength = constraints?.maxLength.trim() ? positive(constraints.maxLength) : Infinity;
  const fixedColumns = constraints?.arrangement === 'fixed' ? positive(constraints.columns) : null;
  const unitFactor = state.dimensionUnit === 'ft' ? 12 : 1;
  const lockedWidth = positive(state.width), lockedLength = positive(state.length);
  if (maxWidth === null || maxLength === null) return {layouts:[],issue:'Maximum width and length must be positive, or blank for no limit.'};
  if (constraints?.arrangement === 'fixed' && (fixedColumns === null || !Number.isSafeInteger(fixedColumns) || fixedColumns > n)) return {layouts:[],issue:'Enter a whole column count between 1 and the finished piece count.'};
  if (constraints && ((!constraints.adjustWidth && lockedWidth === null) || (!constraints.adjustLength && lockedLength === null))) return {layouts:[],issue:'Locked Working Pour dimensions must be positive.'};
  const candidates: PourLayout[] = [];
  for (const rotated of w === l || constraints?.rotate === false ? [false] : [false, true]) {
    const pw = rotated ? l : w, pl = rotated ? w : l;
    for (let columns = 1; columns <= n; columns++) {
      if (fixedColumns !== null && columns !== fixedColumns) continue;
      const rows = Math.ceil(n / columns);
      let widthIn = columns * pw + (columns - 1) * gap + 2 * edge, lengthIn = rows * pl + (rows - 1) * gap + 2 * edge;
      if (constraints && !constraints.adjustWidth) {if (widthIn > lockedWidth! * unitFactor + 1e-9) continue; widthIn = lockedWidth! * unitFactor;}
      if (constraints && !constraints.adjustLength) {if (lengthIn > lockedLength! * unitFactor + 1e-9) continue; lengthIn = lockedLength! * unitFactor;}
      if (widthIn > maxWidth + 1e-9 || lengthIn > maxLength + 1e-9) continue;
      const area = widthIn * lengthIn / 144, volume = area * t / 12;
      if (![widthIn, lengthIn, area, volume].every(Number.isFinite)) continue;
      candidates.push({name: '', columns, rows, rotated, widthIn, lengthIn, thicknessIn: t, area, volume, unused: columns * rows - n});
    }
  }
  if (!candidates.length) return {layouts: [], issue: 'No modeled rectangular arrangement fits these constraints. Increase a limit, unlock a dimension, or change the permitted arrangement/allowances.'};
  if (constraints) {
    const seen = new Set<string>();
    const layouts = candidates.sort((a,b)=>a.volume-b.volume || Math.max(a.widthIn,a.lengthIn)-Math.max(b.widthIn,b.lengthIn) || a.unused-b.unused).filter(c=>{
      const key = `${dimensionalValue(c.widthIn)}:${dimensionalValue(c.lengthIn)}`;
      if(seen.has(key)) return false; seen.add(key); return true;
    }).slice(0,3).map((c,i)=>({...c,name:`Alternative ${i+1}`}));
    return {layouts,issue:null};
  }
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
