import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseGedcomFamilies, validateGedcomFamilyGraph } from '../src/gedcom-family-parser.js';
import {
  buildProofFamily,
  PROOF_BASE_EXPECTED_PEOPLE,
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
assert.equal(PROOF_EXPECTED_PEOPLE, 139, 'one-step breadth proof tree must remain 139 people');
assert.equal(family.people.length, PROOF_EXPECTED_PEOPLE);
assert.equal(family.metadata.basePeople, PROOF_BASE_EXPECTED_PEOPLE);

const expansionSiblings = family.people.filter(person => person.proofExpansionKind === 'sibling');
const expansionSpouses = family.people.filter(person => person.proofExpansionKind === 'spouse');
assert.equal(expansionSiblings.length, 53, 'one breadth step should add 53 GEDCOM-recorded siblings');
assert.equal(expansionSpouses.length, 33, 'one breadth step should add 33 GEDCOM-recorded spouses');
assert.equal(PROOF_BASE_EXPECTED_PEOPLE + expansionSiblings.length + expansionSpouses.length, family.people.length);

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

for (const person of family.people) {
  if (!person.proofExpansionKind) continue;
  assert.ok(['sibling', 'spouse'].includes(person.proofExpansionKind), 'expansion may only add one-step siblings or spouses');
}

const connected = new Set([PROOF_ROOT_ID]);
let changed = true;
while (changed) {
  changed = false;
  for (const link of family.relationships) {
    if (connected.has(link.from) && !connected.has(link.to)) { connected.add(link.to); changed = true; }
    if (connected.has(link.to) && !connected.has(link.from)) { connected.add(link.from); changed = true; }
  }
}
assert.equal(connected.size, family.people.length, 'every proof-tree person must connect to the home person through displayed GEDCOM relationships');

console.log('proof-family.test.mjs passed');
