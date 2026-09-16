import assert from 'node:assert/strict';
import {
  PLAQUE_NAME_START_RATIO,
  PLAQUE_DATE_START_RATIO,
  PLAQUE_DATE_MIN_RATIO,
} from '../src/plaque.js';

assert.ok(PLAQUE_DATE_START_RATIO < PLAQUE_NAME_START_RATIO * 0.75, 'dates should remain clearly subordinate to the person name');
assert.ok(PLAQUE_DATE_START_RATIO <= 0.043, 'date typography must not drift back to the oversized pre-v0.4.19 treatment');
assert.ok(PLAQUE_DATE_MIN_RATIO < PLAQUE_DATE_START_RATIO, 'long dates may shrink further to fit without enlarging the plaque');

console.log('plaque dates remain visually subordinate to names');
