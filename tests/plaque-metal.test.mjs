import assert from 'node:assert/strict';
import { PLAQUE_METALS, plaqueMetalForSex } from '../src/plaque-metal.js';

assert.equal(plaqueMetalForSex('M').id, 'antique-brass');
assert.equal(plaqueMetalForSex('m').id, 'antique-brass');
assert.equal(plaqueMetalForSex('F').id, 'rose-bronze');
assert.equal(plaqueMetalForSex('f').id, 'rose-bronze');
assert.equal(plaqueMetalForSex('U').id, 'aged-pewter');
assert.equal(plaqueMetalForSex('').id, 'aged-pewter');
assert.equal(plaqueMetalForSex('X').id, 'aged-pewter');
assert.notEqual(PLAQUE_METALS.M.rule, PLAQUE_METALS.F.rule, 'male and female inner rules should be visibly distinct');
assert.notEqual(PLAQUE_METALS.F.rule, PLAQUE_METALS.U.rule, 'unknown/unspecified treatment should remain neutral');

for (const metal of Object.values(PLAQUE_METALS)) {
  for (const key of ['dark', 'mid', 'light', 'bright', 'edge', 'rule']) {
    assert.ok(metal[key], `${metal.id} must define ${key}`);
  }
}

console.log('plaque metal palettes distinguish sex with restrained brass, rose bronze, and pewter treatments');
