import assert from 'node:assert/strict';
import { calculateProposalEstimate, effectiveEstimateAssumptions, validateEstimateAssumptions, validateEstimateInputs } from '../src/modules/proposals/estimate-calculations';
import { proposalEstimateDefaultAssumptions } from '../src/modules/proposals/estimate-defaults';
import { applyEstimateValuesToProposalLine } from '../src/modules/proposals/estimate-to-proposal';
import type { ProposalEstimate, ProposalEstimateInputs } from '../src/modules/proposals/estimate-types';
import type { ProposalLine } from '../src/modules/proposals/types';

const closeTo = (actual: number | null, expected: number, tolerance = 0.0001) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
};

const stIgnacio: ProposalEstimateInputs = {
  geometryProfile: 'flat',
  customerQuantity: 43,
  lengthInches: 48,
  widthInches: 24,
  riserHeightInches: null,
  thicknessInches: 0.375,
  depthInches: null,
  roughLengthInches: 50,
  roughWidthInches: 50,
  roughThicknessInches: 0.5,
  productionQuantityOverride: null,
  finish: '200 grit',
  sealer: 'Plaza Plus',
  resinColor: 'KRC 001 White',
  filler: 'HSF-20',
  colorPlate: 'SW-20-1062 TZ',
  chipBlend: [
    { id: 'china-white', color: 'China White Marble #1', percentage: 90, size: '#1', materialType: 'Marble', vendor: 'KCI', unitCostPerBag: 20 },
    { id: 'mirror', color: 'KCI SA Mirror #1', percentage: 10, size: '#1', materialType: 'Glass', vendor: 'KCI', unitCostPerBag: 45 },
  ],
};

const result = calculateProposalEstimate(stIgnacio, proposalEstimateDefaultAssumptions);
assert.equal(result.calculationVersion, 'proposal-estimate-v2');
assert.equal(result.production.calculatedQuantity, 44, 'yield must round 43 customer pieces to 44 production pieces');
assert.equal(result.production.effectiveQuantity, 44);
assert.equal(result.production.quantitySource, 'calculated');
assert.equal(result.production.slabCount, 22);
closeTo(result.geometry.customerCubicFeet, 10.75);
closeTo(result.geometry.productionCubicFeet, 11);
closeTo(result.geometry.customerLinearFeet, 172);
closeTo(result.geometry.productionLinearFeet, 176);
closeTo(result.geometry.customerEstimatedWeightLb, 1505);
closeTo(result.production.roughSquareFeet, 381.9444444444);
closeTo(result.production.roughCubicFeet, 15.9143518519);
closeTo(result.production.wastePercent, 44.6759259259);
closeTo(result.production.batchCount, 9.0000016128);
closeTo(result.materials.chipPounds, 1800.00032256);
closeTo(result.materials.chipBags, 36.0000064512);
closeTo(result.materials.totalCost, 2611.0074016733);
closeTo(result.freight.totalCost, 701.3392445560);
closeTo(result.labor.totalHours, 63.3498103697);
closeTo(result.labor.totalCost, 3167.4905184867, 0.001);
closeTo(result.shop.totalCost, 1199.8070145783);
closeTo(result.pricing.baseCost, 7679.6441792943, 0.001);
closeTo(result.pricing.totalMarkup, 3071.8576717177, 0.001);
closeTo(result.pricing.repFee, 537.5750925506, 0.001);
// The workbook's $253.56 unit metric omits $90 of chip-blending labor; V2 intentionally restores it, including its 40% labor markup and 5% rep fee ($132.30 total).
closeTo(result.pricing.internalTotal, 11289.0769435627, 0.001);
closeTo(result.pricing.internalCalculatedUnitMetric, 256.5699305355, 0.001);
closeTo(result.pricing.perLinearFoot, 64.1424826339, 0.001);

const overridden = calculateProposalEstimate(
  { ...stIgnacio, productionQuantityOverride: 46 },
  effectiveEstimateAssumptions(proposalEstimateDefaultAssumptions, { materialDensityLbPerCubicFoot: 150 }),
);
assert.equal(overridden.production.effectiveQuantity, 46);
assert.equal(overridden.production.quantitySource, 'override');
closeTo(overridden.geometry.customerEstimatedWeightLb, 1612.5);
assert.equal(proposalEstimateDefaultAssumptions.materialDensityLbPerCubicFoot, 140, 'overrides must not mutate defaults');

const treadRiser = calculateProposalEstimate(
  {
    ...stIgnacio,
    geometryProfile: 'tread_riser',
    customerQuantity: 10,
    widthInches: null,
    depthInches: 12,
    riserHeightInches: 6,
    thicknessInches: 0.5,
  },
  proposalEstimateDefaultAssumptions,
);
closeTo(treadRiser.geometry.developedWidthInches, 18);
closeTo(treadRiser.geometry.customerSquareFeet, 60);
closeTo(treadRiser.geometry.customerCubicFeet, 2.5);

const blank = calculateProposalEstimate(
  { ...stIgnacio, customerQuantity: null, lengthInches: null },
  proposalEstimateDefaultAssumptions,
);
assert.equal(blank.production.effectiveQuantity, null);
assert.equal(blank.geometry.customerCubicFeet, null);
assert.equal(blank.geometry.customerEstimatedWeightLb, null);
assert.equal(blank.pricing.internalCalculatedUnitMetric, null);

const explicitZero = calculateProposalEstimate(
  { ...stIgnacio, customerQuantity: 0, lengthInches: 0, productionQuantityOverride: 0 },
  proposalEstimateDefaultAssumptions,
);
assert.equal(explicitZero.production.calculatedQuantity, 0, 'explicit zero customer quantity must not become unavailable');
assert.equal(explicitZero.production.effectiveQuantity, 0, 'explicit zero production override must remain an override');
assert.equal(explicitZero.production.quantitySource, 'override');
assert.equal(explicitZero.geometry.customerCubicFeet, 0, 'explicit zero geometry must remain distinct from missing geometry');
assert.equal(explicitZero.geometry.productionCubicFeet, 0);
assert.equal(explicitZero.geometry.customerLinearFeet, 0);
assert.equal(explicitZero.production.roughCubicFeet, 0);
assert.equal(explicitZero.production.batchCount, 0);

assert.deepEqual(validateEstimateAssumptions({ ...proposalEstimateDefaultAssumptions, materialDensityLbPerCubicFoot: 0 }), [
  'materialDensityLbPerCubicFoot must be greater than zero.',
]);
assert.deepEqual(validateEstimateInputs({
  ...stIgnacio,
  chipBlend: stIgnacio.chipBlend.map((row) => ({ ...row, percentage: 60 })),
}), ['Chip blend percentages cannot exceed 100%.']);
assert.throws(
  () => calculateProposalEstimate({ ...stIgnacio, roughThicknessInches: -0.5 }, proposalEstimateDefaultAssumptions),
  /roughThicknessInches cannot be negative or invalid/,
);

const estimate: ProposalEstimate = {
  proposalId: 'proposal-1',
  defaultsVersionId: 'defaults-1',
  defaultsVersion: 1,
  calculationVersion: result.calculationVersion,
  defaultAssumptions: proposalEstimateDefaultAssumptions,
  assumptionOverrides: {},
  effectiveAssumptions: proposalEstimateDefaultAssumptions,
  inputs: stIgnacio,
  outputs: result,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
};
const proposalLine: ProposalLine = {
  id: 'line-1', lineType: 'product', itemNumber: '1', description: 'St. Ignacio', ref: '', colorPlate: '',
  quantity: '9', unit: 'ea.', length: '', width: '', heightThickness: '', cft: '', lf: '', estimatedWeight: '',
  rate: '987.65', total: '8888.85', sourceMetadata: {}, displayOrder: 0, geometryProfile: 'none',
  dimensionApplicability: {}, lengthInches: '', widthInches: '', riserHeightInches: '', thicknessInches: '',
  cubicFeet: '', linearFeet: '', estimatedWeightPounds: '',
};
const appliedQuantity = applyEstimateValuesToProposalLine(proposalLine, estimate, 'quantity');
assert.equal(appliedQuantity.quantity, '43', 'Estimate assistance must copy customer quantity, not production quantity');
const appliedDimensions = applyEstimateValuesToProposalLine(appliedQuantity, estimate, 'dimensions');
assert.equal(appliedDimensions.lengthInches, '48');
assert.equal(appliedDimensions.widthInches, '24');
assert.equal(appliedDimensions.thicknessInches, '0.375');
const appliedGeometry = applyEstimateValuesToProposalLine(appliedDimensions, estimate, 'geometry');
assert.equal(appliedGeometry.cubicFeet, '10.75');
assert.equal(appliedGeometry.linearFeet, '172');
const appliedWeight = applyEstimateValuesToProposalLine(appliedGeometry, estimate, 'weight');
assert.equal(appliedWeight.estimatedWeightPounds, '1505');
assert.equal(appliedWeight.rate, proposalLine.rate, 'Estimate assistance must never overwrite Customer Rate');
assert.equal(appliedWeight.total, proposalLine.total, 'Estimate assistance must never copy an internal total');

console.log('Proposal estimating engine golden-fixture checks passed.');
