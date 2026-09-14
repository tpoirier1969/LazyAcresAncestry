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
const LINEAGE_SLOT_SPACING = 12;

export function generationGapForPopulation(count) {
  const population = Math.max(1, Number(count) || 1);
  if (population <= 44) return LAYOUT_GAPS.GENERATION_GAP;
  const extra = Math.log2(population / 44) * 1.45;
  return Math.min(9, LAYOUT_GAPS.GENERATION_GAP + extra);
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
  const lineagePositions = buildLineagePositions(
    people,
    root.id,
    parentsByChild,
    parentLinks,
    spouseAdjacency,
  );
  const { unitsByLevel, unitByPerson } = buildGenerationUnits(
    people,
    levels,
    parentsByChild,
    spouseAdjacency,
    distances,
    lineagePositions,
    root.id,
  );

  connectFamilyUnits(unitsByLevel, unitByPerson, parentsByChild);
  const { blocksByLevel, blockByPerson } = buildFamilyBlocks(unitsByLevel);
  connectBlockNeighbors(parentLinks, blockByPerson);
  const planar = placeFamilyBlocks(blocksByLevel, root.id, people.length);
  const rootPoint = planar.get(root.id) || { x: 0, y: 0 };

  for (const person of people) {
    const point = planar.get(person.id);
    if (!point) continue;
    positions.set(
      person.id,
      tangentPoint(point.x - rootPoint.x, point.y - rootPoint.y, radius),
    );
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
  const blood = new Set();

  const add = (id, slot) => {
    if (!byId.has(id)) return false;
    sum.set(id, (sum.get(id) || 0) + slot);
    count.set(id, (count.get(id) || 0) + 1);
    blood.add(id);
    return true;
  };

  grandparentBranches.forEach((grandparentId, index) => {
    const slot = slotValues[index];
    const branchSeeds = new Set([grandparentId]);
    for (const greatGrandparent of parentsByChild.get(grandparentId) || []) {
      add(greatGrandparent, slot);
      for (const sibling of childrenByParent.get(greatGrandparent) || []) branchSeeds.add(sibling);
    }

    const queue = [...branchSeeds];
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
  for (const person of people) {
    if (count.has(person.id)) {
      positions.set(person.id, sum.get(person.id) / count.get(person.id));
    }
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (const person of people) {
      if (positions.has(person.id) || blood.has(person.id)) continue;
      const partnerPositions = [...(spouseAdjacency.get(person.id) || [])]
        .map(id => positions.get(id))
        .filter(Number.isFinite);
      if (partnerPositions.length) positions.set(person.id, average(partnerPositions));
    }
  }

  for (const person of people) {
    if (positions.has(person.id)) continue;
    const branch = BRANCH_ORDER[person.branch];
    positions.set(person.id, branch == null ? 0 : branch - 1);
  }
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

      const members = orderUnitMembers(
        component,
        rootId,
        byId,
        spouseAdjacency,
        parentsByChild,
        distances,
      );
      const anchorMember = [...members].sort((a, b) => (
        (distances.get(a) ?? 1e9) - (distances.get(b) ?? 1e9)
        || memberSeed(a, b, byId, rootId)
      ))[0];
      const branches = members.map(member => byId.get(member)?.branch).filter(Boolean);
      const birthYears = members.map(member => birthYear(byId.get(member))).filter(Number.isFinite);
      const labels = members.map(member => byId.get(member)?.name || member).sort();
      const lineageValues = members.map(member => lineagePositions.get(member)).filter(Number.isFinite);
      const unit = {
        id: `${level}:${units.length}`,
        level,
        members,
        anchorMember,
        parentUnits: new Set(),
        layoutParentUnits: new Set(),
        childUnits: new Set(),
        branch: mostCommon(branches),
        lineagePosition: lineageValues.length ? average(lineageValues) : 0,
        birthYear: birthYears.length ? Math.min(...birthYears) : 9999,
        label: labels[0] || '',
      };
      units.push(unit);
      members.forEach(member => unitByPerson.set(member, unit));
    });

    unitsByLevel.set(level, units);
  }

  return { unitsByLevel, unitByPerson };
}

function memberSeed(a, b, byId, rootId) {
  if (a === rootId) return -1;
  if (b === rootId) return 1;
  const yearA = birthYear(byId.get(a));
  const yearB = birthYear(byId.get(b));
  if (yearA !== yearB) return yearA - yearB;
  return String(byId.get(a)?.name || a).localeCompare(String(byId.get(b)?.name || b));
}

function orderUnitMembers(component, rootId, byId, spouseAdjacency, parentsByChild, distances) {
  const members = [...component];
  const baseSort = (a, b) => {
    if (a === rootId) return -1;
    if (b === rootId) return 1;
    const distanceA = distances.get(a) ?? 1e9;
    const distanceB = distances.get(b) ?? 1e9;
    if (distanceA !== distanceB) return distanceA - distanceB;
    const lineageA = parentsByChild.get(a)?.size ? 0 : 1;
    const lineageB = parentsByChild.get(b)?.size ? 0 : 1;
    if (lineageA !== lineageB) return lineageA - lineageB;
    return memberSeed(a, b, byId, rootId);
  };

  members.sort(baseSort);
  if (members.length <= 2) return members;

  const memberSet = new Set(members);
  const degree = id => [...(spouseAdjacency.get(id) || [])]
    .filter(spouse => memberSet.has(spouse)).length;
  const hub = [...members].sort((a, b) => degree(b) - degree(a) || baseSort(a, b))[0];
  const others = members.filter(id => id !== hub).sort(baseSort);
  const leftCount = Math.ceil(others.length / 2);
  return [...others.slice(0, leftCount), hub, ...others.slice(leftCount)];
}

function connectFamilyUnits(unitsByLevel, unitByPerson, parentsByChild) {
  for (const units of unitsByLevel.values()) {
    for (const unit of units) {
      for (const member of unit.members) {
        for (const parent of parentsByChild.get(member) || []) {
          const parentUnit = unitByPerson.get(parent);
          if (parentUnit && parentUnit.level === unit.level + 1) {
            unit.parentUnits.add(parentUnit.id);
            parentUnit.childUnits.add(unit.id);
          }
        }
      }

      for (const parent of parentsByChild.get(unit.anchorMember) || []) {
        const parentUnit = unitByPerson.get(parent);
        if (parentUnit && parentUnit.level === unit.level + 1) {
          unit.layoutParentUnits.add(parentUnit.id);
        }
      }
      if (!unit.layoutParentUnits.size) {
        unit.parentUnits.forEach(id => unit.layoutParentUnits.add(id));
      }
    }
  }
}

function buildFamilyBlocks(unitsByLevel) {
  const blocksByLevel = new Map();
  const blockByPerson = new Map();

  for (const [level, units] of unitsByLevel) {
    const groups = new Map();
    for (const unit of units) {
      const parentKey = [...unit.layoutParentUnits].sort().join('|');
      const key = parentKey ? `family:${parentKey}` : `unit:${unit.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(unit);
    }

    const blocks = [...groups.entries()].map(([key, groupUnits]) => {
      groupUnits.sort(compareSeed);
      const placements = blockPlacements(groupUnits);
      const branches = groupUnits.map(unit => unit.branch).filter(Boolean);
      const lineageValues = groupUnits.map(unit => unit.lineagePosition).filter(Number.isFinite);
      const block = {
        id: `${level}:${key}`,
        level,
        units: groupUnits,
        branch: mostCommon(branches),
        lineagePosition: lineageValues.length ? average(lineageValues) : 0,
        birthYear: Math.min(...groupUnits.map(unit => unit.birthYear)),
        label: groupUnits.map(unit => unit.label).sort()[0] || '',
        placements,
        span: placements.span,
        upNeighborIds: new Set(),
        downNeighborIds: new Set(),
      };
      placements.entries.forEach(entry => blockByPerson.set(entry.personId, block));
      return block;
    });

    blocksByLevel.set(level, blocks);
  }

  return { blocksByLevel, blockByPerson };
}

function connectBlockNeighbors(parentLinks, blockByPerson) {
  for (const link of parentLinks) {
    const parentBlock = blockByPerson.get(link.from);
    const childBlock = blockByPerson.get(link.to);
    if (!parentBlock || !childBlock || parentBlock === childBlock) continue;
    parentBlock.downNeighborIds.add(link.to);
    childBlock.upNeighborIds.add(link.from);
  }
}

function blockPlacements(units) {
  const entries = [];
  let x = 0;
  let started = false;

  for (const unit of units) {
    if (started) x += LAYOUT_GAPS.SIBLING_GAP;
    unit.members.forEach((personId, index) => {
      if (index > 0) x += LAYOUT_GAPS.COUPLE_GAP;
      entries.push({ personId, unitId: unit.id, x });
      started = true;
    });
  }

  const span = entries.length ? entries[entries.length - 1].x - entries[0].x : 0;
  const midpoint = entries.length ? (entries[0].x + entries[entries.length - 1].x) / 2 : 0;
  entries.forEach(entry => { entry.offset = entry.x - midpoint; });
  return { entries, span };
}

function placeFamilyBlocks(blocksByLevel, rootId, peopleCount) {
  const planar = new Map();
  const levels = [...blocksByLevel.keys()].sort((a, b) => b - a);
  const generationGap = generationGapForPopulation(peopleCount);

  const placeLevel = (level, neighborDirection) => {
    const blocks = blocksByLevel.get(level);
    blocks.forEach(block => {
      const ids = neighborDirection === 'up' ? block.upNeighborIds : block.downNeighborIds;
      const xs = [...ids]
        .map(id => planar.get(id)?.x)
        .filter(Number.isFinite);
      const lineageTarget = block.lineagePosition * LINEAGE_SLOT_SPACING;
      // Once a block has real parent/child neighbors, those recorded GEDCOM
      // connections are the authoritative horizontal target. Lineage slots are
      // only a deterministic seed/order for otherwise unanchored blocks.
      block.desiredX = xs.length ? average(xs) : lineageTarget;
    });

    blocks.sort((a, b) => {
      const hasA = Number.isFinite(a.desiredX);
      const hasB = Number.isFinite(b.desiredX);
      if (hasA && hasB && a.desiredX !== b.desiredX) return a.desiredX - b.desiredX;
      if (hasA !== hasB) return hasA ? -1 : 1;
      return compareSeed(a, b);
    });

    const centers = packedCenters(blocks);
    const y = level * generationGap;
    blocks.forEach((block, index) => {
      const center = centers[index];
      for (const entry of block.placements.entries) {
        planar.set(entry.personId, { x: center + entry.offset, y });
      }
    });
  };

  for (const level of levels) placeLevel(level, 'up');

  for (let pass = 0; pass < 5; pass += 1) {
    for (const level of [...levels].reverse()) placeLevel(level, 'down');
    for (const level of levels) placeLevel(level, 'up');
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

function packedCenters(blocks) {
  if (!blocks.length) return [];
  const desired = [];
  let cursor = 0;

  blocks.forEach((block, index) => {
    if (Number.isFinite(block.desiredX)) cursor = block.desiredX;
    else if (index === 0) cursor = 0;
    else cursor = desired[index - 1] + blockSeparation(blocks[index - 1], block);
    desired.push(cursor);
  });

  const forward = [desired[0]];
  for (let index = 1; index < blocks.length; index += 1) {
    forward[index] = Math.max(
      desired[index],
      forward[index - 1] + blockSeparation(blocks[index - 1], blocks[index]),
    );
  }

  const backward = new Array(blocks.length);
  backward[blocks.length - 1] = desired[blocks.length - 1];
  for (let index = blocks.length - 2; index >= 0; index -= 1) {
    backward[index] = Math.min(
      desired[index],
      backward[index + 1] - blockSeparation(blocks[index], blocks[index + 1]),
    );
  }

  return forward.map((value, index) => (value + backward[index]) / 2);
}

function blockSeparation(a, b) {
  return a.span / 2 + b.span / 2 + LAYOUT_GAPS.BETWEEN_FAMILY_GAP;
}

function compareSeed(a, b) {
  if (a.lineagePosition !== b.lineagePosition) return a.lineagePosition - b.lineagePosition;
  const branchA = BRANCH_ORDER[a.branch] ?? 3;
  const branchB = BRANCH_ORDER[b.branch] ?? 3;
  if (branchA !== branchB) return branchA - branchB;
  if (a.birthYear !== b.birthYear) return a.birthYear - b.birthYear;
  return a.label.localeCompare(b.label);
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
