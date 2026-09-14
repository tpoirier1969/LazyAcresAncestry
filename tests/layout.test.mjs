import assert from 'node:assert/strict';
import { LAYOUT_GAPS, layoutSample } from '../src/layout.js';

const people = [
  {id:'root',role:'root',branch:'center'},
  {id:'spouse',role:'spouse',branch:'center'},
  {id:'sib',role:'sibling',branch:'center'},
  {id:'dad',role:'parent',branch:'paternal'},
  {id:'mom',role:'parent',branch:'maternal'},
  {id:'pgf',role:'grandparent',branch:'paternal',cluster:'p0'},
  {id:'pgm',role:'grandparent',branch:'paternal',cluster:'p1'},
  {id:'p0s1',role:'grandparent-sibling',branch:'paternal',cluster:'p0'},
  {id:'p0s2',role:'grandparent-sibling',branch:'paternal',cluster:'p0'},
  {id:'p1s1',role:'grandparent-sibling',branch:'paternal',cluster:'p1'},
  {id:'mgf',role:'grandparent',branch:'maternal',cluster:'m0'},
  {id:'mgm',role:'grandparent',branch:'maternal',cluster:'m1'},
  {id:'m0s1',role:'grandparent-sibling',branch:'maternal',cluster:'m0'},
  {id:'m1s1',role:'grandparent-sibling',branch:'maternal',cluster:'m1'},
];

const radius = 120;
const positions = layoutSample(people, radius);
assert.equal(positions.size, people.length);

const inverse = unit => {
  const theta = Math.acos(Math.max(-1, Math.min(1, -unit.z)));
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-8) return {x:0,y:0};
  const d = radius * theta;
  return {x:d*unit.x/s,y:d*unit.y/s};
};
const xy = id => inverse(positions.get(id));
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.02, `${message}: ${actual} vs ${expected}`);
const xGap = (a, b) => Math.abs(xy(a).x - xy(b).x);

close(xy('dad').y - xy('root').y, LAYOUT_GAPS.GENERATION_GAP, 'root-to-parent generation gap');
close(xy('pgf').y - xy('dad').y, LAYOUT_GAPS.GENERATION_GAP, 'parent-to-grandparent generation gap');
close(xGap('root', 'spouse'), LAYOUT_GAPS.COUPLE_GAP, 'couple gap');
close(xGap('sib', 'root'), LAYOUT_GAPS.SIBLING_GAP, 'sibling gap');
close(xGap('dad', 'mom'), LAYOUT_GAPS.COUPLE_GAP, 'parent couple gap');
close(xGap('p0s1', 'p0s2'), LAYOUT_GAPS.SIBLING_GAP, 'same-family sibling gap');
close(xGap('p0s2', 'pgf'), LAYOUT_GAPS.SIBLING_GAP, 'sibling-to-direct-ancestor gap');
close(xGap('pgf', 'pgm'), LAYOUT_GAPS.COUPLE_GAP, 'grandparent couple gap');
close(xGap('p1s1', 'm0s1'), LAYOUT_GAPS.BETWEEN_FAMILY_GAP, 'between-family gap');

assert.ok(LAYOUT_GAPS.COUPLE_GAP >= LAYOUT_GAPS.MIN_PERSON_CLEARANCE);
assert.ok(LAYOUT_GAPS.SIBLING_GAP > LAYOUT_GAPS.COUPLE_GAP);
assert.ok(LAYOUT_GAPS.BETWEEN_FAMILY_GAP > LAYOUT_GAPS.SIBLING_GAP);

console.log('semantic family spacing hierarchy ok');
