'use client';

import { Plus, Trash2 } from 'lucide-react';
import { calculateProposalEstimate, effectiveEstimateAssumptions, validateEstimateAssumptions, validateEstimateInputs } from './estimate-calculations';
import { estimateAssumptionDefinitions, estimateAssumptionsByGroup, type EstimateAssumptionGroup, type EstimateAssumptionKey } from './estimate-assumption-fields';
import EstimateAssumptionField from './EstimateAssumptionField';
import type { EstimateChipBlendRow, EstimateRoundingMode, ProposalEstimate, ProposalEstimateAssumptionOverrides, ProposalEstimateInputs } from './estimate-types';

const fieldClass = 'mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'block min-w-0 text-xs font-bold text-slate-700';
const sectionClass = 'border border-slate-300 bg-white p-4';

const optionalNumber = (value: string) => value === '' ? null : Number(value);
const number = (value: number | null, digits = 2) => value === null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: digits });
const money = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="border border-slate-200 bg-slate-50 px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd>{detail ? <div className="mt-0.5 text-[10px] text-slate-500">{detail}</div> : null}</div>;
}

function CostTable({ rows, quantityLabel = 'Quantity' }: { rows: Array<{ key: string; label: string; quantity: number; unit: string; cost: number }>; quantityLabel?: string }) {
  return <div className="mt-3 overflow-x-auto border border-slate-200"><table className="w-full min-w-[520px] border-collapse text-xs"><thead><tr className="bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">{quantityLabel}</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2 text-right">Cost</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-t border-slate-200"><td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td><td className="px-3 py-2 text-right tabular-nums">{number(row.quantity, 4)}</td><td className="px-3 py-2 text-slate-500">{row.unit}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{money(row.cost)}</td></tr>)}</tbody></table></div>;
}

type Props = {
  estimate: ProposalEstimate;
  disabled?: boolean;
  onChange(estimate: ProposalEstimate): void;
};

export default function EstimateEditor({ estimate, disabled = false, onChange }: Props) {
  const errors = [...validateEstimateAssumptions(estimate.effectiveAssumptions), ...validateEstimateInputs(estimate.inputs)];

  function recalculate(inputs: ProposalEstimateInputs, overrides: ProposalEstimateAssumptionOverrides) {
    const effectiveAssumptions = effectiveEstimateAssumptions(estimate.defaultAssumptions, overrides);
    let outputs = estimate.outputs;
    if (validateEstimateAssumptions(effectiveAssumptions).length === 0 && validateEstimateInputs(inputs).length === 0) outputs = calculateProposalEstimate(inputs, effectiveAssumptions);
    onChange({ ...estimate, inputs, assumptionOverrides: overrides, effectiveAssumptions, outputs });
  }

  function patchInput<Key extends keyof ProposalEstimateInputs>(key: Key, value: ProposalEstimateInputs[Key]) {
    recalculate({ ...estimate.inputs, [key]: value }, estimate.assumptionOverrides);
  }

  function patchAssumption(key: EstimateAssumptionKey, value: number | EstimateRoundingMode) {
    recalculate(estimate.inputs, { ...estimate.assumptionOverrides, [key]: value });
  }

  function resetAssumption(key: EstimateAssumptionKey) {
    const overrides = { ...estimate.assumptionOverrides };
    delete overrides[key];
    recalculate(estimate.inputs, overrides);
  }

  function assumptionField(key: EstimateAssumptionKey) {
    const definition = estimateAssumptionDefinitions.find((candidate) => candidate.key === key);
    if (!definition) return null;
    return <EstimateAssumptionField key={key} definition={definition} value={estimate.effectiveAssumptions[key]} modified={Object.prototype.hasOwnProperty.call(estimate.assumptionOverrides, key)} disabled={disabled} onChange={(value) => patchAssumption(key, value)} onReset={() => resetAssumption(key)} />;
  }

  function assumptionGroup(group: EstimateAssumptionGroup) {
    return <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{estimateAssumptionsByGroup(group).map((definition) => assumptionField(definition.key))}</div>;
  }

  function patchBlendRow(index: number, changes: Partial<EstimateChipBlendRow>) {
    patchInput('chipBlend', estimate.inputs.chipBlend.map((row, candidate) => candidate === index ? { ...row, ...changes } : row));
  }

  const inputs = estimate.inputs;
  const outputs = estimate.outputs;
  const showWidth = inputs.geometryProfile !== 'tread_riser';
  const showRiser = inputs.geometryProfile !== 'flat';
  const showDepth = inputs.geometryProfile !== 'flat';

  return <div className="space-y-4" data-proposal-estimate-editor>
    <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950"><strong>Internal Estimate</strong> — production geometry, assumptions, cost, and pricing guidance remain separate from the customer Proposal.</div>
    {errors.length ? <div role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{errors.join(' ')}</div> : null}

    <section className={sectionClass} aria-labelledby="estimate-finished-geometry">
      <h3 id="estimate-finished-geometry" className="text-sm font-bold uppercase tracking-wide">A. Finished Geometry</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>Geometry profile<select disabled={disabled} value={inputs.geometryProfile} onChange={(event) => patchInput('geometryProfile', event.target.value as ProposalEstimateInputs['geometryProfile'])} className={fieldClass}><option value="flat">Flat piece</option><option value="tread_riser">Tread / riser</option><option value="custom">Custom</option></select></label>
        <label className={labelClass}>Customer Quantity<input type="number" min="0" step="any" disabled={disabled} value={inputs.customerQuantity ?? ''} onChange={(event) => patchInput('customerQuantity', optionalNumber(event.target.value))} className={fieldClass} /></label>
        <label className={labelClass}>Length (L)<input type="number" min="0" step="any" disabled={disabled} value={inputs.lengthInches ?? ''} onChange={(event) => patchInput('lengthInches', optionalNumber(event.target.value))} className={fieldClass} /></label>
        {showWidth ? <label className={labelClass}>Width (W)<input type="number" min="0" step="any" disabled={disabled} value={inputs.widthInches ?? ''} onChange={(event) => patchInput('widthInches', optionalNumber(event.target.value))} className={fieldClass} /></label> : null}
        {showDepth ? <label className={labelClass}>Depth (D)<input type="number" min="0" step="any" disabled={disabled} value={inputs.depthInches ?? ''} onChange={(event) => patchInput('depthInches', optionalNumber(event.target.value))} className={fieldClass} /></label> : null}
        {showRiser ? <label className={labelClass}>Riser Height (RH)<input type="number" min="0" step="any" disabled={disabled} value={inputs.riserHeightInches ?? ''} onChange={(event) => patchInput('riserHeightInches', optionalNumber(event.target.value))} className={fieldClass} /></label> : null}
        <label className={labelClass}>Thickness (T)<input type="number" min="0" step="any" disabled={disabled} value={inputs.thicknessInches ?? ''} onChange={(event) => patchInput('thicknessInches', optionalNumber(event.target.value))} className={fieldClass} /></label>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Customer CFT" value={number(outputs.geometry.customerCubicFeet, 4)} /><Metric label="Customer LF" value={number(outputs.geometry.customerLinearFeet)} /><Metric label="Customer SF" value={number(outputs.geometry.customerSquareFeet, 2)} /><Metric label="Estimated Weight" value={`${number(outputs.geometry.customerEstimatedWeightLb)} lb`} detail={`${number(estimate.effectiveAssumptions.materialDensityLbPerCubicFoot)} lb/ft³`} /></dl>
    </section>

    <section className={sectionClass} aria-labelledby="estimate-production">
      <h3 id="estimate-production" className="text-sm font-bold uppercase tracking-wide">B. Rough Pour / Production</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>Rough Length<input type="number" min="0" step="any" disabled={disabled} value={inputs.roughLengthInches ?? ''} onChange={(event) => patchInput('roughLengthInches', optionalNumber(event.target.value))} className={fieldClass} /></label>
        <label className={labelClass}>Rough Width<input type="number" min="0" step="any" disabled={disabled} value={inputs.roughWidthInches ?? ''} onChange={(event) => patchInput('roughWidthInches', optionalNumber(event.target.value))} className={fieldClass} /></label>
        <label className={labelClass}>Rough Thickness<input type="number" min="0" step="any" disabled={disabled} value={inputs.roughThicknessInches ?? ''} onChange={(event) => patchInput('roughThicknessInches', optionalNumber(event.target.value))} className={fieldClass} /></label>
        <label className={labelClass}>Production Quantity Override<input type="number" min="0" step="any" disabled={disabled} value={inputs.productionQuantityOverride ?? ''} onChange={(event) => patchInput('productionQuantityOverride', optionalNumber(event.target.value))} className={fieldClass} /><span className="mt-1 block text-[10px] font-normal text-slate-500">Leave blank to use the yield-derived quantity.</span></label>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Calculated Production Qty" value={number(outputs.production.calculatedQuantity)} /><Metric label="Effective Production Qty" value={number(outputs.production.effectiveQuantity)} detail={outputs.production.quantitySource === 'override' ? 'Manual override' : outputs.production.quantitySource === 'calculated' ? 'Calculated from yield' : 'Awaiting inputs'} /><Metric label="Slabs" value={number(outputs.production.slabCount)} /><Metric label="Production CFT" value={number(outputs.geometry.productionCubicFeet, 4)} /></dl>
    </section>

    <section className={sectionClass} aria-labelledby="estimate-yield">
      <h3 id="estimate-yield" className="text-sm font-bold uppercase tracking-wide">C. Yield / Waste / Batches</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Rough SF" value={number(outputs.production.roughSquareFeet)} /><Metric label="Rough CFT" value={number(outputs.production.roughCubicFeet, 4)} /><Metric label="Waste" value={`${number(outputs.production.wastePercent)}%`} /><Metric label="Batches" value={number(outputs.production.batchCount, 4)} /></dl>
      {assumptionGroup('production')}
    </section>

    <section className={sectionClass} aria-labelledby="estimate-materials">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="estimate-materials" className="text-sm font-bold uppercase tracking-wide">D. Materials / Formulation</h3><p className="mt-1 text-xs text-slate-500">Material selections and blend pricing affect only this internal Estimate.</p></div>{!disabled ? <button type="button" onClick={() => patchInput('chipBlend', [...inputs.chipBlend, { id: crypto.randomUUID(), color: '', percentage: 0, size: '', materialType: '', vendor: '', unitCostPerBag: 0 }])} className="inline-flex h-9 items-center gap-1 border border-slate-400 px-3 text-xs font-bold"><Plus className="h-4 w-4" />Add Chip</button> : null}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className={labelClass}>Finish<input disabled={disabled} value={inputs.finish} onChange={(event) => patchInput('finish', event.target.value)} className={fieldClass} /></label><label className={labelClass}>Sealer<input disabled={disabled} value={inputs.sealer} onChange={(event) => patchInput('sealer', event.target.value)} className={fieldClass} /></label><label className={labelClass}>Resin Color<input disabled={disabled} value={inputs.resinColor} onChange={(event) => patchInput('resinColor', event.target.value)} className={fieldClass} /></label><label className={labelClass}>Filler<input disabled={disabled} value={inputs.filler} onChange={(event) => patchInput('filler', event.target.value)} className={fieldClass} /></label><label className={labelClass}>Color Plate<input disabled={disabled} value={inputs.colorPlate} onChange={(event) => patchInput('colorPlate', event.target.value)} className={fieldClass} /></label></div>
      <div className="mt-3 space-y-2">{inputs.chipBlend.map((row, index) => <div key={row.id} className="grid gap-2 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_.7fr_1fr_1fr_1.1fr_1fr_auto]"><label className={labelClass}>Color<input disabled={disabled} value={row.color} onChange={(event) => patchBlendRow(index, { color: event.target.value })} className={fieldClass} /></label><label className={labelClass}>%<input type="number" min="0" max="100" step="any" disabled={disabled} value={row.percentage} onChange={(event) => patchBlendRow(index, { percentage: Number(event.target.value) })} className={fieldClass} /></label><label className={labelClass}>Size<input disabled={disabled} value={row.size} onChange={(event) => patchBlendRow(index, { size: event.target.value })} className={fieldClass} /></label><label className={labelClass}>Type<input disabled={disabled} value={row.materialType} onChange={(event) => patchBlendRow(index, { materialType: event.target.value })} className={fieldClass} /></label><label className={labelClass}>Vendor<input disabled={disabled} value={row.vendor} onChange={(event) => patchBlendRow(index, { vendor: event.target.value })} className={fieldClass} /></label><label className={labelClass}>Cost / Bag<input type="number" min="0" step="0.01" disabled={disabled} value={row.unitCostPerBag} onChange={(event) => patchBlendRow(index, { unitCostPerBag: Number(event.target.value) })} className={fieldClass} /></label>{!disabled ? <button type="button" aria-label={`Remove ${row.color || `chip row ${index + 1}`}`} onClick={() => patchInput('chipBlend', inputs.chipBlend.filter((_, candidate) => candidate !== index))} className="mt-5 h-9 w-9 border border-slate-300 text-red-700"><Trash2 className="mx-auto h-4 w-4" /></button> : null}</div>)}</div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-3"><Metric label="Chip Pounds" value={`${number(outputs.materials.chipPounds)} lb`} /><Metric label="Chip Bags" value={number(outputs.materials.chipBags, 4)} /><Metric label="Material Cost" value={money(outputs.materials.totalCost)} /></dl>
      <CostTable rows={outputs.materials.rows} />
      {assumptionGroup('materials')}
    </section>

    <section className={sectionClass} aria-labelledby="estimate-labor">
      <h3 id="estimate-labor" className="text-sm font-bold uppercase tracking-wide">E. Fabrication / Labor</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="Base Hours" value={number(outputs.labor.baseHours)} /><Metric label="Difficulty Hours" value={number(outputs.labor.difficultyHours)} /><Metric label="Labor Cost" value={money(outputs.labor.totalCost)} /></dl>
      <CostTable rows={outputs.labor.rows.map((row) => ({ ...row, quantity: row.hours, unit: 'hr' }))} quantityLabel="Hours" />
      {assumptionGroup('labor')}
    </section>

    <section className={sectionClass} aria-labelledby="estimate-freight-shop">
      <h3 id="estimate-freight-shop" className="text-sm font-bold uppercase tracking-wide">F. Freight / Shop Cost</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Inbound Freight" value={money(outputs.freight.totalCost)} /><Metric label="Shop Capacity" value={`${number(outputs.shop.capacityHoursPerDay)} hr/day`} /><Metric label="Effective Shop Days" value={number(outputs.shop.effectiveDays, 4)} /><Metric label="Shop Cost" value={money(outputs.shop.totalCost)} /></dl>
      <CostTable rows={outputs.freight.rows} />
      {assumptionGroup('freightShop')}
    </section>

    <section className={sectionClass} aria-labelledby="estimate-pricing">
      <h3 id="estimate-pricing" className="text-sm font-bold uppercase tracking-wide">G. Pricing / Internal Metrics</h3>
      <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">Internal calculations are guidance only. They never populate the customer Proposal Rate automatically.</div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Base Internal Cost" value={money(outputs.pricing.baseCost)} /><Metric label="Category Markup" value={money(outputs.pricing.totalMarkup)} /><Metric label="Rep Fee" value={money(outputs.pricing.repFee)} /><Metric label="Internal Total" value={money(outputs.pricing.internalTotal)} /><Metric label="Calculated Unit Metric" value={money(outputs.pricing.internalCalculatedUnitMetric)} detail="Internal total ÷ effective production quantity" /><Metric label="Per SF" value={money(outputs.pricing.perSquareFoot)} /><Metric label="Per LF" value={money(outputs.pricing.perLinearFoot)} /><Metric label="Per Slab" value={money(outputs.pricing.perSlab)} /></dl>
      {assumptionGroup('pricing')}
    </section>
  </div>;
}
