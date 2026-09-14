import assert from 'node:assert/strict';
import { cameraBehavior, cameraCenterY, normalizedLogZoom } from '../src/camera-behavior.js';

const MIN_GAP = 3.8;
const DEFAULT_GAP = 7.2;
const OVERVIEW_GAP = 155;

assert.equal(normalizedLogZoom(MIN_GAP, MIN_GAP, OVERVIEW_GAP), 0);
assert.equal(normalizedLogZoom(OVERVIEW_GAP, MIN_GAP, OVERVIEW_GAP), 1);

const gapAt = t => MIN_GAP * Math.pow(OVERVIEW_GAP / MIN_GAP, t);
const close = cameraBehavior(MIN_GAP, MIN_GAP, OVERVIEW_GAP);
const normal = cameraBehavior(DEFAULT_GAP, MIN_GAP, OVERVIEW_GAP);
const medium = cameraBehavior(gapAt(0.5), MIN_GAP, OVERVIEW_GAP);
const far = cameraBehavior(OVERVIEW_GAP, MIN_GAP, OVERVIEW_GAP);

assert.ok(far.viewTilt > medium.viewTilt && medium.viewTilt > normal.viewTilt && normal.viewTilt > close.viewTilt, 'camera angle must change continuously as distance increases');
assert.ok(normal.viewTilt < 0.06, 'normal home view should remain close to perpendicular rather than jumping early toward the horizon');
assert.ok(medium.viewTilt > 0.11 && medium.viewTilt < 0.14, 'medium zoom should be partway through the angle transition');
assert.ok(far.viewTilt >= 0.23 && far.viewTilt <= 0.25, 'wide overview should retain a restrained oblique angle');

const sampledTilts = Array.from({ length: 11 }, (_, index) => cameraBehavior(gapAt(index / 10), MIN_GAP, OVERVIEW_GAP).viewTilt);
const tiltSteps = sampledTilts.slice(1).map((value, index) => value - sampledTilts[index]);
assert.ok(tiltSteps.every(step => step > 0), 'zoom-to-angle curve must never reverse direction');
assert.ok(Math.max(...tiltSteps) < 0.05, 'zoom-to-angle curve must not contain a perceptible jump');

assert.equal(close.targetYRatio, normal.targetYRatio, 'zoom must not vertically pan the focused person');
assert.equal(normal.targetYRatio, medium.targetYRatio, 'zoom must keep one stable focused-person screen height');
assert.equal(medium.targetYRatio, far.targetYRatio, 'wide zoom must still be centered on the focused person');

assert.ok(close.dragSensitivity < normal.dragSensitivity && normal.dragSensitivity < medium.dragSensitivity && medium.dragSensitivity < far.dragSensitivity, 'panning should remain zoom-dependent and slowest during close inspection');
assert.ok(normal.dragSensitivity < 0.00025, 'normal-view panning should remain substantially slower than v0.4.5');
assert.ok(far.dragSensitivity <= 0.00058, 'even the far overview should stay restrained');

const height = 900;
const normalCy = cameraCenterY({ height, targetYRatio: normal.targetYRatio });
const farCy = cameraCenterY({ height, targetYRatio: far.targetYRatio });
assert.equal(normalCy, height * 0.58, 'normal focus point should use the canonical stable screen height');
assert.equal(farCy, normalCy, 'camera principal point must not move merely because zoom changed');

console.log('gradual pivoted camera angle, stable zoom focus, and canonical overview gap ok');
