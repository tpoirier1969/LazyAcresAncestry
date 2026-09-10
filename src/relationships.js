export function describeRelationship(homeId, targetId, people = [], relationships = []) {
  if (!homeId || !targetId) return 'Relationship unavailable';
  if (homeId === targetId) return 'Home person';

  const byId = new Map(people.map(person => [person.id, person]));
  const parentsByChild = new Map();
  const childrenByParent = new Map();
  const spouses = new Map();

  for (const link of relationships) {
    if (!link?.from || !link?.to) continue;
    if (link.type === 'parent') {
      if (!parentsByChild.has(link.to)) parentsByChild.set(link.to, new Set());
      parentsByChild.get(link.to).add(link.from);
      if (!childrenByParent.has(link.from)) childrenByParent.set(link.from, new Set());
      childrenByParent.get(link.from).add(link.to);
    } else if (link.type === 'spouse') {
      addMapSet(spouses, link.from, link.to);
      addMapSet(spouses, link.to, link.from);
    }
  }

  const target = byId.get(targetId);
  const sex = target?.sex;

  if (spouses.get(homeId)?.has(targetId)) return sexed(sex, 'Husband', 'Wife', 'Spouse');

  const directParents = parentsByChild.get(homeId) || new Set();
  if (directParents.has(targetId)) return sexed(sex, 'Father', 'Mother', 'Parent');

  const directChildren = childrenByParent.get(homeId) || new Set();
  if (directChildren.has(targetId)) return sexed(sex, 'Son', 'Daughter', 'Child');

  if (shareParent(homeId, targetId, parentsByChild)) return sexed(sex, 'Brother', 'Sister', 'Sibling');

  const ancestorPath = findAncestorPath(homeId, targetId, parentsByChild);
  if (ancestorPath) {
    const generation = ancestorPath.length;
    const side = sideFromFirstHop(ancestorPath[0], byId);
    return ancestorLabel(generation, sex, side);
  }

  const descendantPath = findDescendantPath(homeId, targetId, childrenByParent);
  if (descendantPath) return descendantLabel(descendantPath.length, sex);

  const ancestors = enumerateAncestors(homeId, parentsByChild, 8);
  for (const entry of ancestors) {
    if (!shareParent(entry.id, targetId, parentsByChild)) continue;
    const side = sideFromFirstHop(entry.firstHop, byId);
    return auntUncleLabel(entry.generation, sex, side);
  }

  return 'Relationship not identified in current data';
}

function addMapSet(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function shareParent(a, b, parentsByChild) {
  const aParents = parentsByChild.get(a);
  const bParents = parentsByChild.get(b);
  if (!aParents || !bParents) return false;
  for (const parent of aParents) if (bParents.has(parent)) return true;
  return false;
}

function findAncestorPath(startId, targetId, parentsByChild, maxDepth = 12) {
  const queue = [{ id: startId, path: [] }];
  const seen = new Set([startId]);
  while (queue.length) {
    const current = queue.shift();
    if (current.path.length >= maxDepth) continue;
    for (const parent of parentsByChild.get(current.id) || []) {
      if (seen.has(parent)) continue;
      const path = [...current.path, parent];
      if (parent === targetId) return path;
      seen.add(parent);
      queue.push({ id: parent, path });
    }
  }
  return null;
}

function findDescendantPath(startId, targetId, childrenByParent, maxDepth = 12) {
  const queue = [{ id: startId, path: [] }];
  const seen = new Set([startId]);
  while (queue.length) {
    const current = queue.shift();
    if (current.path.length >= maxDepth) continue;
    for (const child of childrenByParent.get(current.id) || []) {
      if (seen.has(child)) continue;
      const path = [...current.path, child];
      if (child === targetId) return path;
      seen.add(child);
      queue.push({ id: child, path });
    }
  }
  return null;
}

function enumerateAncestors(startId, parentsByChild, maxDepth) {
  const out = [];
  const queue = [{ id: startId, generation: 0, firstHop: null }];
  const seen = new Set([startId]);
  while (queue.length) {
    const current = queue.shift();
    if (current.generation >= maxDepth) continue;
    for (const parent of parentsByChild.get(current.id) || []) {
      if (seen.has(parent)) continue;
      const generation = current.generation + 1;
      const firstHop = current.firstHop || parent;
      out.push({ id: parent, generation, firstHop });
      seen.add(parent);
      queue.push({ id: parent, generation, firstHop });
    }
  }
  return out;
}

function sideFromFirstHop(firstHopId, byId) {
  const sex = byId.get(firstHopId)?.sex;
  if (sex === 'M') return 'Paternal';
  if (sex === 'F') return 'Maternal';
  return '';
}

function ancestorLabel(generation, sex, side) {
  if (generation === 1) return sexed(sex, 'Father', 'Mother', 'Parent');
  const base = sexed(sex, 'Grandfather', 'Grandmother', 'Grandparent');
  if (generation === 2) return join(side, base);
  if (generation === 3) return join(side, `Great-${base}`);
  return join(side, `${ordinal(generation - 2)} Great-${base}`);
}

function descendantLabel(generation, sex) {
  if (generation === 1) return sexed(sex, 'Son', 'Daughter', 'Child');
  const base = sexed(sex, 'Grandson', 'Granddaughter', 'Grandchild');
  if (generation === 2) return base;
  if (generation === 3) return `Great-${base}`;
  return `${ordinal(generation - 2)} Great-${base}`;
}

function auntUncleLabel(ancestorGeneration, sex, side) {
  const base = sexed(sex, 'Uncle', 'Aunt', 'Aunt/Uncle');
  if (ancestorGeneration <= 1) return join(side, base);
  if (ancestorGeneration === 2) return join(side, `Great-${base}`);
  return join(side, `${ordinal(ancestorGeneration - 1)} Great-${base}`);
}

function sexed(sex, male, female, neutral) {
  if (sex === 'M') return male;
  if (sex === 'F') return female;
  return neutral;
}

function join(prefix, label) {
  return prefix ? `${prefix} ${label}` : label;
}

function ordinal(value) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const suffix = value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th';
  return `${value}${suffix}`;
}
