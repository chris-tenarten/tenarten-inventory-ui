import type { ProposalLine } from './types';

const finiteNonnegative = (value: string | undefined) => {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalized = (value: number) => String(Number(value.toFixed(6)));

export type ProposalCustomerGeometryAvailability = {
  cubicFeet: boolean;
  linearFeet: boolean;
  estimatedWeight: boolean;
};

export function proposalCustomerGeometryAvailability(line: ProposalLine, densityLbPerCubicFoot: number | null): ProposalCustomerGeometryAvailability {
  const applicability = line.dimensionApplicability ?? {};
  const quantity = finiteNonnegative(line.quantity);
  const length = finiteNonnegative(line.lengthInches);
  const width = finiteNonnegative(line.widthInches);
  const thickness = finiteNonnegative(line.thicknessInches);
  const authoredCubicFeet = finiteNonnegative(line.cubicFeet);
  const canCalculateCubicFeet = line.geometryProfile === 'flat'
    && Boolean(applicability.cubicFeet)
    && Boolean(applicability.length)
    && Boolean(applicability.width)
    && Boolean(applicability.thickness)
    && quantity !== null && length !== null && width !== null && thickness !== null;
  const canCalculateLinearFeet = line.geometryProfile !== 'none'
    && Boolean(applicability.linearFeet)
    && Boolean(applicability.length)
    && quantity !== null && length !== null;
  const calculatedCubicFeet = canCalculateCubicFeet ? length! * width! * thickness! * quantity! / 1728 : null;
  const cubicFeetForWeight = calculatedCubicFeet ?? authoredCubicFeet;
  const canCalculateWeight = Boolean(applicability.estimatedWeight)
    && Boolean(applicability.cubicFeet)
    && cubicFeetForWeight !== null
    && densityLbPerCubicFoot !== null
    && Number.isFinite(densityLbPerCubicFoot)
    && densityLbPerCubicFoot >= 0;
  return { cubicFeet: canCalculateCubicFeet, linearFeet: canCalculateLinearFeet, estimatedWeight: canCalculateWeight };
}

/**
 * Deliberately calculates only customer-facing geometry selected for this Proposal line.
 * It never reads Estimate quantity/production output and has no Rate or internal-pricing path.
 */
export function calculateProposalCustomerGeometry(line: ProposalLine, densityLbPerCubicFoot: number | null): ProposalLine {
  const availability = proposalCustomerGeometryAvailability(line, densityLbPerCubicFoot);
  const quantity = finiteNonnegative(line.quantity);
  const length = finiteNonnegative(line.lengthInches);
  const width = finiteNonnegative(line.widthInches);
  const thickness = finiteNonnegative(line.thicknessInches);
  const calculatedCubicFeet = availability.cubicFeet
    ? length! * width! * thickness! * quantity! / 1728
    : null;
  const cubicFeetForWeight = calculatedCubicFeet ?? finiteNonnegative(line.cubicFeet);
  return {
    ...line,
    cubicFeet: calculatedCubicFeet === null ? line.cubicFeet : normalized(calculatedCubicFeet),
    linearFeet: availability.linearFeet ? normalized(Math.ceil(length! * quantity! / 12)) : line.linearFeet,
    estimatedWeightPounds: availability.estimatedWeight && cubicFeetForWeight !== null && densityLbPerCubicFoot !== null
      ? normalized(cubicFeetForWeight * densityLbPerCubicFoot)
      : line.estimatedWeightPounds,
  };
}
