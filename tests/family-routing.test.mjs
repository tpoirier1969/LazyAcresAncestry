import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.document = globalThis.document || { getElementById() { return null; } };
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} };

const {
  GlobeScene,
  buildRelationshipGroups,
  familyLaneBand,
  familyStemRange,
  planFamilyRoutes,
  relationshipLineMetrics,
  shouldSnapSingleChildRoute,
  surfaceLineStepCount,
  RELATIONSHIP_LINE_WIDTH,
  RELATIONSHIP_OVERVIEW_LINE_WIDTH,
  ANCESTRY_CONTINUATION_LINE_WIDTH,
  ANCESTRY_CONTINUATION_OVERVIEW_WIDTH,
  RELATIONSHIP_COLORS,
  ANCESTRY_STUB_LENGTH,
  FAMILY_CHILD_STEM_PREFERRED,
  FAMILY_CHILD_STEM_MIN,
  FAMILY_PARALLEL_GAP,
  FAMILY_SINGLE_CHILD_SNAP_MAX,
  SURFACE_LINE_STATIC_MAX_STEPS,
  SURFACE_LINE_MOVING_MAX_STEPS,
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
assert.ok(roomy.preferred >= FAMILY_CHILD_STEM_PREFERRED - 1e-9, 'normal generation spacing should place a family rail roughly one portrait-frame height above the child');
assert.ok(roomy.minimum <= roomy.preferred);
assert.ok(roomy.maximum > roomy.preferred, 'roomy generations may grow the connector when another family needs clearance');
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
  Math.abs(route1.railY - route2.railY) >= FAMILY_PARALLEL_GAP * 0.80,
  'overlapping family rails should be pushed onto visibly distinct heights when generation space permits',
);

const snapRoute = {
  source: { x: 0, y: 3 },
  parentPoints: [{ x: -0.7, y: 3 }, { x: 0.7, y: 3 }],
  parentMinX: -0.7,
  parentMaxX: 0.7,
  children: [{ point: { x: FAMILY_SINGLE_CHILD_SNAP_MAX * 0.45, y: 0 } }],
};
assert.equal(shouldSnapSingleChildRoute(snapRoute), true, 'a tiny one-child dogleg beneath a couple should collapse to a straight descent');
const noSnapRoute = {
  ...snapRoute,
  children: [{ point: { x: FAMILY_SINGLE_CHILD_SNAP_MAX * 1.5, y: 0 } }],
  parentMaxX: FAMILY_SINGLE_CHILD_SNAP_MAX * 2,
};
assert.equal(shouldSnapSingleChildRoute(noSnapRoute), false, 'a meaningful horizontal offset must retain normal family routing');

const snapGroups = [{ familyId: 'SNAP', parents: ['SP1', 'SP2'], children: ['SC'], lane: 0 }];
const snapPoints = new Map([
  ['SP1', { x: -0.6, y: 3 }],
  ['SP2', { x: 0.6, y: 3 }],
  ['SC', { x: 0.12, y: 0 }],
]);
const snapped = planFamilyRoutes(snapGroups, id => snapPoints.get(id))[0];
assert.equal(snapped.directSingleChild, true, 'planned one-child family should mark a short-offset route for direct descent');

const manyFamilies = Array.from({ length: 6 }, (_, index) => ({
  familyId: `FX${index}`,
  parents: [`PX${index}`],
  children: [`CX${index}`],
  lane: index,
}));
const manyPoints = new Map();
manyFamilies.forEach((group, index) => {
  manyPoints.set(group.parents[0], { x: index * 0.03, y: 5 });
  manyPoints.set(group.children[0], { x: index * 0.03, y: 0 });
});
const manyRoutes = planFamilyRoutes(manyFamilies, id => manyPoints.get(id));
assert.equal(manyRoutes.length, 6);
const railYs = manyRoutes.map(route => route.railY).sort((a, b) => a - b);
for (let index = 1; index < railYs.length; index += 1) {
  assert.ok(
    railYs[index] - railYs[index - 1] >= FAMILY_PARALLEL_GAP * 0.75,
    'dense overlapping routes should consume available vertical space before stacking rails nearly on top of one another',
  );
}

const closeCamera = { focal: 900, centerZ: 232.2, near: 0.1 };
const overviewCamera = { focal: 900, centerZ: 380, near: 0.1 };
const staticCloseSteps = surfaceLineStepCount(12, closeCamera, 225, false);
const movingCloseSteps = surfaceLineStepCount(12, closeCamera, 225, true);
const overviewSteps = surfaceLineStepCount(12, overviewCamera, 225, false);
assert.ok(staticCloseSteps > 12, 'close static relationship lines must use far more than the old fixed 12 samples');
assert.ok(staticCloseSteps > movingCloseSteps, 'static rendering should resolve curvature more finely than active dragging');
assert.ok(overviewSteps < staticCloseSteps, 'sampling density should fall with projected size rather than wasting work at overview distance');
assert.equal(surfaceLineStepCount(1000, closeCamera, 225, false), SURFACE_LINE_STATIC_MAX_STEPS, 'static smoothing must have a deterministic safety cap');
assert.equal(surfaceLineStepCount(1000, closeCamera, 225, true), SURFACE_LINE_MOVING_MAX_STEPS, 'moving smoothing must have a deterministic safety cap');

const closeMetrics = relationshipLineMetrics(3.8);
const mediumMetrics = relationshipLineMetrics(30);
const overviewMetrics = relationshipLineMetrics(155);
assert.ok(closeMetrics.primary > mediumMetrics.primary && mediumMetrics.primary > overviewMetrics.primary, 'relationship strokes must thin continuously as the view widens');
assert.ok(Math.abs(closeMetrics.primary - RELATIONSHIP_LINE_WIDTH) < 1e-9, 'closest view should retain the approved bold relationship weight');
assert.ok(Math.abs(overviewMetrics.primary - RELATIONSHIP_OVERVIEW_LINE_WIDTH) < 1e-9, 'overview should use the deliberate thinner relationship weight');
assert.ok(Math.abs(closeMetrics.continuation - ANCESTRY_CONTINUATION_LINE_WIDTH) < 1e-9);
assert.ok(Math.abs(overviewMetrics.continuation - ANCESTRY_CONTINUATION_OVERVIEW_WIDTH) < 1e-9);
assert.ok(overviewMetrics.primary >= 1.5, 'overview lines must remain readable rather than reverting to hairlines');

const paintCalls = [];
const paintScene = Object.create(GlobeScene.prototype);
paintScene.drag = null;
paintScene.motionFrame = null;
paintScene.focusFrame = null;
paintScene.sampleSurfacePolyline = pointsToSample => pointsToSample;
paintScene.strokeSampledSurfacePolyline = (sampled, stroke) => paintCalls.push(stroke);
paintScene.drawFamilyRoute({
  source: { x: 0, y: 3 },
  parentPoints: [{ x: -0.6, y: 3 }, { x: 0.6, y: 3 }],
  parentMinX: -0.6,
  parentMaxX: 0.6,
  directSingleChild: false,
  railY: 1,
  minX: -2,
  maxX: 2,
  children: [
    { point: { x: -1, y: 0 } },
    { point: { x: 1, y: 0 } },
  ],
}, closeCamera);
assert.equal(paintCalls.length, 10, 'a two-parent/two-child family should render partner bar, trunk, rail, and two child stems in two paint passes');
assert.ok(paintCalls.slice(0, 5).every(stroke => stroke === RELATIONSHIP_COLORS.halo), 'every same-family halo must be painted before any colored family stroke');
assert.deepEqual(
  paintCalls.slice(5),
  [
    RELATIONSHIP_COLORS.couple,
    RELATIONSHIP_COLORS.descent,
    RELATIONSHIP_COLORS.rail,
    RELATIONSHIP_COLORS.descent,
    RELATIONSHIP_COLORS.descent,
  ],
  'family color strokes should form one connected diagram without separate junction-node paint',
);

assert.notEqual(RELATIONSHIP_COLORS.couple, RELATIONSHIP_COLORS.descent, 'couple and descent relationships should remain visually distinguishable');
assert.notEqual(RELATIONSHIP_COLORS.descent, RELATIONSHIP_COLORS.rail, 'descent stems and family rails should have related but distinct brick-red tones');
assert.notEqual(RELATIONSHIP_COLORS.continuation, RELATIONSHIP_COLORS.rail, 'omitted-parent continuations should use their own lighter treatment');

console.log('GEDCOM family routes preserve topology, suppress tiny doglegs, reduce route overlap, thin with zoom, and render without junction nodes');
