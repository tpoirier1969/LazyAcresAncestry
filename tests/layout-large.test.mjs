import assert from 'node:assert/strict';
import { generationGapForPopulation, layoutSample } from '../src/layout.js';

const people = [];
const relationships = [];
const add = (id, role = 'extended-family', branch = 'center', directAncestorDepth = null, year = 2000) => {
  people.push({
    id,
    name: id,
    role,
    branch,
    directAncestorDepth,
    birth: { date: String(year) },
  });
};
const spouse = (a, b) => relationships.push({ type: 'spouse', from: a, to: b });
const parent = (a, b) => relationships.push({ type: 'parent', from: a, to: b });

add('root', 'root', 'center', 0, 1969);
add('root-spouse', 'spouse', 'center', null, 1968);
spouse('root', 'root-spouse');
add('dad', 'parent', 'paternal', 1, 1944);
add('mom', 'parent', 'maternal', 1, 1947);
spouse('dad', 'mom');
parent('dad', 'root');
parent('mom', 'root');
add('sister', 'sibling', 'center', null, 1971);
parent('dad', 'sister');
parent('mom', 'sister');

const grandparents = [];
for (let index = 0; index < 4; index += 1) {
  const id = `gp${index}`;
  grandparents.push(id);
  add(id, 'grandparent', index < 2 ? 'paternal' : 'maternal', 2, 1910 + index);
}
spouse('gp0', 'gp1');
spouse('gp2', 'gp3');
parent('gp0', 'dad');
parent('gp1', 'dad');
parent('gp2', 'mom');
parent('gp3', 'mom');

for (let branchIndex = 0; branchIndex < 4; branchIndex += 1) {
  const branch = branchIndex < 2 ? 'paternal' : 'maternal';
  const greatA = `gg${branchIndex}a`;
  const greatB = `gg${branchIndex}b`;
  add(greatA, 'great-grandparent', branch, 3, 1880 + branchIndex);
  add(greatB, 'great-grandparent', branch, 3, 1882 + branchIndex);
  spouse(greatA, greatB);
  parent(greatA, grandparents[branchIndex]);
  parent(greatB, grandparents[branchIndex]);

  for (let siblingIndex = 0; siblingIndex < 5; siblingIndex += 1) {
    const sibling = `b${branchIndex}s${siblingIndex}`;
    const siblingSpouse = `${sibling}-spouse`;
    add(sibling, 'grandparent-sibling', branch, null, 1900 + siblingIndex);
    add(siblingSpouse, 'family-spouse', branch, null, 1901 + siblingIndex);
    spouse(sibling, siblingSpouse);
    parent(greatA, sibling);
    parent(greatB, sibling);

    for (let childIndex = 0; childIndex < 4; childIndex += 1) {
      const child = `${sibling}c${childIndex}`;
      const childSpouse = `${child}-spouse`;
      add(child, 'extended-family', branch, null, 1930 + childIndex);
      add(childSpouse, 'family-spouse', branch, null, 1931 + childIndex);
      spouse(child, childSpouse);
      parent(sibling, child);
      parent(siblingSpouse, child);

      for (let grandchildIndex = 0; grandchildIndex < 2; grandchildIndex += 1) {
        const grandchild = `${child}g${grandchildIndex}`;
        add(grandchild, 'extended-family', branch, null, 1960 + grandchildIndex);
        parent(child, grandchild);
        parent(childSpouse, grandchild);
      }
    }
  }
}

const radius = 225;
const positions = layoutSample(people, radius, relationships);
const inverse = unit => {
  const theta = Math.acos(Math.max(-1, Math.min(1, -unit.z)));
  const sine = Math.sin(theta);
  if (Math.abs(sine) < 1e-8) return { x: 0, y: 0 };
  const distance = radius * theta;
  return {
    x: distance * unit.x / sine,
    y: distance * unit.y / sine,
  };
};
const xy = id => inverse(positions.get(id));
const midpoint = (a, b) => (xy(a).x + xy(b).x) / 2;
const xs = people.map(person => xy(person.id).x);
const ys = people.map(person => xy(person.id).y);
const height = Math.max(...ys) - Math.min(...ys);

assert.equal(positions.size, people.length, 'every scoped person should receive a layout position');
assert.ok(
  Math.abs(midpoint('gp0', 'gp1') - xy('dad').x) < 8,
  'paternal grandparent couple must stay near the father despite hundreds of collateral descendants',
);
assert.ok(
  Math.abs(midpoint('gp2', 'gp3') - xy('mom').x) < 8,
  'maternal grandparent couple must stay near the mother despite hundreds of collateral descendants',
);
assert.ok(
  generationGapForPopulation(people.length) > 15,
  'large family graphs should open up vertically instead of reusing prototype row spacing',
);
assert.ok(
  height > 45,
  'a large multi-generation graph should not collapse into a thin horizontal railway band',
);

console.log('large nuclear-family layout keeps the direct ancestry spine stable');
