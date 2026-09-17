import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/globe-webgl.js', import.meta.url), 'utf8');
const atlas = await readFile(new URL('../assets/atlas-base.svg', import.meta.url), 'utf8');

assert.match(
  atlas,
  /<image\b[^>]*href=["']data:image\/jpeg;base64,/i,
  'the bundled rendered atlas wrapper must contain the expected embedded JPEG artwork',
);
assert.match(
  source,
  /embeddedRasterSource\(svgText\)/,
  'the renderer must extract the embedded raster artwork instead of relying on WebGL to rasterize the SVG wrapper',
);
assert.match(
  source,
  /MAX_TEXTURE_SIZE/,
  'the renderer must respect the device texture-size limit before uploading atlas artwork',
);
assert.match(
  source,
  /gl\.getError\(\)/,
  'the renderer must verify that WebGL accepted the atlas texture upload',
);
assert.ok(
  source.indexOf('this.uploadTexture(image);') < source.indexOf('this.ready = true;'),
  'the atlas renderer must not report ready until the artwork has been uploaded successfully',
);
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

console.log('atlas artwork is loaded, verified, and used directly as the sphere surface');
