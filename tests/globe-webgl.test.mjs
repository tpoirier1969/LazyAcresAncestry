import assert from 'node:assert/strict';
import { ATLAS_FLIP_Y, buildSphereMesh } from '../src/globe-webgl.js';

const longitudeSegments = 16;
const latitudeSegments = 8;
const mesh = buildSphereMesh(longitudeSegments, latitudeSegments);

assert.equal(mesh.vertexCount, (longitudeSegments + 1) * (latitudeSegments + 1));
assert.equal(mesh.triangleCount, longitudeSegments * latitudeSegments * 2);
assert.equal(mesh.vertices.length, mesh.vertexCount * 5);
assert.equal(mesh.indices.length, mesh.triangleCount * 3);
assert.equal(ATLAS_FLIP_Y, false, 'atlas upload must preserve source-image top-to-bottom orientation');

const vertex = index => {
  const offset = index * 5;
  return {
    x: mesh.vertices[offset],
    y: mesh.vertices[offset + 1],
    z: mesh.vertices[offset + 2],
    u: mesh.vertices[offset + 3],
    v: mesh.vertices[offset + 4],
  };
};

const stride = longitudeSegments + 1;
const middleRow = latitudeSegments / 2;
const middleCol = longitudeSegments / 2;
const front = vertex(middleRow * stride + middleCol);
assert.ok(Math.abs(front.x) < 1e-6);
assert.ok(Math.abs(front.y) < 1e-6);
assert.ok(Math.abs(front.z + 1) < 1e-6, 'UV center must face the viewing apex');
assert.ok(Math.abs(front.u - 0.5) < 1e-6 && Math.abs(front.v - 0.5) < 1e-6);

const north = vertex(middleCol);
const south = vertex(latitudeSegments * stride + middleCol);
assert.ok(north.y > 0.999 && Math.abs(north.v) < 1e-6, 'north pole must use the top edge of the atlas texture');
assert.ok(south.y < -0.999 && Math.abs(south.v - 1) < 1e-6, 'south pole must use the bottom edge of the atlas texture');

const east = vertex(middleRow * stride + Math.round(longitudeSegments * 0.625));
const west = vertex(middleRow * stride + Math.round(longitudeSegments * 0.375));
assert.ok(east.x > 0, 'increasing atlas longitude must move east to screen-right');
assert.ok(west.x < 0, 'decreasing atlas longitude must move west to screen-left');
assert.ok(east.u > front.u && west.u < front.u, 'atlas U orientation must remain west-to-east');

for (let i = 0; i < mesh.vertexCount; i += 1) {
  const p = vertex(i);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-5, 'sphere vertices must remain unit length');
  assert.ok(p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1, 'UVs must remain inside the atlas texture');
}

console.log('WebGL UV sphere orientation and mesh ok');
