import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGedcomFamilies, primaryFamilyOfOrigin } from '../src/gedcom-family-parser.js';

const gedcomUrl = new URL('../Poirier - Hillman - Kauppila - Eilola - Bucco - Sortonen - Perreault - Stella families..ged', import.meta.url);
const text = await readFile(gedcomUrl, 'utf8');
const parsed = parseGedcomFamilies(text);
const motherId = 'I40538615623';
const mother = parsed.individuals.get(motherId);

assert.ok(mother, 'Tod\'s mother must exist in the imported GEDCOM');
assert.ok(primaryFamilyOfOrigin(mother), 'Tod\'s mother must have one preferred family of origin');

const displayedParentLinks = parsed.relationships.filter(link => link.type === 'parent' && link.to === motherId);
const displayedParentFamilies = new Set(displayedParentLinks.map(link => link.familyId));
assert.equal(displayedParentFamilies.size, 1, 'Tod\'s mother must not be displayed with more than one set of parents');
assert.equal(displayedParentLinks.length, 2, 'Tod\'s mother should have exactly two displayed parent links');

const primaryFamilyId = primaryFamilyOfOrigin(mother);
assert.deepEqual([...displayedParentFamilies], [primaryFamilyId]);

const alternateParentLinks = parsed.relationships.filter(link => link.type === 'alternate-parent' && link.to === motherId);
for (const link of alternateParentLinks) {
  assert.notEqual(link.familyId, primaryFamilyId, 'alternate household links must never replace the preferred ancestry family');
}

console.log(`Mary Hillman parentage uses one displayed family (${primaryFamilyId}); ${alternateParentLinks.length} alternate parent links retained as non-ancestral context`);
