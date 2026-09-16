import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ATLAS_CODED_FALLBACK_TEXTURE_URL,
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

assert.equal(ATLAS_TEXTURE_URL, 'assets/atlas-base.svg', 'rendered base atlas must remain bundled with the app');
assert.equal(ATLAS_FALLBACK_TEXTURE_URL, 'assets/atlas-base-fallback.svg', 'the prior neutral atlas must remain available as an explicit fallback asset');
assert.equal(ATLAS_CODED_FALLBACK_TEXTURE_URL, 'assets/atlas-base-coded-fallback.svg', 'the v0.4.20 coded fictional atlas must be preserved as a separate fallback');
assert.equal(ATLAS_RELIEF_TEXTURE_URL, ATLAS_TEXTURE_URL, 'bundled atlas mode must not blend sharp modern Earth imagery over the antique treatment');
assert.equal(ATLAS_RELIEF_TEXTURE_FALLBACK_URL, ATLAS_TEXTURE_URL, 'lower-capability devices must retain the same rendered atlas');
assert.equal(ATLAS_DETAIL_LEVELS.length, 0, 'modern regional WMS overlays must remain disabled');
assert.equal(atlasDetailLevel(7), null);
assert.equal(atlasDetailLevel(100), null);
assert.equal(atlasDetailStrength(7), 0);
assert.equal(atlasDetailStrength(100), 0);
assert.equal(quantizeAtlasDetailCenter(ATLAS_HOME_ANCHOR, atlasDetailLevel(7)), null);
assert.equal(atlasDetailBounds(ATLAS_HOME_ANCHOR, atlasDetailLevel(7)), null);

const localAtlas = fs.readFileSync(new URL(`../${ATLAS_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(localAtlas, /^<svg[^>]*width="8192"[^>]*height="4096"/i, 'rendered atlas must keep the large 8192×4096 texture contract');
assert.match(localAtlas, /data:image\/jpeg;base64,/i, 'canonical atlas must contain the rendered raster artwork rather than regenerated geometric land paths');
assert.doesNotMatch(localAtlas, /fill="url\(#land\)"/, 'canonical rendered atlas must not silently fall back to the coded v0.4.20 landmass generator');

const codedFallback = fs.readFileSync(new URL(`../${ATLAS_CODED_FALLBACK_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(codedFallback, /fill="url\(#land\)"/, 'coded fictional atlas must remain preserved as a fallback asset');
assert.match(codedFallback, /OCEANVS FAMILIAE/, 'coded fallback should retain its identifying cartographic label');

const fallbackAtlas = fs.readFileSync(new URL(`../${ATLAS_FALLBACK_TEXTURE_URL}`, import.meta.url), 'utf8');
assert.match(fallbackAtlas, /^<svg[^>]*width="2048"[^>]*height="1024"/i, 'neutral fallback must preserve its previous dimensions');

assert.equal(ATLAS_DETAIL_SOURCE_PAGE, '', 'bundled atlas mode must not claim a live NASA regional source');
assert.match(ATLAS_DETAIL_CREDIT, /disabled for bundled antique atlas mode/i, 'disabled modern regional detail must be documented truthfully');
assert.equal(ATLAS_TEXTURE_SOURCE_PAGE, '', 'bundled rendered atlas does not depend on a live source page');
assert.match(ATLAS_TEXTURE_CREDIT, /rendered antique atlas/i, 'atlas provenance must identify it as rendered artwork');
assert.equal(ATLAS_TEXTURE_SHA1, 'bundled-rendered-atlas-v1');
assert.equal(ATLAS_HOME_ANCHOR.label, 'Central Upper Peninsula home orientation');
assert.ok(Number.isFinite(ATLAS_HOME_ANCHOR.latitude) && Math.abs(ATLAS_HOME_ANCHOR.latitude) <= 90);
assert.ok(Number.isFinite(ATLAS_HOME_ANCHOR.longitude) && Math.abs(ATLAS_HOME_ANCHOR.longitude) <= 180);

console.log('rendered antique atlas is bundled, faded, and preserves both prior fallback treatments');