import assert from 'node:assert/strict';
import { scopeFamilyGraph } from '../src/data.js';

const people = [
  { id: 'root', name: 'Root', role: 'root' },
  { id: 'spouse', name: 'Root Spouse', role: 'spouse' },
  { id: 'dad', name: 'Dad', role: 'parent' },
  { id: 'mom', name: 'Mom', role: 'parent' },
  { id: 'pgf', name: 'Paternal Grandfather', role: 'grandparent' },
  { id: 'pgm', name: 'Paternal Grandmother', role: 'grandparent' },
  { id: 'uncle', name: 'Dad Sibling', role: 'extended-family' },
  { id: 'cousin', name: 'Cousin', role: 'extended-family' },
  { id: 'cousinSpouse', name: 'Cousin Spouse', role: 'family-spouse' },
  { id: 'inlawParent', name: 'Unrelated In-law Parent', role: 'extended-family' },
  { id: 'inlawSibling', name: 'Unrelated In-law Sibling', role: 'extended-family' },
];

const relationships = [
  { type: 'parent', from: 'dad', to: 'root' },
  { type: 'parent', from: 'mom', to: 'root' },
  { type: 'spouse', from: 'root', to: 'spouse' },
  { type: 'parent', from: 'pgf', to: 'dad' },
  { type: 'parent', from: 'pgm', to: 'dad' },
  { type: 'parent', from: 'pgf', to: 'uncle' },
  { type: 'parent', from: 'pgm', to: 'uncle' },
  { type: 'parent', from: 'uncle', to: 'cousin' },
  { type: 'spouse', from: 'cousin', to: 'cousinSpouse' },
  { type: 'parent', from: 'inlawParent', to: 'cousinSpouse' },
  { type: 'parent', from: 'inlawParent', to: 'inlawSibling' },
];

const scoped = scopeFamilyGraph(people, relationships, 2);
const ids = new Set(scoped.people.map(person => person.id));

for (const expected of ['root', 'spouse', 'dad', 'mom', 'pgf', 'pgm', 'uncle', 'cousin', 'cousinSpouse']) {
  assert(ids.has(expected), `${expected} should remain in the requested ancestor/sibling/descendant family scope`);
}
assert(!ids.has('inlawParent'), 'a spouse parent must not pull an unrelated ancestry branch into the displayed tree');
assert(!ids.has('inlawSibling'), 'a spouse sibling must not hitchhike into the displayed tree');
assert.equal(
  scoped.people.find(person => person.id === 'cousin')?.scopeKind,
  'blood',
  'descendants of an ancestor sibling should be marked as blood-line scope',
);
assert.equal(
  scoped.people.find(person => person.id === 'cousinSpouse')?.scopeKind,
  'family-partner',
  'a displayed spouse should remain a one-hop family partner rather than opening an in-law branch',
);

const scopedRelationshipIds = new Set(scoped.relationships.flatMap(link => [link.from, link.to]));
assert(!scopedRelationshipIds.has('inlawParent'));
assert(!scopedRelationshipIds.has('inlawSibling'));

console.log('ancestor, sibling-descendant, and one-hop partner family scope ok');
