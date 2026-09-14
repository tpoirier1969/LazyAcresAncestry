import assert from 'node:assert/strict';
import { buildSphereMesh } from '../src/globe-webgl.js';

const longitudeSegments = 16;
const latitudeSegments = 8;
const mesh = buildSphereMesh(longitudeSegments, latitudeSegments);

assert.equal(mesh.vertexCount, (longitudeSegments + 1) * (latitudeSegments + 1));
assert.equal(mesh.triangleCount, longitudeSegments * latitudeSegments * 2);
assert.equal(mesh.vertices.length, mesh.vertexCount * 5);
assert.equal(mesh.indices.length, mesh.triangleCount * 3);

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

const middleRow = latitudeSegments / 2;
const middleCol = longitudeSegments / 2;
const front = vertex(middleRow * (longitudeSegments + 1) + middleCol);
assert.ok(Math.abs(front.x) < 1e-6);
assert.ok(Math.abs(front.y) < 1e-6);
assert.ok(Math.abs(front.z + 1) < 1e-6, 'UV center must face the viewing apex');
assert.ok(Math.abs(front.u - 0.5) < 1e-6 && Math.abs(front.v - 0.5) < 1e-6);

for (let i = 0; i < mesh.vertexCount; i += 1) {
  const p = vertex(i);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-5, 'sphere vertices must remain unit length');
  assert.ok(p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1, 'UVs must remain inside the atlas texture');
}

console.log('WebGL UV sphere mesh ok');
