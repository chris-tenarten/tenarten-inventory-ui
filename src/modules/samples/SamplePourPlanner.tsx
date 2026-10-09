'use client';
import {useState, type ReactNode} from 'react';
import {BusinessButton, BusinessInput, BusinessSelect} from '@/components/BusinessWriteControls';
import {BATCH_FIRST_VERSION, calculateSampleFormulation, type SampleFormulationState} from './formulation';
import type {SampleBlendRow} from './types';
import {batchFirstQuantities} from '../../../supabase/functions/_shared/sample-batch-first.mjs';
import {applyPourLayout, batchFractionLabel, convertPourUnits, finishedGeometry, geometryNumber as fmt, suggestPourLayouts} from './pour-planning';

const input = 'mt-1 h-10 w-full min-w-0 border border-slate-300 bg-white px-2 text-sm';
const label = 'min-w-0 text-xs font-bold text-slate-700';
export default function SamplePourPlanner({state, rows, patch, onChange, children}: {
  state: SampleFormulationState; rows: SampleBlendRow[]; children: ReactNode;
  patch: (changes: Partial<SampleFormulationState>) => void;
  onChange: (state: SampleFormulationState) => void;
}) {
  const [show, setShow] = useState(false), [edge, setEdge] = useState('0'), [gap, setGap] = useState('0');
  const finished = finishedGeometry(state), result = calculateSampleFormulation(state, rows);
  const batch = state.calculationVersion === BATCH_FIRST_VERSION ? batchFirstQuantities(state, rows) : null;
  const target = Number(state.profile?.batchChipTargetLb), loading = Number(state.profile?.defaultChipDensityLbCft);
  const referenceVolume = batch && target > 0 && loading > 0 ? target / loading : null;
  const volume = result.productionVolumeCft === '' ? null : Number(result.productionVolumeCft);
  const suggestions = show ? suggestPourLayouts(state, edge, gap) : {layouts: [], issue: null};
  const manual = rows.some(r=>r.quantityProvenance==='manual');
  const displacedInstructions = batch && volume !== null ? Object.entries(state.profile?.batchContract?.components ?? {}).filter(([,c])=>c?.shopWorking?.rule==='at_volume' && Math.abs(Number(c.shopWorking.volumeCft)-volume)>1e-6) : [];
  const field = (title: string, key: 'finishedPlateWidth'|'finishedPlateLength'|'finishedPlateQuantity'|'thicknessIn'|'width'|'length', suffix?: string) => <label className={label}>{title}<BusinessInput aria-label={title} type="number" min={key==='finishedPlateQuantity'?1:0} step={key==='finishedPlateQuantity'?1:'any'} value={state[key]} onChange={e=>patch({[key]:e.target.value})} className={input}/>{suffix && <span className="mt-1 block text-[11px] font-normal text-slate-500">{suffix}</span>}</label>;
  return <div className="mt-3 space-y-4" data-testid="sample-pour-planner">
    <fieldset><legend className="text-sm font-bold">Finished Plates</legend>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field('Finished Plate Width','finishedPlateWidth','inches')}{field('Finished Plate Length','finishedPlateLength','inches')}{field('Finished Pieces','finishedPlateQuantity')}{field('Thickness','thicknessIn','inches · shared with Working Pour')}
      </div>
      <p data-testid="finished-geometry" className="mt-2 text-sm font-semibold">{fmt(finished.area)} SF · {fmt(finished.volume)} CFT finished</p>
      <p className="text-xs text-slate-500">Changing finished dimensions or count does not resize the Working Pour. Shared thickness updates both.</p>
    </fieldset>
    <fieldset><legend className="text-sm font-bold">Working Pour</legend>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field('Working Pour Width','width')}{field('Working Pour Length','length')}
        <label className={label}>Working Pour Units<BusinessSelect aria-label="Working Pour Units" value={state.dimensionUnit} onChange={e=>onChange(convertPourUnits(state,e.target.value as 'in'|'ft'))} className={input}><option value="in">inches</option><option value="ft">feet</option></BusinessSelect><span className="mt-1 block text-[11px] font-normal text-slate-500">Converts width and length; preserves physical size.</span></label>
      </div>
      <p data-testid="working-geometry" className="mt-2 text-sm font-semibold">{result.areaSf === '' ? '—' : fmt(Number(result.areaSf))} SF · {fmt(volume)} CFT Working Pour</p>
      {volume !== null && finished.volume !== null && volume < finished.volume-1e-6 && <p role="status" className="mt-2 text-xs font-semibold text-amber-800">Working Pour volume is less than the total finished-piece volume.</p>}
      <p className="text-xs text-slate-500">Volume alone does not establish that pieces fit or allow for cutting and finishing.</p>
    </fieldset>
    <div className="grid gap-2 border-y border-slate-200 py-3 text-sm sm:grid-cols-2" aria-label="Batch relationship">
      <p>Reference Batch volume: <strong>{fmt(referenceVolume)} CFT</strong></p>
      <p data-testid="pour-fraction">Working Pour: <strong>{batchFractionLabel(batch?.fraction ?? null)}</strong></p>
      <p className="text-xs text-slate-500 sm:col-span-2">Derived from captured Batch chips and chip loading; not measured finished-terrazzo yield. Missing Batch authority is shown as —.</p>
    </div>
    {children}
    {manual && <p className="text-xs text-amber-800">Manual shop quantities are preserved and do not automatically scale with geometry. Review them against the current exact projection before preparation.</p>}
    {displacedInstructions.length>0 && <div className="text-xs text-amber-800"><p>Captured shop instructions apply at a different pour volume. Their original values remain captured; calculated rows use the existing exact-projection fallback. Manual overrides remain unchanged. Review practical quantities.</p><ul className="mt-1 list-inside list-disc">{displacedInstructions.map(([role,c])=><li key={role}>{role === 'resin' ? 'Resin' : role === 'hardener' ? 'Hardener' : 'Filler'}: {c?.shopWorking?.quantity} {c?.shopWorking?.unit} at {c?.shopWorking?.volumeCft} CFT</li>)}</ul></div>}
    <button type="button" aria-expanded={show} onClick={()=>setShow(!show)} className="min-h-10 border border-slate-400 px-3 text-xs font-bold">{show?'Hide suggestions':'Suggest Working Pour'}</button>
    {show && <div className="space-y-3 border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-600">Theoretical rectangular grids, not shop-approved molds. All pieces use the same orientation. Confirm fit, allowances and cutting feasibility before applying.</p>
      <div className="grid grid-cols-2 gap-3"><label className={label}>Edge allowance (in)<BusinessInput type="number" min="0" step="any" value={edge} onChange={e=>setEdge(e.target.value)} className={input}/><span className="block text-[11px] font-normal">Added at each outer edge</span></label><label className={label}>Separation / cutting allowance (in)<BusinessInput type="number" min="0" step="any" value={gap} onChange={e=>setGap(e.target.value)} className={input}/><span className="block text-[11px] font-normal">Added between rows and columns</span></label></div>
      <p className="text-xs text-slate-500">Allowances affect suggestions only and start at zero. They are not saved as shop standards.</p>
      {suggestions.issue && <p role="status" className="text-xs text-amber-800">{suggestions.issue}</p>}
      <div className="grid gap-3 lg:grid-cols-3">{suggestions.layouts.map(layout=>{
        const proposed={...state,...applyPourLayout(state,layout)};
        const projected=calculateSampleFormulation(proposed,rows);
        const fraction=referenceVolume ? layout.volume/referenceVolume : null;
        return <div key={layout.name} className="min-w-0 border border-slate-300 bg-white p-3" data-testid="pour-suggestion">
          <h4 className="text-sm font-bold">{layout.name}</h4><p className="text-xs">{layout.columns} columns × {layout.rows} rows{layout.rotated?' · pieces rotated':''}{layout.unused?` · ${layout.unused} unused positions`:''}</p>
          <p className="mt-2 text-sm font-semibold">{fmt(layout.widthIn)}″ × {fmt(layout.lengthIn)}″ × {fmt(layout.thicknessIn)}″</p>
          <p className="text-xs">{fmt(layout.area)} SF · {fmt(layout.volume)} CFT</p>
          <p className="mt-1 text-xs">Projected chips: {projected.availableChipMixOz === ''?'—':fmt(Number(projected.availableChipMixOz))} oz · {batchFractionLabel(fraction)}</p>
          <BusinessButton type="button" aria-label={`Apply ${layout.name} to Working Pour`} onClick={()=>patch(applyPourLayout(state,layout))} className="mt-3 min-h-10 border border-blue-800 px-2 text-xs font-bold text-blue-900">Apply to Working Pour</BusinessButton>
        </div>;
      })}</div>
      <p className="text-xs text-slate-500">Apply changes this unsaved Working Pour only. Formulation and manual shop instructions remain unchanged.</p>
    </div>}
  </div>;
}
