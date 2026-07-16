import assert from 'node:assert/strict';
import {
  normalizeNullableNumber,
  productionValuesEqual,
} from '../src/modules/production/update-normalization.ts';

const cases = [
  [null, '', true],
  [null, '   ', true],
  [null, null, true],
  [0, '0', true],
  [1750, '1750', true],
  [1750, '1750.0', true],
  [1750, '', false],
  [1750, 'invalid', false],
];

for (const [persisted, draft, expected] of cases) {
  assert.equal(
    productionValuesEqual('estimated_man_hours', persisted, draft),
    expected,
    `${String(persisted)} and ${JSON.stringify(draft)} equivalence`,
  );
}

assert.deepEqual(normalizeNullableNumber('invalid'), { valid: false, value: null });
assert.equal(productionValuesEqual('customer', 'Ector County', 'Ector County'), true);
assert.equal(productionValuesEqual('production_status', 'on_deck', 'on_deck'), true);
assert.equal(productionValuesEqual('estimated_man_hours', 1750, '1751'), false);

let updaterCalls = 0;
let auditCalls = 0;
const maybePersist = (field, previous, next) => {
  if (productionValuesEqual(field, previous, next)) return;
  updaterCalls += 1;
  auditCalls += 1;
};
maybePersist('estimated_man_hours', null, '');
assert.equal(updaterCalls, 0);
assert.equal(auditCalls, 0);

console.log('Production update normalization checks passed.');
