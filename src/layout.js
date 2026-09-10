import { tangentPoint } from './geometry.js';

// Compact by default. The constants deliberately leave breathing room while
// avoiding the wide, sparse prototype layout. Branch-specific expansion can be
// added later when the full relationship graph is available.
const BASE = {
  root: [0, 0],
  spouse: [2.08, 0.10],
  sibling: [-2.08, 0.10],
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
    place(person, x, 2.18);
  });

  grandparents.forEach(person => {
    const paternal = person.branch === 'paternal';
    const branchGrandparents = grandparents.filter(p => p.branch === person.branch);
    const sideIndex = branchGrandparents.indexOf(person);
    const x = (paternal ? -1 : 1) * (1.18 + sideIndex * 1.88);
    place(person, x, 4.05);
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
    const columns = Math.min(group.length, group.length > 9 ? 7 : 6);
    const rowGap = 1.08;
    const columnGap = 1.00;

    group.forEach((person, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rowCount = Math.min(columns, group.length - row * columns);
      const offset = (col + 1) * columnGap + (rowCount < columns ? (columns - rowCount) * columnGap * 0.16 : 0);
      const x = anchorXY.x + outward * offset;
      const y = anchorXY.y + 1.22 + row * rowGap;
      place(person, x, y);
    });
  });

  return positions;
}
