import assert from 'node:assert/strict';

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
assert.ok(guide.railY > guide.averageY, 'omitted-parent sibling rail must sit toward the older generation, not toward descendants');
assert.deepEqual(guide.rail[0], [-3, guide.railY]);
assert.deepEqual(guide.rail[1], [4, guide.railY]);
assert.equal(guide.stems.length, 3);
assert.equal('omittedParentsStub' in guide, false, 'fallback sibling rails must not draw dangling lines to parents that are outside scope');
assert.equal(siblingClusterGuide([{ x: 0, y: 0 }]), null, 'one person is not a sibling cluster');

console.log('fallback sibling rails have no dangling stubs and stay visually distinct from child rails');