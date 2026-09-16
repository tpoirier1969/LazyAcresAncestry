import assert from 'node:assert/strict';
import { descendantIdsHiddenBy } from '../src/scene.js';

const people = [
  { id: 'A', role: 'root' },
  { id: 'SA', role: 'one-step-spouse', proofExpansionKind: 'spouse' },
  { id: 'B', role: 'descendant', proofExpansionKind: 'descendant' },
  { id: 'SB', role: 'one-step-spouse', proofExpansionKind: 'descendant-co-parent' },
  { id: 'C', role: 'descendant', proofExpansionKind: 'descendant' },
  { id: 'SC', role: 'one-step-spouse', proofExpansionKind: 'descendant-co-parent' },
  { id: 'X', role: 'descendant', proofExpansionKind: 'descendant' },
];

const relationships = [
  { type: 'spouse', from: 'A', to: 'SA', familyId: 'FA' },
  { type: 'parent', from: 'A', to: 'B', familyId: 'FA' },
  { type: 'spouse', from: 'B', to: 'SB', familyId: 'FB' },
  { type: 'parent', from: 'B', to: 'C', familyId: 'FB' },
  { type: 'spouse', from: 'C', to: 'SC', familyId: 'FC' },
  { type: 'parent', from: 'X', to: 'X', familyId: 'FX' },
];

const hiddenFromA = descendantIdsHiddenBy(new Set(['A']), people, relationships);
assert.equal(hiddenFromA.has('A'), false, 'the collapse anchor remains visible');
assert.equal(hiddenFromA.has('SA'), false, 'the anchor spouse remains visible');
assert.equal(hiddenFromA.has('B'), true, 'direct descendants are hidden');
assert.equal(hiddenFromA.has('C'), true, 'descendant closure is hidden recursively');
assert.equal(hiddenFromA.has('SB'), true, 'supporting spouses of hidden descendants are hidden');
assert.equal(hiddenFromA.has('SC'), true, 'supporting spouses deeper in the hidden branch are hidden');
assert.equal(hiddenFromA.has('X'), false, 'unrelated branches remain visible');

const hiddenFromB = descendantIdsHiddenBy(new Set(['B']), people, relationships);
assert.equal(hiddenFromB.has('B'), false, 'a nested collapse anchor remains visible');
assert.equal(hiddenFromB.has('SB'), false, 'the collapse anchor spouse remains visible');
assert.equal(hiddenFromB.has('C'), true, 'only descendants below the selected anchor are hidden');
assert.equal(hiddenFromB.has('A'), false, 'ancestors remain visible');

console.log('family branch collapse regression passed');
