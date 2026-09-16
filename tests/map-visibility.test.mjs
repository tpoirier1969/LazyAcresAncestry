import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mapCanvas = html.match(/<canvas id="mapCanvas"[^>]*style="([^"]+)"/i)?.[1] || '';

assert.ok(mapCanvas, 'map canvas must keep an explicit visible presentation contract');
assert.match(mapCanvas, /filter:none/, 'the atlas canvas must not be recolored or hidden behind CSS filters');
assert.doesNotMatch(mapCanvas, /brightness\(|contrast\(|saturate\(/, 'the map artwork should reach the sphere without a color curtain');

console.log('map canvas presents the atlas artwork directly');
