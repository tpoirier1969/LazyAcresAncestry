import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizePlace } from '../src/places.js';

const base = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, base), 'utf8');

const index = JSON.parse(read('data/place-geocodes.json'));
assert.ok(index.entries.length > 4000, 'previous geographic references should be bundled locally');
const keys = new Set();
for (const entry of index.entries) {
  assert.equal(entry.length, 5);
  const [name, canonical, lat, lon, quality] = entry;
  const key = normalizePlace(name);
  assert.ok(key.length > 0);
  assert.ok(!keys.has(key), 'coordinate reference names must be unique');
  keys.add(key);
  assert.ok(canonical);
  assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90);
  assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180);
  assert.ok(['mapped', 'approximate'].includes(quality));
}
assert.ok(keys.has('ishpeming, marquette, michigan, usa'));

const leafletJS = read('vendor/leaflet-1.9.4.js');
const leafletCSS = read('vendor/leaflet-1.9.4.css');
assert.ok(leafletJS.includes('Leaflet 1.9.4'));
assert.ok(leafletCSS.includes('.leaflet-pane') && leafletCSS.includes('.leaflet-tile'));
assert.ok(read('vendor/LEAFLET-LICENSE.txt').includes('BSD 2-Clause License'));
new vm.Script(leafletJS, { filename: 'leaflet-1.9.4.js' });
const mapSource = read('src/places-view.js');
assert.ok(mapSource.includes("'vendor/leaflet-1.9.4'"), 'map should use bundled, pinned Leaflet assets');
assert.ok(read('places.css').includes('mix-blend-mode:normal'), 'map tiles should not wash out over parchment');
const worldSVG = read('assets/geographic-world.svg');
assert.ok(worldSVG.includes('Natural Earth 110m'));
assert.ok(worldSVG.includes('viewBox="0 0 1280 1280"'));
assert.ok(worldSVG.match(/<path d="/g)?.length > 200);
assert.ok(read('assets/GEOGRAPHIC-WORLD-SOURCE.txt').includes('world-atlas license'));
assert.ok(mapSource.includes('assets/geographic-world.svg'));
assert.ok(read('places.css').includes("url('assets/geographic-world.svg')"));

console.log('Bundled places geography and map library integrity passed');
