import assert from 'node:assert/strict';
import { projectedSphereVerticalBounds } from '../src/geometry.js';

const listeners = new Map();
globalThis.document = { getElementById: () => null };
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: true });
globalThis.ResizeObserver = class { observe() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.devicePixelRatio = 1;

const canvas = {
  width: 0,
  height: 0,
  dataset: {},
  getContext: () => ({}),
  getBoundingClientRect: () => ({ width: 1200, height: 800 }),
  addEventListener: (type, handler) => listeners.set(type, handler),
  setPointerCapture: () => {},
};

const { GlobeScene } = await import('../src/scene.js');
const scene = new GlobeScene(canvas, () => {});
scene.setFamily([
  { id: 'HOME', name: 'Home', role: 'root', branch: 'center', birth: { date: '1969' } },
  { id: 'PARENT', name: 'Parent', role: 'parent', branch: 'paternal', birth: { date: '1940' } },
], [
  { type: 'parent', from: 'PARENT', to: 'HOME' },
]);

function assertSphereCentered(message) {
  const camera = scene.camera();
  const bounds = projectedSphereVerticalBounds(camera, scene.radius);
  assert(bounds, `${message}: sphere bounds must be projectable`);
  assert.ok(Math.abs(camera.cx - 600) < 1e-9, `${message}: sphere x center must remain at viewport midpoint`);
  assert.ok(Math.abs(bounds.centerY - 400) < 1e-7, `${message}: projected sphere y center must remain at viewport midpoint`);
}

scene.focus('PARENT');
assert.equal(scene.focusedId, 'PARENT');
const focusedYaw = scene.yaw;
const focusedPitch = scene.pitch;
assertSphereCentered('after focusing another person');

const wheel = listeners.get('wheel');
assert.equal(typeof wheel, 'function', 'scene must install wheel zoom interaction');
for (let index = 0; index < 60; index += 1) {
  wheel({ deltaY: -100, preventDefault() {} });
}
assert.equal(scene.focusedId, 'PARENT', 'zooming all the way in must never change the selected person to Home');
assert.ok(Math.abs(scene.yaw - focusedYaw) < 1e-12, 'wheel zoom must not rotate away from the selected person');
assert.ok(Math.abs(scene.pitch - focusedPitch) < 1e-12, 'wheel zoom must not pitch away from the selected person');
assert.ok(scene.cameraGap <= 3.800001, 'test should actually reach the closest supported zoom');
assertSphereCentered('at closest zoom');

for (let index = 0; index < 100; index += 1) {
  wheel({ deltaY: 100, preventDefault() {} });
}
assert.ok(scene.cameraGap >= 519.9, 'test should actually reach the farthest supported zoom');
assertSphereCentered('at farthest zoom');

const pointerDown = listeners.get('pointerdown');
const pointerMove = listeners.get('pointermove');
const pointerUp = listeners.get('pointerup');
pointerDown({ clientX: 400, clientY: 300, pointerId: 1 });
pointerMove({ clientX: 650, clientY: 420 });
pointerUp({ offsetX: 650, offsetY: 420 });
assertSphereCentered('after drag rotation');

scene.focus('HOME', { resetZoom: true });
assert.equal(scene.focusedId, 'HOME', 'Home remains an explicit focus action');
assert.ok(scene.cameraGap > 3.8, 'explicit Home action may restore the normal home camera distance');
assertSphereCentered('after returning Home');

console.log('wheel zoom preserves focus and the projected globe center remains fixed at the viewport center');
