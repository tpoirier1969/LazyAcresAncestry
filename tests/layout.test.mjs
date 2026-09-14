import assert from 'node:assert/strict';
import { LAYOUT_GAPS, layoutSample } from '../src/layout.js';

const people = [
  { id: 'root', name: 'Root', role: 'root', branch: 'center', birth: { date: '1969' } },
  { id: 'spouse', name: 'Spouse', role: 'spouse', branch: 'center', birth: { date: '1970' } },
  { id: 'sib', name: 'Sibling', role: 'sibling', branch: 'center', birth: { date: '1972' } },
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
close(xGap('root', 'spouse'), LAYOUT_GAPS.COUPLE_GAP, 'couple members must remain adjacent');
assert.ok(xGap('root', 'sib') <= LAYOUT_GAPS.COUPLE_GAP + LAYOUT_GAPS.SIBLING_GAP + 0.05, 'siblings should remain in the same local family block');

assert.ok(LAYOUT_GAPS.COUPLE_GAP >= LAYOUT_GAPS.MIN_PERSON_CLEARANCE);
assert.ok(LAYOUT_GAPS.SIBLING_GAP > LAYOUT_GAPS.COUPLE_GAP);
assert.ok(LAYOUT_GAPS.BETWEEN_FAMILY_GAP > LAYOUT_GAPS.SIBLING_GAP);

for (const person of people) {
  const point = xy(person.id);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${person.id} must receive a finite layout position`);
}

console.log('relationship-driven multi-generation family layout ok');
