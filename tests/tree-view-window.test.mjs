import assert from 'node:assert/strict';
import {
  DEFAULT_VISIBLE_PEOPLE,
  branchControlFamilies,
  descendantFamilyIds,
  nearestPeopleIds,
  visibleIdsForExpandedFamilies,
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
const initialControls = branchControlFamilies(base, new Set(), people, relationships);
assert.equal(initialControls.some(control => control.familyId === 'FB' && control.action === 'expand'), true,
  'a visible family whose children are hidden must expose one family-level expansion control');
assert.equal(initialControls.some(control => control.familyId === 'FA'), false,
  'a family whose immediate child is already visible should not show a redundant expansion arrow');

const oneLayer = visibleIdsForExpandedFamilies(base, new Set(['FB']), people, relationships);
assert.equal(oneLayer.has('C'), true, 'expanding a family boundary reveals its immediate child generation');
assert.equal(oneLayer.has('SC'), true, 'the newly revealed child keeps its spouse visible as a family unit');
assert.equal(oneLayer.has('D'), false, 'one branch click must not recursively dump every deeper generation onto the screen');

const oneLayerControls = branchControlFamilies(oneLayer, new Set(['FB']), people, relationships);
assert.equal(oneLayerControls.some(control => control.familyId === 'FB' && control.action === 'collapse'), true,
  'an expanded family boundary must turn into a collapse control');
assert.equal(oneLayerControls.some(control => control.familyId === 'FC' && control.action === 'expand'), true,
  'the newly revealed generation must expose its own next branch boundary');

const nested = visibleIdsForExpandedFamilies(base, new Set(['FB', 'FC']), people, relationships);
assert.equal(nested.has('D'), true, 'expanding the newly revealed family boundary exposes the following generation');

const belowFB = descendantFamilyIds('FB', people, relationships);
assert.deepEqual([...belowFB].sort(), ['FC'], 'collapsing a family branch must identify nested family expansions below it');

console.log('nearest-600 window and family-level expansion chevrons regression passed');
