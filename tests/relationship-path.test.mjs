import assert from 'node:assert/strict';
import { findRelationshipPath } from '../src/relationship-path.js';

const people = [
  'tod', 'amy', 'father', 'mother', 'grandfather', 'grandmother',
  'henrik', 'henrikDad', 'henrikMom', 'annaGretha', 'johanElsila',
  'donna', 'donnaDad', 'donnaMom', 'outsider', 'unknown',
].map(id => ({ id, name: id }));

const parent = (from, to, familyId) => ({ type: 'parent', from, to, familyId });
const spouse = (from, to, familyId) => ({ type: 'spouse', from, to, familyId });

const family = [
  parent('father', 'tod', 'home'), parent('mother', 'tod', 'home'),
  parent('father', 'amy', 'home'), parent('mother', 'amy', 'home'),
  spouse('father', 'mother', 'home'),
  parent('grandfather', 'father', 'grandparents'),
  parent('grandmother', 'father', 'grandparents'),
  parent('henrikDad', 'henrik', 'henrikFamily'),
  parent('henrikMom', 'henrik', 'henrikFamily'),
  spouse('henrikDad', 'henrikMom', 'henrikFamily'),
  parent('annaGretha', 'henrikDad', 'olderFamily'),
  parent('johanElsila', 'henrikDad', 'olderFamily'),
  spouse('annaGretha', 'johanElsila', 'olderFamily'),
  spouse('tod', 'donna', 'todDonna'),
  parent('donnaDad', 'donna', 'donnaParents'),
  parent('donnaMom', 'donna', 'donnaParents'),
  // A direct connection from a person on Tod's side to Henrik's father.
  spouse('amy', 'henrikDad', 'bridge'),
];

const siblings = findRelationshipPath('tod', 'amy', people, family);
assert.deepEqual(siblings.path, ['tod', 'father', 'amy']);
assert.deepEqual(new Set(siblings.visibleIds), new Set(['tod', 'amy', 'father', 'mother']));
assert.deepEqual(siblings.segments.map(segment => segment.ids), [
  ['tod'], ['father', 'mother'], ['amy'],
]);
assert.ok(siblings.highlightedParentChild.has('mother>tod'));
assert.ok(siblings.highlightedParentChild.has('mother>amy'));
assert.ok(siblings.highlightedCouples.has('father|mother'));

const toHenrik = findRelationshipPath('tod', 'henrik', people, family);
assert.deepEqual(toHenrik.path, ['tod', 'father', 'amy', 'henrikDad', 'henrik']);
assert.ok(toHenrik.visibleIds.has('henrikMom'), 'Henrik co-parent present');
assert.ok(!toHenrik.visibleIds.has('annaGretha'), 'Henrik grandmother excluded');
assert.ok(!toHenrik.visibleIds.has('johanElsila'), 'Henrik grandfather excluded');
assert.ok(!toHenrik.highlightedCouples.has('annaGretha|johanElsila'));

const directParent = findRelationshipPath('henrik', 'henrikDad', people, family);
assert.deepEqual(new Set(directParent.visibleIds), new Set(['henrik', 'henrikDad', 'henrikMom']));

const adoption = [
  parent('father', 'tod', 'birth'), parent('mother', 'tod', 'birth'),
  parent('outsider', 'tod', 'adoption'),
];
const originalUnit = findRelationshipPath('tod', 'father', people, adoption);
assert.ok(originalUnit.visibleIds.has('mother'));
assert.ok(!originalUnit.visibleIds.has('outsider'), 'Different family should not be folded into the same parent unit');

assert.equal(findRelationshipPath('tod', 'unknown', people, family), null);
assert.equal(findRelationshipPath('tod', 'missing', people, family), null);

console.log('relationship path and parental-unit regression tests passed');
