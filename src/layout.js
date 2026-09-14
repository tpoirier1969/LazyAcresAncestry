import { tangentPoint } from './geometry.js';

// The root-to-parent distance is the approved visual baseline. Older generations
// sit slightly farther apart in surface coordinates to compensate for perspective.
const ROOT_Y = 0;
const PARENT_Y = 2.48;
const GRANDPARENT_Y = 5.46;
const PEER_GAP = 1.52;
const MIN_VISIBLE_GAP = 1.48;
const BAND_HALF_HEIGHT = 2.05;

const BASE = {
  root: [0, ROOT_Y],
  spouse: [2.08, 0.05],
  sibling: [-2.08, 0.05],
};

export function layoutSample(people, radius) {
  const positions = new Map();
  const coordinates = new Map();
  const originals = new Map();
  const grandparents = people.filter(p => p.role === 'grandparent');
  const parents = people.filter(p => p.role === 'parent');

  const place = (person, x, y) => {
    const point = { x, y };
    coordinates.set(person.id, point);
    originals.set(person.id, { ...point });
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
    const x = (paternal ? -1 : 1) * (1.34 + sideIndex * 1.96);
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

  // The sibling blocks above are intentionally simple and predictable, but two
  // large families can overlap one another. Resolve those collisions with a
  // deterministic minimum-distance pass in surface coordinates. Direct
  // grandparents stay fixed; siblings move only enough to restore a consistent
  // physical gap, and remain inside the same generation band.
  const generationPeople = people.filter(person => person.role === 'grandparent' || person.role === 'grandparent-sibling');
  relaxGeneration(generationPeople, coordinates, originals);

  coordinates.forEach((point, id) => positions.set(id, tangentPoint(point.x, point.y, radius)));
  return positions;
}

function relaxGeneration(people, coordinates, originals) {
  const pinned = new Set(people.filter(person => person.role === 'grandparent').map(person => person.id));
  const branchById = new Map(people.map(person => [person.id, person.branch]));

  for (let iteration = 0; iteration < 150; iteration += 1) {
    let moved = false;

    for (let i = 0; i < people.length; i += 1) {
      const a = people[i];
      const pa = coordinates.get(a.id);
      if (!pa) continue;
      for (let j = i + 1; j < people.length; j += 1) {
        const b = people[j];
        const pb = coordinates.get(b.id);
        if (!pb) continue;

        let dx = pb.x - pa.x;
        let dy = pb.y - pa.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= MIN_VISIBLE_GAP) continue;

        if (distance < 1e-6) {
          const angle = deterministicAngle(a.id, b.id);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const overlap = MIN_VISIBLE_GAP - distance;
        const nx = dx / distance;
        const ny = dy / distance;
        const aPinned = pinned.has(a.id);
        const bPinned = pinned.has(b.id);
        if (aPinned && bPinned) continue;

        if (aPinned) {
          pb.x += nx * overlap;
          pb.y += ny * overlap;
        } else if (bPinned) {
          pa.x -= nx * overlap;
          pa.y -= ny * overlap;
        } else {
          pa.x -= nx * overlap * 0.5;
          pa.y -= ny * overlap * 0.5;
          pb.x += nx * overlap * 0.5;
          pb.y += ny * overlap * 0.5;
        }
        moved = true;
      }
    }

    people.forEach(person => {
      if (pinned.has(person.id)) return;
      const point = coordinates.get(person.id);
      const original = originals.get(person.id);
      if (!point || !original) return;

      // Very light spring keeps family groups recognizable while collision
      // resolution handles the actual spacing requirement.
      point.x += (original.x - point.x) * 0.010;
      point.y += (original.y - point.y) * 0.010;
      point.y = clamp(point.y, GRANDPARENT_Y - BAND_HALF_HEIGHT, GRANDPARENT_Y + BAND_HALF_HEIGHT);

      const branch = branchById.get(person.id);
      if (branch === 'paternal') point.x = Math.min(point.x, -0.18);
      if (branch === 'maternal') point.x = Math.max(point.x, 0.18);
    });

    if (!moved && iteration > 20) break;
  }
}

function deterministicAngle(a, b) {
  const text = `${a}|${b}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
  return (hash % 6283) / 1000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
