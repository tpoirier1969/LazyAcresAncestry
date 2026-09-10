import assert from 'node:assert/strict';
import { describeRelationship } from '../src/relationships.js';

const people = [
  { id: 'tod', sex: 'M' },
  { id: 'wife', sex: 'F' },
  { id: 'dad', sex: 'M' },
  { id: 'mom', sex: 'F' },
  { id: 'sister', sex: 'F' },
  { id: 'pgm', sex: 'F' },
  { id: 'mgf', sex: 'M' },
  { id: 'pgu', sex: 'M' },
  { id: 'son', sex: 'M' },
];

const relationships = [
  { type: 'spouse', from: 'tod', to: 'wife' },
  { type: 'parent', from: 'dad', to: 'tod' },
  { type: 'parent', from: 'mom', to: 'tod' },
  { type: 'parent', from: 'dad', to: 'sister' },
  { type: 'parent', from: 'mom', to: 'sister' },
  { type: 'parent', from: 'pgm', to: 'dad' },
  { type: 'parent', from: 'mgf', to: 'mom' },
  { type: 'parent', from: 'pgu-parent', to: 'pgm' },
  { type: 'parent', from: 'pgu-parent', to: 'pgu' },
  { type: 'parent', from: 'tod', to: 'son' },
];

assert.equal(describeRelationship('tod', 'tod', people, relationships), 'Home person');
assert.equal(describeRelationship('tod', 'wife', people, relationships), 'Wife');
assert.equal(describeRelationship('tod', 'dad', people, relationships), 'Father');
assert.equal(describeRelationship('tod', 'mom', people, relationships), 'Mother');
assert.equal(describeRelationship('tod', 'sister', people, relationships), 'Sister');
assert.equal(describeRelationship('tod', 'pgm', people, relationships), 'Paternal Grandmother');
assert.equal(describeRelationship('tod', 'mgf', people, relationships), 'Maternal Grandfather');
assert.equal(describeRelationship('tod', 'pgu', people, relationships), 'Paternal Great-Uncle');
assert.equal(describeRelationship('tod', 'son', people, relationships), 'Son');
assert.equal(describeRelationship('tod', 'missing', people, relationships), 'Relationship not identified in current data');

console.log('relationship labels ok');
