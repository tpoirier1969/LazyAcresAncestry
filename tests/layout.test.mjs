import assert from 'node:assert/strict';
import { layoutSample } from '../src/layout.js';

const people = [
  { id: 'root', role: 'root', branch: 'center' },
  { id: 'spouse', role: 'spouse', branch: 'center' },
  { id: 'sib', role: 'sibling', branch: 'center' },
  { id: 'dad', role: 'parent', branch: 'paternal' },
  { id: 'mom', role: 'parent', branch: 'maternal' },
  { id: 'pgf', role: 'grandparent', branch: 'paternal', cluster: 'p0' },
  { id: 'pgm', role: 'grandparent', branch: 'paternal', cluster: 'p1' },
  { id: 'puncle', role: 'grandparent-sibling', branch: 'paternal', cluster: 'p0' },
];
const positions = layoutSample(people, 78);
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))) * 78;
assert(angle(positions.get('root'), positions.get('spouse')) < 2.2, 'spouse spacing should be compact');
assert(angle(positions.get('root'), positions.get('dad')) < 2.7, 'parent generation should stay close');
assert(angle(positions.get('pgf'), positions.get('puncle')) < 1.7, 'grandparent sibling groups should use compact spacing');
console.log('compact layout spacing ok');
