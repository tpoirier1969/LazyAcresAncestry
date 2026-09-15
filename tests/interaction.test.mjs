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

function assertFocusAt(target, message, tolerance = 0.75) {
  const point = scene.focusedScreenPoint();
  assert(point, `${message}: focused person must remain projectable`);
  assert.ok(Math.abs(point.x - target.x) <= tolerance, `${message}: focused x moved ${Math.abs(point.x - target.x).toFixed(3)}px`);
  assert.ok(Math.abs(point.y - target.y) <= tolerance, `${message}: focused y moved ${Math.abs(point.y - target.y).toFixed(3)}px`);
}

scene.focus('PARENT');
assert.equal(scene.focusedId, 'PARENT');
const focusedTarget = scene.focusedScreenPoint();
assert(focusedTarget, 'focused parent should be visible before zoom');
assertSphereCentered('after focusing another person');

const wheel = listeners.get('wheel');
assert.equal(typeof wheel, 'function', 'scene must install wheel zoom interaction');
for (let index = 0; index < 60; index += 1) {
  wheel({ deltaY: -100, preventDefault() {} });
  assertFocusAt(focusedTarget, `zoom-in step ${index + 1}`);
}
assert.equal(scene.focusedId, 'PARENT', 'zooming all the way in must never change the selected person to Home');
assert.ok(scene.cameraGap <= 3.800001, 'test should actually reach the closest supported zoom');
assertSphereCentered('at closest zoom');
assertFocusAt(focusedTarget, 'at closest zoom');

for (let index = 0; index < 100; index += 1) {
  wheel({ deltaY: 100, preventDefault() {} });
  assertFocusAt(focusedTarget, `zoom-out step ${index + 1}`);
}
assert.ok(scene.cameraGap >= 519.9, 'test should actually reach the farthest supported zoom');
assertSphereCentered('at farthest zoom');
assertFocusAt(focusedTarget, 'at farthest zoom');

const pointerDown = listeners.get('pointerdown');
const pointerMove = listeners.get('pointermove');
const pointerUp = listeners.get('pointerup');
pointerDown({ clientX: 400, clientY: 300, pointerId: 1 });
pointerMove({ clientX: 650, clientY: 420 });
pointerUp({ offsetX: 650, offsetY: 420 });
assertSphereCentered('after drag rotation');

const draggedTarget = scene.focusedScreenPoint();
assert(draggedTarget, 'focused person should remain visible after the test drag');
wheel({ deltaY: -100, preventDefault() {} });
assertFocusAt(draggedTarget, 'zoom after manual rotation');
assertSphereCentered('zoom after manual rotation');

scene.focus('HOME', { resetZoom: true });
assert.equal(scene.focusedId, 'HOME', 'Home remains an explicit focus action');
assert.ok(scene.cameraGap > 3.8, 'explicit Home action may restore the normal home camera distance');
assertSphereCentered('after returning Home');

console.log('wheel zoom preserves the focused screen coordinate while the projected globe center remains fixed');
