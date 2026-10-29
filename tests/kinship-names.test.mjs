import assert from 'node:assert/strict';
import { describePairRelationship } from '../src/relationships.js';
import { findRelationshipPath } from '../src/relationship-path.js';

const ids = [
  'root', 'rootFather', 'rootMother', 'rootGrandpa', 'rootGrandma',
  'rootGreat', 'aunt', 'greatAunt', 'cousin', 'cousinChild', 'cousinGrandchild',
  'cousinGreatGrandchild', 'cousinMother', 'cousinSpouse',
  'spouse', 'stepParent', 'stepSister', 'otherParent', 'halfSister',
  'son', 'wifeFather', 'wifeMother', 'unrelated',
];
const sex = new Map([
  ['root','M'], ['rootFather','M'], ['rootMother','F'],
  ['rootGrandpa','M'], ['rootGrandma','F'], ['rootGreat','M'],
  ['aunt','F'], ['greatAunt','F'], ['cousin','F'],
  ['cousinChild','F'], ['cousinGrandchild','F'], ['cousinGreatGrandchild','F'],
  ['spouse','F'], ['stepParent','M'], ['stepSister','F'], ['otherParent','F'],
  ['halfSister','F'], ['son','M'], ['wifeFather','M'], ['wifeMother','F'],
]);
const people = ids.map(id => ({ id, sex: sex.get(id) || 'U' }));
const parent = (from, to, familyId) => ({ type: 'parent', from, to, familyId });
const marry = (from, to, familyId) => ({ type: 'spouse', from, to, familyId });
const relations = [
  parent('rootFather','root','fr'), parent('rootMother','root','fr'),
  marry('rootFather','rootMother','fr'),
  parent('rootGrandpa','rootFather','gp'), parent('rootGrandma','rootFather','gp'),
  parent('rootGrandpa','aunt','gp'), parent('rootGrandma','aunt','gp'),
  parent('rootGreat','rootGrandpa','ggp'), parent('rootGreat','greatAunt','ggp'),
  parent('aunt','cousin','cousins'),
  parent('cousinMother','cousin','cousins'),
  parent('cousin','cousinChild','gen1'),
  parent('cousinChild','cousinGrandchild','gen2'),
  parent('cousinGrandchild','cousinGreatGrandchild','gen3'),
  marry('root','spouse','rootSpouse'),
  parent('root','son','child'),
  parent('wifeFather','spouse','wifeFam'),
  parent('wifeMother','spouse','wifeFam'),
  marry('rootMother','stepParent','stepHousehold'),
  parent('stepParent','stepSister','stepFamily'),
  parent('otherParent','stepSister','stepFamily'),
  parent('rootFather','halfSister','halves'),
  parent('otherParent','halfSister','halves'),
];
const label = (a,b) => {
  const path = findRelationshipPath(a,b,people,relations);
  return describePairRelationship(a,b,people,relations,path?.path);
};
assert.equal(label('root','rootFather'), 'Father');
assert.equal(label('root','rootMother'), 'Mother');
assert.equal(label('root','rootGrandpa'), 'Grandfather');
assert.equal(label('root','rootGreat'), 'Great-grandfather');
assert.equal(label('root','aunt'), 'Aunt');
assert.equal(label('root','greatAunt'), 'Grand-aunt');
assert.equal(label('root','cousin'), 'First cousin');
assert.equal(label('root','cousinChild'), 'First cousin once removed');
assert.equal(label('root','cousinGrandchild'), 'First cousin twice removed');
assert.equal(label('root','cousinGreatGrandchild'), 'First cousin 3 times removed');
assert.equal(label('root','stepSister'), 'Stepsister');
assert.equal(label('root','stepParent'), 'Stepfather');
assert.equal(label('root','halfSister'), 'Half-sister');
assert.equal(label('root','spouse'), 'Wife');
assert.equal(label('root','wifeFather'), 'Father-in-law');
assert.equal(label('root','son'), 'Son');
assert.equal(label('root','unrelated'), 'Family connection recorded (exact relationship not established)');
assert.equal(label('root','root'), 'Same person');

const partial = [
  parent('rootFather','root','family'),
  parent('rootFather','halfSister','family'),
];
assert.equal(describePairRelationship('root','halfSister', people, partial), 'Sister');

console.log('kinship relationship naming tests passed');
