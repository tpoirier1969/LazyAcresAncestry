import assert from 'node:assert/strict';
import { generationGapForPopulation, layoutSample, LAYOUT_GAPS } from '../src/layout.js';

assert.equal(generationGapForPopulation(44), LAYOUT_GAPS.GENERATION_GAP);
assert.ok(generationGapForPopulation(139) >= 2.7 && generationGapForPopulation(139) < 3.0, '139-person proof tree should keep generations compact enough to avoid large empty vertical bands');
assert.ok(generationGapForPopulation(9099) <= 3.12, 'large trees should not gain large generation gaps merely because more people exist');

const people = [
  { id: 'root', name: 'Root', role: 'root', birth: { date: '1969' } },
  { id: 'spouse', name: 'Spouse', role: 'spouse', birth: { date: '1970' } },
  { id: 'dad', name: 'Dad', role: 'parent', birth: { date: '1940' } },
  { id: 'uncle', name: 'Uncle', role: 'one-step-sibling', generationHint: 1, birth: { date: '1938' } },
  { id: 'mom', name: 'Mom', role: 'parent', birth: { date: '1942' } },
  { id: 'aunt', name: 'Aunt', role: 'one-step-sibling', generationHint: 1, birth: { date: '1944' } },
  { id: 'pgf', name: 'PGF', role: 'grandparent', birth: { date: '1910' } },
  { id: 'pgm', name: 'PGM', role: 'grandparent', birth: { date: '1912' } },
  { id: 'mgf', name: 'MGF', role: 'grandparent', birth: { date: '1911' } },
  { id: 'mgm', name: 'MGM', role: 'grandparent', birth: { date: '1914' } },
];
const relationships = [
  { type: 'spouse', from: 'root', to: 'spouse', familyId: 'FR' },
  { type: 'spouse', from: 'dad', to: 'mom', familyId: 'F0' },
  { type: 'spouse', from: 'pgf', to: 'pgm', familyId: 'FP' },
  { type: 'spouse', from: 'mgf', to: 'mgm', familyId: 'FM' },
  { type: 'parent', from: 'dad', to: 'root', familyId: 'F0' },
  { type: 'parent', from: 'mom', to: 'root', familyId: 'F0' },
  { type: 'parent', from: 'pgf', to: 'dad', familyId: 'FP' },
  { type: 'parent', from: 'pgm', to: 'dad', familyId: 'FP' },
  { type: 'parent', from: 'pgf', to: 'uncle', familyId: 'FP' },
  { type: 'parent', from: 'pgm', to: 'uncle', familyId: 'FP' },
  { type: 'parent', from: 'mgf', to: 'mom', familyId: 'FM' },
  { type: 'parent', from: 'mgm', to: 'mom', familyId: 'FM' },
  { type: 'parent', from: 'mgf', to: 'aunt', familyId: 'FM' },
  { type: 'parent', from: 'mgm', to: 'aunt', familyId: 'FM' },
];

const radius = 225;
const positions = layoutSample(people, radius, relationships);
const inverse = unit => {
  const theta = Math.acos(Math.max(-1, Math.min(1, -unit.z)));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-8) return { x: 0, y: 0 };
  const d = radius * theta;
  return { x: d * unit.x / s, y: d * unit.y / s };
};
const xy = id => inverse(positions.get(id));
const midpoint = ids => ids.reduce((sum, id) => sum + xy(id).x, 0) / ids.length;
const interval = ids => ({ min: Math.min(...ids.map(id => xy(id).x)), max: Math.max(...ids.map(id => xy(id).x)) });

assert.ok(Math.abs(xy('root').x) < 0.02, 'home person is only the final coordinate origin');
assert.ok(Math.abs(xy('dad').y - xy('root').y) < 3.0, 'adjacent generations should not be separated by oversized empty bands');
assert.ok(Math.abs(Math.abs(xy('dad').x - xy('mom').x) - LAYOUT_GAPS.COUPLE_GAP) < 0.03, 'the parents meet as a couple at the boundary of their two origin families');

const paternal = interval(['dad', 'uncle']);
const maternal = interval(['mom', 'aunt']);
assert.ok(paternal.max < maternal.min || maternal.max < paternal.min, 'paternal and maternal sibling families remain distinct blocks instead of interleaving');
assert.ok(Math.abs(midpoint(['pgf', 'pgm']) - midpoint(['dad', 'uncle'])) < LAYOUT_GAPS.BETWEEN_COMPONENT_GAP, 'a parent family remains over its own children');
assert.ok(Math.abs(midpoint(['mgf', 'mgm']) - midpoint(['mom', 'aunt'])) < LAYOUT_GAPS.BETWEEN_COMPONENT_GAP, 'the neighboring parent family remains over its own children');

console.log('relationship topology, not paternal/maternal branch labels, controls family placement');
