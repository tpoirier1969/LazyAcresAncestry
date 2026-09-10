import assert from 'node:assert/strict';
import {
  ATLAS_COMPASS,
  ATLAS_DETAIL_PATHS,
  ATLAS_HACHURES,
  ATLAS_ISLANDS,
  ATLAS_LABELS,
  ATLAS_LANDMASSES,
  ATLAS_MOUNTAINS,
  ATLAS_RHUMB_LINES,
  ATLAS_RIVERS,
  ATLAS_SHIP,
} from '../src/atlas-map.js';

const pathGroups = [ATLAS_LANDMASSES, ATLAS_ISLANDS, ATLAS_DETAIL_PATHS, ATLAS_HACHURES, ATLAS_RHUMB_LINES, ATLAS_RIVERS];
const allPaths = pathGroups.flat();
const allPoints = allPaths.flat();

assert(ATLAS_LANDMASSES.length >= 4, 'atlas should contain several large landmasses');
assert(ATLAS_ISLANDS.length >= 6, 'atlas should contain enough islands to read as cartography');
assert(allPoints.length > 150, 'atlas linework should be materially richer than a few decorative polygons');
assert(ATLAS_LABELS.length >= 4, 'atlas should include visible cartographic labels');
assert(ATLAS_MOUNTAINS.length >= 8, 'atlas should include interior relief marks');

allPoints.forEach(point => {
  assert.equal(point.length, 2, 'atlas coordinates must be x/y pairs');
  assert(point.every(Number.isFinite), 'atlas coordinates must be finite numbers');
  assert(Math.hypot(point[0], point[1]) < 35, 'atlas coordinates must stay inside the intended local sphere neighborhood');
});

[ATLAS_COMPASS, ATLAS_SHIP, ...ATLAS_MOUNTAINS].forEach(feature => {
  assert(Number.isFinite(feature.x) && Number.isFinite(feature.y), 'atlas ornaments must have finite surface positions');
  assert(Number.isFinite(feature.size) && feature.size > 0, 'atlas ornaments must have a positive size');
});

console.log(`atlas map ok: ${ATLAS_LANDMASSES.length} landmasses, ${ATLAS_ISLANDS.length} islands, ${allPoints.length} mapped points`);
