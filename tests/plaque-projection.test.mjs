import assert from 'node:assert/strict';
import { rigidPlaquePlacement } from '../src/plaque-projection.js';

const frame = {
  center: { x: 300, y: 460 },
  anchor: { x: 300, y: 500 },
  xAxis: { x: 40, y: 4 },
  yAxis: { x: 0, y: 40 },
};

const textureWidth = 520;
const textureHeight = 468;
const placement = rigidPlaquePlacement(frame, textureWidth, textureHeight);
assert(placement);
assert(Math.abs(placement.width - Math.hypot(40, 4) * 2) < 1e-9);
assert(Math.abs(placement.height - 80) < 1e-9);
assert(Math.abs(placement.e - frame.center.x) < 1e-9);
assert(Math.abs(placement.f - frame.center.y) < 1e-9);

const projectTexturePoint = (x, y) => ({
  x: placement.a * x + placement.c * y + placement.e,
  y: placement.b * x + placement.d * y + placement.f,
});

const projectedRight = projectTexturePoint(textureWidth / 2, 0);
assert(Math.abs(projectedRight.x - (frame.center.x + frame.xAxis.x)) < 1e-9);
assert(Math.abs(projectedRight.y - (frame.center.y + frame.xAxis.y)) < 1e-9);

const projectedBottom = projectTexturePoint(0, textureHeight / 2);
assert(Math.abs(projectedBottom.x - frame.anchor.x) < 1e-9);
assert(
  Math.abs(projectedBottom.y - frame.anchor.y) < 1e-9,
  'projected plaque bottom center must stay attached to sphere anchor',
);

const foreshortenedFrame = {
  center: { x: 300, y: 480 },
  anchor: { x: 300, y: 500 },
  xAxis: { x: 40, y: 0 },
  yAxis: { x: 0, y: 20 },
};
const foreshortened = rigidPlaquePlacement(foreshortenedFrame, textureWidth, textureHeight);
assert(foreshortened);
assert.equal(foreshortened.height, 40, 'surface tilt must foreshorten plaque height on screen');
assert.equal(foreshortened.width, 80, 'surface tilt must not invent horizontal scaling');

console.log('3D plaque plane projection ok');
