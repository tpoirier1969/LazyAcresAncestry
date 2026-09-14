import assert from 'node:assert/strict';
import { cameraBehavior, cameraCenterY, normalizedLogZoom } from '../src/camera-behavior.js';

const MIN_GAP = 3.8;
const DEFAULT_GAP = 7.2;
const MAX_GAP = 120;

assert.equal(normalizedLogZoom(MIN_GAP, MIN_GAP, MAX_GAP), 0);
assert.equal(normalizedLogZoom(MAX_GAP, MIN_GAP, MAX_GAP), 1);

const close = cameraBehavior(MIN_GAP, MIN_GAP, MAX_GAP);
const normal = cameraBehavior(DEFAULT_GAP, MIN_GAP, MAX_GAP);
const far = cameraBehavior(MAX_GAP, MIN_GAP, MAX_GAP);

assert.ok(far.viewTilt > normal.viewTilt && normal.viewTilt > close.viewTilt, 'camera must tilt progressively toward the horizon as the view pulls back');
assert.ok(normal.viewTilt > 0.20, 'normal home view must have a visibly oblique camera angle');
assert.ok(far.viewTilt - close.viewTilt > 0.45, 'zoom range must create a materially different camera angle');

assert.ok(close.dragSensitivity < normal.dragSensitivity && normal.dragSensitivity < far.dragSensitivity, 'panning should be slowest during close inspection and faster in broad overview');
assert.ok(normal.dragSensitivity < 0.0007, 'normal-view panning should remain substantially slower than the previous interaction');
assert.ok(far.dragSensitivity <= 0.001, 'even the far overview should not return to the old fast pan speed');

const height = 900;
const focal = 936;
const radius = 150;
const centerZ = radius + DEFAULT_GAP;
const cy = cameraCenterY({
  height,
  focal,
  centerZ,
  radius,
  viewTilt: normal.viewTilt,
  targetYRatio: normal.targetYRatio,
});
const focusWorldY = radius * Math.sin(normal.viewTilt);
const focusWorldZ = -radius * Math.cos(normal.viewTilt);
const focusScreenY = cy - focusWorldY * focal / (centerZ + focusWorldZ);
assert.ok(Math.abs(focusScreenY - height * normal.targetYRatio) < 1e-9, 'camera framing must keep the focused person at the intended screen height while the viewing angle changes');

console.log('zoom-dependent camera angle and pan speed ok');
