import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseGedcomFamilies, validateGedcomFamilyGraph } from '../src/gedcom-family-parser.js';
import {
  buildProofFamily,
  PROOF_BASE_EXPECTED_PEOPLE,
  PROOF_BREADTH_EXPECTED_PEOPLE,
  PROOF_EXPECTED_PEOPLE,
  PROOF_ROOT_ID,
  PROOF_SIBLING_CHILD_ID,
  PROOF_SIBLING_ID,
} from '../src/proof-family.js';

const GEDCOM = 'Poirier - Hillman - Kauppila - Eilola - Bucco - Sortonen - Perreault - Stella families..ged';
const text = fs.readFileSync(new URL(`../${GEDCOM}`, import.meta.url), 'utf8');
const parsed = parseGedcomFamilies(text);
assert.equal(validateGedcomFamilyGraph(parsed).length, 0, 'source GEDCOM relationships should resolve to real family/person records');

const family = buildProofFamily(parsed);
assert.equal(PROOF_BASE_EXPECTED_PEOPLE, 53, 'approved proof-tree base must remain 53 people');
assert.equal(PROOF_BREADTH_EXPECTED_PEOPLE, 139, 'previous UI breadth checkpoint must remain 139 people');
assert.equal(PROOF_EXPECTED_PEOPLE, 568, 'next UI family layer must remain 568 people');
assert.equal(family.people.length, PROOF_EXPECTED_PEOPLE);
assert.equal(family.metadata.basePeople, PROOF_BASE_EXPECTED_PEOPLE);
assert.equal(family.metadata.previousUiPeople, PROOF_BREADTH_EXPECTED_PEOPLE);

const expansionSiblings = family.people.filter(person => person.proofExpansionKind === 'sibling');
const expansionSpouses = family.people.filter(person => person.proofExpansionKind === 'spouse');
const expansionChildren = family.people.filter(person => person.proofExpansionKind === 'child');
const expansionChildSpouses = family.people.filter(person => person.proofExpansionKind === 'child-spouse');
assert.equal(expansionSiblings.length, 53, 'first breadth step should preserve 53 GEDCOM-recorded siblings');
assert.equal(expansionSpouses.length, 75, 'all currently displayed people should gain their recorded spouses without ancestor recursion');
assert.equal(expansionChildren.length, 249, 'one added descendant layer should contain 249 children');
assert.equal(expansionChildSpouses.length, 138, 'new child family units should include 138 recorded spouses/co-parents');
assert.equal(
  PROOF_BASE_EXPECTED_PEOPLE
    + expansionSiblings.length
    + expansionSpouses.length
    + expansionChildren.length
    + expansionChildSpouses.length,
  family.people.length,
);

const ids = new Set(family.people.map(person => person.id));
for (const relation of family.relationships) {
  assert.ok(ids.has(relation.from) && ids.has(relation.to), 'every displayed relationship must stay inside the proof tree');
  assert.ok(relation.familyId, 'every displayed relationship must identify its source GEDCOM FAM record');
  assert.ok(parsed.families.has(relation.familyId), 'every displayed relationship must resolve to a source GEDCOM family');
}

const rootParents = family.relationships
  .filter(link => link.type === 'parent' && link.to === PROOF_ROOT_ID)
  .map(link => link.from)
  .sort();
assert.deepEqual(rootParents, ['I40538615623', 'I40538616542'].sort(), 'Tod must have exactly his recorded mother and father');

const amyChildren = family.relationships
  .filter(link => link.type === 'parent' && link.from === PROOF_SIBLING_ID)
  .map(link => link.to);
assert.deepEqual(amyChildren, [PROOF_SIBLING_CHILD_ID], 'Amy must have exactly one displayed child');

const maikelLink = family.relationships.find(link => (
  link.type === 'parent'
  && link.from === PROOF_SIBLING_ID
  && link.to === PROOF_SIBLING_CHILD_ID
));
assert.equal(maikelLink?.pedigree, 'adopted', 'the working proof layer must preserve the user-confirmed adoption');

const tod = family.people.find(person => person.id === PROOF_ROOT_ID);
assert.ok(tod?.rawGedcom?.saved_records?.length > 0, 'saved Ancestry source records must survive the GEDCOM proof import');
assert.ok(tod.rawGedcom.saved_records.some(record => /School Yearbooks/i.test(record.title)), 'known Tod source should be visible');
assert.ok(tod.events.some(event => event.type === 'RESI' && /Gwinn/i.test(event.place)), 'residence geography must survive the GEDCOM proof import');

for (const person of family.people) {
  if (!person.proofExpansionKind) continue;
  assert.ok(
    ['sibling', 'spouse', 'child', 'child-spouse'].includes(person.proofExpansionKind),
    'proof expansion may only add the explicitly approved family-layer kinds',
  );
}

for (const child of expansionChildren) {
  assert.ok(
    family.relationships.some(link => link.type === 'parent' && link.to === child.id),
    `new child ${child.id} must be attached through a real GEDCOM parent relationship`,
  );
}
for (const spouse of expansionChildSpouses) {
  assert.ok(
    family.relationships.some(link => link.type === 'spouse' && (link.from === spouse.id || link.to === spouse.id)),
    `new child spouse ${spouse.id} must be attached through a real GEDCOM spouse relationship`,
  );
}

// Parents outside the current UI scope are never invented. When multiple
// visible people share an out-of-scope family of origin, a sibling rail is
// allowed only because the source GEDCOM FAM record explicitly lists each as
// CHIL. This documented rail also keeps descendant branches visibly connected.
const adjacency = new Map(family.people.map(person => [person.id, new Set()]));
for (const link of family.relationships) {
  adjacency.get(link.from)?.add(link.to);
  adjacency.get(link.to)?.add(link.from);
}

const peopleWithDisplayedParents = new Set(
  family.relationships.filter(link => link.type === 'parent').map(link => link.to),
);
const originGroups = new Map();
for (const person of family.people) {
  if (!person.cluster || peopleWithDisplayedParents.has(person.id)) continue;
  const sourceFamily = parsed.families.get(person.cluster);
  assert.ok(sourceFamily, `sibling rail ${person.cluster} must resolve to a GEDCOM family`);
  assert.ok(sourceFamily.children.includes(person.id), `${person.id} must actually be a CHIL member of ${person.cluster}`);
  if (!originGroups.has(person.cluster)) originGroups.set(person.cluster, []);
  originGroups.get(person.cluster).push(person.id);
}

for (const members of originGroups.values()) {
  const uniqueMembers = [...new Set(members)];
  if (uniqueMembers.length < 2) continue;
  for (let index = 1; index < uniqueMembers.length; index += 1) {
    const a = uniqueMembers[index - 1];
    const b = uniqueMembers[index];
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }
}

const connected = new Set([PROOF_ROOT_ID]);
const queue = [PROOF_ROOT_ID];
while (queue.length) {
  const id = queue.shift();
  for (const neighbor of adjacency.get(id) || []) {
    if (connected.has(neighbor)) continue;
    connected.add(neighbor);
    queue.push(neighbor);
  }
}
assert.equal(
  connected.size,
  family.people.length,
  'every proof-tree person must connect to home through a displayed GEDCOM relationship or documented family-of-origin sibling rail',
);

console.log('proof-family.test.mjs passed');
