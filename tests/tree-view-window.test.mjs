import assert from 'node:assert/strict';
import {
  COLLATERAL_GENERATION_LIMIT,
  DEFAULT_VISIBLE_PEOPLE,
  branchControlFamilies,
  descendantFamilyIds,
  lineageWindowIds,
  visibleIdsForExpandedFamilies,
} from '../src/tree-view.js';

assert.equal(DEFAULT_VISIBLE_PEOPLE, 600, 'the initial visible window must remain capped at 600 people');
assert.equal(COLLATERAL_GENERATION_LIMIT, 3, 'collateral branches must stop at the second-cousin generation');

const lineagePeople = [
  { id: 'T', role: 'root' },
  { id: 'ST' },
  { id: 'P' },
  { id: 'GP' },
  { id: 'GGP' },
  { id: 'GGG' },
  { id: 'D1' },
  { id: 'D2' },
  { id: 'D3' },
  { id: 'D4' },
  { id: 'SD4' },
  { id: 'S' },
  { id: 'N' },
  { id: 'U' },
  { id: 'C1' },
  { id: 'C1R' },
  { id: 'GA' },
  { id: 'C2P' },
  { id: 'C2' },
  { id: 'GGA' },
  { id: 'C3A' },
  { id: 'C3B' },
  { id: 'C3C' },
  { id: 'C3' },
  { id: 'X' },
];

const lineageRelationships = [
  { type: 'spouse', from: 'T', to: 'ST', familyId: 'FT' },
  { type: 'parent', from: 'GGG', to: 'GGP', familyId: 'F0' },
  { type: 'parent', from: 'GGP', to: 'GP', familyId: 'F1' },
  { type: 'parent', from: 'GP', to: 'P', familyId: 'F2' },
  { type: 'parent', from: 'P', to: 'T', familyId: 'F3' },
  { type: 'parent', from: 'T', to: 'D1', familyId: 'FD1' },
  { type: 'parent', from: 'D1', to: 'D2', familyId: 'FD2' },
  { type: 'parent', from: 'D2', to: 'D3', familyId: 'FD3' },
  { type: 'parent', from: 'D3', to: 'D4', familyId: 'FD4' },
  { type: 'spouse', from: 'D4', to: 'SD4', familyId: 'FSD4' },
  { type: 'parent', from: 'P', to: 'S', familyId: 'FS' },
  { type: 'parent', from: 'S', to: 'N', familyId: 'FN' },
  { type: 'parent', from: 'GP', to: 'U', familyId: 'FU' },
  { type: 'parent', from: 'U', to: 'C1', familyId: 'FC1' },
  { type: 'parent', from: 'C1', to: 'C1R', familyId: 'FC1R' },
  { type: 'parent', from: 'GGP', to: 'GA', familyId: 'FGA' },
  { type: 'parent', from: 'GA', to: 'C2P', familyId: 'FC2P' },
  { type: 'parent', from: 'C2P', to: 'C2', familyId: 'FC2' },
  { type: 'parent', from: 'GGG', to: 'GGA', familyId: 'FGGA' },
  { type: 'parent', from: 'GGA', to: 'C3A', familyId: 'FC3A' },
  { type: 'parent', from: 'C3A', to: 'C3B', familyId: 'FC3B' },
  { type: 'parent', from: 'C3B', to: 'C3C', familyId: 'FC3C' },
  { type: 'parent', from: 'C3C', to: 'C3', familyId: 'FC3' },
];

const lineage = lineageWindowIds('T', lineagePeople, lineageRelationships, 50);
assert.equal(lineage.has('T'), true, 'target person must always remain visible');
assert.equal(lineage.has('ST'), true, 'target spouse remains attached to the vertical spine');
assert.equal(lineage.has('GGG'), true, 'deep direct ancestors remain visible beyond the cousin cutoff');
assert.equal(lineage.has('D4'), true, 'deep direct descendants remain visible beyond the cousin cutoff');
assert.equal(lineage.has('SD4'), true, 'spouses of direct descendants remain visible when capacity allows');
assert.equal(lineage.has('S'), true, 'siblings remain visible');
assert.equal(lineage.has('N'), true, 'close collateral descendants remain visible');
assert.equal(lineage.has('C1'), true, 'first cousins remain visible');
assert.equal(lineage.has('C1R'), true, 'first cousins within the three-generation collateral envelope remain visible');
assert.equal(lineage.has('C2'), true, 'second cousins remain visible');
assert.equal(lineage.has('C3'), false, 'third cousins and more distant cousin branches must start hidden');
assert.equal(lineage.has('X'), false, 'unrelated people must not be pulled into the initial working window');

const capped = lineageWindowIds('T', lineagePeople, lineageRelationships, 4);
assert.ok(capped.size <= 4, 'lineage-first selection must obey the requested visible-person cap');
assert.equal(capped.has('T'), true, 'the cap must never evict the target person');

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

console.log('lineage-first second-cousin window and family-level expansion chevrons regression passed');
