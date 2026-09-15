import assert from 'node:assert/strict';

// scene.js touches browser globals only when GlobeScene is instantiated. The
// pure guide helper is safe to exercise under Node.
globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.document = globalThis.document || { getElementById() { return null; } };
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false }));
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} };

const { siblingClusterGuide } = await import('../src/scene.js');

const points = [
  { x: -3, y: 10 },
  { x: 0, y: 10.2 },
  { x: 4, y: 9.8 },
];
const guide = siblingClusterGuide(points);
assert(guide, 'documented sibling groups should produce a guide');
assert.ok(guide.railY > guide.averageY, 'omitted-parent sibling rail must point toward the older generation, not toward descendants');
assert.deepEqual(guide.rail[0], [-3, guide.railY]);
assert.deepEqual(guide.rail[1], [4, guide.railY]);
assert.equal(guide.stems.length, 3);
assert.ok(guide.omittedParentsStub[1][1] > guide.railY, 'central stub must continue toward the omitted parent generation');
assert.equal(siblingClusterGuide([{ x: 0, y: 0 }]), null, 'one person is not a sibling cluster');

console.log('fallback sibling rail points upward toward omitted parents and cannot mimic a child rail');