import assert from 'node:assert/strict';
import { atlasUnitFromUv, triangleAffine } from '../src/sphere-texture.js';

const front = atlasUnitFromUv(0.5, 0.5);
assert.ok(Math.abs(front.x) < 1e-10);
assert.ok(Math.abs(front.y) < 1e-10);
assert.ok(Math.abs(front.z + 1) < 1e-10);

const east = atlasUnitFromUv(0.75, 0.5);
assert.ok(east.x > 0.99);
assert.ok(Math.abs(east.z) < 1e-10);

const north = atlasUnitFromUv(0.5, 0);
assert.ok(north.y > 0.99);

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
