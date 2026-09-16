import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseGedcomFamilies, validateGedcomFamilyGraph } from '../src/gedcom-family-parser.js';
import {
  buildProofFamily,
  PROOF_BASE_EXPECTED_PEOPLE,
  PROOF_PRE_CHILD_EXPECTED_PEOPLE,
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
assert.equal(PROOF_PRE_CHILD_EXPECTED_PEOPLE, 139, 'the established pre-child proof tree must remain 139 people');

const expansionSiblings = family.people.filter(person => person.proofExpansionKind === 'sibling');
const expansionSpouses = family.people.filter(person => person.proofExpansionKind === 'spouse');
const expansionChildren = family.people.filter(person => person.proofExpansionKind === 'child');
const expansionCoParents = family.people.filter(person => person.proofExpansionKind === 'co-parent');
console.log(`proof population ${family.people.length}: base ${PROOF_BASE_EXPECTED_PEOPLE}, siblings ${expansionSiblings.length}, spouses ${expansionSpouses.length}, new children ${expansionChildren.length}, supporting co-parents ${expansionCoParents.length}`);
assert.equal(family.people.length, PROOF_EXPECTED_PEOPLE, 'expanded proof-tree population must match the canonical expected count');
assert.equal(family.metadata.basePeople, PROOF_BASE_EXPECTED_PEOPLE);
assert.equal(family.metadata.preChildPeople, PROOF_PRE_CHILD_EXPECTED_PEOPLE);
assert.equal(expansionSiblings.length, 53, 'the established breadth step should still add 53 GEDCOM-recorded siblings');
assert.equal(expansionSpouses.length, 33, 'the established breadth step should still add 33 GEDCOM-recorded spouses');
assert.ok(expansionChildren.length > 0, 'child stress-test expansion must add recorded children beyond the established 139 people');

const ids = new Set(family.people.map(person => person.id));
for (const relation of family.relationships) {
  assert.ok(ids.has(relation.from) && ids.has(relation.to), 'every displayed relationship must stay inside the proof tree');
  assert.ok(relation.familyId, 'every displayed relationship must identify its source GEDCOM FAM record');
  assert.ok(parsed.families.has(relation.familyId), 'every displayed relationship must resolve to a source GEDCOM family');
}

const preChildSeeds = family.people.filter(person => !['child', 'co-parent'].includes(person.proofExpansionKind));
assert.equal(preChildSeeds.length, PROOF_PRE_CHILD_EXPECTED_PEOPLE, 'children must be expanded from exactly the population that was already displayed before this change');
for (const seed of preChildSeeds) {
  const sourcePerson = parsed.individuals.get(seed.id);
  assert.ok(sourcePerson, `${seed.id} must still resolve to the source GEDCOM`);
  for (const familyId of sourcePerson.fams || []) {
    const sourceFamily = parsed.families.get(familyId);
    if (!sourceFamily) continue;
    for (const childId of sourceFamily.children || []) {
      assert.ok(ids.has(childId), `${seed.id} recorded child ${childId} from ${familyId} must be displayed`);
    }
    const coParentId = sourceFamily.husb === seed.id ? sourceFamily.wife : sourceFamily.wife === seed.id ? sourceFamily.husb : null;
    if (coParentId && parsed.individuals.has(coParentId)) {
      assert.ok(ids.has(coParentId), `${seed.id} family ${familyId} must include co-parent ${coParentId} so the visible child family is complete`);
    }
  }
}

const rootParents = family.relationships
  .filter(link => link.type === 'parent' && link.to === PROOF_ROOT_ID)
  .map(link => link.from)
  .sort();
assert.deepEqual(rootParents, ['I40538615623', 'I40538616542'].sort(), 'Tod must have exactly his recorded mother and father');

for (const parentId of rootParents) {
  const grandparents = family.relationships
    .filter(link => link.type === 'parent' && link.to === parentId)
    .map(link => link.from);
  assert.equal(grandparents.length, 2, `${parentId} must retain both recorded parents in the displayed proof tree`);
  grandparents.forEach(grandparentId => {
    const grandparent = family.people.find(person => person.id === grandparentId);
    assert.equal(grandparent?.directAncestorDepth, 2, `${grandparentId} must remain marked as a direct grandparent`);
  });
}

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
  assert.ok(
    ['sibling', 'spouse', 'child', 'co-parent'].includes(person.proofExpansionKind),
    'proof expansion may only add explicitly supported non-recursive relationship kinds',
  );
}

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
  assert.ok(sourceFamily, `family-of-origin group ${person.cluster} must resolve to a GEDCOM family`);
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
  'every proof-tree person must connect to home through a displayed GEDCOM relationship or documented family-of-origin grouping',
);

console.log('proof-family.test.mjs passed');