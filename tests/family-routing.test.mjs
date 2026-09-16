import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.document = globalThis.document || { getElementById() { return null; } };
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} };

const {
  buildRelationshipGroups,
  familyLaneBand,
  familyStemRange,
  planFamilyRoutes,
  RELATIONSHIP_LINE_WIDTH,
  ANCESTRY_CONTINUATION_LINE_WIDTH,
  RELATIONSHIP_COLORS,
  ANCESTRY_STUB_LENGTH,
  FAMILY_CHILD_STEM_PREFERRED,
  FAMILY_CHILD_STEM_MIN,
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
assert.notEqual(first.lane, second.lane, 'families sharing a parent retain distinct preferred ordering');
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

const continuationPeople = [
  { id: 'TOP1', cluster: 'F-ORIGIN', role: 'great-grandparent' },
  { id: 'TOP2', cluster: 'F-ORIGIN', role: 'one-step-sibling' },
  { id: 'VISIBLE_CHILD', cluster: 'F-VISIBLE', role: 'grandparent' },
  { id: 'VISIBLE_PARENT', cluster: 'F-OLDER', role: 'great-grandparent' },
];
const continuationRelationships = [
  { type: 'parent', from: 'VISIBLE_PARENT', to: 'VISIBLE_CHILD', familyId: 'F-VISIBLE' },
];
const continuationGroups = buildRelationshipGroups(
  continuationRelationships,
  new Set(continuationPeople.map(person => person.id)),
  continuationPeople,
);
assert.deepEqual(
  continuationGroups.ancestryStubs,
  ['TOP1', 'TOP2', 'VISIBLE_PARENT'],
  'people with a documented family of origin but no visible parents should receive individual ancestry-continuation stubs rather than a false sibling rail',
);
assert.ok(!continuationGroups.ancestryStubs.includes('VISIBLE_CHILD'), 'a person with a visible parent must not receive an omitted-parent stub');

const roomy = familyStemRange(3);
assert.ok(
  roomy.preferred >= FAMILY_CHILD_STEM_PREFERRED - 1e-9,
  'normal generation spacing should place the family rail roughly one visible portrait-frame height above the child',
);
assert.ok(roomy.minimum <= roomy.preferred);
assert.ok(roomy.maximum > roomy.preferred, 'roomy generations may grow the connector only when another family needs the lane');

const tighter = familyStemRange(1.5);
assert.ok(tighter.preferred < roomy.preferred, 'tight generations may compress the preferred stem instead of forcing a fixed layout');
assert.ok(tighter.minimum <= tighter.preferred && tighter.preferred <= tighter.maximum);

const roomier = familyStemRange(5);
assert.ok(roomier.maximum > roomy.maximum, 'maximum routing distance derives from actual generation space rather than a hard-coded cap');
assert.ok(FAMILY_CHILD_STEM_MIN < FAMILY_CHILD_STEM_PREFERRED);
assert.ok(ANCESTRY_STUB_LENGTH > 0, 'ancestry continuation must have a real surface length');

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
  Math.abs(route1.railY - route2.railY) >= FAMILY_PARALLEL_GAP * 0.90,
  'overlapping horizontal family routes must receive comfortably separate rail heights',
);
assert.ok(
  planned.some(route => Math.abs(route.stemLength - route.stemRange.preferred) < 1e-6),
  'at least one unconstrained route should use the preferred portrait-relative stem length',
);
assert.ok(
  planned.some(route => route.stemLength > route.stemRange.preferred),
  'a colliding family route should grow only as much as needed to make room',
);

const manyFamilies = Array.from({ length: 6 }, (_, index) => ({
  familyId: `FX${index}`,
  parents: [`PX${index}`],
  children: [`CX${index}`],
  lane: index,
}));
const manyPoints = new Map();
manyFamilies.forEach((group, index) => {
  manyPoints.set(group.parents[0], { x: 0, y: 5 });
  manyPoints.set(group.children[0], { x: index * 0.02, y: 0 });
});
const manyRoutes = planFamilyRoutes(manyFamilies, id => manyPoints.get(id));
assert.equal(manyRoutes.length, 6);
const railYs = manyRoutes.map(route => route.railY).sort((a, b) => a - b);
for (let index = 1; index < railYs.length; index += 1) {
  assert.ok(
    railYs[index] - railYs[index - 1] >= FAMILY_PARALLEL_GAP * 0.90,
    'routing must allocate as many separated lanes as the family geometry requires, not a fixed slot count',
  );
}

assert.ok(RELATIONSHIP_LINE_WIDTH >= 3.2 && RELATIONSHIP_LINE_WIDTH <= 3.7, 'primary relationship strokes should remain intentionally bold at normal viewing distance');
assert.ok(
  ANCESTRY_CONTINUATION_LINE_WIDTH >= RELATIONSHIP_LINE_WIDTH * 0.85,
  'ancestry-continuation lines may be lighter in color but must not collapse back into hairlines',
);
assert.notEqual(RELATIONSHIP_COLORS.couple, RELATIONSHIP_COLORS.descent, 'couple and descent relationships should remain visually distinguishable');
assert.notEqual(RELATIONSHIP_COLORS.descent, RELATIONSHIP_COLORS.rail, 'descent stems and family rails should have related but distinct brick-red tones');
assert.notEqual(RELATIONSHIP_COLORS.continuation, RELATIONSHIP_COLORS.rail, 'omitted-parent continuations should use their own lighter treatment');

console.log('GEDCOM family routes preserve family topology, adaptive spacing, and readable relationship-specific styling');