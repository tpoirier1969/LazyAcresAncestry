import assert from 'node:assert/strict';
import { ATLAS_HOME_ANCHOR } from '../src/atlas-map.js';
import { ATLAS_FLIP_Y, atlasPointToLocal, buildSphereMesh } from '../src/globe-webgl.js';

const longitudeSegments = 16;
const latitudeSegments = 8;
const mesh = buildSphereMesh(longitudeSegments, latitudeSegments);

assert.equal(mesh.vertexCount, (longitudeSegments + 1) * (latitudeSegments + 1));
assert.equal(mesh.triangleCount, longitudeSegments * latitudeSegments * 2);
assert.equal(mesh.vertices.length, mesh.vertexCount * 5);
assert.equal(mesh.indices.length, mesh.triangleCount * 3);
assert.equal(ATLAS_FLIP_Y, false, 'atlas upload must preserve source-image top-to-bottom orientation');

const home = atlasPointToLocal(ATLAS_HOME_ANCHOR.longitude, ATLAS_HOME_ANCHOR.latitude);
assert.ok(Math.abs(home.x) < 1e-10 && Math.abs(home.y) < 1e-10 && home.z < -0.999999999, 'Upper Peninsula home anchor must sit at the genealogy viewing apex');

const eastOfHome = atlasPointToLocal(ATLAS_HOME_ANCHOR.longitude + 1, ATLAS_HOME_ANCHOR.latitude);
const westOfHome = atlasPointToLocal(ATLAS_HOME_ANCHOR.longitude - 1, ATLAS_HOME_ANCHOR.latitude);
const northOfHome = atlasPointToLocal(ATLAS_HOME_ANCHOR.longitude, ATLAS_HOME_ANCHOR.latitude + 1);
const southOfHome = atlasPointToLocal(ATLAS_HOME_ANCHOR.longitude, ATLAS_HOME_ANCHOR.latitude - 1);
assert.ok(eastOfHome.x > 0 && westOfHome.x < 0, 'east/west must remain right/left around the home anchor');
assert.ok(northOfHome.y > 0 && southOfHome.y < 0, 'north/south must remain up/down around the home anchor');

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

for (let i = 0; i < mesh.vertexCount; i += 1) {
  const p = vertex(i);
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-5, 'sphere vertices must remain unit length');
  assert.ok(p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1, 'UVs must remain inside the atlas texture');
}

console.log('WebGL atlas anchor, orientation, and mesh ok');
