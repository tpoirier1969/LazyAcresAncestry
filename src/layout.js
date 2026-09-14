import { tangentPoint } from './geometry.js';

export const LAYOUT_GAPS = Object.freeze({
  COUPLE_GAP: 1.34,
  SIBLING_GAP: 1.62,
  MIN_PERSON_CLEARANCE: 1.26,
  BETWEEN_FAMILY_GAP: 2.10,
  GENERATION_GAP: 3.35,
});

const BRANCH_ORDER = Object.freeze({ paternal: 0, center: 1, maternal: 2 });
const ROLE_LEVEL = Object.freeze({
  'great-grandparent': 3,
  grandparent: 2,
  'grandparent-sibling': 2,
  parent: 1,
  root: 0,
  spouse: 0,
  sibling: 0,
});
const DIRECT_ROLES = new Set(['root', 'parent', 'grandparent', 'great-grandparent']);
const MIN_LINEAGE_SLOT_SPACING = 12;
const LINEAGE_QUANTUM = 0.5;

export function generationGapForPopulation(count) {
  const population = Math.max(1, Number(count) || 1);
  if (population <= 44) return LAYOUT_GAPS.GENERATION_GAP;
  const extra = Math.log2(population / 44) * 4.5;
  return Math.min(24, LAYOUT_GAPS.GENERATION_GAP + extra);
}

export function layoutSample(people, radius, relationships = []) {
  const positions = new Map();
  if (!people.length) return positions;
  const graph = relationships.length ? relationships : (people.relationships || []);
  const byId = new Map(people.map(person => [person.id, person]));
  const known = new Set(byId.keys());
  const parentLinks = graph.filter(link => link.type === 'parent' && known.has(link.from) && known.has(link.to));
  const spouseLinks = graph.filter(link => link.type === 'spouse' && known.has(link.from) && known.has(link.to));
  const root = people.find(person => person.role === 'root') || people[0];
  const levels = assignGenerations(people, root.id, parentLinks, spouseLinks);
  const parentsByChild = collectParents(parentLinks);
  const spouseAdjacency = collectSpouses(spouseLinks);
  const distances = graphDistances(root.id, people, parentLinks, spouseLinks);
  const lineagePositions = buildLineagePositions(people, root.id, parentsByChild, parentLinks, spouseAdjacency);
  const { unitsByLevel, unitByPerson } = buildGenerationUnits(
    people,
    levels,
    parentsByChild,
    spouseAdjacency,
    distances,
    lineagePositions,
    root.id,
  );
  assignUnitFamilies(unitsByLevel, unitByPerson, parentsByChild);
  const planar = placeUnits(unitsByLevel, root.id, people.length);
  const rootPoint = planar.get(root.id) || { x: 0, y: 0 };

  for (const person of people) {
    const point = planar.get(person.id);
    if (!point) continue;
    positions.set(person.id, tangentPoint(point.x - rootPoint.x, point.y - rootPoint.y, radius));
  }
  return positions;
}

function assignGenerations(people, rootId, parentLinks, spouseLinks) {
  const adjacency = new Map(people.map(person => [person.id, []]));
  parentLinks.forEach(link => {
    adjacency.get(link.from)?.push([link.to, -1]);
    adjacency.get(link.to)?.push([link.from, 1]);
  });
  spouseLinks.forEach(link => {
    adjacency.get(link.from)?.push([link.to, 0]);
    adjacency.get(link.to)?.push([link.from, 0]);
  });

  const levels = new Map();
  const queue = [];
  const seed = (id, level) => {
    if (!id || levels.has(id)) return;
    levels.set(id, level);
    queue.push(id);
  };

  seed(rootId, 0);
  propagateLevels(adjacency, levels, queue);
  people.forEach(person => {
    if (!levels.has(person.id) && ROLE_LEVEL[person.role] != null) {
      seed(person.id, ROLE_LEVEL[person.role]);
    }
  });
  propagateLevels(adjacency, levels, queue);
  people.forEach(person => {
    if (!levels.has(person.id)) levels.set(person.id, 0);
  });
  return levels;
}

function propagateLevels(adjacency, levels, queue) {
  while (queue.length) {
    const id = queue.shift();
    const base = levels.get(id);
    for (const [neighbor, delta] of adjacency.get(id) || []) {
      if (levels.has(neighbor)) continue;
      levels.set(neighbor, base + delta);
      queue.push(neighbor);
    }
  }
}

function collectParents(parentLinks) {
  const map = new Map();
  parentLinks.forEach(link => {
    if (!map.has(link.to)) map.set(link.to, new Set());
    map.get(link.to).add(link.from);
  });
  return map;
}

function collectChildren(parentLinks) {
  const map = new Map();
  parentLinks.forEach(link => {
    if (!map.has(link.from)) map.set(link.from, new Set());
    map.get(link.from).add(link.to);
  });
  return map;
}

function collectSpouses(spouseLinks) {
  const map = new Map();
  spouseLinks.forEach(link => {
    if (!map.has(link.from)) map.set(link.from, new Set());
    if (!map.has(link.to)) map.set(link.to, new Set());
    map.get(link.from).add(link.to);
    map.get(link.to).add(link.from);
  });
  return map;
}

function graphDistances(rootId, people, parentLinks, spouseLinks) {
  const adjacency = new Map(people.map(person => [person.id, new Set()]));
  [...parentLinks, ...spouseLinks].forEach(link => {
    adjacency.get(link.from)?.add(link.to);
    adjacency.get(link.to)?.add(link.from);
  });

  const distances = new Map([[rootId, 0]]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    const distance = distances.get(id);
    for (const neighbor of adjacency.get(id) || []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, distance + 1);
      queue.push(neighbor);
    }
  }
  return distances;
}

function buildLineagePositions(people, rootId, parentsByChild, parentLinks, spouseAdjacency) {
  const byId = new Map(people.map(person => [person.id, person]));
  const childrenByParent = collectChildren(parentLinks);
  const rootParents = [...(parentsByChild.get(rootId) || [])]
    .sort((a, b) => lineagePersonOrder(byId.get(a), byId.get(b)));
  const grandparentBranches = [];

  rootParents.forEach(parentId => {
    const grandparents = [...(parentsByChild.get(parentId) || [])]
      .sort((a, b) => lineagePersonOrder(byId.get(a), byId.get(b)));
    grandparents.forEach(id => {
      if (!grandparentBranches.includes(id)) grandparentBranches.push(id);
    });
  });

  const slotCount = grandparentBranches.length;
  const slotValues = grandparentBranches.map((_, index) => (
    slotCount <= 1 ? 0 : -((slotCount - 1) / 2) + index
  ));
  const sum = new Map();
  const count = new Map();
  const add = (id, slot) => {
    if (!byId.has(id)) return;
    sum.set(id, (sum.get(id) || 0) + slot);
    count.set(id, (count.get(id) || 0) + 1);
  };

  grandparentBranches.forEach((grandparentId, index) => {
    const slot = slotValues[index];
    const seeds = new Set([grandparentId]);
    for (const greatGrandparent of parentsByChild.get(grandparentId) || []) {
      add(greatGrandparent, slot);
      for (const sibling of childrenByParent.get(greatGrandparent) || []) seeds.add(sibling);
    }

    const queue = [...seeds];
    const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      add(id, slot);
      for (const child of childrenByParent.get(id) || []) queue.push(child);
    }
  });

  const positions = new Map();
  people.forEach(person => {
    if (count.has(person.id)) {
      positions.set(person.id, sum.get(person.id) / count.get(person.id));
    }
  });

  for (let pass = 0; pass < 2; pass += 1) {
    for (const person of people) {
      if (positions.has(person.id)) continue;
      const partnerPositions = [...(spouseAdjacency.get(person.id) || [])]
        .map(id => positions.get(id))
        .filter(Number.isFinite);
      if (partnerPositions.length) positions.set(person.id, average(partnerPositions));
    }
  }

  people.forEach(person => {
    if (positions.has(person.id)) return;
    const branch = BRANCH_ORDER[person.branch];
    positions.set(person.id, branch == null ? 0 : branch - 1);
  });
  return positions;
}

function lineagePersonOrder(a, b) {
  const branchA = BRANCH_ORDER[a?.branch] ?? 3;
  const branchB = BRANCH_ORDER[b?.branch] ?? 3;
  if (branchA !== branchB) return branchA - branchB;
  const sexOrder = { M: 0, F: 1, U: 2 };
  const sexA = sexOrder[a?.sex] ?? 3;
  const sexB = sexOrder[b?.sex] ?? 3;
  if (sexA !== sexB) return sexA - sexB;
  const yearA = birthYear(a);
  const yearB = birthYear(b);
  if (yearA !== yearB) return yearA - yearB;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function buildGenerationUnits(
  people,
  levels,
  parentsByChild,
  spouseAdjacency,
  distances,
  lineagePositions,
  rootId,
) {
  const byId = new Map(people.map(person => [person.id, person]));
  const peopleByLevel = new Map();
  people.forEach(person => {
    const level = levels.get(person.id) ?? 0;
    if (!peopleByLevel.has(level)) peopleByLevel.set(level, []);
    peopleByLevel.get(level).push(person.id);
  });

  const unitsByLevel = new Map();
  const unitByPerson = new Map();
  for (const [level, ids] of peopleByLevel) {
    const levelSet = new Set(ids);
    const visited = new Set();
    const units = [];

    [...ids].sort().forEach(id => {
      if (visited.has(id)) return;
      const component = [];
      const stack = [id];
      visited.add(id);
      while (stack.length) {
        const current = stack.pop();
        component.push(current);
        for (const spouse of spouseAdjacency.get(current) || []) {
          if (levelSet.has(spouse) && !visited.has(spouse)) {
            visited.add(spouse);
            stack.push(spouse);
          }
        }
      }

      const members = orderUnitMembers(component, rootId, byId, parentsByChild, distances);
      const anchorMember = [...members]
        .sort((a, b) => memberPriority(a, b, byId, distances, rootId))[0];
      const directDepths = members.map(id => directDepth(byId.get(id))).filter(Number.isFinite);
      const lineageValues = members.map(member => lineagePositions.get(member)).filter(Number.isFinite);
      const birthYears = members.map(member => birthYear(byId.get(member))).filter(Number.isFinite);
      const unit = {
        id: `${level}:${units.length}`,
        level,
        members,
        anchorMember,
        distance: Math.min(...members.map(member => distances.get(member) ?? 1e9)),
        directDepth: directDepths.length ? Math.min(...directDepths) : null,
        lineagePosition: lineageValues.length ? average(lineageValues) : 0,
        branch: mostCommon(members.map(member => byId.get(member)?.branch).filter(Boolean)),
        birthYear: birthYears.length ? Math.min(...birthYears) : 9999,
        label: members.map(member => byId.get(member)?.name || member).sort()[0] || '',
        familyKey: '',
      };
      units.push(unit);
      members.forEach(member => unitByPerson.set(member, unit));
    });

    unitsByLevel.set(level, units);
  }
  return { unitsByLevel, unitByPerson };
}

function directDepth(person) {
  if (Number.isFinite(person?.directAncestorDepth)) return person.directAncestorDepth;
  return DIRECT_ROLES.has(person?.role) ? (ROLE_LEVEL[person.role] ?? 0) : null;
}

function memberPriority(a, b, byId, distances, rootId) {
  if (a === rootId) return -1;
  if (b === rootId) return 1;
  const da = directDepth(byId.get(a));
  const db = directDepth(byId.get(b));
  if (Number.isFinite(da) !== Number.isFinite(db)) return Number.isFinite(da) ? -1 : 1;
  const distanceA = distances.get(a) ?? 1e9;
  const distanceB = distances.get(b) ?? 1e9;
  if (distanceA !== distanceB) return distanceA - distanceB;
  return memberSeed(a, b, byId, rootId);
}

function orderUnitMembers(component, rootId, byId, parentsByChild, distances) {
  const members = [...component].sort((a, b) => memberPriority(a, b, byId, distances, rootId));
  if (members.length <= 2) return members;

  const anchor = members[0];
  const others = members.slice(1).sort((a, b) => {
    const lineageA = parentsByChild.get(a)?.size ? 0 : 1;
    const lineageB = parentsByChild.get(b)?.size ? 0 : 1;
    return lineageA - lineageB || memberSeed(a, b, byId, rootId);
  });
  const leftCount = Math.floor(others.length / 2);
  return [...others.slice(0, leftCount), anchor, ...others.slice(leftCount)];
}

function memberSeed(a, b, byId, rootId) {
  if (a === rootId) return -1;
  if (b === rootId) return 1;
  const yearA = birthYear(byId.get(a));
  const yearB = birthYear(byId.get(b));
  if (yearA !== yearB) return yearA - yearB;
  return String(byId.get(a)?.name || a).localeCompare(String(byId.get(b)?.name || b));
}

function assignUnitFamilies(unitsByLevel, unitByPerson, parentsByChild) {
  for (const units of unitsByLevel.values()) {
    for (const unit of units) {
      unit.parentUnitIds = new Set();
      unit.childUnitIds = new Set();
    }
  }

  for (const units of unitsByLevel.values()) {
    for (const unit of units) {
      for (const member of unit.members) {
        for (const parent of parentsByChild.get(member) || []) {
          const parentUnit = unitByPerson.get(parent);
          if (!parentUnit || parentUnit === unit) continue;
          if (parentUnit.level !== unit.level + 1) continue;
          unit.parentUnitIds.add(parentUnit.id);
          parentUnit.childUnitIds.add(unit.id);
        }
      }

      const anchorParents = new Set();
      for (const parent of parentsByChild.get(unit.anchorMember) || []) {
        const parentUnit = unitByPerson.get(parent);
        if (parentUnit && parentUnit !== unit && parentUnit.level === unit.level + 1) {
          anchorParents.add(parentUnit.id);
        }
      }
      unit.familyKey = [...(anchorParents.size ? anchorParents : unit.parentUnitIds)]
        .sort()
        .join('|') || `origin:${unit.id}`;
    }
  }
}

function placeUnits(unitsByLevel, rootId, peopleCount) {
  const generationGap = generationGapForPopulation(peopleCount);
  const rootLevel = findRootLevel(unitsByLevel, rootId);
  const unitCenters = new Map();
  const planar = new Map();
  const lineageSpacing = placeRootLevel(
    unitsByLevel.get(rootLevel) || [],
    rootLevel,
    generationGap,
    unitCenters,
    planar,
  );

  const levels = [...unitsByLevel.keys()].sort((a, b) => a - b);
  const minLevel = levels[0] ?? rootLevel;
  const maxLevel = levels[levels.length - 1] ?? rootLevel;

  // Descendants inherit the horizontal neighborhood of their recorded parent
  // unit, rather than snapping back to the center of a broad generation row.
  for (let level = rootLevel - 1; level >= minLevel; level -= 1) {
    placeConnectedLevel(
      unitsByLevel.get(level) || [],
      'parentUnitIds',
      level,
      generationGap,
      lineageSpacing,
      unitCenters,
      planar,
    );
  }

  // Ancestors and collateral ancestor siblings are centered over the recorded
  // children already beneath them. Each spouse/nuclear unit remains its own
  // block so a direct ancestor cannot be dragged sideways by a huge sibling row.
  for (let level = rootLevel + 1; level <= maxLevel; level += 1) {
    placeConnectedLevel(
      unitsByLevel.get(level) || [],
      'childUnitIds',
      level,
      generationGap,
      lineageSpacing,
      unitCenters,
      planar,
    );
  }

  const root = planar.get(rootId);
  if (root) {
    const rootX = root.x;
    const rootY = root.y;
    for (const point of planar.values()) {
      point.x -= rootX;
      point.y -= rootY;
    }
  }
  return planar;
}

function findRootLevel(unitsByLevel, rootId) {
  for (const [level, units] of unitsByLevel) {
    if (units.some(unit => unit.members.includes(rootId))) return level;
  }
  return 0;
}

function placeRootLevel(units, level, generationGap, unitCenters, planar) {
  const buckets = new Map();
  for (const unit of units) {
    const lane = quantizeLineage(unit.lineagePosition);
    if (!buckets.has(lane)) buckets.set(lane, []);
    buckets.get(lane).push(unit);
  }

  const laneLayouts = new Map();
  for (const [lane, laneUnits] of buckets) {
    laneLayouts.set(lane, packLaneUnits(laneUnits));
  }
  const lineageSpacing = requiredLineageSpacing(new Map([[level, laneLayouts]]));

  for (const [lane, layout] of laneLayouts) {
    const laneCenter = lane * lineageSpacing;
    for (const placed of layout.units) {
      const center = laneCenter + placed.offset;
      unitCenters.set(placed.unit.id, center);
      placeUnitMembers(planar, placed.unit, center, level * generationGap);
    }
  }
  return lineageSpacing;
}

function placeConnectedLevel(
  units,
  neighborField,
  level,
  generationGap,
  lineageSpacing,
  unitCenters,
  planar,
) {
  if (!units.length) return;
  const ordered = [...units];
  ordered.forEach(unit => {
    const connected = [...(unit[neighborField] || [])]
      .map(id => unitCenters.get(id))
      .filter(Number.isFinite);
    unit.desiredX = connected.length
      ? average(connected)
      : quantizeLineage(unit.lineagePosition) * lineageSpacing;
  });

  ordered.sort((a, b) => {
    if (a.desiredX !== b.desiredX) return a.desiredX - b.desiredX;
    const directOrder = anchorPriorityShallow(a, b);
    if (directOrder) return directOrder;
    return compareUnitSeed(a, b);
  });

  const centers = packedDesiredCenters(ordered);
  ordered.forEach((unit, index) => {
    const center = centers[index];
    unitCenters.set(unit.id, center);
    placeUnitMembers(planar, unit, center, level * generationGap);
  });
}

function packedDesiredCenters(units) {
  if (!units.length) return [];
  const forward = new Array(units.length);
  forward[0] = units[0].desiredX;
  for (let index = 1; index < units.length; index += 1) {
    forward[index] = Math.max(
      units[index].desiredX,
      forward[index - 1] + unitSeparation(units[index - 1], units[index]),
    );
  }

  const backward = new Array(units.length);
  backward[units.length - 1] = units[units.length - 1].desiredX;
  for (let index = units.length - 2; index >= 0; index -= 1) {
    backward[index] = Math.min(
      units[index].desiredX,
      backward[index + 1] - unitSeparation(units[index], units[index + 1]),
    );
  }

  return units.map((unit, index) => {
    const compromise = (forward[index] + backward[index]) / 2;
    if (Number.isFinite(unit.directDepth)) {
      return unit.desiredX * 0.72 + compromise * 0.28;
    }
    return compromise;
  });
}

function packLaneUnits(units) {
  const ordered = [...units].sort(compareUnitSeed);
  if (!ordered.length) return { units: [], min: 0, max: 0 };
  const anchorIndex = findLaneAnchorIndex(ordered);
  const placements = new Map([[ordered[anchorIndex].id, 0]]);

  let leftEdge = -unitHalfWidth(ordered[anchorIndex]);
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    const unit = ordered[index];
    const rightNeighbor = ordered[index + 1];
    const gap = sameFamily(unit, rightNeighbor)
      ? LAYOUT_GAPS.SIBLING_GAP
      : LAYOUT_GAPS.BETWEEN_FAMILY_GAP;
    const center = leftEdge - gap - unitHalfWidth(unit);
    placements.set(unit.id, center);
    leftEdge = center - unitHalfWidth(unit);
  }

  let rightEdge = unitHalfWidth(ordered[anchorIndex]);
  for (let index = anchorIndex + 1; index < ordered.length; index += 1) {
    const unit = ordered[index];
    const leftNeighbor = ordered[index - 1];
    const gap = sameFamily(unit, leftNeighbor)
      ? LAYOUT_GAPS.SIBLING_GAP
      : LAYOUT_GAPS.BETWEEN_FAMILY_GAP;
    const center = rightEdge + gap + unitHalfWidth(unit);
    placements.set(unit.id, center);
    rightEdge = center + unitHalfWidth(unit);
  }

  return {
    units: ordered.map(unit => ({ unit, offset: placements.get(unit.id) })),
    min: leftEdge,
    max: rightEdge,
  };
}

function findLaneAnchorIndex(units) {
  let best = 0;
  for (let index = 1; index < units.length; index += 1) {
    if (anchorPriority(units[index], units[best]) < 0) best = index;
  }
  return best;
}

function anchorPriority(a, b) {
  const directA = Number.isFinite(a.directDepth);
  const directB = Number.isFinite(b.directDepth);
  if (directA !== directB) return directA ? -1 : 1;
  if (directA && a.directDepth !== b.directDepth) return a.directDepth - b.directDepth;
  if (a.distance !== b.distance) return a.distance - b.distance;
  return compareUnitSeed(a, b);
}

function compareUnitSeed(a, b) {
  if (a.familyKey !== b.familyKey) return a.familyKey.localeCompare(b.familyKey);
  const directOrder = anchorPriorityShallow(a, b);
  if (directOrder) return directOrder;
  if (a.birthYear !== b.birthYear) return a.birthYear - b.birthYear;
  return a.label.localeCompare(b.label);
}

function anchorPriorityShallow(a, b) {
  const directA = Number.isFinite(a.directDepth);
  const directB = Number.isFinite(b.directDepth);
  if (directA !== directB) return directA ? -1 : 1;
  if (directA && a.directDepth !== b.directDepth) return a.directDepth - b.directDepth;
  if (a.distance !== b.distance) return a.distance - b.distance;
  return 0;
}

function sameFamily(a, b) {
  return a?.familyKey && b?.familyKey && a.familyKey === b.familyKey;
}

function unitHalfWidth(unit) {
  return ((Math.max(1, unit.members.length) - 1) * LAYOUT_GAPS.COUPLE_GAP) / 2;
}

function unitSeparation(a, b) {
  const gap = sameFamily(a, b) ? LAYOUT_GAPS.SIBLING_GAP : LAYOUT_GAPS.BETWEEN_FAMILY_GAP;
  return unitHalfWidth(a) + unitHalfWidth(b) + gap;
}

function placeUnitMembers(planar, unit, centerX, y) {
  const memberCount = Math.max(1, unit.members.length);
  const start = centerX - ((memberCount - 1) * LAYOUT_GAPS.COUPLE_GAP) / 2;
  unit.members.forEach((personId, index) => {
    planar.set(personId, { x: start + index * LAYOUT_GAPS.COUPLE_GAP, y });
  });
}

function requiredLineageSpacing(levelLayouts) {
  let spacing = MIN_LINEAGE_SLOT_SPACING;
  for (const laneLayouts of levelLayouts.values()) {
    const lanes = [...laneLayouts.keys()].sort((a, b) => a - b);
    for (let index = 0; index < lanes.length - 1; index += 1) {
      const leftLane = lanes[index];
      const rightLane = lanes[index + 1];
      const delta = rightLane - leftLane;
      if (delta <= 0) continue;
      const left = laneLayouts.get(leftLane);
      const right = laneLayouts.get(rightLane);
      const required = (left.max - right.min + LAYOUT_GAPS.BETWEEN_FAMILY_GAP) / delta;
      if (required > spacing) spacing = required;
    }
  }
  return spacing;
}

function quantizeLineage(value) {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.round(numeric / LINEAGE_QUANTUM) * LINEAGE_QUANTUM;
}

function birthYear(person) {
  const match = String(person?.birth?.date || '').match(/\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/);
  return match ? Number(match[1]) : 9999;
}

function mostCommon(values) {
  if (!values.length) return null;
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
