import assert from 'node:assert/strict';
import { generationGapForPopulation, layoutSample, LAYOUT_GAPS } from '../src/layout.js';

assert.equal(generationGapForPopulation(44), LAYOUT_GAPS.GENERATION_GAP);
assert.ok(generationGapForPopulation(139) > 5, '139-person proof tree needs visibly stronger generation separation');
assert.ok(generationGapForPopulation(9099) <= 9, 'population spacing must remain bounded on the sphere');

const people = [
  { id: 'root', name: 'Root', role: 'root', branch: 'center', directAncestorDepth: 0, birth: { date: '1969' } },
  { id: 'spouse', name: 'Spouse', role: 'spouse', branch: 'center', directAncestorDepth: null, birth: { date: '1970' } },
  { id: 'dad', name: 'Dad', role: 'parent', branch: 'paternal', directAncestorDepth: 1, birth: { date: '1940' } },
  { id: 'mom', name: 'Mom', role: 'parent', branch: 'maternal', directAncestorDepth: 1, birth: { date: '1942' } },
  { id: 'pgf', name: 'PGF', role: 'grandparent', branch: 'paternal', directAncestorDepth: 2, birth: { date: '1910' } },
  { id: 'pgm', name: 'PGM', role: 'grandparent', branch: 'paternal', directAncestorDepth: 2, birth: { date: '1912' } },
  { id: 'mgf', name: 'MGF', role: 'grandparent', branch: 'maternal', directAncestorDepth: 2, birth: { date: '1911' } },
  { id: 'mgm', name: 'MGM', role: 'grandparent', branch: 'maternal', directAncestorDepth: 2, birth: { date: '1914' } },
  { id: 'uncle', name: 'Uncle', role: 'one-step-sibling', branch: 'paternal', generationHint: 1, cluster: 'dad-family', directAncestorDepth: null, birth: { date: '1938' } },
];
const relationships = [
  { type: 'spouse', from: 'root', to: 'spouse' },
  { type: 'spouse', from: 'dad', to: 'mom' },
  { type: 'spouse', from: 'pgf', to: 'pgm' },
  { type: 'spouse', from: 'mgf', to: 'mgm' },
  { type: 'parent', from: 'dad', to: 'root' },
  { type: 'parent', from: 'mom', to: 'root' },
  { type: 'parent', from: 'pgf', to: 'dad' },
  { type: 'parent', from: 'pgm', to: 'dad' },
  { type: 'parent', from: 'mgf', to: 'mom' },
  { type: 'parent', from: 'mgm', to: 'mom' },
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
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;

assert.ok(Math.abs(xy('root').x) < 0.02, 'home person remains the horizontal origin');
assert.ok(Math.abs(average([xy('dad').x, xy('mom').x])) < 0.02, 'direct parents stay centered over the home lineage');
assert.ok(Math.abs(average(['pgf', 'pgm', 'mgf', 'mgm'].map(id => xy(id).x))) < 0.02, 'direct grandparent generation stays centered on the ancestry spine');
assert.ok(((xy('pgf').x + xy('pgm').x) / 2) < ((xy('mgf').x + xy('mgm').x) / 2), 'paternal and maternal grandparent families keep their left-to-right identity');

console.log('direct ancestry spine stays centered while larger proof trees receive stronger generation spacing');