import { tangentPoint } from './geometry.js';

// The visible home view uses perspective, so equal physical surface gaps appear
// progressively compressed as generations move away from the viewing apex.
// Keep the root-to-parent spacing the user already likes, then compensate the
// next band so the apparent generation spacing stays visually even.
const ROOT_Y = 0;
const PARENT_Y = 2.48;
const GRANDPARENT_Y = 5.46;
const PEER_GAP = 1.32;

const BASE = {
  root: [0, ROOT_Y],
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
    place(person, x, PARENT_Y);
  });

  grandparents.forEach(person => {
    const paternal = person.branch === 'paternal';
    const branchGrandparents = grandparents.filter(p => p.branch === person.branch);
    const sideIndex = branchGrandparents.indexOf(person);
    const x = (paternal ? -1 : 1) * (1.34 + sideIndex * 1.92);
    place(person, x, GRANDPARENT_Y);
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
    const rowCountTotal = Math.ceil(group.length / columns);

    group.forEach((person, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rowCount = Math.min(columns, group.length - row * columns);
      const offset = (col + 1) * PEER_GAP + (rowCount < columns ? (columns - rowCount) * PEER_GAP * 0.10 : 0);
      const x = anchorXY.x + outward * offset;
      const y = anchorXY.y + (row - (rowCountTotal - 1) / 2) * PEER_GAP;
      place(person, x, y);
    });
  });

  return positions;
}
