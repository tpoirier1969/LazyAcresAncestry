import assert from 'node:assert/strict';
import {
  DEFAULT_VISIBLE_PEOPLE,
  descendantIds,
  hiddenImmediateDescendantRootIds,
  nearestPeopleIds,
  visibleIdsForExpandedRoots,
} from '../src/tree-view.js';

assert.equal(DEFAULT_VISIBLE_PEOPLE, 600, 'the initial visible window must target the nearest 600 people');

const people = [
  { id: 'A', role: 'root' },
  { id: 'SA' },
  { id: 'B' },
  { id: 'SB' },
  { id: 'C' },
  { id: 'SC' },
  { id: 'D' },
  { id: 'X' },
];

const relationships = [
  { type: 'spouse', from: 'A', to: 'SA', familyId: 'FA' },
  { type: 'parent', from: 'A', to: 'B', familyId: 'FA' },
  { type: 'parent', from: 'SA', to: 'B', familyId: 'FA' },
  { type: 'spouse', from: 'B', to: 'SB', familyId: 'FB' },
  { type: 'parent', from: 'B', to: 'C', familyId: 'FB' },
  { type: 'parent', from: 'SB', to: 'C', familyId: 'FB' },
  { type: 'spouse', from: 'C', to: 'SC', familyId: 'FC' },
  { type: 'parent', from: 'C', to: 'D', familyId: 'FC' },
  { type: 'parent', from: 'SC', to: 'D', familyId: 'FC' },
];

const nearest = nearestPeopleIds('A', people, relationships, 4);
assert.equal(nearest.size, 4, 'nearest-person window must obey its requested cap when enough people exist');
assert.equal(nearest.has('A'), true, 'target person must always be in the nearest-person window');
assert.equal(nearest.has('D'), false, 'distant descendants must start outside a small nearest-person window');
assert.equal(nearest.has('X'), false, 'unconnected people must not be pulled into the target window');

const base = new Set(['A', 'SA', 'B', 'SB']);
const initialBoundaries = hiddenImmediateDescendantRootIds(base, people, relationships);
assert.equal(initialBoundaries.has('B'), true, 'a visible parent with hidden children must expose an expansion boundary');
assert.equal(initialBoundaries.has('A'), false, 'a parent whose immediate child is already visible should not show a redundant expansion arrow');

const oneLayer = visibleIdsForExpandedRoots(base, new Set(['B']), people, relationships);
assert.equal(oneLayer.has('C'), true, 'expanding a boundary reveals its immediate child generation');
assert.equal(oneLayer.has('SC'), true, 'the newly revealed child keeps its spouse visible as a family unit');
assert.equal(oneLayer.has('D'), false, 'one branch click must not recursively dump every deeper generation onto the screen');

const nested = visibleIdsForExpandedRoots(base, new Set(['B', 'C']), people, relationships);
assert.equal(nested.has('D'), true, 'expanding the newly revealed boundary exposes the following generation');

const belowB = descendantIds('B', people, relationships);
assert.deepEqual([...belowB].sort(), ['C', 'D'], 'collapsing an expanded branch must be able to identify all nested descendant expansion roots');

console.log('nearest-600 window and inline generation expansion regression passed');
