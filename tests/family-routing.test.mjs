import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.document = globalThis.document || { getElementById() { return null; } };
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} };

const {
  buildRelationshipGroups,
  familyLaneBand,
  familyRailY,
  relationshipLineWidth,
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
assert.notEqual(first.lane, second.lane, 'families sharing a parent must receive separate rail lanes');
assert.notEqual(familyLaneBand(first.lane), familyLaneBand(second.lane), 'separate family lanes must render at different vertical offsets');
assert.equal(familyLaneBand(0), 0);
assert.equal(familyLaneBand(1), 1);
assert.equal(familyLaneBand(2), 2, 'family lanes should stack monotonically instead of alternating back onto one another');

const rail0 = familyRailY(4, 0, 0);
const rail1 = familyRailY(4, 0, 1);
const rail2 = familyRailY(4, 0, 2);
assert.ok(rail0 > 0 && rail0 < rail1 && rail1 < rail2, 'parallel family rails must have comfortable ordered separation');
assert.ok(rail2 <= 1.08, 'child drop must never exceed the plaque/photo-frame height');
assert.equal(relationshipLineWidth(), relationshipLineWidth(), 'all relationship segments must share one screen-space line width');

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

console.log('GEDCOM family routes use short child drops, separated parallel lanes, and one connector thickness');