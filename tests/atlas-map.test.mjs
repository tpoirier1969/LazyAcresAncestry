import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ATLAS_DETAIL_CREDIT,
  ATLAS_DETAIL_FADE_MS,
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
  atlasDetailKey,
  atlasDetailLevel,
  atlasDetailStrength,
  atlasDetailUrl,
  quantizeAtlasDetailCenter,
} from '../src/atlas-map.js';

assert.equal(ATLAS_TEXTURE_URL, 'assets/atlas-base.svg', 'base atlas must be bundled with the app so the globe cannot go blank when remote imagery fails');
assert.equal(ATLAS_RELIEF_TEXTURE_FALLBACK_URL, ATLAS_TEXTURE_URL, 'low-capability or failed relief loads must fall back to the bundled atlas');
assert.match(ATLAS_RELIEF_TEXTURE_URL, /3840px-Solarsystemscope_texture_8k_earth_daymap\.jpg$/, 'global relief should use a bounded 4K-class texture');
assert.equal(ATLAS_DETAIL_LEVELS.length, 4, 'progressive atlas should expose four regional detail levels');
assert.deepEqual(ATLAS_DETAIL_LEVELS.map(level => level.id), ['local', 'subregional', 'regional', 'continental']);
assert.ok(ATLAS_DETAIL_LEVELS[0].longitudeSpan < ATLAS_DETAIL_LEVELS[1].longitudeSpan);
assert.ok(ATLAS_DETAIL_LEVELS[1].longitudeSpan < ATLAS_DETAIL_LEVELS[2].longitudeSpan);
assert.ok(ATLAS_DETAIL_LEVELS[2].longitudeSpan < ATLAS_DETAIL_LEVELS[3].longitudeSpan);
assert.ok(Math.max(...ATLAS_DETAIL_LEVELS.map(level => level.width)) <= 2560, 'regional detail textures must remain within the GPU memory budget');
assert.ok(ATLAS_DETAIL_FADE_MS >= 250 && ATLAS_DETAIL_FADE_MS <= 600, 'LOD changes should cross-fade without keeping duplicate textures alive unnecessarily long');

const localAtlas = fs.readFileSync(new URL(`../${ATLAS_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(localAtlas, /^<svg[\s\S]*<path/i, 'bundled atlas must contain actual map geometry');
assert.ok(localAtlas.length > 4000, 'bundled atlas must be substantive rather than a blank placeholder');

assert.equal(atlasDetailLevel(7)?.id, 'local');
assert.equal(atlasDetailLevel(20)?.id, 'subregional');
assert.equal(atlasDetailLevel(50)?.id, 'regional');
assert.equal(atlasDetailLevel(100)?.id, 'continental');
assert.equal(atlasDetailLevel(180), null, 'far globe overview should rely on the global texture');
assert.equal(atlasDetailStrength(100), 1);
assert.ok(atlasDetailStrength(140) > 0 && atlasDetailStrength(140) < 1, 'regional layer should fade away smoothly beyond its far LOD');
assert.equal(atlasDetailStrength(155), 0);

const local = atlasDetailLevel(7);
const quantizedHome = quantizeAtlasDetailCenter(ATLAS_HOME_ANCHOR, local);
const quantizedNearby = quantizeAtlasDetailCenter({
  longitude: ATLAS_HOME_ANCHOR.longitude + 1,
  latitude: ATLAS_HOME_ANCHOR.latitude + 1,
}, local);
assert.deepEqual(quantizedNearby, quantizedHome, 'small camera movements should reuse the same regional texture instead of churning GPU uploads');

const homeBounds = atlasDetailBounds(ATLAS_HOME_ANCHOR, local);
assert(homeBounds, 'home view should receive a regional detail rectangle');
assert.ok(ATLAS_HOME_ANCHOR.longitude > homeBounds.west && ATLAS_HOME_ANCHOR.longitude < homeBounds.east);
assert.ok(ATLAS_HOME_ANCHOR.latitude > homeBounds.south && ATLAS_HOME_ANCHOR.latitude < homeBounds.north);
const homeUrl = new URL(atlasDetailUrl(homeBounds, local));
assert.equal(homeUrl.hostname, 'gibs.earthdata.nasa.gov');
assert.equal(homeUrl.searchParams.get('layers'), 'BlueMarble_NextGeneration');
assert.equal(homeUrl.searchParams.get('width'), '2560', 'closest map view should request a sharp but bounded regional image');
assert.ok(Number(homeUrl.searchParams.get('height')) >= 768);
assert.match(atlasDetailKey(homeBounds, local), /^local:/);
assert.equal(atlasDetailBounds({ longitude: 179, latitude: 0 }, local), null, 'single regional WMS requests must fall back to global detail at the antimeridian');

assert.match(ATLAS_DETAIL_SOURCE_PAGE, /^https:\/\/science\.nasa\.gov\//, 'NASA detail provenance page must remain recorded');
assert(ATLAS_DETAIL_CREDIT.includes('NASA'), 'NASA detail credit must remain explicit');
assert.equal(ATLAS_TEXTURE_SOURCE_PAGE, '', 'bundled schematic atlas does not depend on a live source page');
assert(ATLAS_TEXTURE_CREDIT.includes('Bundled Lazy Acres Ancestry'), 'bundled atlas provenance must remain explicit');
assert.equal(ATLAS_TEXTURE_SHA1, 'bundled-local-atlas');
assert.ok(ATLAS_HOME_ANCHOR.latitude > 45 && ATLAS_HOME_ANCHOR.latitude < 48, 'home anchor should remain in Michigan Upper Peninsula latitude');
assert.ok(ATLAS_HOME_ANCHOR.longitude < -84 && ATLAS_HOME_ANCHOR.longitude > -91, 'home anchor should remain in Michigan Upper Peninsula longitude');

console.log('progressive atlas has a guaranteed bundled base while bounding global and regional GPU texture memory');
