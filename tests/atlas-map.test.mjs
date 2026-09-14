import assert from 'node:assert/strict';
import {
  ATLAS_HOME_ANCHOR,
  ATLAS_REGIONAL_DETAIL_BOUNDS,
  ATLAS_REGIONAL_DETAIL_CREDIT,
  ATLAS_REGIONAL_DETAIL_SOURCE_PAGE,
  ATLAS_REGIONAL_DETAIL_URL,
  ATLAS_RELIEF_TEXTURE_FALLBACK_URL,
  ATLAS_RELIEF_TEXTURE_URL,
  ATLAS_TEXTURE_CREDIT,
  ATLAS_TEXTURE_SHA1,
  ATLAS_TEXTURE_SOURCE_PAGE,
  ATLAS_TEXTURE_URL,
} from '../src/atlas-map.js';

assert.match(ATLAS_TEXTURE_URL, /^https:\/\/upload\.wikimedia\.org\//, 'atlas must use the detailed Wikimedia base image');
assert(ATLAS_TEXTURE_URL.endsWith('/Equirectangular-projection-topographic-world.jpg'), 'atlas base must remain equirectangular');
assert.match(ATLAS_RELIEF_TEXTURE_URL, /Solarsystemscope_texture_8k_earth_daymap\.jpg$/, 'global detail source should remain a true 8K equirectangular image');
assert.match(ATLAS_RELIEF_TEXTURE_FALLBACK_URL, /3840px-Solarsystemscope_texture_8k_earth_daymap\.jpg$/, 'limited GPUs need a 4K-class global detail fallback');
assert.match(ATLAS_REGIONAL_DETAIL_URL, /^https:\/\/gibs\.earthdata\.nasa\.gov\/wms\/epsg4326\/best\/wms\.cgi\?/, 'Great Lakes detail must come from NASA GIBS WMS');
assert(ATLAS_REGIONAL_DETAIL_URL.includes('width=4096'), 'regional LOD should request enough source pixels to improve the close view');
assert(ATLAS_REGIONAL_DETAIL_URL.includes('layers=BlueMarble_NextGeneration'), 'regional LOD must use the intended Blue Marble layer');
assert.equal(ATLAS_REGIONAL_DETAIL_BOUNDS.west, -105);
assert.equal(ATLAS_REGIONAL_DETAIL_BOUNDS.east, -70);
assert.equal(ATLAS_REGIONAL_DETAIL_BOUNDS.south, 35);
assert.equal(ATLAS_REGIONAL_DETAIL_BOUNDS.north, 55);
assert.match(ATLAS_REGIONAL_DETAIL_SOURCE_PAGE, /^https:\/\/science\.nasa\.gov\//, 'regional NASA provenance page must remain recorded');
assert(ATLAS_REGIONAL_DETAIL_CREDIT.includes('NASA'), 'regional detail credit must remain explicit');
assert.match(ATLAS_TEXTURE_SOURCE_PAGE, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, 'atlas provenance page must remain recorded');
assert(ATLAS_TEXTURE_CREDIT.includes('CC BY-SA 4.0'), 'atlas licensing credit must remain explicit');
assert.match(ATLAS_TEXTURE_SHA1, /^[0-9a-f]{40}$/, 'atlas source checksum must remain recorded for provenance');
assert.ok(ATLAS_HOME_ANCHOR.latitude > 45 && ATLAS_HOME_ANCHOR.latitude < 48, 'home anchor should remain in Michigan Upper Peninsula latitude');
assert.ok(ATLAS_HOME_ANCHOR.longitude < -84 && ATLAS_HOME_ANCHOR.longitude > -91, 'home anchor should remain in Michigan Upper Peninsula longitude');

console.log('regional-LOD antique atlas assets and Upper Peninsula anchor ok');
