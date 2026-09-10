import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ATLAS_TEXTURE_URL, atlasTexturePlacement } from '../src/atlas-map.js';

assert(ATLAS_TEXTURE_URL.endsWith('/assets/antique-atlas-texture.svg'), 'atlas should use the bundled atlas image texture');
const base = atlasTexturePlacement({ yaw: 0, pitch: 0, sphereRadius: 1000, imageWidth: 1536, imageHeight: 768 });
assert(base.height > 700 && base.height < 850, `unexpected atlas texture height ${base.height}`);
assert(Math.abs(base.width / base.height - 2) < 1e-9, '2:1 map texture should preserve its aspect ratio');
const quarterTurn = atlasTexturePlacement({ yaw: Math.PI / 2, pitch: 0, sphereRadius: 1000, imageWidth: 1536, imageHeight: 768 });
assert(Math.abs(quarterTurn.xShift + base.width / 4) < 1e-9, 'quarter globe turn should pan texture by one quarter of its width');
const pitched = atlasTexturePlacement({ yaw: 0, pitch: 0.4, sphereRadius: 1000, imageWidth: 1536, imageHeight: 768 });
assert(pitched.yShift > 0 && pitched.yShift < base.height * 0.1, 'pitch should shift the atlas vertically but keep it stable');
const svg = await readFile(new URL('../assets/antique-atlas-texture.svg', import.meta.url), 'utf8');
assert((svg.match(/class="coast"/g) || []).length >= 6, 'atlas texture should contain multiple coherent landmasses');
assert(svg.includes('id="compass"'), 'atlas texture should include cartographic ornament');
console.log('atlas texture and placement ok');
