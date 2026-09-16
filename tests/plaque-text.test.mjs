import assert from 'node:assert/strict';
import {
  PLAQUE_NAME_START_RATIO,
  PLAQUE_DATE_START_RATIO,
  PLAQUE_DATE_MIN_RATIO,
} from '../src/plaque.js';

assert.ok(PLAQUE_DATE_START_RATIO < PLAQUE_NAME_START_RATIO * 0.85, 'dates should remain visibly subordinate to the person name');
assert.ok(PLAQUE_DATE_START_RATIO >= 0.047 && PLAQUE_DATE_START_RATIO <= 0.051, 'preferred date size should sit between the earlier oversized and later undersized treatments');
assert.ok(PLAQUE_DATE_MIN_RATIO >= 0.033 && PLAQUE_DATE_MIN_RATIO <= 0.038, 'wrapped dates should remain readable while retaining room to fit');
assert.ok(PLAQUE_DATE_MIN_RATIO < PLAQUE_DATE_START_RATIO, 'long dates may shrink further to fit without enlarging the plaque');

console.log('plaque dates use the approved intermediate readable hierarchy');
