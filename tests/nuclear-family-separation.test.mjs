import assert from 'node:assert/strict';
import { layoutSample } from '../src/layout.js';
import { FAMILY_VIEW_SPACING, spreadFamilyLayout } from '../src/layout-spacing.js';

const radius = 225;
const people = [
  { id: 'HOME', name: 'Home Child', role: 'root', directAncestorDepth: 0, cluster: 'FHOME', birth: { date: '1969' } },
  { id: 'PARENT', name: 'Actual Parent', role: 'parent', directAncestorDepth: 1, cluster: 'FORIGIN', birth: { date: '1940' } },
  { id: 'PARENT_SPOUSE', name: 'Other Actual Parent', role: 'parent', directAncestorDepth: 1, cluster: 'FOTHERORIGIN', birth: { date: '1942' } },
  { id: 'AUNT', name: 'Aunt', role: 'one-step-sibling', cluster: 'FORIGIN', generationHint: 1, birth: { date: '1938' } },
  { id: 'UNCLE', name: 'Uncle', role: 'one-step-spouse', cluster: 'FUNRELATED', generationHint: 1, birth: { date: '1939' } },
  { id: 'COUSIN', name: 'Cousin', role: 'extended-family', cluster: 'FAUNT', generationHint: 0, birth: { date: '1967' } },
  { id: 'GP1', name: 'Grandparent One', role: 'grandparent', directAncestorDepth: 2, cluster: 'FGP', birth: { date: '1910' } },
  { id: 'GP2', name: 'Grandparent Two', role: 'grandparent', directAncestorDepth: 2, cluster: 'FGP', birth: { date: '1912' } },
];

const relationships = [
  { type: 'spouse', from: 'PARENT', to: 'PARENT_SPOUSE', familyId: 'FHOME' },
  { type: 'parent', from: 'PARENT', to: 'HOME', familyId: 'FHOME' },
  { type: 'parent', from: 'PARENT_SPOUSE', to: 'HOME', familyId: 'FHOME' },
  { type: 'spouse', from: 'AUNT', to: 'UNCLE', familyId: 'FAUNT' },
  { type: 'parent', from: 'AUNT', to: 'COUSIN', familyId: 'FAUNT' },
  { type: 'parent', from: 'UNCLE', to: 'COUSIN', familyId: 'FAUNT' },
  { type: 'spouse', from: 'GP1', to: 'GP2', familyId: 'FORIGIN' },
  { type: 'parent', from: 'GP1', to: 'PARENT', familyId: 'FORIGIN' },
  { type: 'parent', from: 'GP2', to: 'PARENT', familyId: 'FORIGIN' },
  { type: 'parent', from: 'GP1', to: 'AUNT', familyId: 'FORIGIN' },
  { type: 'parent', from: 'GP2', to: 'AUNT', familyId: 'FORIGIN' },
];

const base = layoutSample(people, radius, relationships);
const positions = spreadFamilyLayout(base, people, relationships, radius);
const x = id => surfaceXY(positions.get(id), radius).x;

const actualPair = [x('PARENT'), x('PARENT_SPOUSE')].sort((a, b) => a - b);
const collateralPair = [x('AUNT'), x('UNCLE')].sort((a, b) => a - b);
const actualCenter = (actualPair[0] + actualPair[1]) / 2;
const collateralCenter = (collateralPair[0] + collateralPair[1]) / 2;
const homeX = x('HOME');
const cousinX = x('COUSIN');

const pairGap = actualPair[1] < collateralPair[0]
  ? collateralPair[0] - actualPair[1]
  : collateralPair[1] < actualPair[0]
    ? actualPair[0] - collateralPair[1]
    : -1;
assert.ok(
  pairGap >= FAMILY_VIEW_SPACING.FAMILY_BLOCK_GAP - 0.08,
  'a parent couple and an aunt/uncle couple must occupy separate nuclear-family blocks even when the blood relatives are siblings',
);
assert.ok(
  Math.abs(homeX - actualCenter) < Math.abs(homeX - collateralCenter),
  'the child must stay visually under the actual parent couple rather than the aunt/uncle couple',
);
assert.ok(
  Math.abs(cousinX - collateralCenter) < Math.abs(cousinX - actualCenter),
  'the aunt/uncle child must remain under that collateral couple',
);
assert.ok(
  (collateralCenter - actualCenter) * (cousinX - homeX) > 0,
  'parent-family order and child-family order must match so their descent corridors do not cross',
);

function surfaceXY(unit, sphereRadius) {
  const theta = Math.acos(Math.max(-1, Math.min(1, -unit.z)));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-7) return { x: 0, y: 0 };
  const d = sphereRadius * theta;
  return { x: d * unit.x / s, y: d * unit.y / s };
}

console.log('nuclear family separation keeps aunt/uncle branches from reading as a second parent set');
