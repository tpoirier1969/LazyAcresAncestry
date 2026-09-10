import assert from 'node:assert/strict';
import { extractAlternateNames, extractSavedRecords } from '../src/gedcom.js';

const raw = {
  alternate_names: ['Jane Smith', 'Jane Smith', 'Janie Smith'],
  sources: [
    { title: '1900 United States Federal Census', page: 'Ward 3, page 14', url: 'https://example.com/record/1' },
    { titl: 'Michigan Death Records', date: '12 May 1950', repository: 'State archive' },
  ],
};

const records = extractSavedRecords(raw);
assert.equal(records.length, 2);
assert.equal(records[0].title, '1900 United States Federal Census');
assert.match(records[0].detail, /Ward 3/);
assert.equal(records[0].url, 'https://example.com/record/1');
assert.equal(records[1].title, 'Michigan Death Records');
assert.deepEqual(extractAlternateNames(raw), ['Jane Smith', 'Janie Smith']);
assert.deepEqual(extractSavedRecords({ birth: {}, death: {}, alternate_names: [] }), []);

console.log('gedcom record extraction ok');
