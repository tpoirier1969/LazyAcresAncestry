import { tangentPoint } from './geometry.js';

export const LAYOUT_GAPS = Object.freeze({
  COUPLE_GAP: 1.34,
  SIBLING_GAP: 1.58,
  MIN_PERSON_CLEARANCE: 1.24,
  BETWEEN_FAMILY_GAP: 2.18,
  BETWEEN_COMPONENT_GAP: 2.78,
  GENERATION_GAP: 2.70,
});

const ROLE_LEVEL = Object.freeze({
  'great-grandparent': 3,
  grandparent: 2,
  'grandparent-sibling': 2,
  parent: 1,
  root: 0,
  spouse: 0,
  sibling: 0,
  'sibling-descendant': -1,
});

export function generationGapForPopulation(count) {
  const population = Math.max(1, Number(count) || 1);
  if (population <= 44) return LAYOUT_GAPS.GENERATION_GAP;
  const extra = Math.log2(population / 44) * 0.08;
  return Math.min(3.12, LAYOUT_GAPS.GENERATION_GAP + extra);
}

export function layoutSample(people, radius, relationships = []) {
  const positions = new Map();
  if (!people.length) return positions;

  const graph = relationships.length ? relationships : (people.relationships || []);
  const byId = new Map(people.map(person => [person.id, person]));
  const known = new Set(byId.keys());
  const parentLinks = graph.filter(link => link.type === 'parent' && known.has(link.from) && known.has(link.to));
  const spouseLinks = graph.filter(link => link.type === 'spouse' && known.has(link.from) && known.has(link.to));
  const anchor = people.find(person => person.role === 'root') || people[0];
  const levels = assignGenerations(people, anchor.id, parentLinks, spouseLinks);
  const parentLinksByChild = linksBy(parentLinks, 'to');
  const childLinksByParent = linksBy(parentLinks, 'from');
  const spouseLinksByPerson = spouseLinksForPeople(spouseLinks);
  const { blocksByLevel, blockByPerson } = buildOriginBlocks(
    people,
    levels,
    parentLinksByChild,
    spouseLinksByPerson,
    byId,
  );
  const componentsByLevel = buildMarriageComponents(
    blocksByLevel,
    blockByPerson,
    spouseLinks,
    spouseLinksByPerson,
    byId,
  );
  const planar = placeTopology(
    componentsByLevel,
    levels,
    parentLinksByChild,
    childLinksByParent,
    people.length,
  );

  // The selected home person is only the coordinate origin. Family ordering,
  // adjacency and subtree packing above are relationship-driven and do not use
  // home-person branch labels or direct-ancestor status.
  const anchorPoint = planar.get(anchor.id) || { x: 0, y: 0 };
  for (const person of people) {
    const point = planar.get(person.id);
    if (!point) continue;
    positions.set(person.id, tangentPoint(point.x - anchorPoint.x, point.y - anchorPoint.y, radius));
  }

  return positions;
}

function assignGenerations(people, anchorId, parentLinks, spouseLinks) {
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

  seed(anchorId, 0);
  propagateLevels(adjacency, levels, queue);

  people.forEach(person => {
    if (levels.has(person.id)) return;
    if (Number.isFinite(person.generationHint)) seed(person.id, person.generationHint);
    else if (ROLE_LEVEL[person.role] != null) seed(person.id, ROLE_LEVEL[person.role]);
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

function linksBy(links, key) {
  const map = new Map();
  links.forEach(link => {
    const id = link[key];
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(link);
  });
  return map;
}

function spouseLinksForPeople(spouseLinks) {
  const map = new Map();
  spouseLinks.forEach(link => {
    if (!map.has(link.from)) map.set(link.from, []);
    if (!map.has(link.to)) map.set(link.to, []);
    map.get(link.from).push({ ...link, spouseId: link.to });
    map.get(link.to).push({ ...link, spouseId: link.from });
  });
  return map;
}

function buildOriginBlocks(people, levels, parentLinksByChild, spouseLinksByPerson, byId) {
  const groups = new Map();

  people.forEach(person => {
    const level = levels.get(person.id) ?? 0;
    const originKey = originFamilyKey(person, parentLinksByChild.get(person.id) || []);
    const key = `${level}|${originKey}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        originKey,
        level,
        members: [],
        spouseNeighborIds: new Set(),
        seed: '',
      });
    }
    groups.get(key).members.push(person.id);
  });

  const blocksByLevel = new Map();
  const blockByPerson = new Map();

  for (const block of groups.values()) {
    block.members.sort((a, b) => personSeed(a, b, byId));
    block.seed = block.members.map(id => byId.get(id)?.name || id).sort()[0] || block.id;
    if (!blocksByLevel.has(block.level)) blocksByLevel.set(block.level, []);
    blocksByLevel.get(block.level).push(block);
    block.members.forEach(id => blockByPerson.set(id, block));
  }

  for (const blocks of blocksByLevel.values()) {
    blocks.sort(blockSeedCompare);
  }

  // Same-generation spouse links connect family-of-origin blocks into marriage
  // neighborhoods. This is the key distinction from the old generation-row
  // layout: sibling families remain intact and couples bring those families
  // beside one another rather than merging them into one row-wide unit.
  for (const [personId, links] of spouseLinksByPerson) {
    const block = blockByPerson.get(personId);
    if (!block) continue;
    links.forEach(link => {
      const spouseBlock = blockByPerson.get(link.spouseId);
      if (!spouseBlock || spouseBlock === block || spouseBlock.level !== block.level) return;
      block.spouseNeighborIds.add(spouseBlock.id);
    });
  }

  return { blocksByLevel, blockByPerson };
}

function originFamilyKey(person, parentLinks) {
  const familyIds = [...new Set(parentLinks.map(link => link.familyId).filter(Boolean))].sort();
  if (familyIds.length) return `fam:${familyIds[0]}`;
  const parentIds = [...new Set(parentLinks.map(link => link.from).filter(Boolean))].sort();
  if (parentIds.length) return `parents:${parentIds.join('+')}`;
  if (person.cluster) return `cluster:${person.cluster}`;
  return `solo:${person.id}`;
}

function buildMarriageComponents(blocksByLevel, blockByPerson, spouseLinks, spouseLinksByPerson, byId) {
  const componentsByLevel = new Map();

  for (const [level, blocks] of blocksByLevel) {
    const blockMap = new Map(blocks.map(block => [block.id, block]));
    const adjacency = new Map(blocks.map(block => [block.id, new Set()]));
    spouseLinks.forEach(link => {
      const a = blockByPerson.get(link.from);
      const b = blockByPerson.get(link.to);
      if (!a || !b || a.level !== level || b.level !== level || a === b) return;
      adjacency.get(a.id)?.add(b.id);
      adjacency.get(b.id)?.add(a.id);
    });

    const visited = new Set();
    const components = [];
    blocks.forEach(block => {
      if (visited.has(block.id)) return;
      const ids = [];
      const stack = [block.id];
      visited.add(block.id);
      while (stack.length) {
        const id = stack.pop();
        ids.push(id);
        for (const neighbor of adjacency.get(id) || []) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }

      const orderedBlocks = linearizeMarriageBlocks(ids, adjacency, blockMap);
      const component = buildComponentGeometry(
        level,
        orderedBlocks,
        adjacency,
        blockMap,
        blockByPerson,
        spouseLinksByPerson,
        byId,
      );
      components.push(component);
    });

    components.sort(componentSeedCompare);
    componentsByLevel.set(level, components);
  }

  return componentsByLevel;
}

function linearizeMarriageBlocks(ids, adjacency, blockMap) {
  if (ids.length <= 1) return ids.map(id => blockMap.get(id));

  const degree = id => adjacency.get(id)?.size || 0;
  const maxDegree = Math.max(...ids.map(degree));

  if (maxDegree <= 2) {
    const endpoints = ids.filter(id => degree(id) <= 1).sort((a, b) => blockSeedCompare(blockMap.get(a), blockMap.get(b)));
    const start = endpoints[0] || [...ids].sort((a, b) => blockSeedCompare(blockMap.get(a), blockMap.get(b)))[0];
    const order = [];
    const used = new Set();
    let current = start;
    let previous = null;
    while (current && !used.has(current)) {
      order.push(current);
      used.add(current);
      const next = [...(adjacency.get(current) || [])]
        .filter(id => id !== previous && !used.has(id))
        .sort((a, b) => blockSeedCompare(blockMap.get(a), blockMap.get(b)))[0];
      previous = current;
      current = next || null;
    }
    [...ids]
      .filter(id => !used.has(id))
      .sort((a, b) => blockSeedCompare(blockMap.get(a), blockMap.get(b)))
      .forEach(id => order.push(id));
    return order.map(id => blockMap.get(id));
  }

  // Multiple marriages form a star or small network. Put the most connected
  // family-of-origin block in the middle and distribute spouse families on both
  // sides. A person is never duplicated merely to make the drawing easier.
  const centerId = [...ids].sort((a, b) => (
    degree(b) - degree(a)
    || blockSeedCompare(blockMap.get(a), blockMap.get(b))
  ))[0];
  const neighbors = [...(adjacency.get(centerId) || [])]
    .sort((a, b) => blockSeedCompare(blockMap.get(a), blockMap.get(b)));
  const left = [];
  const right = [];
  neighbors.forEach((id, index) => {
    if (index % 2 === 0) left.unshift(id);
    else right.push(id);
  });
  const placed = new Set([centerId, ...neighbors]);
  const remainder = ids
    .filter(id => !placed.has(id))
    .sort((a, b) => blockSeedCompare(blockMap.get(a), blockMap.get(b)));
  return [...left, centerId, ...right, ...remainder].map(id => blockMap.get(id));
}

function buildComponentGeometry(
  level,
  orderedBlocks,
  adjacency,
  blockMap,
  blockByPerson,
  spouseLinksByPerson,
  byId,
) {
  const blockIndex = new Map(orderedBlocks.map((block, index) => [block.id, index]));
  const placements = [];
  let cursor = 0;

  orderedBlocks.forEach((block, blockOrder) => {
    const orderedMembers = orderBlockMembers(
      block,
      blockIndex,
      blockByPerson,
      spouseLinksByPerson,
      byId,
    );
    const memberSpan = Math.max(0, (orderedMembers.length - 1) * LAYOUT_GAPS.SIBLING_GAP);
    const blockLeft = cursor;
    orderedMembers.forEach((personId, memberIndex) => {
      placements.push({
        personId,
        x: blockLeft + memberIndex * LAYOUT_GAPS.SIBLING_GAP,
      });
    });
    cursor = blockLeft + memberSpan;

    if (blockOrder < orderedBlocks.length - 1) {
      const next = orderedBlocks[blockOrder + 1];
      const spousesAcrossBoundary = adjacency.get(block.id)?.has(next.id);
      cursor += spousesAcrossBoundary ? LAYOUT_GAPS.COUPLE_GAP : LAYOUT_GAPS.BETWEEN_FAMILY_GAP;
    }
  });

  const minX = placements.length ? Math.min(...placements.map(entry => entry.x)) : 0;
  const maxX = placements.length ? Math.max(...placements.map(entry => entry.x)) : 0;
  const midpoint = (minX + maxX) / 2;
  placements.forEach(entry => { entry.localX = entry.x - midpoint; });

  return {
    id: `${level}:${orderedBlocks.map(block => block.id).join('~')}`,
    level,
    blocks: orderedBlocks,
    placements,
    width: maxX - minX,
    seed: orderedBlocks.map(block => block.seed).sort()[0] || '',
    desiredX: null,
  };
}

function orderBlockMembers(block, blockIndex, blockByPerson, spouseLinksByPerson, byId) {
  const currentIndex = blockIndex.get(block.id) ?? 0;
  const score = personId => {
    const spouseBlockIndexes = (spouseLinksByPerson.get(personId) || [])
      .map(link => blockByPerson.get(link.spouseId))
      .filter(spouseBlock => spouseBlock && blockIndex.has(spouseBlock.id))
      .map(spouseBlock => blockIndex.get(spouseBlock.id));
    const hasLeft = spouseBlockIndexes.some(index => index < currentIndex);
    const hasRight = spouseBlockIndexes.some(index => index > currentIndex);
    if (hasLeft && !hasRight) return -1;
    if (hasRight && !hasLeft) return 1;
    return 0;
  };

  return [...block.members].sort((a, b) => (
    score(a) - score(b)
    || personSeed(a, b, byId)
  ));
}

function placeTopology(componentsByLevel, levels, parentLinksByChild, childLinksByParent, peopleCount) {
  const planar = new Map();
  const orderedLevels = [...componentsByLevel.keys()].sort((a, b) => b - a);
  const generationGap = generationGapForPopulation(peopleCount);

  const placeLevel = (level, direction) => {
    const components = componentsByLevel.get(level) || [];
    components.forEach(component => {
      component.desiredX = desiredComponentCenter(
        component,
        planar,
        direction,
        parentLinksByChild,
        childLinksByParent,
      );
    });

    components.sort((a, b) => {
      const aKnown = Number.isFinite(a.desiredX);
      const bKnown = Number.isFinite(b.desiredX);
      if (aKnown && bKnown && Math.abs(a.desiredX - b.desiredX) > 1e-9) return a.desiredX - b.desiredX;
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return componentSeedCompare(a, b);
    });

    const centers = packComponentCenters(components);
    const y = level * generationGap;
    components.forEach((component, index) => {
      const center = centers[index];
      component.placements.forEach(entry => {
        planar.set(entry.personId, { x: center + entry.localX, y });
      });
    });
  };

  // Initial pass descends family by family. Refinement alternates directions so
  // ancestors center over their actual descendants and descendants remain under
  // their actual parents without allowing a generation-wide rail to dominate.
  orderedLevels.forEach(level => placeLevel(level, 'parents'));
  for (let pass = 0; pass < 5; pass += 1) {
    [...orderedLevels].reverse().forEach(level => placeLevel(level, 'children'));
    orderedLevels.forEach(level => placeLevel(level, 'parents'));
  }

  return planar;
}

function desiredComponentCenter(component, planar, direction, parentLinksByChild, childLinksByParent) {
  const candidates = [];

  component.placements.forEach(entry => {
    const links = direction === 'parents'
      ? parentLinksByChild.get(entry.personId) || []
      : childLinksByParent.get(entry.personId) || [];
    const neighborXs = links
      .map(link => direction === 'parents' ? link.from : link.to)
      .map(id => planar.get(id)?.x)
      .filter(Number.isFinite);
    if (!neighborXs.length) return;
    candidates.push(average(neighborXs) - entry.localX);
  });

  return candidates.length ? average(candidates) : null;
}

function packComponentCenters(components) {
  if (!components.length) return [];
  const desired = [];

  components.forEach((component, index) => {
    if (Number.isFinite(component.desiredX)) desired[index] = component.desiredX;
    else if (index === 0) desired[index] = 0;
    else desired[index] = desired[index - 1] + componentSeparation(components[index - 1], component);
  });

  const forward = [desired[0]];
  for (let index = 1; index < components.length; index += 1) {
    forward[index] = Math.max(
      desired[index],
      forward[index - 1] + componentSeparation(components[index - 1], components[index]),
    );
  }

  const backward = new Array(components.length);
  backward[components.length - 1] = desired[components.length - 1];
  for (let index = components.length - 2; index >= 0; index -= 1) {
    backward[index] = Math.min(
      desired[index],
      backward[index + 1] - componentSeparation(components[index], components[index + 1]),
    );
  }

  return forward.map((value, index) => (value + backward[index]) / 2);
}

function componentSeparation(a, b) {
  return a.width / 2 + b.width / 2 + LAYOUT_GAPS.BETWEEN_COMPONENT_GAP;
}

function blockSeedCompare(a, b) {
  const yearA = Math.min(...a.members.map(id => birthYearFromId(id, a, null)).filter(Number.isFinite), 9999);
  const yearB = Math.min(...b.members.map(id => birthYearFromId(id, b, null)).filter(Number.isFinite), 9999);
  if (yearA !== yearB) return yearA - yearB;
  return String(a.seed || a.id).localeCompare(String(b.seed || b.id));
}

function componentSeedCompare(a, b) {
  return String(a.seed || a.id).localeCompare(String(b.seed || b.id));
}

function personSeed(a, b, byId) {
  const yearA = birthYear(byId.get(a));
  const yearB = birthYear(byId.get(b));
  if (yearA !== yearB) return yearA - yearB;
  return String(byId.get(a)?.name || a).localeCompare(String(byId.get(b)?.name || b));
}

function birthYear(person) {
  const match = String(person?.birth?.date || '').match(/\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/);
  return match ? Number(match[1]) : 9999;
}

// Blocks already retain a stable name seed. This helper deliberately returns a
// neutral year when only the block is available; chronological ordering inside
// each sibling block is handled by personSeed, while family blocks themselves
// are ordered by relationships first and stable labels second.
function birthYearFromId() {
  return 9999;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
