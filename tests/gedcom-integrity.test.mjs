import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Archival evidence is read-only. Do not update this checksum to accommodate an edit.
// If this test fails, STOP: investigate the unexpected change with the owner.
const GEDCOM_NAME = 'Poirier - Hillman - Kauppila - Eilola - Bucco - Sortonen - Perreault - Stella families..ged';
const ARCHIVAL_SHA256 = '9a5c80c3a94383755c7f2206df622deab315dc732a08c7976a3d29d64c0d038d';
const ARCHIVAL_BYTES = 9274758;

test('the original Ancestry GEDCOM remains byte-for-byte unmodified', () => {
  const bytes = readFileSync(new URL('../' + GEDCOM_NAME, import.meta.url));
  assert.equal(bytes.length, ARCHIVAL_BYTES, 'archival GEDCOM size changed; do not replace source');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ARCHIVAL_SHA256,
    'archival GEDCOM differs from the user-verified original; do not rewrite source');
});
