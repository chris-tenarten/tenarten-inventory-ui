'use client';

import { RotateCcw, Settings2 } from 'lucide-react';
import type { EstimateAssumptionDefinition } from './estimate-assumption-fields';
import type { EstimateRoundingMode } from './estimate-types';

const fieldClass = 'mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';

type Props = {
  definition: EstimateAssumptionDefinition;
  value: number | EstimateRoundingMode;
  modified?: boolean;
  disabled?: boolean;
  helperText?: string;
  showReset?: boolean;
  onChange(value: number | EstimateRoundingMode): void;
  onReset?(): void;
};

export default function EstimateAssumptionField({ definition, value, modified = false, disabled = false, helperText = 'Default estimating assumption — editable for this estimate.', showReset = true, onChange, onReset }: Props) {
  return <label className="block min-w-0 text-xs font-bold text-slate-700">
    <span className="flex min-h-5 items-center gap-1.5">
      <Settings2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <span className="min-w-0 truncate" title={definition.label}>{definition.label}</span>
      {modified ? <span className="shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-900">Modified</span> : null}
      {modified && showReset && !disabled && onReset ? <button type="button" onClick={(event) => { event.preventDefault(); onReset(); }} className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><RotateCcw className="h-3 w-3" aria-hidden="true" />Reset</button> : null}
    </span>
    {definition.kind === 'rounding' ? <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value as EstimateRoundingMode)} className={fieldClass} title={helperText}>
      <option value="fractional">Keep fractional result</option>
      <option value="whole_up">Round up to whole</option>
    </select> : <span className="relative block">
      <input type="number" min={definition.min} max={definition.max} step={definition.step} disabled={disabled} value={value} onChange={(event) => onChange(Number(event.target.value))} className={`${fieldClass} pr-16`} title={helperText} />
      <span className="pointer-events-none absolute bottom-0 right-2 flex h-9 items-center text-[10px] font-semibold text-slate-500">{definition.unit}</span>
    </span>}
    <span className="mt-1 block text-[10px] font-normal text-slate-500">{helperText}</span>
  </label>;
}
