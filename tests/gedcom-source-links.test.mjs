import assert from 'node:assert/strict';
import { ancestryRecordUrlFromApid, savedRecordsForIndividual } from '../src/gedcom-family-parser.js';

assert.equal(
  ancestryRecordUrlFromApid('1,7602::2771226'),
  'https://www.ancestry.com/discoveryui-content/view/2771226:7602',
  'Ancestry _APID values should resolve to the corresponding discovery record URL',
);
assert.equal(
  ancestryRecordUrlFromApid('7602::2771226'),
  'https://www.ancestry.com/discoveryui-content/view/2771226:7602',
  'APID parsing should also accept exports without the leading type/version prefix',
);
assert.equal(ancestryRecordUrlFromApid('not-an-apid'), '', 'unknown identifiers must not fabricate a record URL');

const individual = {
  citations: [
    {
      sourceId: 'S1',
      context: 'birth',
      page: 'Page 14',
      apids: ['1,7602::2771226'],
    },
  ],
};
const sources = new Map([
  ['S1', { title: 'Example Ancestry Collection', author: '', publisher: '' }],
]);
const records = savedRecordsForIndividual(individual, sources);
assert.equal(records.length, 1);
assert.equal(records[0].title, 'Example Ancestry Collection');
assert.equal(records[0].url, 'https://www.ancestry.com/discoveryui-content/view/2771226:7602');
assert.match(records[0].detail, /Ancestry record reference/);

console.log('Ancestry _APID saved records receive deterministic direct record links');
