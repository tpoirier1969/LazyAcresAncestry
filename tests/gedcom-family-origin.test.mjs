import assert from 'node:assert/strict';
import { parseGedcomFamilies, primaryFamilyOfOrigin } from '../src/gedcom-family-parser.js';

const parsed = parseGedcomFamilies(`0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Biological /Father/
1 SEX M
1 FAMS @F1@
0 @I2@ INDI
1 NAME Biological /Mother/
1 SEX F
1 FAMS @F1@
0 @I3@ INDI
1 NAME Child /Example/
1 FAMC @F2@
2 PEDI foster
1 FAMC @F1@
2 PEDI birth
0 @I4@ INDI
1 NAME Aunt /Example/
1 SEX F
1 FAMS @F2@
0 @I5@ INDI
1 NAME Uncle /Example/
1 SEX M
1 FAMS @F2@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 @F2@ FAM
1 HUSB @I5@
1 WIFE @I4@
1 CHIL @I3@
0 TRLR`);

const child = parsed.individuals.get('I3');
assert.equal(primaryFamilyOfOrigin(child), 'F1', 'explicit birth family must outrank a foster/guardian household');
assert.equal(child.famc[0].familyId, 'F1', 'legacy first-family consumers must see the preferred ancestry family first');

const biologicalLinks = parsed.relationships.filter(link => link.to === 'I3' && link.familyId === 'F1');
assert.equal(biologicalLinks.length, 2);
assert.ok(biologicalLinks.every(link => link.type === 'parent'));

const alternateLinks = parsed.relationships.filter(link => link.to === 'I3' && link.familyId === 'F2');
assert.equal(alternateLinks.length, 2);
assert.ok(alternateLinks.every(link => link.type === 'alternate-parent'));
assert.ok(alternateLinks.every(link => link.pedigree === 'foster'));

const implicitBirth = parseGedcomFamilies(`0 @I10@ INDI
1 NAME Parent /One/
1 FAMS @F10@
0 @I11@ INDI
1 NAME Parent /Two/
1 FAMS @F10@
0 @I12@ INDI
1 NAME Child /Two/
1 FAMC @F20@
2 PEDI foster
1 FAMC @F10@
0 @I13@ INDI
1 NAME Foster /One/
1 FAMS @F20@
0 @I14@ INDI
1 NAME Foster /Two/
1 FAMS @F20@
0 @F10@ FAM
1 HUSB @I10@
1 WIFE @I11@
1 CHIL @I12@
0 @F20@ FAM
1 HUSB @I13@
1 WIFE @I14@
1 CHIL @I12@`);
assert.equal(primaryFamilyOfOrigin(implicitBirth.individuals.get('I12')), 'F10', 'an untagged FAMC must outrank an explicitly foster family');

console.log('GEDCOM primary family-of-origin selection ok');
