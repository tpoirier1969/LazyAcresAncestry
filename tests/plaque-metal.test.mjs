import assert from 'node:assert/strict';
import { PLAQUE_METALS, plaqueMetalForSex } from '../src/plaque-metal.js';

assert.equal(plaqueMetalForSex('M').id, 'oil-rubbed-bronze');
assert.equal(plaqueMetalForSex('m').id, 'oil-rubbed-bronze');
assert.equal(plaqueMetalForSex('F').id, 'red-rose-bronze');
assert.equal(plaqueMetalForSex('f').id, 'red-rose-bronze');
assert.equal(plaqueMetalForSex('U').id, 'aged-pewter');
assert.equal(plaqueMetalForSex('').id, 'aged-pewter');
assert.equal(plaqueMetalForSex('X').id, 'aged-pewter');
assert.notEqual(PLAQUE_METALS.M.rule, PLAQUE_METALS.F.rule, 'male and female inner rules should remain visibly distinct');
assert.notEqual(PLAQUE_METALS.F.rule, PLAQUE_METALS.U.rule, 'unknown/unspecified treatment should remain neutral');
assert.ok(PLAQUE_METALS.M.dark < PLAQUE_METALS.M.bright, 'male palette must retain a dark oil-rubbed bronze body with lighter highlights');
assert.ok(PLAQUE_METALS.F.mid !== PLAQUE_METALS.M.mid, 'female palette should be visibly redder than the male bronze');

for (const metal of Object.values(PLAQUE_METALS)) {
  for (const key of ['dark', 'mid', 'light', 'bright', 'edge', 'rule']) {
    assert.ok(metal[key], `${metal.id} must define ${key}`);
  }
}

console.log('plaque metal palettes distinguish oil-rubbed bronze, red rose bronze, and neutral pewter');
