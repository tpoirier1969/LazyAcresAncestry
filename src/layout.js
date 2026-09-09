import { tangentPoint } from './geometry.js';

const BASE = {
  root: [0, 0],
  spouse: [3.2, 0.2],
  sibling: [-3.2, 0.2],
};

export function layoutSample(people, radius) {
  const positions = new Map();
  const grandparents = people.filter(p => p.role === 'grandparent');
  const parents = people.filter(p => p.role === 'parent');

  people.forEach(person => {
    const fixed = BASE[person.role];
    if (fixed) positions.set(person.id, tangentPoint(fixed[0], fixed[1], radius));
  });

  parents.forEach(person => {
    const x = person.branch === 'paternal' ? -2.25 : 2.25;
    positions.set(person.id, tangentPoint(x, 3.25, radius));
  });

  grandparents.forEach(person => {
    const paternal = person.branch === 'paternal';
    const sideIndex = grandparents.filter(p => p.branch === person.branch).indexOf(person);
    const x = (paternal ? -1 : 1) * (1.7 + sideIndex * 2.65);
    positions.set(person.id, tangentPoint(x, 6.35, radius));
  });

  const siblingGroups = new Map();
  people.filter(p => p.role === 'grandparent-sibling').forEach(person => {
    if (!siblingGroups.has(person.cluster)) siblingGroups.set(person.cluster, []);
    siblingGroups.get(person.cluster).push(person);
  });

  siblingGroups.forEach((group, cluster) => {
    const anchor = grandparents.find(person => person.cluster === cluster);
    if (!anchor) return;
    const anchorUnit = positions.get(anchor.id);
    const side = anchor.branch === 'paternal' ? -1 : 1;
    group.forEach((person, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const spread = (col - Math.min(4, group.length - 1) / 2) * 1.45;
      const x = side * 5.6 + spread;
      const y = 8.8 + row * 1.55;
      positions.set(person.id, tangentPoint(x, y, radius));
    });
    positions.set(anchor.id, anchorUnit);
  });

  return positions;
}
