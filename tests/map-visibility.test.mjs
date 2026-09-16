import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mapCanvas = html.match(/<canvas id="mapCanvas"[^>]*style="([^"]+)"/i)?.[1] || '';

assert.ok(mapCanvas, 'map canvas must keep an explicit visible presentation contract');
assert.match(mapCanvas, /contrast\(1\.18\)/, 'map texture should keep enough contrast to remain visibly cartographic');
assert.match(mapCanvas, /saturate\(1\.30\)/, 'map texture should retain restrained antique color separation');
assert.doesNotMatch(mapCanvas, /brightness\(1\.1[0-9]/, 'map should not be brightened into the parchment background');

console.log('antique map remains visibly present behind genealogy');
