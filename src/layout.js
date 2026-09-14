import { tangentPoint } from './geometry.js';

export const LAYOUT_GAPS = Object.freeze({
  COUPLE_GAP: 1.30,
  SIBLING_GAP: 1.45,
  MIN_PERSON_CLEARANCE: 1.24,
  BETWEEN_FAMILY_GAP: 1.70,
  GENERATION_GAP: 2.48,
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

export function layoutSample(people, radius, relationships = []) {
  const positions = new Map();
  if (!people.length) return positions;

  const byId = new Map(people.map(person => [person.id, person]));
  const known = new Set(byId.keys());
  const parentLinks = relationships.filter(link => link.type === 'parent' && known.has(link.from) && known.has(link.to));
  const spouseLinks = relationships.filter(link => link.type === 'spouse' && known.has(link.from) && known.has(link.to));
  const root = people.find(person => person.role === 'root') || people[0];
  const levels = assignGenerations(people, root.id, parentLinks, spouseLinks);
  const parentsByChild = collectParents(parentLinks);
  const spouseAdjacency = collectSpouses(spouseLinks);
  const { unitsByLevel, unitByPerson } = buildGenerationUnits(
    people,
    levels,
    parentsByChild,
    spouseAdjacency,
    root.id,
  );

  connectParentUnits(unitsByLevel, unitByPerson, parentsByChild);
  orderGenerationUnits(unitsByLevel);

  const planar = new Map();
  [...unitsByLevel.keys()]
    .sort((a, b) => b - a)
    .forEach(level => placeGenerationRow(unitsByLevel.get(level), level, planar));

  const rootPoint = planar.get(root.id) || { x: 0, y: 0 };
  for (const person of people) {
    const point = planar.get(person.id);
    if (!point) continue;
    positions.set(
      person.id,
      tangentPoint(point.x - rootPoint.x, point.y, radius),
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

  // The bundled 44-person fallback intentionally lacks some older parents.
  // Role levels keep those known sibling groups on the correct generation,
  // while the complete GEDCOM graph derives generations entirely from links.
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
      const candidate = base + delta;
      if (!levels.has(neighbor)) {
        levels.set(neighbor, candidate);
        queue.push(neighbor);
      }
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

function buildGenerationUnits(people, levels, parentsByChild, spouseAdjacency, rootId) {
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

    ids.sort().forEach(id => {
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

      const members = orderUnitMembers(component, rootId, byId, spouseAdjacency, parentsByChild);
      const parentSets = members
        .map(member => [...(parentsByChild.get(member) || [])].sort())
        .filter(parentIds => parentIds.length);
      const branches = members
        .map(member => byId.get(member)?.branch)
        .filter(Boolean);
      const birthYears = members
        .map(member => birthYear(byId.get(member)))
        .filter(Number.isFinite);
      const labels = members.map(member => byId.get(member)?.name || member).sort();
      const unit = {
        id: `${level}:${units.length}`,
        level,
        members,
        parentUnits: new Set(),
        originKey: parentSets.length ? parentSets.map(set => set.join('|')).sort()[0] : '',
        branch: mostCommon(branches),
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

function orderUnitMembers(component, rootId, byId, spouseAdjacency, parentsByChild) {
  const members = [...component];
  const baseSort = (a, b) => {
    if (a === rootId) return -1;
    if (b === rootId) return 1;
    const personA = byId.get(a);
    const personB = byId.get(b);
    const lineageA = parentsByChild.get(a)?.size ? 0 : 1;
    const lineageB = parentsByChild.get(b)?.size ? 0 : 1;
    if (lineageA !== lineageB) return lineageA - lineageB;
    const yearA = birthYear(personA);
    const yearB = birthYear(personB);
    if (yearA !== yearB) return yearA - yearB;
    return String(personA?.name || a).localeCompare(String(personB?.name || b));
  };
  members.sort(baseSort);
  if (members.length <= 2) return members;

  // Multiple marriages are represented as one same-generation unit. Put the
  // person connected to the most spouses in the middle so every recorded
  // partner line has a short, legible path instead of crossing the whole unit.
  const degree = id => [...(spouseAdjacency.get(id) || [])]
    .filter(spouse => members.includes(spouse)).length;
  const hub = [...members].sort((a, b) => degree(b) - degree(a) || baseSort(a, b))[0];
  const others = members.filter(id => id !== hub).sort(baseSort);
  const leftCount = Math.ceil(others.length / 2);
  return [...others.slice(0, leftCount), hub, ...others.slice(leftCount)];
}

function connectParentUnits(unitsByLevel, unitByPerson, parentsByChild) {
  for (const units of unitsByLevel.values()) {
    units.forEach(unit => {
      unit.members.forEach(member => {
        for (const parent of parentsByChild.get(member) || []) {
          const parentUnit = unitByPerson.get(parent);
          if (parentUnit && parentUnit.level === unit.level + 1) {
            unit.parentUnits.add(parentUnit.id);
          }
        }
      });
    });
  }
}

function orderGenerationUnits(unitsByLevel) {
  const levels = [...unitsByLevel.keys()].sort((a, b) => b - a);
  let previousIndex = new Map();

  levels.forEach((level, levelIndex) => {
    const units = unitsByLevel.get(level);
    units.sort((a, b) => {
      if (levelIndex > 0) {
        const aParents = [...a.parentUnits]
          .map(id => previousIndex.get(id))
          .filter(Number.isFinite);
        const bParents = [...b.parentUnits]
          .map(id => previousIndex.get(id))
          .filter(Number.isFinite);
        const aBarycenter = aParents.length ? average(aParents) : Infinity;
        const bBarycenter = bParents.length ? average(bParents) : Infinity;
        if (aBarycenter !== bBarycenter) return aBarycenter - bBarycenter;
      }
      return compareSeed(a, b);
    });
    previousIndex = new Map(units.map((unit, index) => [unit.id, index]));
  });
}

function compareSeed(a, b) {
  const branchA = BRANCH_ORDER[a.branch] ?? 3;
  const branchB = BRANCH_ORDER[b.branch] ?? 3;
  if (branchA !== branchB) return branchA - branchB;
  if (a.originKey !== b.originKey) return a.originKey.localeCompare(b.originKey);
  if (a.birthYear !== b.birthYear) return a.birthYear - b.birthYear;
  return a.label.localeCompare(b.label);
}

function placeGenerationRow(units, level, planar) {
  const entries = [];
  units.forEach((unit, unitIndex) => {
    const previous = units[unitIndex - 1];
    unit.members.forEach((personId, memberIndex) => {
      let gapBefore = 0;
      if (memberIndex > 0) {
        gapBefore = LAYOUT_GAPS.COUPLE_GAP;
      } else if (unitIndex > 0) {
        const sameSiblingFamily = Boolean(unit.originKey)
          && unit.originKey === previous?.originKey;
        gapBefore = sameSiblingFamily
          ? LAYOUT_GAPS.SIBLING_GAP
          : LAYOUT_GAPS.BETWEEN_FAMILY_GAP;
      }
      entries.push({ personId, gapBefore });
    });
  });

  const width = entries.reduce((sum, entry, index) => (
    index === 0 ? sum : sum + Math.max(entry.gapBefore, LAYOUT_GAPS.MIN_PERSON_CLEARANCE)
  ), 0);
  let x = -width / 2;
  const y = level * LAYOUT_GAPS.GENERATION_GAP;

  entries.forEach((entry, index) => {
    if (index > 0) x += Math.max(entry.gapBefore, LAYOUT_GAPS.MIN_PERSON_CLEARANCE);
    planar.set(entry.personId, { x, y });
  });
}

function birthYear(person) {
  const match = String(person?.birth?.date || '').match(/\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/);
  return match ? Number(match[1]) : 9999;
}

function mostCommon(values) {
  if (!values.length) return null;
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
