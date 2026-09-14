import assert from 'node:assert/strict';

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

scene.focus('PARENT');
assert.equal(scene.focusedId, 'PARENT');
const focusedYaw = scene.yaw;
const focusedPitch = scene.pitch;
const wheel = listeners.get('wheel');
assert.equal(typeof wheel, 'function', 'scene must install wheel zoom interaction');

for (let index = 0; index < 60; index += 1) {
  wheel({ deltaY: -100, preventDefault() {} });
}

assert.equal(scene.focusedId, 'PARENT', 'zooming all the way in must never change the selected person to Home');
assert.ok(Math.abs(scene.yaw - focusedYaw) < 1e-12, 'wheel zoom must not rotate away from the selected person');
assert.ok(Math.abs(scene.pitch - focusedPitch) < 1e-12, 'wheel zoom must not pitch away from the selected person');
assert.ok(scene.cameraGap <= 3.800001, 'test should actually reach the closest supported zoom');

scene.focus('HOME', { resetZoom: true });
assert.equal(scene.focusedId, 'HOME', 'Home remains an explicit focus action');
assert.ok(scene.cameraGap > 3.8, 'explicit Home action may restore the normal home camera distance');

console.log('wheel zoom preserves selected-person focus; Home remains explicit');
