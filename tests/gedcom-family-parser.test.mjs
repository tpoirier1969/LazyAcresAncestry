import assert from 'node:assert/strict';
import { parseGedcomFamilies, validateGedcomFamilyGraph } from '../src/gedcom-family-parser.js';

const gedcom = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I_TOD@ INDI
1 NAME Tod /Poirier/
1 SEX M
1 FAMC @F_PARENTS@
0 @I_MARY@ INDI
1 NAME Mary /Hillman/
1 SEX F
1 FAMS @F_PARENTS@
0 @I_ROY@ INDI
1 NAME Roy /Poirier/
1 SEX M
1 FAMS @F_PARENTS@
0 @I_AMY@ INDI
1 NAME Amy Sue /Poirier/
1 SEX F
1 FAMC @F_PARENTS@
1 FAMS @F_AMY@
0 @I_MAIKEL@ INDI
1 NAME Maikel /Poirier/
1 SEX M
1 FAMC @F_AMY@
2 PEDI adopted
0 @F_PARENTS@ FAM
1 HUSB @I_ROY@
1 WIFE @I_MARY@
1 CHIL @I_TOD@
1 CHIL @I_AMY@
0 @F_AMY@ FAM
1 WIFE @I_AMY@
1 CHIL @I_MAIKEL@
0 TRLR`;

const parsed = parseGedcomFamilies(gedcom);
assert.equal(parsed.individuals.size, 5);
assert.equal(parsed.families.size, 2);
assert.deepEqual(validateGedcomFamilyGraph(parsed), []);

const todParents = parsed.relationships
  .filter(rel => rel.type === 'parent' && rel.to === 'I_TOD')
  .map(rel => rel.from)
  .sort();
assert.deepEqual(todParents, ['I_MARY', 'I_ROY']);

const amyChildren = [...parsed.families.values()]
  .filter(family => family.husb === 'I_AMY' || family.wife === 'I_AMY')
  .flatMap(family => family.children);
assert.deepEqual(amyChildren, ['I_MAIKEL']);

const maikelParentLinks = parsed.relationships
  .filter(rel => rel.type === 'parent' && rel.to === 'I_MAIKEL');
assert.equal(maikelParentLinks.length, 1);
assert.equal(maikelParentLinks[0].from, 'I_AMY');
assert.equal(maikelParentLinks[0].pedigree, 'adopted');

console.log('GEDCOM family parser preserves FAM parentage and adoption without inference');
