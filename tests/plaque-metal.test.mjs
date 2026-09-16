import assert from 'node:assert/strict';
import { PLAQUE_METALS, plaqueMetalForSex } from '../src/plaque-metal.js';

assert.equal(plaqueMetalForSex('M').id, 'oil-rubbed-bronze');
assert.equal(plaqueMetalForSex('m').id, 'oil-rubbed-bronze');
assert.equal(plaqueMetalForSex('F').id, 'rose-bronze');
assert.equal(plaqueMetalForSex('f').id, 'rose-bronze');
assert.equal(plaqueMetalForSex('U').id, 'aged-pewter');
assert.equal(plaqueMetalForSex('').id, 'aged-pewter');
assert.equal(plaqueMetalForSex('X').id, 'aged-pewter');
assert.notEqual(PLAQUE_METALS.M.rule, PLAQUE_METALS.F.rule, 'male and female inner rules should be visibly distinct');
assert.notEqual(PLAQUE_METALS.F.rule, PLAQUE_METALS.U.rule, 'unknown/unspecified treatment should remain neutral');
assert.ok(
  parseInt(PLAQUE_METALS.M.light.slice(1, 3), 16) < parseInt(PLAQUE_METALS.F.light.slice(1, 3), 16),
  'male bronze should remain visibly darker than the warmer female rose bronze',
);
assert.ok(
  parseInt(PLAQUE_METALS.F.mid.slice(1, 3), 16) > parseInt(PLAQUE_METALS.F.mid.slice(3, 5), 16),
  'female midtone should carry a clear red-brown bias',
);

for (const metal of Object.values(PLAQUE_METALS)) {
  for (const key of ['dark', 'mid', 'light', 'bright', 'edge', 'rule']) {
    assert.ok(metal[key], `${metal.id} must define ${key}`);
  }
}

console.log('plaque metal palettes distinguish oil-rubbed bronze, rose bronze, and pewter treatments');
