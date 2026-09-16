import assert from 'node:assert/strict';
import { tangentPoint } from '../src/geometry.js';
import { FAMILY_VIEW_SPACING, spreadFamilyLayout } from '../src/layout-spacing.js';

const radius = 225;
const people = [
  { id: 'C1', name: 'Child One', cluster: 'F0' },
  { id: 'S1', name: 'Spouse One', role: 'one-step-spouse' },
  { id: 'U1', name: 'Other Child', cluster: 'F9' },
  { id: 'SU', name: 'Other Spouse', role: 'one-step-spouse' },
  { id: 'C2', name: 'Child Two', cluster: 'F0' },
  { id: 'S2', name: 'Spouse Two', role: 'one-step-spouse' },
];
const relationships = [
  { type: 'spouse', from: 'C1', to: 'S1', familyId: 'FC1' },
  { type: 'spouse', from: 'U1', to: 'SU', familyId: 'FU1' },
  { type: 'spouse', from: 'C2', to: 'S2', familyId: 'FC2' },
];
const xs = new Map([
  ['C1', -2.0], ['S1', -1.8],
  ['U1', -1.0], ['SU', -0.8],
  ['C2', 0.0], ['S2', 0.2],
]);
const positions = new Map([...xs].map(([id, x]) => [id, tangentPoint(x, 0, radius)]));
const spread = spreadFamilyLayout(positions, people, relationships, radius);
const recovered = new Map([...spread].map(([id, unit]) => [id, surfaceX(unit, radius)]));

const f0 = ['C1', 'S1', 'C2', 'S2'].map(id => recovered.get(id)).sort((a, b) => a - b);
const f9 = ['U1', 'SU'].map(id => recovered.get(id)).sort((a, b) => a - b);
const separated = f0[f0.length - 1] < f9[0] || f9[f9.length - 1] < f0[0];
assert.equal(separated, true, 'separate origin families should occupy contiguous non-interleaving blocks');

const ordered = [...recovered.values()].sort((a, b) => a - b);
for (let i = 1; i < ordered.length; i += 1) {
  assert.ok(
    ordered[i] - ordered[i - 1] >= FAMILY_VIEW_SPACING.MIN_PERSON_GAP - 1e-6,
    'people on one generation row should keep the minimum physical clearance',
  );
}

function surfaceX(unit, sphereRadius) {
  const theta = Math.acos(Math.max(-1, Math.min(1, -unit.z)));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-7) return 0;
  return sphereRadius * theta * unit.x / s;
}

console.log('family-aware layout spacing regression passed');
