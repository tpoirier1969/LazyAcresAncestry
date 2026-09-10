import { tangentPoint } from './geometry.js';

// Generations get clear vertical bands. People within a generation are kept
// compact, with branch-specific expansion only where large sibling groups need it.
const BASE = {
  root: [0, 0],
  spouse: [2.08, 0.05],
  sibling: [-2.08, 0.05],
};

export function layoutSample(people, radius) {
  const positions = new Map();
  const coordinates = new Map();
  const grandparents = people.filter(p => p.role === 'grandparent');
  const parents = people.filter(p => p.role === 'parent');

  const place = (person, x, y) => {
    coordinates.set(person.id, { x, y });
    positions.set(person.id, tangentPoint(x, y, radius));
  };

  people.forEach(person => {
    const fixed = BASE[person.role];
    if (fixed) place(person, fixed[0], fixed[1]);
  });

  parents.forEach(person => {
    const x = person.branch === 'paternal' ? -1.46 : 1.46;
    place(person, x, 2.48);
  });

  grandparents.forEach(person => {
    const paternal = person.branch === 'paternal';
    const branchGrandparents = grandparents.filter(p => p.branch === person.branch);
    const sideIndex = branchGrandparents.indexOf(person);
    const x = (paternal ? -1 : 1) * (1.25 + sideIndex * 1.78);
    place(person, x, 4.95);
  });

  const siblingGroups = new Map();
  people.filter(p => p.role === 'grandparent-sibling').forEach(person => {
    if (!siblingGroups.has(person.cluster)) siblingGroups.set(person.cluster, []);
    siblingGroups.get(person.cluster).push(person);
  });

  siblingGroups.forEach((group, cluster) => {
    const anchor = grandparents.find(person => person.cluster === cluster);
    if (!anchor) return;
    const anchorXY = coordinates.get(anchor.id);
    const outward = anchor.branch === 'paternal' ? -1 : 1;
    const columns = Math.min(group.length, 5);
    const columnGap = 1.08;
    const rowGap = 0.88;
    const branchGrandparents = grandparents.filter(person => person.branch === anchor.branch);
    const anchorIndex = branchGrandparents.indexOf(anchor);
    const rowBias = (anchorIndex % 2 === 0 ? -1 : 1) * 0.38;

    group.forEach((person, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rowCount = Math.min(columns, group.length - row * columns);
      const offset = (col + 1) * columnGap + (rowCount < columns ? (columns - rowCount) * columnGap * 0.10 : 0);
      const x = anchorXY.x + outward * offset;
      // Keep siblings in the grandparent generation band. Wrapped rows move
      // only slightly within that band instead of masquerading as older generations.
      const y = anchorXY.y + rowBias + (row - (Math.ceil(group.length / columns) - 1) / 2) * rowGap;
      place(person, x, y);
    });
  });

  return positions;
}
