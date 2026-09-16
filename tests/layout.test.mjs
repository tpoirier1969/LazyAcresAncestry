import assert from 'node:assert/strict';
import { LAYOUT_GAPS, layoutSample } from '../src/layout.js';

const people = [
  { id: 'root', name: 'Root', role: 'root', branch: 'center', birth: { date: '1969' } },
  { id: 'spouse', name: 'Spouse', role: 'spouse', branch: 'center', birth: { date: '1970' } },
  { id: 'sib', name: 'Sibling', role: 'sibling', branch: 'center', birth: { date: '1972' } },
  { id: 'sibchild', name: 'Sibling Child', role: 'extended-family', branch: 'center', birth: { date: '1999' } },
  { id: 'dad', name: 'Dad', role: 'parent', branch: 'paternal', birth: { date: '1940' } },
  { id: 'mom', name: 'Mom', role: 'parent', branch: 'maternal', birth: { date: '1942' } },
  { id: 'pgf', name: 'Paternal Grandfather', role: 'grandparent', branch: 'paternal', birth: { date: '1910' } },
  { id: 'pgm', name: 'Paternal Grandmother', role: 'grandparent', branch: 'paternal', birth: { date: '1912' } },
  { id: 'mgf', name: 'Maternal Grandfather', role: 'grandparent', branch: 'maternal', birth: { date: '1911' } },
  { id: 'mgm', name: 'Maternal Grandmother', role: 'grandparent', branch: 'maternal', birth: { date: '1914' } },
  { id: 'pggf', name: 'Paternal Great Grandfather', role: 'great-grandparent', branch: 'paternal', birth: { date: '1880' } },
  { id: 'pggm', name: 'Paternal Great Grandmother', role: 'great-grandparent', branch: 'paternal', birth: { date: '1882' } },
  { id: 'cousinParent', name: 'Grandparent Sibling', role: 'grandparent-sibling', branch: 'paternal', birth: { date: '1908' } },
  { id: 'cousin', name: 'Cousin Parent', role: 'extended-family', branch: 'paternal', birth: { date: '1935' } },
  { id: 'cousin2', name: 'Cousin', role: 'extended-family', branch: 'paternal', birth: { date: '1966' } },
];

const relationships = [
  { type: 'spouse', from: 'root', to: 'spouse' },
  { type: 'spouse', from: 'dad', to: 'mom' },
  { type: 'spouse', from: 'pgf', to: 'pgm' },
  { type: 'spouse', from: 'mgf', to: 'mgm' },
  { type: 'spouse', from: 'pggf', to: 'pggm' },
  { type: 'parent', from: 'dad', to: 'root' },
  { type: 'parent', from: 'mom', to: 'root' },
  { type: 'parent', from: 'dad', to: 'sib' },
  { type: 'parent', from: 'mom', to: 'sib' },
  { type: 'parent', from: 'sib', to: 'sibchild' },
  { type: 'parent', from: 'pgf', to: 'dad' },
  { type: 'parent', from: 'pgm', to: 'dad' },
  { type: 'parent', from: 'mgf', to: 'mom' },
  { type: 'parent', from: 'mgm', to: 'mom' },
  { type: 'parent', from: 'pggf', to: 'pgf' },
  { type: 'parent', from: 'pggm', to: 'pgf' },
  { type: 'parent', from: 'pggf', to: 'cousinParent' },
  { type: 'parent', from: 'pggm', to: 'cousinParent' },
  { type: 'parent', from: 'cousinParent', to: 'cousin' },
  { type: 'parent', from: 'cousin', to: 'cousin2' },
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
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.02, `${message}: ${actual} vs ${expected}`);
const xGap = (a, b) => Math.abs(xy(a).x - xy(b).x);

close(xy('root').x, 0, 'root must remain horizontal layout origin');
close(xy('root').y, 0, 'root must remain generation zero');
close(xy('dad').y - xy('root').y, LAYOUT_GAPS.GENERATION_GAP, 'root-to-parent generation gap');
close(xy('pgf').y - xy('dad').y, LAYOUT_GAPS.GENERATION_GAP, 'parent-to-grandparent generation gap');
close(xy('pggf').y - xy('pgf').y, LAYOUT_GAPS.GENERATION_GAP, 'grandparent-to-great-grandparent generation gap');
close(xy('cousinParent').y, xy('pgf').y, 'grandparent siblings must share a generation');
close(xy('cousin').y, xy('dad').y, 'descendant of grandparent sibling must align with parent generation');
close(xy('cousin2').y, xy('root').y, 'next cousin generation must align with root generation');
close(xy('sibchild').y, -LAYOUT_GAPS.GENERATION_GAP, 'a sibling child must sit one generation below the root');
close(xGap('root', 'spouse'), LAYOUT_GAPS.COUPLE_GAP, 'couple members must remain adjacent');
assert.ok(xGap('root', 'sib') <= LAYOUT_GAPS.COUPLE_GAP + LAYOUT_GAPS.SIBLING_GAP + 0.05, 'siblings should remain in the same local family block');
assert.ok(Math.abs(xy('sibchild').x - xy('sib').x) < LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'a child must stay beneath its actual parent rather than a generation-wide rail');

const parentMidpoint = (xy('dad').x + xy('mom').x) / 2;
const siblingMidpoint = (xy('root').x + xy('sib').x) / 2;
assert.ok(Math.abs(parentMidpoint - siblingMidpoint) < LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'parents should remain centered above their recorded sibling family');
assert.ok(Math.abs(((xy('pgf').x + xy('pgm').x) / 2) - xy('dad').x) < LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'paternal grandparents should stay over the paternal parent');
assert.ok(Math.abs(((xy('mgf').x + xy('mgm').x) / 2) - xy('mom').x) < LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'maternal grandparents should stay over the maternal parent');

assert.ok(LAYOUT_GAPS.COUPLE_GAP >= LAYOUT_GAPS.MIN_PERSON_CLEARANCE);
assert.ok(LAYOUT_GAPS.SIBLING_GAP > LAYOUT_GAPS.COUPLE_GAP);
assert.ok(LAYOUT_GAPS.BETWEEN_FAMILY_GAP > LAYOUT_GAPS.SIBLING_GAP);
assert.ok(LAYOUT_GAPS.GENERATION_GAP > LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'generation separation must read more strongly than within-row family spacing');

for (const person of people) {
  const point = xy(person.id);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${person.id} must receive a finite layout position`);
}

const multiFamilyPeople = [
  { id: 'C1', name: 'Child One', role: 'root', branch: 'center', birth: { date: '1969' } },
  { id: 'C2', name: 'Child Two', role: 'sibling', branch: 'center', birth: { date: '1971' } },
  { id: 'C3', name: 'Child Three', role: 'sibling', branch: 'center', birth: { date: '1973' } },
  { id: 'C4', name: 'Child Four', role: 'sibling', branch: 'center', birth: { date: '1975' } },
  { id: 'A', name: 'Shared Parent', role: 'parent', branch: 'center', birth: { date: '1940' } },
  { id: 'B', name: 'First Spouse', role: 'parent', branch: 'center', birth: { date: '1941' } },
  { id: 'D', name: 'Second Spouse', role: 'parent', branch: 'center', birth: { date: '1942' } },
];
const multiFamilyRelationships = [
  { type: 'spouse', from: 'A', to: 'B', familyId: 'F1' },
  { type: 'parent', from: 'A', to: 'C1', familyId: 'F1' },
  { type: 'parent', from: 'B', to: 'C1', familyId: 'F1' },
  { type: 'parent', from: 'A', to: 'C2', familyId: 'F1' },
  { type: 'parent', from: 'B', to: 'C2', familyId: 'F1' },
  { type: 'spouse', from: 'A', to: 'D', familyId: 'F2' },
  { type: 'parent', from: 'A', to: 'C3', familyId: 'F2' },
  { type: 'parent', from: 'D', to: 'C3', familyId: 'F2' },
  { type: 'parent', from: 'A', to: 'C4', familyId: 'F2' },
  { type: 'parent', from: 'D', to: 'C4', familyId: 'F2' },
];
const multiPositions = layoutSample(multiFamilyPeople, radius, multiFamilyRelationships);
const multiXY = id => inverse(multiPositions.get(id));
const familyRange = ids => {
  const xs = ids.map(id => multiXY(id).x).sort((a, b) => a - b);
  return { min: xs[0], max: xs[xs.length - 1] };
};
const family1 = familyRange(['C1', 'C2']);
const family2 = familyRange(['C3', 'C4']);
const familyGap = family1.max < family2.min
  ? family2.min - family1.max
  : family2.max < family1.min
    ? family1.min - family2.max
    : -1;
assert.ok(familyGap >= LAYOUT_GAPS.BETWEEN_FAMILY_GAP - 0.05, 'children from two GEDCOM families sharing a parent must remain separate contiguous family blocks');
close(Math.abs(multiXY('C1').x - multiXY('C2').x), LAYOUT_GAPS.SIBLING_GAP, 'siblings in F1 should use sibling spacing');
close(Math.abs(multiXY('C3').x - multiXY('C4').x), LAYOUT_GAPS.SIBLING_GAP, 'siblings in F2 should use sibling spacing');

const collateralPeople = [
  { id: 'HOME', name: 'Home', role: 'root', branch: 'center', directAncestorDepth: 0, birth: { date: '1969' } },
  { id: 'DAD', name: 'Dad', role: 'parent', branch: 'paternal', directAncestorDepth: 1, birth: { date: '1940' } },
  { id: 'MOM', name: 'Mom', role: 'parent', branch: 'maternal', directAncestorDepth: 1, birth: { date: '1942' } },
  { id: 'UNCLE', name: 'Collateral Parent', role: 'one-step-sibling', branch: 'paternal', generationHint: 1, cluster: 'FOLDER', birth: { date: '1937' } },
  { id: 'AUNT', name: 'Collateral Spouse', role: 'one-step-spouse', branch: 'paternal', generationHint: 1, birth: { date: '1942' } },
  { id: 'CHILD', name: 'Collateral Child', role: 'one-step-child', branch: 'paternal', generationHint: 0, cluster: 'FCOLL', birth: { date: '1965' } },
  { id: 'NEIGHBOR', name: 'Neighboring Cousin', role: 'one-step-child', branch: 'paternal', generationHint: 0, cluster: 'FOTHER', birth: { date: '1967' } },
];
const collateralRelationships = [
  { type: 'spouse', from: 'DAD', to: 'MOM', familyId: 'FHOME' },
  { type: 'parent', from: 'DAD', to: 'HOME', familyId: 'FHOME' },
  { type: 'parent', from: 'MOM', to: 'HOME', familyId: 'FHOME' },
  { type: 'spouse', from: 'UNCLE', to: 'AUNT', familyId: 'FCOLL' },
  { type: 'parent', from: 'UNCLE', to: 'CHILD', familyId: 'FCOLL' },
  { type: 'parent', from: 'AUNT', to: 'CHILD', familyId: 'FCOLL' },
];
const collateralPositions = layoutSample(collateralPeople, radius, collateralRelationships);
const collateralXY = id => inverse(collateralPositions.get(id));
const collateralParentMidpoint = (collateralXY('UNCLE').x + collateralXY('AUNT').x) / 2;
assert.ok(
  Math.abs(collateralParentMidpoint - collateralXY('CHILD').x) < 0.08,
  'centering the direct ancestry spine must not pull a collateral single-child family away from its parents',
);
assert.ok(
  Math.abs((collateralXY('DAD').x + collateralXY('MOM').x) / 2) < 0.02,
  'direct parents should remain centered on the home ancestry spine without moving collateral families',
);

console.log('GEDCOM family-block layout preserves separate families and centered collateral single-child descents');
