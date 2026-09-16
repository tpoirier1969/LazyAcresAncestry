import assert from 'node:assert/strict';
import { projectedSphereVerticalBounds } from '../src/geometry.js';

const listeners = new Map();
const timers = new Map();
let timerSerial = 0;
const hoverCard = {
  hidden: true,
  innerHTML: '',
  style: {},
  getBoundingClientRect: () => ({ width: 320, height: 190 }),
};
globalThis.document = {
  getElementById: id => id === 'personHover' ? hoverCard : null,
};
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: true });
globalThis.ResizeObserver = class { observe() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.setTimeout = (fn, delay) => {
  const id = ++timerSerial;
  timers.set(id, { fn, delay });
  return id;
};
globalThis.clearTimeout = id => timers.delete(id);
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1200;
globalThis.innerHeight = 800;

const canvas = {
  width: 0,
  height: 0,
  dataset: {},
  getContext: () => ({}),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
  addEventListener: (type, handler) => listeners.set(type, handler),
  setPointerCapture: () => {},
};

const { GlobeScene, HOVER_DELAY_MS } = await import('../src/scene.js');
const scene = new GlobeScene(canvas, () => {});
scene.setFamily([
  { id: 'HOME', name: 'Home', role: 'root', branch: 'center', directAncestorDepth: 0, sex: 'M', birth: { date: '1969', place: 'Home Place' } },
  { id: 'PARENT', name: 'Parent Person', role: 'parent', branch: 'paternal', directAncestorDepth: 1, sex: 'M', birth: { date: '1940', place: 'Parent Place' }, rawGedcom: { saved_records: [] } },
], [
  { type: 'parent', from: 'PARENT', to: 'HOME', familyId: 'F1' },
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

const pointerMove = listeners.get('pointermove');
assert.equal(typeof pointerMove, 'function', 'scene must install pointer hover/drag interaction');
scene.hitAreas = [{ id: 'PARENT', x: 240, y: 180, r: 32, z: 1 }];
pointerMove({ offsetX: 240, offsetY: 180, clientX: 240, clientY: 180, pointerType: 'mouse' });
assert.equal(scene.hoverCandidateId, 'PARENT', 'hovering a plaque must start intent tracking for that person');
assert.equal(scene.hoveredId, null, 'person must not be considered visibly hovered before the delay completes');
assert.equal(hoverCard.hidden, true, 'hover card must remain hidden during the intent delay');
assert.equal(timers.size, 1, 'one hover timer should be pending');
const pendingHover = [...timers.entries()][0];
assert.equal(pendingHover[1].delay, HOVER_DELAY_MS);
assert.equal(HOVER_DELAY_MS, 1250, 'hover details should require 1.25 seconds of continuous intent');
pendingHover[1].fn();
timers.delete(pendingHover[0]);
assert.equal(scene.hoveredId, 'PARENT', 'person should become visibly hovered after the delay');
assert.equal(hoverCard.hidden, false, 'completed hover intent must show the reusable person tooltip');
assert.match(hoverCard.innerHTML, /Parent Person/, 'hover card must include the person name');
assert.match(hoverCard.innerHTML, /Parent Place/, 'hover card must include known event place information');
assert.match(hoverCard.innerHTML, /Click for full person details/, 'hover card must point to the existing full details interaction');
pointerMove({ offsetX: 900, offsetY: 700, clientX: 900, clientY: 700, pointerType: 'mouse' });
assert.equal(hoverCard.hidden, true, 'moving away from a plaque must clear the tooltip');
assert.equal(scene.hoverCandidateId, null, 'moving away must clear hover intent as well as the visible card');

scene.focus('PARENT');
assert.equal(scene.focusedId, 'PARENT');
const viewportCenter = { x: 600, y: 400 };
assertFocusAt(viewportCenter, 'click focus must place the selected person at the visible viewport center');
const focusedTarget = scene.focusedScreenPoint();
assert(focusedTarget, 'focused parent should be visible before zoom');
assertSphereCentered('after focusing another person');

const customTarget = { x: 470, y: 400 };
scene.focus('PARENT', { targetPoint: customTarget });
assertFocusAt(customTarget, 'UI may supply the center of the unobscured map area');

const wheel = listeners.get('wheel');
assert.equal(typeof wheel, 'function', 'scene must install wheel zoom interaction');
const anchoredTarget = scene.focusedScreenPoint();
for (let index = 0; index < 60; index += 1) {
  wheel({ deltaY: -100, preventDefault() {} });
  assertFocusAt(anchoredTarget, `zoom-in step ${index + 1}`);
}
assert.equal(scene.focusedId, 'PARENT', 'zooming all the way in must never change the selected person to Home');
assert.ok(scene.cameraGap <= 3.800001, 'test should actually reach the closest supported zoom');
assertSphereCentered('at closest zoom');
assertFocusAt(anchoredTarget, 'at closest zoom');

for (let index = 0; index < 100; index += 1) {
  wheel({ deltaY: 100, preventDefault() {} });
  assertFocusAt(anchoredTarget, `zoom-out step ${index + 1}`);
}
assert.ok(scene.cameraGap >= 519.9, 'test should actually reach the farthest supported zoom');
assertSphereCentered('at farthest zoom');
assertFocusAt(anchoredTarget, 'at farthest zoom');

const pointerDown = listeners.get('pointerdown');
const pointerUp = listeners.get('pointerup');
pointerDown({ clientX: 400, clientY: 300, pointerId: 1 });
pointerMove({ clientX: 650, clientY: 420, pointerType: 'mouse' });
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
assertFocusAt(viewportCenter, 'returning Home must restore the home person to the viewport center');
assertSphereCentered('after returning Home');

console.log('1.25-second hover intent, click focus, anchored wheel zoom, and globe centering remain stable');
