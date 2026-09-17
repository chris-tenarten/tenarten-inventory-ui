'use client';

import { Calculator, Plus, Trash2 } from 'lucide-react';
import EstimateProposalApplyActions from './EstimateProposalApplyActions';
import { calculateProposalCustomerGeometry, proposalCustomerGeometryAvailability } from './proposal-customer-geometry';
import {
  formatMoney,
  knownProposalTaxRate,
  lineTotal,
  proposalClarifications,
  proposalEscalationNotice,
  proposalLeadTimeNotice,
  proposalTotals,
} from './model';
import type { Proposal, ProposalDimensionApplicability, ProposalDimensionKey, ProposalLine } from './types';

const field = 'mt-1 h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const area = 'mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const label = 'text-xs font-bold text-slate-700';
const section = 'border border-slate-300 bg-white p-4';
const clarificationKeys = new Set<keyof Proposal>(['taxEnabled', 'taxCounty', 'taxRate', 'destinationZip', 'freightEstimate']);

const dimensionFields: Array<{ key: ProposalDimensionKey; field: keyof ProposalLine; label: string }> = [
  { key: 'length', field: 'lengthInches', label: 'L' },
  { key: 'width', field: 'widthInches', label: 'W' },
  { key: 'riserHeight', field: 'riserHeightInches', label: 'RH' },
  { key: 'thickness', field: 'thicknessInches', label: 'T' },
  { key: 'cubicFeet', field: 'cubicFeet', label: 'CFT' },
  { key: 'linearFeet', field: 'linearFeet', label: 'LF' },
  { key: 'estimatedWeight', field: 'estimatedWeightPounds', label: 'EST. weight' },
];

export function blankProposalLine(order: number): ProposalLine {
  return {
    id: crypto.randomUUID(),
    lineType: 'product',
    itemNumber: String(order + 1),
    description: '',
    ref: '',
    colorPlate: '',
    quantity: '',
    unit: 'ea.',
    length: '',
    width: '',
    heightThickness: '',
    cft: '',
    lf: '',
    estimatedWeight: '',
    rate: '',
    total: '0',
    sourceMetadata: {},
    displayOrder: order,
    geometryProfile: 'none',
    dimensionApplicability: {},
    lengthInches: '',
    widthInches: '',
    riserHeightInches: '',
    thicknessInches: '',
    cubicFeet: '',
    linearFeet: '',
    estimatedWeightPounds: '',
  };
}

const profileApplicability = (profile: ProposalLine['geometryProfile']): ProposalDimensionApplicability => {
  if (profile === 'flat') return { length: true, width: true, thickness: true, cubicFeet: true, linearFeet: true, estimatedWeight: true };
  if (profile === 'tread_riser') return { length: true, riserHeight: true, thickness: true, cubicFeet: true, linearFeet: true, estimatedWeight: true };
  return {};
};

export default function ProposalCustomerEditor({ proposal, onChange }: { proposal: Proposal; onChange(value: Proposal): void }) {
  const disabled = proposal.status === 'issued';
  const totals = proposalTotals(proposal.lines, proposal.taxEnabled, proposal.taxRate);

  function patch<Key extends keyof Proposal>(key: Key, value: Proposal[Key]) {
    const generated = proposalClarifications(proposal);
    const next = {
      ...proposal,
      [key]: value,
      ...(key === 'taxCounty' ? { taxRate: knownProposalTaxRate(String(value)) } : {}),
      fieldSources: Object.fromEntries(Object.entries(proposal.fieldSources).filter(([sourceKey]) => sourceKey !== key)),
    };
    if (clarificationKeys.has(key) && (!proposal.notes.trim() || proposal.notes === generated)) next.notes = proposalClarifications(next);
    onChange(next);
  }

  function replaceLine(index: number, replacement: ProposalLine) {
    patch('lines', proposal.lines.map((current, candidate) => candidate === index ? { ...replacement, total: String(lineTotal(replacement)) } : current));
  }

  function patchLine(index: number, changes: Partial<ProposalLine>) {
    const current = proposal.lines[index];
    replaceLine(index, { ...current, ...changes });
  }

  function changeGeometryProfile(index: number, geometryProfile: ProposalLine['geometryProfile']) {
    const current = proposal.lines[index];
    const dimensionApplicability = geometryProfile === 'custom'
      ? current.dimensionApplicability ?? {}
      : profileApplicability(geometryProfile);
    const clearedDimensions = Object.fromEntries(
      dimensionFields.filter((dimension) => !dimensionApplicability[dimension.key]).map((dimension) => [dimension.field, '']),
    ) as Partial<ProposalLine>;
    patchLine(index, {
      geometryProfile,
      dimensionApplicability,
      ...clearedDimensions,
    });
  }

  function setDimensionApplicable(index: number, key: ProposalDimensionKey, fieldName: keyof ProposalLine, checked: boolean) {
    const current = proposal.lines[index];
    patchLine(index, {
      dimensionApplicability: { ...current.dimensionApplicability, [key]: checked },
      ...(checked ? {} : { [fieldName]: '' }),
    });
  }

  return <div className="space-y-5" data-customer-proposal-editor>
    <div className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950"><strong>Customer Proposal</strong> — customer-facing values are independently authored. Estimate values enter only through the explicit actions below.</div>

    <section className={section}>
      <h3 className="text-sm font-bold uppercase tracking-wide">Proposal details</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>Date<input type="date" disabled={disabled} value={proposal.proposalDate} onChange={(event) => patch('proposalDate', event.target.value)} className={field} /></label>
        <label className={label}>Project #<input disabled={disabled} value={proposal.projectNumber} onChange={(event) => patch('projectNumber', event.target.value)} className={field} /></label>
        <label className={label}>Project<input disabled={disabled} value={proposal.projectName} onChange={(event) => patch('projectName', event.target.value)} className={field} /></label>
        <label className={label}>Project Location<input disabled={disabled} value={proposal.projectLocation} onChange={(event) => patch('projectLocation', event.target.value)} className={field} /></label>
        <label className={label}>F.O.B.<input disabled={disabled} value={proposal.fob} onChange={(event) => patch('fob', event.target.value)} className={field} /></label>
        <label className={label}>Side Mark<input disabled={disabled} value={proposal.sideMark} onChange={(event) => patch('sideMark', event.target.value)} className={field} /></label>
        <label className={label}>Sales Rep<input disabled={disabled} value={proposal.salesRep} onChange={(event) => patch('salesRep', event.target.value)} className={field} /></label>
        <label className={label}>Terms<input disabled={disabled} value={proposal.terms} onChange={(event) => patch('terms', event.target.value)} className={field} /></label>
        <label className={label}>Valid days<input type="number" min="0" disabled={disabled} value={proposal.validDays} onChange={(event) => patch('validDays', event.target.value)} className={field} /></label>
        <label className={label}>Requested delivery date<input disabled={disabled} value={proposal.requestedDelivery} onChange={(event) => patch('requestedDelivery', event.target.value)} className={field} /></label>
      </div>
      <div className="mt-4 border border-slate-300">
        <div className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Standard estimate terms</div>
        <div className="grid text-center text-xs font-bold text-slate-800 sm:grid-cols-2"><p className="flex min-h-12 items-center justify-center px-4 py-3 sm:border-r sm:border-slate-300">{proposalEscalationNotice}</p><p className="flex min-h-12 items-center justify-center border-t border-slate-300 px-4 py-3 sm:border-t-0">{proposalLeadTimeNotice}</p></div>
      </div>
    </section>

    <section className={section}>
      <h3 className="text-sm font-bold uppercase tracking-wide">Customer & contact</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${label} sm:col-span-2`}>Company<input disabled={disabled} value={proposal.customerName} onChange={(event) => patch('customerName', event.target.value)} className={field} /></label>
        <label className={`${label} sm:col-span-2`}>Street<input disabled={disabled} value={proposal.customerStreet ?? ''} onChange={(event) => patch('customerStreet', event.target.value)} className={field} /></label>
        <label className={label}>City<input disabled={disabled} value={proposal.customerCity ?? ''} onChange={(event) => patch('customerCity', event.target.value)} className={field} /></label>
        <label className={label}>State<input disabled={disabled} value={proposal.customerState ?? ''} onChange={(event) => patch('customerState', event.target.value)} className={field} /></label>
        <label className={label}>ZIP<input disabled={disabled} value={proposal.customerPostalCode ?? ''} onChange={(event) => patch('customerPostalCode', event.target.value)} className={field} /></label>
        <label className={label}>Contact<input disabled={disabled} value={proposal.customerContactName ?? ''} onChange={(event) => patch('customerContactName', event.target.value)} className={field} /></label>
        <label className={label}>Office phone<input type="tel" disabled={disabled} value={proposal.customerOfficePhone ?? ''} onChange={(event) => patch('customerOfficePhone', event.target.value)} className={field} /></label>
        <label className={label}>Mobile phone<input type="tel" disabled={disabled} value={proposal.customerMobilePhone ?? ''} onChange={(event) => patch('customerMobilePhone', event.target.value)} className={field} /></label>
        <label className={`${label} sm:col-span-2`}>Email<input type="email" disabled={disabled} value={proposal.customerEmail ?? ''} onChange={(event) => patch('customerEmail', event.target.value)} className={field} /></label>
      </div>
      {proposal.customerAddress || proposal.customerContact ? <details className="mt-4 border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-700">Legacy customer context (preserved for compatibility)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={label}>Legacy address<textarea disabled={disabled} value={proposal.customerAddress} onChange={(event) => patch('customerAddress', event.target.value)} rows={3} className={area} /></label><label className={label}>Legacy contact<textarea disabled={disabled} value={proposal.customerContact} onChange={(event) => patch('customerContact', event.target.value)} rows={3} className={area} /></label></div></details> : null}
    </section>

    <section className={section}>
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold uppercase tracking-wide">Line items</h3><p className="mt-1 text-xs text-slate-500">Choose only the dimensions that apply to each product line.</p></div>{!disabled ? <button type="button" onClick={() => patch('lines', [...proposal.lines, blankProposalLine(proposal.lines.length)])} className="inline-flex h-8 shrink-0 items-center gap-1 border border-slate-300 px-2 text-xs font-bold"><Plus className="h-4 w-4" />Add product row</button> : null}</div>
      <div className="mt-3 space-y-3">{proposal.lines.map((line, index) => {
        const legacyGeometry = !line.geometryProfile && [line.length, line.width, line.heightThickness, line.cft, line.lf, line.estimatedWeight].some(Boolean);
        const profile = line.geometryProfile || 'none';
        const density = proposal.estimate?.effectiveAssumptions.materialDensityLbPerCubicFoot ?? null;
        const calculationAvailability = proposalCustomerGeometryAvailability(line, density);
        const canCalculateGeometry = Object.values(calculationAvailability).some(Boolean);
        return <article key={line.id} className="border border-slate-200 bg-slate-50 p-3">
          {line.lineType === 'product' && proposal.estimate ? <div className="mb-3"><EstimateProposalApplyActions estimate={proposal.estimate} line={line} disabled={disabled} onApply={(replacement) => replaceLine(index, replacement)} /></div> : null}
          <div className="grid items-start gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <label className={label}>Type<select disabled={disabled} value={line.lineType} onChange={(event) => patchLine(index, { lineType: event.target.value as ProposalLine['lineType'] })} className={field}><option value="product">Product</option><option value="charge">Charge / allowance</option><option value="informational">Informational</option><option value="included">Included</option></select></label>
            {line.lineType === 'product' ? <>
              <label className={label}>Item #<input disabled={disabled} value={line.itemNumber} onChange={(event) => patchLine(index, { itemNumber: event.target.value })} className={field} /></label>
              <label className={`${label} sm:col-span-2 lg:col-span-3`}>Description<textarea disabled={disabled} value={line.description} onChange={(event) => patchLine(index, { description: event.target.value })} rows={3} className={area} /></label>
              <label className={label}>REF<input disabled={disabled} value={line.ref} onChange={(event) => patchLine(index, { ref: event.target.value })} className={field} /></label>
              <label className={label}>Color Plate<input disabled={disabled} value={line.colorPlate} onChange={(event) => patchLine(index, { colorPlate: event.target.value })} className={field} /></label>
              <fieldset className="sm:col-span-2"><legend className="sr-only">Quantity and unit</legend><div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><label className={label}>QTY<input type="number" min="0" step="any" disabled={disabled} value={line.quantity} onChange={(event) => patchLine(index, { quantity: event.target.value })} className={field} /></label><label className={label}>UOM<input disabled={disabled} value={line.unit} onChange={(event) => patchLine(index, { unit: event.target.value })} className={field} /></label></div></fieldset>
              {legacyGeometry ? <>{([
                ['length', 'L'], ['width', 'W'], ['heightThickness', 'H/T'], ['cft', 'CFT'], ['lf', 'LF'], ['estimatedWeight', 'EST. weight'],
              ] as Array<[keyof ProposalLine, string]>).map(([key, caption]) => <label key={key} className={label}>{caption}<input disabled={disabled} value={String(line[key] ?? '')} onChange={(event) => patchLine(index, { [key]: event.target.value })} className={field} /></label>)}</> : <>
                <label className={`${label} sm:col-span-2`}>Geometry profile<select disabled={disabled} value={profile} onChange={(event) => changeGeometryProfile(index, event.target.value as ProposalLine['geometryProfile'])} className={field}><option value="none">No dimensions</option><option value="flat">Flat piece</option><option value="tread_riser">Tread / riser</option><option value="custom">Custom applicability</option></select></label>
                {profile !== 'none' ? <fieldset className="sm:col-span-4 lg:col-span-6"><legend className="text-xs font-bold text-slate-700">Applicable Proposal dimensions</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{dimensionFields.map((dimension) => <label key={dimension.key} className="inline-flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" disabled={disabled} checked={Boolean(line.dimensionApplicability?.[dimension.key])} onChange={(event) => setDimensionApplicable(index, dimension.key, dimension.field, event.target.checked)} />{dimension.label}</label>)}</div></fieldset> : null}
                {dimensionFields.filter((dimension) => line.dimensionApplicability?.[dimension.key]).map((dimension) => <label key={dimension.key} className={label}>{dimension.label}<input type="number" min="0" step="any" disabled={disabled} value={String(line[dimension.field] ?? '')} onChange={(event) => patchLine(index, { [dimension.field]: event.target.value })} className={field} /></label>)}
                {!disabled && profile !== 'none' ? <div className="sm:col-span-4 lg:col-span-8"><button type="button" disabled={!canCalculateGeometry} onClick={() => replaceLine(index, calculateProposalCustomerGeometry(line, density))} className="inline-flex h-8 items-center gap-1.5 border border-slate-400 bg-white px-2.5 text-[11px] font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Calculator className="h-3.5 w-3.5" aria-hidden="true" />Calculate Proposal geometry</button><p className="mt-1 text-[10px] text-slate-500">Uses this Proposal line&apos;s customer QTY. Flat lines can calculate CFT; all applicable profiles can calculate LF; weight uses the Estimate&apos;s captured effective density. Results remain editable.</p></div> : null}
              </>}
              <label className={label}>Customer Rate<input type="number" min="0" step="0.01" disabled={disabled} value={line.rate} onChange={(event) => patchLine(index, { rate: event.target.value })} className={field} /></label>
              <div className={label}>Total<div className="mt-1 flex h-9 items-center border border-slate-300 bg-white px-2 text-sm font-bold">{formatMoney(lineTotal(line))}</div></div>
            </> : <>
              <label className={`${label} sm:col-span-3`}>Description<input disabled={disabled} value={line.description} onChange={(event) => patchLine(index, { description: event.target.value })} className={field} /></label>
              {line.lineType !== 'informational' ? <><label className={label}>QTY<input type="number" min="0" step="any" disabled={disabled} value={line.quantity} onChange={(event) => patchLine(index, { quantity: event.target.value })} className={field} /></label><label className={label}>UOM<input disabled={disabled} value={line.unit} onChange={(event) => patchLine(index, { unit: event.target.value })} className={field} /></label></> : null}
              {line.lineType === 'charge' ? <><label className={label}>EST. weight<input disabled={disabled} value={line.estimatedWeight} onChange={(event) => patchLine(index, { estimatedWeight: event.target.value })} className={field} /></label><label className={label}>Rate<input type="number" min="0" step="0.01" disabled={disabled} value={line.rate} onChange={(event) => patchLine(index, { rate: event.target.value })} className={field} /></label></> : null}
              <div className={`${label} ${line.lineType === 'informational' ? 'sm:col-span-3' : ''}`}>Total<div className="mt-1 flex h-9 items-center border border-slate-300 bg-white px-2 text-sm font-bold">{line.lineType === 'included' ? 'INCL' : line.lineType === 'informational' ? '—' : formatMoney(lineTotal(line))}</div></div>
            </>}
            {!disabled ? <button type="button" disabled={proposal.lines.length === 1} onClick={() => patch('lines', proposal.lines.filter((_, candidate) => candidate !== index))} className="h-9 w-9 border border-slate-300 text-red-700 disabled:opacity-30" aria-label={`Remove line ${index + 1}`}><Trash2 className="mx-auto h-4 w-4" /></button> : null}
          </div>
        </article>;
      })}</div>
    </section>

    <section className={section}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold uppercase tracking-wide">Line item totals</h3><p className="mt-1 text-xs text-slate-500">Calculated from the chargeable customer Proposal rows above.</p></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={disabled} checked={proposal.taxEnabled} onChange={(event) => patch('taxEnabled', event.target.checked)} />Apply sales tax</label></div>
      <dl className="ml-auto mt-4 w-full space-y-2 border border-slate-300 bg-slate-50 px-4 py-3 text-sm sm:max-w-md"><div className="flex justify-between"><dt>Product and charge subtotal</dt><dd className="font-semibold">{formatMoney(totals.subtotal)}</dd></div><div className="flex justify-between"><dt>Sales tax ({proposal.taxEnabled ? `${proposal.taxRate}%` : 'not applied'})</dt><dd className="font-semibold">{formatMoney(totals.tax)}</dd></div><div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold"><dt>Proposal total</dt><dd>{formatMoney(totals.total)}</dd></div></dl>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <label className={`${label} border border-slate-300 bg-white p-4`}>Formula / color details<textarea disabled={disabled} value={proposal.formulaSnapshot} onChange={(event) => patch('formulaSnapshot', event.target.value)} rows={7} className={area} /></label>
      <div className={section}><h3 className="text-sm font-bold uppercase tracking-wide">Commercial clarifications</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={label}>County<input disabled={disabled} value={proposal.taxCounty} onChange={(event) => patch('taxCounty', event.target.value)} className={field} /></label><label className={label}>Tax rate %<input type="number" min="0" step="0.001" disabled={disabled} value={proposal.taxRate} onChange={(event) => patch('taxRate', event.target.value)} className={field} /></label><label className={label}>Destination ZIP<input disabled={disabled} value={proposal.destinationZip} onChange={(event) => patch('destinationZip', event.target.value)} className={field} /></label><label className={label}>Freight estimate<input type="number" min="0" step="0.01" disabled={disabled} value={proposal.freightEstimate} onChange={(event) => patch('freightEstimate', event.target.value)} className={field} /></label></div><div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"><label className={`${label} block flex-1`}>Notes / Clarifications<textarea disabled={disabled} value={proposal.notes} onChange={(event) => patch('notes', event.target.value)} rows={9} placeholder="Enter Proposal-specific notes and clarifications…" className={area} /></label>{!disabled ? <button type="button" onClick={() => patch('notes', proposalClarifications(proposal))} className="h-9 shrink-0 border border-slate-400 bg-white px-3 text-xs font-bold">Reset to standard wording</button> : null}</div><p className="mt-1 text-[11px] text-slate-500">Standard wording is editable. Structured values update it only until you customize the text.</p><label className={`${label} mt-3 block`}>Standard Tenarten fine print<textarea disabled={disabled} value={proposal.disclaimerSnapshot} onChange={(event) => patch('disclaimerSnapshot', event.target.value)} rows={5} className={area} /></label></div>
    </section>

    <section className={section}><h3 className="text-sm font-bold uppercase tracking-wide">Quote respectfully submitted by</h3><div className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>Name<input disabled={disabled} value={proposal.submittedByName} onChange={(event) => patch('submittedByName', event.target.value)} className={field} /></label><label className={label}>Phone<input disabled={disabled} value={proposal.submittedByPhone} onChange={(event) => patch('submittedByPhone', event.target.value)} className={field} /></label><label className={label}>Email<input type="email" disabled={disabled} value={proposal.submittedByEmail} onChange={(event) => patch('submittedByEmail', event.target.value)} className={field} /></label></div></section>
  </div>;
}
