import assert from 'node:assert/strict';
import { ATLAS_POLAR_EPSILON, atlasUnitFromUv, triangleAffine } from '../src/sphere-texture.js';

const front = atlasUnitFromUv(0.5, 0.5);
assert.ok(Math.abs(front.x) < 1e-10);
assert.ok(Math.abs(front.y) < 1e-10);
assert.ok(Math.abs(front.z + 1) < 1e-10);

const east = atlasUnitFromUv(0.75, 0.5);
assert.ok(east.x > 0.99);
assert.ok(Math.abs(east.z) < 1e-10);

const north = atlasUnitFromUv(0.5, 0);
assert.ok(north.y > 0.999, 'polar clamp must remain visually negligible');
assert.ok(ATLAS_POLAR_EPSILON > 0 && ATLAS_POLAR_EPSILON < 0.01);

// The old exact-pole mapping collapsed every longitude to one destination
// point, producing giant texture fans. Longitudes must remain distinct at the
// clamped polar ring.
const northWest = atlasUnitFromUv(0.25, 0);
const northEast = atlasUnitFromUv(0.75, 0);
assert.ok(Math.hypot(northWest.x - northEast.x, northWest.z - northEast.z) > 0.005, 'polar texture row must not collapse to a single point');

const source = [{x:0,y:0},{x:1,y:0},{x:0,y:1}];
const destination = [{x:10,y:20},{x:30,y:20},{x:10,y:50}];
const t = triangleAffine(source, destination);
assert.ok(t);
const apply = p => ({x:t.a*p.x+t.c*p.y+t.e, y:t.b*p.x+t.d*p.y+t.f});
for (let i=0;i<3;i++) {
  const q=apply(source[i]);
  assert.ok(Math.abs(q.x-destination[i].x)<1e-9);
  assert.ok(Math.abs(q.y-destination[i].y)<1e-9);
}
console.log('sphere texture projection ok');
