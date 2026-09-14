import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  requiredSphereRadius,
  tangentPoint,
  projectSpherePoint,
  projectedTangentFrame,
  rotatePoint,
  slerpUnit,
  yawPitchToFront,
} from '../src/geometry.js';
import { buildRelationshipGroups } from '../src/scene.js';

const radius = requiredSphereRadius({ count: 9099, plaqueWidth: 1, plaqueHeight: 0.75, spacingFactor: 1.8, packingEfficiency: 0.65 });
assert(radius > 38 && radius < 40, `unexpected radius ${radius}`);

const camera = { cx: 800, cy: 450, focal: 900, centerZ: 47.8, near: 0.1 };
const near = tangentPoint(0, 0, 40);
const mid = tangentPoint(0, 5, 40);
const far = tangentPoint(0, 10, 40);
const n = projectSpherePoint(near, camera, 40);
const m = projectSpherePoint(mid, camera, 40);
const f = projectSpherePoint(far, camera, 40);
assert(n.z < m.z && m.z < f.z, 'distance from camera must rise smoothly with arc distance');
assert.equal(projectSpherePoint({ x: 0, y: 0, z: 1 }, camera, 40), null, 'back-side sphere points must not project across the visible atlas horizon');
const fn = projectedTangentFrame(near, camera, 40, 1, 0.82);
const fm = projectedTangentFrame(mid, camera, 40, 1, 0.82);
const ff = projectedTangentFrame(far, camera, 40, 1, 0.82);
const width = frame => Math.hypot(frame.xAxis.x, frame.xAxis.y) * 2;
const height = frame => Math.hypot(frame.yAxis.x, frame.yAxis.y) * 2;
assert(width(fn) > width(fm) && width(fm) > width(ff), 'equal-size plaques must shrink monotonically with distance');
assert(width(fn) / width(fm) < 1.35, 'near generations should not jump abruptly in apparent size');

const slopedCamera = { cx: 800, cy: 2100, focal: 900, centerZ: 84.2, near: 0.1 };
const sloped = rotatePoint(tangentPoint(0, 15, 78), 0, 0.15);
const slopedFrame = projectedTangentFrame(sloped, slopedCamera, 78, 1, 0.86);
assert(width(slopedFrame) > 0 && height(slopedFrame) > 0, 'surface-tangent plaque must remain projectable');
assert(height(slopedFrame) < width(slopedFrame) * 1.2, 'surface tilt must naturally foreshorten a plaque rather than standing it upright');

const arcMid = slerpUnit(tangentPoint(-2, 3, 40), tangentPoint(2, 3, 40), 0.5);
assert(Math.abs(Math.hypot(arcMid.x, arcMid.y, arcMid.z) - 1) < 1e-10, 'relationship paths must remain on the sphere');

const offAxis = tangentPoint(5, 4, 40);
const focus = yawPitchToFront(offAxis);
const focused = rotatePoint(offAxis, focus.yaw, focus.pitch);
assert(Math.abs(focused.x) < 1e-8 && Math.abs(focused.y) < 1e-8 && focused.z < -0.999, 'focus rotation must bring the selected point to the viewing apex');

const relationshipSample = [
  { type: 'spouse', from: 'P1', to: 'P2' },
  { type: 'parent', from: 'P1', to: 'C1' },
  { type: 'parent', from: 'P2', to: 'C1' },
  { type: 'parent', from: 'P1', to: 'C2' },
  { type: 'parent', from: 'P2', to: 'C2' },
  { type: 'parent', from: 'MISSING', to: 'C3' },
];
const samplePeople = [
  { id: 'P1' },
  { id: 'P2' },
  { id: 'C1' },
  { id: 'C2' },
  { id: 'C3' },
  { id: 'G1', role: 'grandparent', cluster: 'family-a' },
  { id: 'G2', role: 'grandparent-sibling', cluster: 'family-a' },
  { id: 'UNRELATED' },
];
const knownIds = new Set(samplePeople.map(person => person.id));
const grouped = buildRelationshipGroups(relationshipSample, knownIds, samplePeople);
assert.deepEqual(grouped.spousePairs, [['P1', 'P2']], 'recorded spouses should produce one partner bar');
assert.equal(grouped.parentSets.length, 1, 'children with the same recorded parents should form one sibling group');
assert.deepEqual(grouped.parentSets[0], { parents: ['P1', 'P2'], children: ['C1', 'C2'] });
assert.deepEqual(grouped.siblingClusters, [['G1', 'G2']], 'imported sibling-cluster metadata should create a peer rail without inventing parents');
assert(!JSON.stringify(grouped).includes('MISSING'), 'relationships to people outside the rendered sample must not create stray lines');
assert(!JSON.stringify(grouped).includes('UNRELATED'), 'people without evidence or sibling-cluster metadata must not gain fabricated connectors');

const familySample = JSON.parse(readFileSync(new URL('../data/sample-family.json', import.meta.url), 'utf8'));
const familyIds = new Set(familySample.people.map(person => person.gedcom_id));
const normalizedPeople = familySample.people.map(person => ({
  id: person.gedcom_id,
  role: person.role,
  cluster: person.cluster,
}));
const normalizedRelationships = familySample.relationships.map(link => ({ type: link.type, from: link.from, to: link.to }));
const fullGroups = buildRelationshipGroups(normalizedRelationships, familyIds, normalizedPeople);
const connected = new Set();
fullGroups.spousePairs.forEach(pair => pair.forEach(id => connected.add(id)));
fullGroups.parentSets.forEach(group => {
  group.parents.forEach(id => connected.add(id));
  group.children.forEach(id => connected.add(id));
});
fullGroups.siblingClusters.forEach(ids => ids.forEach(id => connected.add(id)));
const disconnected = [...familyIds].filter(id => !connected.has(id));
assert.deepEqual(disconnected, [], `every current prototype person must connect to at least one other person; disconnected: ${disconnected.join(', ')}`);

console.log(`geometry ok: capacity sphere diameter ${(radius * 2).toFixed(1)} plaque widths; tangent plaques and complete sample connectivity ok`);
