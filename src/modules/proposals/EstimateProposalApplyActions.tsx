'use client';

import { ArrowRight } from 'lucide-react';
import { applyEstimateValuesToProposalLine, canApplyEstimateGroup, type EstimateApplyGroup } from './estimate-to-proposal';
import type { ProposalEstimate } from './estimate-types';
import type { ProposalLine } from './types';

const actions: Array<{ group: EstimateApplyGroup; label: string }> = [
  { group: 'quantity', label: 'Use Estimate Quantity' },
  { group: 'dimensions', label: 'Use Estimate Dimensions' },
  { group: 'geometry', label: 'Use Estimate Geometry Values' },
  { group: 'weight', label: 'Use Estimate Weight' },
];

export default function EstimateProposalApplyActions({ estimate, line, disabled = false, onApply }: { estimate: ProposalEstimate; line: ProposalLine; disabled?: boolean; onApply(line: ProposalLine, group: EstimateApplyGroup): void }) {
  return <div className="border border-blue-200 bg-blue-50 p-3" data-estimate-proposal-apply-actions>
    <div className="text-[10px] font-bold uppercase tracking-[.12em] text-blue-900">Estimate → Proposal</div>
    <p className="mt-1 text-xs text-slate-600">Copy only the selected customer-facing values into this Proposal line. Proposal values remain editable.</p>
    <div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <button key={action.group} type="button" disabled={disabled || !canApplyEstimateGroup(estimate, action.group)} onClick={() => onApply(applyEstimateValuesToProposalLine(line, estimate, action.group), action.group)} className="inline-flex h-8 items-center gap-1.5 border border-blue-300 bg-white px-2.5 text-[11px] font-bold text-blue-950 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{action.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>)}</div>
    <p className="mt-2 text-[10px] text-slate-500">Internal cost, markups, fees, and pricing metrics are never applied to Customer Rate.</p>
  </div>;
}
