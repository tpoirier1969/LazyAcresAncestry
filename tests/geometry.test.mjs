import assert from 'node:assert/strict';
import { requiredSphereRadius, tangentPoint, projectSpherePoint, projectedTangentFrame } from '../src/geometry.js';

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
const fn = projectedTangentFrame(near, camera, 40, 1, 0.82);
const fm = projectedTangentFrame(mid, camera, 40, 1, 0.82);
const ff = projectedTangentFrame(far, camera, 40, 1, 0.82);
const width = frame => Math.hypot(frame.xAxis.x, frame.xAxis.y) * 2;
assert(width(fn) > width(fm) && width(fm) > width(ff), 'equal-size plaques must shrink monotonically with distance');
assert(width(fn) / width(fm) < 1.35, 'near generations should not jump abruptly in apparent size');
console.log(`geometry ok: sphere diameter ${(radius * 2).toFixed(1)} plaque widths`);
