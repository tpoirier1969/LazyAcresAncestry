import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/globe-webgl.js', import.meta.url), 'utf8');

assert.match(
  source,
  /sourceTint\s*=\s*clamp\(\(sourceTint\s*-\s*0\.5\)\s*\*\s*1\.34\s*\+\s*0\.5/,
  'atlas source artwork should receive explicit local contrast before antiquing',
);
assert.match(
  source,
  /antique\s*=\s*mix\(antique,\s*sourceTint,\s*0\.42\)/,
  'the rendered atlas must remain a substantial visible part of the globe shader',
);
assert.match(
  source,
  /sourceGradient[\s\S]*max\(sourceGradient,\s*reliefGradient\)/,
  'coastlines and cartographic edges from the source atlas must contribute to engraving detail',
);

console.log('atlas shader preserves visible source cartography');
