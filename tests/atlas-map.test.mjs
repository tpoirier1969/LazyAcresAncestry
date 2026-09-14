import assert from 'node:assert/strict';
import {
  ATLAS_TEXTURE_CREDIT,
  ATLAS_TEXTURE_SHA1,
  ATLAS_TEXTURE_SOURCE_PAGE,
  ATLAS_TEXTURE_URL,
} from '../src/atlas-map.js';

assert.match(ATLAS_TEXTURE_URL, /^https:\/\/upload\.wikimedia\.org\//, 'atlas must use the high-detail Wikimedia source image');
assert(ATLAS_TEXTURE_URL.endsWith('/Equirectangular-projection-topographic-world.jpg'), 'atlas texture must remain the equirectangular physical world map');
assert.match(ATLAS_TEXTURE_SOURCE_PAGE, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, 'atlas provenance page must remain recorded');
assert(ATLAS_TEXTURE_CREDIT.includes('CC BY-SA 4.0'), 'atlas licensing credit must remain explicit');
assert.match(ATLAS_TEXTURE_SHA1, /^[0-9a-f]{40}$/, 'atlas source checksum must remain recorded for provenance');
console.log('high-detail atlas texture provenance ok');
