import assert from 'node:assert/strict';
import { rigidPlaquePlacement } from '../src/plaque-projection.js';

const frame = {
  anchor: { x: 300, y: 500 },
  xAxis: { x: 40, y: 0 },
};

const placement = rigidPlaquePlacement(frame, 520, 468);
assert(placement);
assert(Math.abs(placement.width - 80) < 1e-9);
assert(
  Math.abs(placement.width / placement.height - 520 / 468) < 1e-9,
  'screen rendering must preserve plaque aspect ratio',
);

const bottomCenter = {
  x: placement.center.x + placement.down.x * placement.height * 0.5,
  y: placement.center.y + placement.down.y * placement.height * 0.5,
};
assert(Math.abs(bottomCenter.x - frame.anchor.x) < 1e-9);
assert(
  Math.abs(bottomCenter.y - frame.anchor.y) < 1e-9,
  'bottom center must stay attached to sphere anchor',
);

console.log('rigid plaque placement ok');
