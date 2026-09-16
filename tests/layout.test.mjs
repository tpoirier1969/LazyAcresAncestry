import assert from 'node:assert/strict';
import { LAYOUT_GAPS, layoutSample } from '../src/layout.js';

const people = [
  { id: 'root', name: 'Root', role: 'root', birth: { date: '1969' } },
  { id: 'spouse', name: 'Spouse', role: 'spouse', birth: { date: '1970' } },
  { id: 'sib', name: 'Sibling', role: 'sibling', birth: { date: '1972' } },
  { id: 'sibchild', name: 'Sibling Child', role: 'sibling-descendant', birth: { date: '1999' } },
  { id: 'dad', name: 'Dad', role: 'parent', birth: { date: '1940' } },
  { id: 'dadSib', name: 'Dad Sibling', role: 'one-step-sibling', generationHint: 1, birth: { date: '1938' } },
  { id: 'mom', name: 'Mom', role: 'parent', birth: { date: '1942' } },
  { id: 'momSib', name: 'Mom Sibling', role: 'one-step-sibling', generationHint: 1, birth: { date: '1944' } },
  { id: 'pgf', name: 'Paternal Grandfather', role: 'grandparent', birth: { date: '1910' } },
  { id: 'pgm', name: 'Paternal Grandmother', role: 'grandparent', birth: { date: '1912' } },
  { id: 'mgf', name: 'Maternal Grandfather', role: 'grandparent', birth: { date: '1911' } },
  { id: 'mgm', name: 'Maternal Grandmother', role: 'grandparent', birth: { date: '1914' } },
  { id: 'pggf', name: 'Paternal Great Grandfather', role: 'great-grandparent', cluster: 'O1', birth: { date: '1880' } },
  { id: 'pggm', name: 'Paternal Great Grandmother', role: 'great-grandparent', cluster: 'O2', birth: { date: '1882' } },
  { id: 'cousinParent', name: 'Grandparent Sibling', role: 'grandparent-sibling', birth: { date: '1908' } },
  { id: 'cousin', name: 'Cousin Parent', role: 'one-step-spouse', generationHint: 1, birth: { date: '1935' } },
  { id: 'cousin2', name: 'Cousin', role: 'one-step-sibling', generationHint: 0, birth: { date: '1966' } },
];

const relationships = [
  { type: 'spouse', from: 'root', to: 'spouse', familyId: 'Froot' },
  { type: 'spouse', from: 'dad', to: 'mom', familyId: 'F0' },
  { type: 'spouse', from: 'pgf', to: 'pgm', familyId: 'Fp' },
  { type: 'spouse', from: 'mgf', to: 'mgm', familyId: 'Fm' },
  { type: 'spouse', from: 'pggf', to: 'pggm', familyId: 'Fpg' },
  { type: 'parent', from: 'dad', to: 'root', familyId: 'F0' },
  { type: 'parent', from: 'mom', to: 'root', familyId: 'F0' },
  { type: 'parent', from: 'dad', to: 'sib', familyId: 'F0' },
  { type: 'parent', from: 'mom', to: 'sib', familyId: 'F0' },
  { type: 'parent', from: 'sib', to: 'sibchild', familyId: 'Fsib' },
  { type: 'parent', from: 'pgf', to: 'dad', familyId: 'Fp' },
  { type: 'parent', from: 'pgm', to: 'dad', familyId: 'Fp' },
  { type: 'parent', from: 'pgf', to: 'dadSib', familyId: 'Fp' },
  { type: 'parent', from: 'pgm', to: 'dadSib', familyId: 'Fp' },
  { type: 'parent', from: 'mgf', to: 'mom', familyId: 'Fm' },
  { type: 'parent', from: 'mgm', to: 'mom', familyId: 'Fm' },
  { type: 'parent', from: 'mgf', to: 'momSib', familyId: 'Fm' },
  { type: 'parent', from: 'mgm', to: 'momSib', familyId: 'Fm' },
  { type: 'parent', from: 'pggf', to: 'pgf', familyId: 'Fpg' },
  { type: 'parent', from: 'pggm', to: 'pgf', familyId: 'Fpg' },
  { type: 'parent', from: 'pggf', to: 'cousinParent', familyId: 'Fpg' },
  { type: 'parent', from: 'pggm', to: 'cousinParent', familyId: 'Fpg' },
  { type: 'parent', from: 'cousinParent', to: 'cousin', familyId: 'Fc1' },
  { type: 'parent', from: 'cousin', to: 'cousin2', familyId: 'Fc2' },
];

const radius = 225;
const positions = layoutSample(people, radius, relationships);
assert.equal(positions.size, people.length);

const inverse = unit => {
  const theta = Math.acos(Math.max(-1, Math.min(1, -unit.z)));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-8) return { x: 0, y: 0 };
  const d = radius * theta;
  return { x: d * unit.x / s, y: d * unit.y / s };
};
const xy = id => inverse(positions.get(id));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.03, `${message}: ${actual} vs ${expected}`);
const xGap = (a, b) => Math.abs(xy(a).x - xy(b).x);
const interval = ids => ({
  min: Math.min(...ids.map(id => xy(id).x)),
  max: Math.max(...ids.map(id => xy(id).x)),
});

close(xy('root').x, 0, 'home person is only the final horizontal coordinate origin');
close(xy('root').y, 0, 'home person is only the final vertical coordinate origin');
close(xy('dad').y - xy('root').y, LAYOUT_GAPS.GENERATION_GAP, 'root-to-parent generation gap');
close(xy('pgf').y - xy('dad').y, LAYOUT_GAPS.GENERATION_GAP, 'parent-to-grandparent generation gap');
close(xy('pggf').y - xy('pgf').y, LAYOUT_GAPS.GENERATION_GAP, 'grandparent-to-great-grandparent generation gap');
close(xy('cousinParent').y, xy('pgf').y, 'siblings remain in the same generation');
close(xy('cousin').y, xy('dad').y, 'collateral descendants align by recorded parent relationships');
close(xy('cousin2').y, xy('root').y, 'next collateral generation aligns naturally');
close(xy('sibchild').y, -LAYOUT_GAPS.GENERATION_GAP, 'a sibling child sits one generation below the root');

const paternal = interval(['dad', 'dadSib']);
const maternal = interval(['mom', 'momSib']);
assert.ok(
  paternal.max < maternal.min || maternal.max < paternal.min,
  'children from two different parent families must occupy separate contiguous family blocks instead of interleaving',
);
close(xGap('dad', 'mom'), LAYOUT_GAPS.COUPLE_GAP, 'spouses from different family-of-origin blocks meet at the boundary between those families');
assert.ok(xGap('dad', 'dadSib') <= LAYOUT_GAPS.SIBLING_GAP + 0.03, 'siblings remain contiguous inside their family-of-origin block');
assert.ok(xGap('mom', 'momSib') <= LAYOUT_GAPS.SIBLING_GAP + 0.03, 'the neighboring spouse family remains contiguous too');

const rootFamily = interval(['root', 'sib']);
assert.ok(rootFamily.max - rootFamily.min <= LAYOUT_GAPS.SIBLING_GAP + 0.03, 'children of one GEDCOM family remain one local sibling block');
assert.ok(xGap('root', 'spouse') <= LAYOUT_GAPS.COUPLE_GAP + 0.03, 'a spouse joins at the outside edge of the root family block');
assert.ok(Math.abs(xy('sibchild').x - xy('sib').x) < LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'a child remains beneath its actual parent family');

assert.ok(LAYOUT_GAPS.COUPLE_GAP >= LAYOUT_GAPS.MIN_PERSON_CLEARANCE);
assert.ok(LAYOUT_GAPS.SIBLING_GAP > LAYOUT_GAPS.COUPLE_GAP);
assert.ok(LAYOUT_GAPS.BETWEEN_FAMILY_GAP > LAYOUT_GAPS.SIBLING_GAP);
assert.ok(LAYOUT_GAPS.BETWEEN_COMPONENT_GAP > LAYOUT_GAPS.BETWEEN_FAMILY_GAP);

for (const person of people) {
  const point = xy(person.id);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${person.id} must receive a finite layout position`);
}

console.log('family-topology layout keeps sibling families contiguous and places married families beside one another');
