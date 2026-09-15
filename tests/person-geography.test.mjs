import assert from 'node:assert/strict';
import { personGeographyLocations, resolveGenealogyPlace } from '../src/person-geography.js';

assert.equal(resolveGenealogyPlace('Michigan, USA'), null, 'broad state/country geography must not create a person region');
assert.equal(resolveGenealogyPlace('Ishpeming, Marquette, Michigan, USA')?.token, 'ishpeming');
assert.equal(resolveGenealogyPlace('Gwinn, MI')?.token, 'gwinn');

const locations = personGeographyLocations({
  birth: { date: '16 MAY 1969', place: 'Ishpeming, Marquette, Michigan, USA' },
  events: [
    { type: 'RESI', date: '1986', place: 'Ishpeming, Michigan' },
    { type: 'RESI', date: '1987', place: 'Ishpeming, Michigan' },
    { type: 'RESI', date: '1995', place: 'Gwinn, MI' },
    { type: 'RESI', date: '1997', place: 'Gwinn, Michigan' },
    { type: 'RESI', date: '2001-2020', place: 'Ishpeming, Michigan, USA' },
  ],
  death: {},
});

assert.deepEqual(
  locations.map(location => location.token),
  ['ishpeming', 'gwinn', 'ishpeming'],
  'consecutive records for one city should collapse while a later return remains in the travel path',
);

console.log('person-geography.test.mjs passed');
