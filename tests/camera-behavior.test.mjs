import assert from 'node:assert/strict';
import { blendOverviewCenter, cameraBehavior, cameraCenterY, normalizedLogZoom } from '../src/camera-behavior.js';

const MIN_GAP = 3.8;
const DEFAULT_GAP = 7.2;
const MAX_GAP = 180;

assert.equal(normalizedLogZoom(MIN_GAP, MIN_GAP, MAX_GAP), 0);
assert.equal(normalizedLogZoom(MAX_GAP, MIN_GAP, MAX_GAP), 1);

const gapAt = t => MIN_GAP * Math.pow(MAX_GAP / MIN_GAP, t);
const close = cameraBehavior(MIN_GAP, MIN_GAP, MAX_GAP);
const normal = cameraBehavior(DEFAULT_GAP, MIN_GAP, MAX_GAP);
const medium = cameraBehavior(gapAt(0.5), MIN_GAP, MAX_GAP);
const far = cameraBehavior(MAX_GAP, MIN_GAP, MAX_GAP);

assert.ok(far.viewTilt > medium.viewTilt && medium.viewTilt > normal.viewTilt && normal.viewTilt > close.viewTilt, 'camera angle must change continuously as distance increases');
assert.ok(normal.viewTilt < 0.06, 'normal home view should remain close to perpendicular rather than jumping early toward the horizon');
assert.ok(medium.viewTilt > 0.12 && medium.viewTilt < 0.17, 'medium zoom should be partway through the angle transition');
assert.ok(far.viewTilt >= 0.27 && far.viewTilt <= 0.29, 'wide overview should retain a restrained but obvious oblique angle');

const sampledTilts = Array.from({ length: 11 }, (_, index) => cameraBehavior(gapAt(index / 10), MIN_GAP, MAX_GAP).viewTilt);
const tiltSteps = sampledTilts.slice(1).map((value, index) => value - sampledTilts[index]);
assert.ok(tiltSteps.every(step => step > 0), 'zoom-to-angle curve must never reverse direction');
assert.ok(Math.max(...tiltSteps) < 0.055, 'zoom-to-angle curve must not contain a perceptible jump');

assert.equal(close.overviewT, 0, 'close inspection must not use overview framing');
assert.equal(far.overviewT, 1, 'maximum distance must fully use overview framing');
assert.ok(medium.overviewT < 0.05, 'overview framing should wait until the user is genuinely pulling back');
assert.ok(close.targetYRatio > far.targetYRatio, 'natural focus framing may rise slightly without shoving the family to the top');
assert.ok(far.targetYRatio >= 0.50, 'wide framing must not use the old aggressive 25-percent focus target');

assert.ok(close.dragSensitivity < normal.dragSensitivity && normal.dragSensitivity < medium.dragSensitivity && medium.dragSensitivity < far.dragSensitivity, 'panning should remain zoom-dependent and slowest during close inspection');
assert.ok(normal.dragSensitivity < 0.00025, 'normal-view panning should remain substantially slower than v0.4.5');
assert.ok(far.dragSensitivity <= 0.00058, 'even the far overview should stay restrained');

const height = 900;
const focal = 936;
const radius = 225;
const normalCenterZ = radius + DEFAULT_GAP;
const normalCy = cameraCenterY({
  height,
  focal,
  centerZ: normalCenterZ,
  radius,
  viewTilt: normal.viewTilt,
  targetYRatio: normal.targetYRatio,
});
const normalFocusWorldY = radius * Math.sin(normal.viewTilt);
const normalFocusWorldZ = -radius * Math.cos(normal.viewTilt);
const normalFocusScreenY = normalCy - normalFocusWorldY * focal / (normalCenterZ + normalFocusWorldZ);
assert.ok(Math.abs(normalFocusScreenY - height * normal.targetYRatio) < 1e-9, 'natural focus framing must remain mathematically stable while camera angle changes');

const projectedFarRadius = 625.3913060750731;
const farBaseCenter = blendOverviewCenter(790, projectedFarRadius, far.overviewT, 14);
assert.ok(Math.abs((farBaseCenter - projectedFarRadius) - 14) < 1e-9, 'canonical far overview should place the sphere top just below the viewport edge');

console.log('gradual camera angle, delayed overview framing, and restrained panning ok');
