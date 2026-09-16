import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ATLAS_DETAIL_CREDIT,
  ATLAS_DETAIL_LEVELS,
  ATLAS_DETAIL_SOURCE_PAGE,
  ATLAS_FALLBACK_TEXTURE_URL,
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

assert.equal(ATLAS_TEXTURE_URL, 'assets/atlas-base.svg', 'fictional base atlas must remain bundled with the app');
assert.equal(ATLAS_FALLBACK_TEXTURE_URL, 'assets/atlas-base-fallback.svg', 'the prior neutral atlas must remain available as an explicit fallback asset');
assert.equal(ATLAS_RELIEF_TEXTURE_URL, ATLAS_TEXTURE_URL, 'fictional atlas mode must not blend real Earth imagery into the invented map');
assert.equal(ATLAS_RELIEF_TEXTURE_FALLBACK_URL, ATLAS_TEXTURE_URL, 'lower-capability devices must retain the same fictional geography');
assert.equal(ATLAS_DETAIL_LEVELS.length, 0, 'real-world regional WMS overlays must remain disabled for the fictional atlas');
assert.equal(atlasDetailLevel(7), null);
assert.equal(atlasDetailLevel(100), null);
assert.equal(atlasDetailStrength(7), 0);
assert.equal(atlasDetailStrength(100), 0);
assert.equal(quantizeAtlasDetailCenter(ATLAS_HOME_ANCHOR, atlasDetailLevel(7)), null);
assert.equal(atlasDetailBounds(ATLAS_HOME_ANCHOR, atlasDetailLevel(7)), null);

const localAtlas = fs.readFileSync(new URL(`../${ATLAS_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(localAtlas, /^<svg[^>]*width="8192"[^>]*height="4096"/i, 'fictional atlas must provide a large 8192×4096 vector canvas for future sphere growth');
assert.match(localAtlas, /fill="url\(#land\)"/, 'fictional atlas must contain deliberate invented land masses rather than a blank graticule');
assert.match(localAtlas, /OCEANVS FAMILIAE/, 'fictional atlas should retain decorative pseudo-Latin cartography');
assert.match(localAtlas, /TEMPORA OMNIA/, 'fictional atlas should retain multiple decorative cartographic labels');
assert.match(localAtlas, /translate\(1460 2450\)/, 'fictional atlas should retain decorative sailing-ship artwork');
assert.match(localAtlas, /translate\(7200 860\)/, 'fictional atlas should retain its decorative compass rose');

const fallbackAtlas = fs.readFileSync(new URL(`../${ATLAS_FALLBACK_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(fallbackAtlas, /^<svg[^>]*width="2048"[^>]*height="1024"/i, 'fallback must preserve the previous neutral atlas dimensions');
assert.doesNotMatch(fallbackAtlas, /OCEANVS FAMILIAE/, 'fallback must remain the old neutral treatment rather than silently duplicating the new fictional atlas');

assert.equal(ATLAS_DETAIL_SOURCE_PAGE, '', 'fictional atlas mode must not claim a live NASA regional source');
assert.match(ATLAS_DETAIL_CREDIT, /disabled for fictional atlas mode/i, 'disabled real-world regional detail must be documented truthfully');
assert.equal(ATLAS_TEXTURE_SOURCE_PAGE, '', 'bundled fictional atlas does not depend on a live source page');
assert.match(ATLAS_TEXTURE_CREDIT, /fictional antique atlas/i, 'bundled atlas provenance must identify it as fictional');
assert.equal(ATLAS_TEXTURE_SHA1, 'bundled-fictional-atlas-v1');
assert.equal(ATLAS_HOME_ANCHOR.label, 'Fictional atlas home orientation');
assert.ok(Number.isFinite(ATLAS_HOME_ANCHOR.latitude) && Math.abs(ATLAS_HOME_ANCHOR.latitude) <= 90);
assert.ok(Number.isFinite(ATLAS_HOME_ANCHOR.longitude) && Math.abs(ATLAS_HOME_ANCHOR.longitude) <= 180);

console.log('fictional antique atlas is bundled, scalable, non-geographic, and preserves the prior atlas as fallback');
