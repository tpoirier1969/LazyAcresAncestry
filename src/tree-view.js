export const DEFAULT_VISIBLE_PEOPLE = 600;

export function nearestPeopleIds(targetId, people = [], relationships = [], limit = DEFAULT_VISIBLE_PEOPLE) {
  const byId = new Map(people.map(person => [person.id, person]));
  const requestedLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_VISIBLE_PEOPLE));
  const target = byId.has(targetId)
    ? targetId
    : people.find(person => person.role === 'root')?.id || people[0]?.id || null;
  if (!target) return new Set();

  const adjacency = undirectedAdjacency(byId, relationships);
  const visible = new Set();
  let frontier = [target];
  const discovered = new Set(frontier);

  while (frontier.length && visible.size < requestedLimit) {
    frontier.sort((a, b) => personOrderKey(byId.get(a)).localeCompare(personOrderKey(byId.get(b))));
    const next = new Set();
    for (const id of frontier) {
      if (visible.size >= requestedLimit) break;
      visible.add(id);
      for (const neighbor of adjacency.get(id) || []) {
        if (discovered.has(neighbor)) continue;
        discovered.add(neighbor);
        next.add(neighbor);
      }
    }
    frontier = [...next];
  }

  return visible;
}

export function visibleIdsForExpandedFamilies(baseVisibleIds, expandedFamilyIds, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  const visible = new Set([...baseVisibleIds].filter(id => knownIds.has(id)));
  const expanded = expandedFamilyIds instanceof Set ? expandedFamilyIds : new Set(expandedFamilyIds || []);
  const families = familyExpansionGroups(knownIds, relationships);
  const spouses = spouseNeighbors(knownIds, relationships);

  let changed = true;
  while (changed) {
    changed = false;
    for (const familyId of expanded) {
      const family = families.get(familyId);
      if (!family || !family.parentIds.some(id => visible.has(id))) continue;
      for (const parentId of family.parentIds) changed = addVisible(visible, parentId) || changed;
      for (const childId of family.childIds) {
        changed = addVisible(visible, childId) || changed;
        for (const spouseId of spouses.get(childId) || []) changed = addVisible(visible, spouseId) || changed;
      }
    }
  }

  return visible;
}

export function branchControlFamilies(visibleIds, expandedFamilyIds, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  const visible = visibleIds instanceof Set ? visibleIds : new Set(visibleIds || []);
  const expanded = expandedFamilyIds instanceof Set ? expandedFamilyIds : new Set(expandedFamilyIds || []);
  const families = familyExpansionGroups(knownIds, relationships);
  const controls = [];

  for (const family of families.values()) {
    const visibleParents = family.parentIds.filter(id => visible.has(id));
    if (!visibleParents.length) continue;
    if (expanded.has(family.familyId)) {
      controls.push({ ...family, visibleParentIds: visibleParents, action: 'collapse' });
      continue;
    }
    if (family.childIds.some(id => !visible.has(id))) {
      controls.push({ ...family, visibleParentIds: visibleParents, action: 'expand' });
    }
  }

  return controls.sort((a, b) => a.familyId.localeCompare(b.familyId));
}

export function descendantFamilyIds(rootFamilyId, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  const families = familyExpansionGroups(knownIds, relationships);
  const root = families.get(rootFamilyId);
  if (!root) return new Set();

  const familiesByParent = new Map();
  for (const family of families.values()) {
    for (const parentId of family.parentIds) {
      if (!familiesByParent.has(parentId)) familiesByParent.set(parentId, new Set());
      familiesByParent.get(parentId).add(family.familyId);
    }
  }

  const result = new Set();
  const peopleQueue = [...root.childIds];
  const visitedPeople = new Set();
  while (peopleQueue.length) {
    const personId = peopleQueue.shift();
    if (visitedPeople.has(personId)) continue;
    visitedPeople.add(personId);
    for (const familyId of familiesByParent.get(personId) || []) {
      if (familyId === rootFamilyId || result.has(familyId)) continue;
      result.add(familyId);
      for (const childId of families.get(familyId)?.childIds || []) peopleQueue.push(childId);
    }
  }
  return result;
}

export function familyExpansionGroups(knownIds, relationships = []) {
  const ids = knownIds instanceof Set ? knownIds : new Set(knownIds || []);
  const families = new Map();
  const ensure = key => {
    if (!families.has(key)) families.set(key, { familyId: key, parentIds: new Set(), childIds: new Set() });
    return families.get(key);
  };

  for (const link of relationships || []) {
    if (!ids.has(link.from) || !ids.has(link.to) || link.from === link.to) continue;
    if (link.type === 'parent') {
      const key = familyKey(link, 'parent');
      const family = ensure(key);
      family.parentIds.add(link.from);
      family.childIds.add(link.to);
    } else if (link.type === 'spouse' && link.familyId) {
      const family = ensure(String(link.familyId));
      family.parentIds.add(link.from);
      family.parentIds.add(link.to);
    }
  }

  return new Map(
    [...families.entries()]
      .filter(([, family]) => family.parentIds.size && family.childIds.size)
      .map(([key, family]) => [key, {
        familyId: key,
        parentIds: [...family.parentIds].sort(),
        childIds: [...family.childIds].sort(),
      }]),
  );
}

function familyKey(link, kind) {
  if (link.familyId) return String(link.familyId);
  return kind === 'parent'
    ? `parent:${String(link.from)}>${String(link.to)}`
    : `spouse:${[link.from, link.to].sort().join('|')}`;
}

function undirectedAdjacency(byId, relationships) {
  const adjacency = new Map([...byId.keys()].map(id => [id, new Set()]));
  for (const link of relationships || []) {
    if (!byId.has(link.from) || !byId.has(link.to) || link.from === link.to) continue;
    adjacency.get(link.from).add(link.to);
    adjacency.get(link.to).add(link.from);
  }
  return adjacency;
}

function spouseNeighbors(knownIds, relationships) {
  const spouses = new Map();
  const add = (a, b) => {
    if (!knownIds.has(a) || !knownIds.has(b) || a === b) return;
    if (!spouses.has(a)) spouses.set(a, new Set());
    spouses.get(a).add(b);
  };
  for (const link of relationships || []) {
    if (link.type !== 'spouse') continue;
    add(link.from, link.to);
    add(link.to, link.from);
  }
  return spouses;
}

function addVisible(visible, id) {
  if (!id || visible.has(id)) return false;
  visible.add(id);
  return true;
}

function personOrderKey(person) {
  if (!person) return '9|';
  const direct = Number.isFinite(person.directAncestorDepth) ? '0' : '1';
  const role = person.role === 'root' ? '0' : '1';
  return `${role}|${direct}|${String(person.id || '')}`;
}
