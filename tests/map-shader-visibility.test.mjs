import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/globe-webgl.js', import.meta.url), 'utf8');

assert.match(
  source,
  /vec4\s+source\s*=\s*texture2D\(uAtlas,\s*vUv\)/,
  'the rendered atlas must be sampled directly as the sphere surface',
);
assert.match(
  source,
  /source\.rgb\s*\*\s*sphereShade/,
  'sphere lighting may shade the atlas but must preserve the atlas artwork itself',
);
assert.doesNotMatch(
  source,
  /landPaper|seaPaper|paperNoise|gridLine|uLabels|progressiveDetail/,
  'the globe shader must not generate parchment, graticules, labels, or replacement cartography over the atlas',
);

console.log('atlas artwork is the sole rendered sphere surface apart from curvature lighting');
