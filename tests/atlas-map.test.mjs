import assert from 'node:assert/strict';
import {
  ATLAS_HOME_ANCHOR,
  ATLAS_RELIEF_TEXTURE_FALLBACK_URL,
  ATLAS_RELIEF_TEXTURE_ULTRA_CREDIT,
  ATLAS_RELIEF_TEXTURE_ULTRA_SOURCE_PAGE,
  ATLAS_RELIEF_TEXTURE_ULTRA_URL,
  ATLAS_RELIEF_TEXTURE_URL,
  ATLAS_TEXTURE_CREDIT,
  ATLAS_TEXTURE_SHA1,
  ATLAS_TEXTURE_SOURCE_PAGE,
  ATLAS_TEXTURE_URL,
} from '../src/atlas-map.js';

assert.match(ATLAS_TEXTURE_URL, /^https:\/\/upload\.wikimedia\.org\//, 'atlas must use the detailed Wikimedia base image');
assert(ATLAS_TEXTURE_URL.endsWith('/Equirectangular-projection-topographic-world.jpg'), 'atlas base must remain equirectangular');
assert.match(ATLAS_RELIEF_TEXTURE_ULTRA_URL, /16384px-Large_World_Map_unmodified\.jpg$/, 'capable GPUs should request a 16K physical-map detail layer');
assert.match(ATLAS_RELIEF_TEXTURE_ULTRA_SOURCE_PAGE, /Large_World_Map_unmodified\.jpg$/, '16K detail provenance page must remain recorded');
assert(ATLAS_RELIEF_TEXTURE_ULTRA_CREDIT.includes('CC BY-SA 4.0'), '16K detail licensing credit must remain explicit');
assert.match(ATLAS_RELIEF_TEXTURE_URL, /Solarsystemscope_texture_8k_earth_daymap\.jpg$/, '8K detail source must remain available as fallback');
assert.match(ATLAS_RELIEF_TEXTURE_FALLBACK_URL, /3840px-Solarsystemscope_texture_8k_earth_daymap\.jpg$/, 'limited GPUs need a 4K-class detail fallback');
assert.match(ATLAS_TEXTURE_SOURCE_PAGE, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, 'atlas provenance page must remain recorded');
assert(ATLAS_TEXTURE_CREDIT.includes('CC BY-SA 4.0'), 'atlas licensing credit must remain explicit');
assert.match(ATLAS_TEXTURE_SHA1, /^[0-9a-f]{40}$/, 'atlas source checksum must remain recorded for provenance');
assert.ok(ATLAS_HOME_ANCHOR.latitude > 45 && ATLAS_HOME_ANCHOR.latitude < 48, 'home anchor should remain in Michigan Upper Peninsula latitude');
assert.ok(ATLAS_HOME_ANCHOR.longitude < -84 && ATLAS_HOME_ANCHOR.longitude > -91, 'home anchor should remain in Michigan Upper Peninsula longitude');

console.log('16K-capable antique atlas assets and Upper Peninsula anchor ok');
