import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.document = globalThis.document || { getElementById() { return null; } };
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} };

const {
  buildRelationshipGroups,
  familyLaneBand,
  planFamilyRoutes,
  RELATIONSHIP_LINE_WIDTH,
  FAMILY_CHILD_STEM_MAX,
  FAMILY_PARALLEL_GAP,
} = await import('../src/scene.js');

const relationships = [
  { type: 'spouse', from: 'A', to: 'B', familyId: 'F1' },
  { type: 'parent', from: 'A', to: 'C1', familyId: 'F1' },
  { type: 'parent', from: 'B', to: 'C1', familyId: 'F1' },
  { type: 'parent', from: 'A', to: 'C2', familyId: 'F1' },
  { type: 'parent', from: 'B', to: 'C2', familyId: 'F1' },
  { type: 'spouse', from: 'A', to: 'D', familyId: 'F2' },
  { type: 'parent', from: 'A', to: 'C3', familyId: 'F2' },
  { type: 'parent', from: 'D', to: 'C3', familyId: 'F2' },
];
const known = new Set(['A', 'B', 'C1', 'C2', 'D', 'C3']);
const grouped = buildRelationshipGroups(relationships, known, []);

assert.equal(grouped.familyGroups.length, 2, 'two GEDCOM FAM records must remain two visible family routes');
const first = grouped.familyGroups.find(group => group.familyId === 'F1');
const second = grouped.familyGroups.find(group => group.familyId === 'F2');
assert.deepEqual(first.parents, ['A', 'B']);
assert.deepEqual(first.children, ['C1', 'C2']);
assert.deepEqual(second.parents, ['A', 'D']);
assert.deepEqual(second.children, ['C3']);
assert.notEqual(first.lane, second.lane, 'families sharing a parent must receive separate preferred rail lanes');
assert.notEqual(familyLaneBand(first.lane), familyLaneBand(second.lane));

const directAndCollateral = buildRelationshipGroups([
  { type: 'spouse', from: 'P1', to: 'P2', familyId: 'F3' },
  { type: 'parent', from: 'P1', to: 'DIRECT', familyId: 'F3' },
  { type: 'parent', from: 'P2', to: 'DIRECT', familyId: 'F3' },
  { type: 'parent', from: 'P1', to: 'SIB', familyId: 'F3' },
  { type: 'parent', from: 'P2', to: 'SIB', familyId: 'F3' },
], new Set(['P1', 'P2', 'DIRECT', 'SIB']), []);
assert.deepEqual(
  directAndCollateral.familyGroups[0].children,
  ['DIRECT', 'SIB'],
  'direct ancestors and their siblings must stay on one documented family rail rather than competing routes',
);

const points = new Map([
  ['A', { x: -2.0, y: 3.0 }],
  ['B', { x: -0.8, y: 3.0 }],
  ['D', { x: 1.0, y: 3.0 }],
  ['C1', { x: -2.6, y: 0 }],
  ['C2', { x: 0.8, y: 0 }],
  ['C3', { x: 2.2, y: 0 }],
]);
const planned = planFamilyRoutes(grouped.familyGroups, id => points.get(id));
assert.equal(planned.length, 2);
const route1 = planned.find(route => route.familyId === 'F1');
const route2 = planned.find(route => route.familyId === 'F2');
assert.ok(
  Math.abs(route1.railY - route2.railY) >= FAMILY_PARALLEL_GAP * 0.75,
  'overlapping horizontal family routes must receive visibly separate rail heights even when they already have distinct GEDCOM families',
);
for (const route of planned) {
  for (const child of route.children) {
    assert.ok(
      Math.abs(route.railY - child.point.y) <= FAMILY_CHILD_STEM_MAX + 1e-9,
      'a child drop may not exceed one portrait-frame height',
    );
  }
}
assert.ok(RELATIONSHIP_LINE_WIDTH > 1 && RELATIONSHIP_LINE_WIDTH < 2, 'all relationship segments should use one restrained screen-space stroke width');

console.log('GEDCOM family routes stay separated, compact, and uniformly weighted');