import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ATLAS_TEXTURE_URL } from '../src/atlas-map.js';

assert(ATLAS_TEXTURE_URL.endsWith('/assets/antique-atlas-texture.svg'));
const svg = await readFile(new URL('../assets/antique-atlas-texture.svg', import.meta.url), 'utf8');
assert(svg.includes('width="4096" height="2048"'), 'atlas texture must remain a high-resolution 2:1 world texture');
assert(svg.includes('id="land"') && svg.includes('id="coastlines"'), 'atlas texture must contain recognizable world land and coastline geometry');
assert(svg.includes('id="graticule"') && svg.includes('id="rhumb-lines"'), 'atlas texture must contain cartographic grid and navigation linework');
assert(svg.includes('MARE ATLANTICUM') && svg.includes('MARE PACIFICUM') && svg.includes('MARE INDICUM'), 'atlas texture should read as a complete world map rather than decorative shapes');
assert(svg.includes('id="compass"'), 'atlas texture must include restrained antique ornament');
assert((svg.match(/<path /g) || []).length > 150, 'atlas texture must retain substantial geographic linework');
console.log('high-resolution antique world texture ok');
