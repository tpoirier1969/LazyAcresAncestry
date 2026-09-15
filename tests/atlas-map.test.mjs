import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ATLAS_DETAIL_CREDIT,
  ATLAS_DETAIL_LEVELS,
  ATLAS_DETAIL_SOURCE_PAGE,
  ATLAS_HOME_ANCHOR,
  ATLAS_RELIEF_TEXTURE_FALLBACK_URL,
  ATLAS_RELIEF_TEXTURE_URL,
  ATLAS_TEXTURE_CREDIT,
  ATLAS_TEXTURE_SHA1,
  ATLAS_TEXTURE_SOURCE_PAGE,
  ATLAS_TEXTURE_URL,
  atlasDetailBounds,
  atlasDetailLevel,
  atlasDetailStrength,
  quantizeAtlasDetailCenter,
} from '../src/atlas-map.js';

assert.equal(ATLAS_TEXTURE_URL, 'assets/atlas-base.svg', 'base atlas must remain bundled with the app');
assert.match(ATLAS_RELIEF_TEXTURE_URL, /2560px-Solarsystemscope_texture_8k_earth_daymap\.jpg$/, 'normal global relief should use the bounded 2560px texture');
assert.match(ATLAS_RELIEF_TEXTURE_FALLBACK_URL, /1920px-Solarsystemscope_texture_8k_earth_daymap\.jpg$/, 'lower-capability devices should still receive a real geographic global map rather than schematic continent overlays');
assert.equal(ATLAS_DETAIL_LEVELS.length, 0, 'rectangular regional WMS overlays must remain disabled until they can be sphere-masked without visible bounds');
assert.equal(atlasDetailLevel(7), null);
assert.equal(atlasDetailLevel(100), null);
assert.equal(atlasDetailStrength(7), 0);
assert.equal(atlasDetailStrength(100), 0);
assert.equal(quantizeAtlasDetailCenter(ATLAS_HOME_ANCHOR, atlasDetailLevel(7)), null);
assert.equal(atlasDetailBounds(ATLAS_HOME_ANCHOR, atlasDetailLevel(7)), null);

const localAtlas = fs.readFileSync(new URL(`../${ATLAS_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(localAtlas, /^<svg[\s\S]*<path/i, 'bundled atlas must retain subtle graticule geometry');
assert.doesNotMatch(localAtlas, /fill="url\(#land\)"/, 'bundled atlas must not contain simplified filled continent polygons');
assert.doesNotMatch(localAtlas, /<ellipse/i, 'bundled atlas must not contain oversized schematic Great Lakes ovals');

assert.match(ATLAS_DETAIL_SOURCE_PAGE, /^https:\/\/science\.nasa\.gov\//, 'future NASA regional-detail provenance must remain recorded');
assert(ATLAS_DETAIL_CREDIT.includes('NASA'), 'future regional-detail provenance must remain explicit');
assert.equal(ATLAS_TEXTURE_SOURCE_PAGE, '', 'bundled neutral atlas does not depend on a live source page');
assert(ATLAS_TEXTURE_CREDIT.includes('Bundled Lazy Acres Ancestry'), 'bundled atlas provenance must remain explicit');
assert.equal(ATLAS_TEXTURE_SHA1, 'bundled-local-atlas');
assert.ok(ATLAS_HOME_ANCHOR.latitude > 45 && ATLAS_HOME_ANCHOR.latitude < 48, 'home anchor should remain in Michigan Upper Peninsula latitude');
assert.ok(ATLAS_HOME_ANCHOR.longitude < -84 && ATLAS_HOME_ANCHOR.longitude > -91, 'home anchor should remain in Michigan Upper Peninsula longitude');

console.log('atlas uses one stable global geography layer and no visible regional area overlays');