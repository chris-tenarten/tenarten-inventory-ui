import type { ProposalEstimate } from './estimate-types';
import type { ProposalDimensionApplicability, ProposalLine } from './types';

export type EstimateApplyGroup = 'quantity' | 'dimensions' | 'geometry' | 'weight';

const text = (value: number) => String(Number(value.toFixed(6)));

function evidence(line: ProposalLine, estimate: ProposalEstimate, group: EstimateApplyGroup) {
  const existing = line.sourceMetadata.estimateAppliedValues && typeof line.sourceMetadata.estimateAppliedValues === 'object'
    ? line.sourceMetadata.estimateAppliedValues as Record<string, unknown>
    : {};
  return {
    ...line.sourceMetadata,
    estimateAppliedValues: {
      ...existing,
      [group]: {
        proposalId: estimate.proposalId,
        calculationVersion: estimate.calculationVersion,
        defaultsVersion: estimate.defaultsVersion,
        estimateUpdatedAt: estimate.updatedAt,
      },
    },
  };
}

/**
 * Copies only explicitly selected customer-facing geometry from an Estimate.
 * This allowlist intentionally has no Rate, cost, markup, rep-fee, or pricing path.
 */
export function applyEstimateValuesToProposalLine(line: ProposalLine, estimate: ProposalEstimate, group: EstimateApplyGroup): ProposalLine {
  if (group === 'quantity') {
    const customerQuantity = estimate.inputs.customerQuantity;
    return customerQuantity === null ? line : { ...line, quantity: text(customerQuantity), sourceMetadata: evidence(line, estimate, group) };
  }
  if (group === 'dimensions') {
    const inputs = estimate.inputs;
    const applicability: ProposalDimensionApplicability = {
      length: inputs.lengthInches !== null,
      width: inputs.geometryProfile !== 'tread_riser' && inputs.widthInches !== null,
      riserHeight: inputs.geometryProfile !== 'flat' && inputs.riserHeightInches !== null,
      thickness: inputs.thicknessInches !== null,
    };
    return {
      ...line,
      geometryProfile: inputs.geometryProfile,
      dimensionApplicability: { ...line.dimensionApplicability, ...applicability },
      lengthInches: inputs.lengthInches === null ? '' : text(inputs.lengthInches),
      widthInches: applicability.width && inputs.widthInches !== null ? text(inputs.widthInches) : '',
      riserHeightInches: applicability.riserHeight && inputs.riserHeightInches !== null ? text(inputs.riserHeightInches) : '',
      thicknessInches: inputs.thicknessInches === null ? '' : text(inputs.thicknessInches),
      sourceMetadata: evidence(line, estimate, group),
    };
  }
  if (group === 'geometry') {
    const { customerCubicFeet, customerLinearFeet } = estimate.outputs.geometry;
    return {
      ...line,
      geometryProfile: !line.geometryProfile || line.geometryProfile === 'none' ? 'custom' : line.geometryProfile,
      dimensionApplicability: { ...line.dimensionApplicability, cubicFeet: customerCubicFeet !== null, linearFeet: customerLinearFeet !== null },
      cubicFeet: customerCubicFeet === null ? '' : text(customerCubicFeet),
      linearFeet: customerLinearFeet === null ? '' : text(customerLinearFeet),
      sourceMetadata: evidence(line, estimate, group),
    };
  }
  const customerWeight = estimate.outputs.geometry.customerEstimatedWeightLb;
  return customerWeight === null ? line : {
    ...line,
    geometryProfile: !line.geometryProfile || line.geometryProfile === 'none' ? 'custom' : line.geometryProfile,
    dimensionApplicability: { ...line.dimensionApplicability, estimatedWeight: true },
    estimatedWeightPounds: text(customerWeight),
    sourceMetadata: evidence(line, estimate, group),
  };
}

export function canApplyEstimateGroup(estimate: ProposalEstimate, group: EstimateApplyGroup) {
  if (group === 'quantity') return estimate.inputs.customerQuantity !== null;
  if (group === 'dimensions') return [estimate.inputs.lengthInches, estimate.inputs.widthInches, estimate.inputs.riserHeightInches, estimate.inputs.thicknessInches].some((value) => value !== null);
  if (group === 'geometry') return estimate.outputs.geometry.customerCubicFeet !== null || estimate.outputs.geometry.customerLinearFeet !== null;
  return estimate.outputs.geometry.customerEstimatedWeightLb !== null;
}
