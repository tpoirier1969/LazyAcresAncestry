import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ATLAS_TEXTURE_URL } from '../src/atlas-map.js';

assert(ATLAS_TEXTURE_URL.endsWith('/assets/antique-atlas-texture.svg'), 'atlas should use the bundled atlas texture');
const svg = await readFile(new URL('../assets/antique-atlas-texture.svg', import.meta.url), 'utf8');
assert(svg.includes('width="4096" height="2048"'), 'atlas texture should retain high-resolution 2:1 dimensions');
assert((svg.match(/class="land"/g) || []).length >= 7, 'atlas texture should contain recognizable world-scale landmasses');
assert((svg.match(/class="river"/g) || []).length >= 1, 'atlas texture should contain river detail');
assert((svg.match(/class="mount"/g) || []).length >= 1, 'atlas texture should contain mountain detail');
assert(svg.includes('AMERICA SEPTENTRIONALIS') && svg.includes('EUROPA') && svg.includes('AFRICA') && svg.includes('ASIA'), 'atlas should read unmistakably as a world map');
assert(svg.includes('translate(560 1570)'), 'atlas texture should include a compass rose');
console.log('high-resolution antique atlas texture ok');
