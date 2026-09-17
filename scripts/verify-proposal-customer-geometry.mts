import assert from 'node:assert/strict';
import { calculateProposalCustomerGeometry, proposalCustomerGeometryAvailability } from '../src/modules/proposals/proposal-customer-geometry';
import type { ProposalLine } from '../src/modules/proposals/types';

const line = (changes: Partial<ProposalLine> = {}): ProposalLine => ({
  id: 'line-1', lineType: 'product', itemNumber: '1', description: '', ref: '', colorPlate: '', quantity: '', unit: 'ea.', length: '', width: '', heightThickness: '', cft: '', lf: '', estimatedWeight: '', rate: '987.65', total: '1975.30', sourceMetadata: {}, displayOrder: 0, geometryProfile: 'none', dimensionApplicability: {}, lengthInches: '', widthInches: '', riserHeightInches: '', thicknessInches: '', cubicFeet: '', linearFeet: '', estimatedWeightPounds: '',
  ...changes,
});

const flat = line({
  geometryProfile: 'flat', quantity: '3', lengthInches: '24', widthInches: '12', thicknessInches: '1',
  dimensionApplicability: { length: true, width: true, thickness: true, cubicFeet: true, linearFeet: true, estimatedWeight: true },
});
const flatResult = calculateProposalCustomerGeometry(flat, 140);
assert.equal(flatResult.cubicFeet, '0.5', 'flat CFT must use customer quantity');
assert.equal(flatResult.linearFeet, '6', 'LF must round up from L x customer quantity');
assert.equal(flatResult.estimatedWeightPounds, '70', 'weight must use customer CFT and captured density');
assert.equal(flatResult.rate, flat.rate, 'geometry calculation must not change Customer Rate');
assert.equal(flatResult.total, flat.total, 'pure geometry calculation must not change the stored Total');

const tread = line({
  geometryProfile: 'tread_riser', quantity: '5', lengthInches: '36', riserHeightInches: '7', thicknessInches: '1', cubicFeet: '2.5',
  dimensionApplicability: { length: true, riserHeight: true, thickness: true, cubicFeet: true, linearFeet: true, estimatedWeight: true },
});
const treadResult = calculateProposalCustomerGeometry(tread, 140);
assert.equal(treadResult.cubicFeet, '2.5', 'tread/riser CFT must remain independently authored when Depth and Riser Height are selectively applicable');
assert.equal(treadResult.linearFeet, '15', 'tread/riser LF may use the unambiguous L x customer quantity rule');
assert.equal(treadResult.estimatedWeightPounds, '350', 'authored tread/riser CFT may drive weight');

const missing = line({
  geometryProfile: 'flat', quantity: '', lengthInches: '24', widthInches: '12', thicknessInches: '1', cubicFeet: 'keep-cft', linearFeet: 'keep-lf', estimatedWeightPounds: 'keep-weight',
  dimensionApplicability: { length: true, width: true, thickness: true, cubicFeet: true, linearFeet: true, estimatedWeight: true },
});
assert.deepEqual(calculateProposalCustomerGeometry(missing, 140), missing, 'missing prerequisites must leave authored values unchanged');

const zero = line({
  geometryProfile: 'flat', quantity: '0', lengthInches: '24', widthInches: '12', thicknessInches: '1',
  dimensionApplicability: { length: true, width: true, thickness: true, cubicFeet: true, linearFeet: true, estimatedWeight: true },
});
const zeroResult = calculateProposalCustomerGeometry(zero, 140);
assert.equal(zeroResult.cubicFeet, '0', 'explicit zero must remain distinct from blank');
assert.equal(zeroResult.linearFeet, '0', 'explicit zero customer quantity must produce zero LF');
assert.equal(zeroResult.estimatedWeightPounds, '0', 'explicit zero CFT must produce zero weight');

const selective = line({ geometryProfile: 'flat', quantity: '3', lengthInches: '24', widthInches: '12', thicknessInches: '1', cubicFeet: 'manual', linearFeet: 'manual', estimatedWeightPounds: 'manual', dimensionApplicability: { length: true, width: true, thickness: true } });
assert.deepEqual(proposalCustomerGeometryAvailability(selective, 140), { cubicFeet: false, linearFeet: false, estimatedWeight: false }, 'non-applicable output fields must not be populated');
assert.deepEqual(calculateProposalCustomerGeometry(selective, 140), selective, 'non-applicable output values must remain untouched');

console.log('Proposal customer geometry verifier: PASS');
