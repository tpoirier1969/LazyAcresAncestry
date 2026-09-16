export const DEFAULT_VISIBLE_PEOPLE = 600;
export const COLLATERAL_GENERATION_LIMIT = 3;

export function lineageWindowIds(targetId, people = [], relationships = [], limit = DEFAULT_VISIBLE_PEOPLE) {
  const byId = new Map(people.map(person => [person.id, person]));
  const knownIds = new Set(byId.keys());
  const requestedLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_VISIBLE_PEOPLE));
  const target = byId.has(targetId)
    ? targetId
    : people.find(person => person.role === 'root')?.id || people[0]?.id || null;
  if (!target) return new Set();

  const { parents, children } = parentChildMaps(knownIds, relationships);
  const spouses = spouseNeighbors(knownIds, relationships);
  const ancestors = generationDepths(target, parents);
  const descendants = generationDepths(target, children);
  const vertical = new Set([...ancestors.keys(), ...descendants.keys()]);

  const visible = new Set();
  const add = id => {
    if (!id || !knownIds.has(id) || visible.has(id) || visible.size >= requestedLimit) return false;
    visible.add(id);
    return true;
  };

  add(target);
  for (const spouseId of sortedIds(spouses.get(target) || [])) add(spouseId);

  const verticalEntries = [];
  for (const [id, depth] of ancestors) {
    if (id !== target) verticalEntries.push({ id, depth, direction: 0 });
  }
  for (const [id, depth] of descendants) {
    if (id !== target) verticalEntries.push({ id, depth, direction: 1 });
  }
  verticalEntries.sort((a, b) => a.depth - b.depth || a.direction - b.direction || a.id.localeCompare(b.id));
  for (const entry of verticalEntries) add(entry.id);

  // Keep spouses/co-parents attached to the vertical spine before spending
  // the remaining display budget on collateral branches.
  for (const entry of verticalEntries) {
    for (const spouseId of sortedIds(spouses.get(entry.id) || [])) add(spouseId);
  }

  const collateral = new Map();
  for (const [ancestorId, targetDepth] of ancestors) {
    if (targetDepth < 1 || targetDepth > COLLATERAL_GENERATION_LIMIT) continue;
    const branchDepths = generationDepths(ancestorId, children, COLLATERAL_GENERATION_LIMIT);
    for (const [candidateId, candidateDepth] of branchDepths) {
      if (candidateDepth < 1 || candidateDepth > COLLATERAL_GENERATION_LIMIT) continue;
      if (vertical.has(candidateId)) continue;
      const span = Math.max(targetDepth, candidateDepth);
      if (span > COLLATERAL_GENERATION_LIMIT) continue;
      const score = targetDepth + candidateDepth;
      const existing = collateral.get(candidateId);
      if (!existing || score < existing.score || (score === existing.score && span < existing.span)) {
        collateral.set(candidateId, { id: candidateId, score, span, targetDepth, candidateDepth });
      }
    }
  }

  const collateralEntries = [...collateral.values()].sort((a, b) =>
    a.span - b.span
    || a.score - b.score
    || a.targetDepth - b.targetDepth
    || a.candidateDepth - b.candidateDepth
    || a.id.localeCompare(b.id));

  for (const entry of collateralEntries) add(entry.id);
  for (const entry of collateralEntries) {
    for (const spouseId of sortedIds(spouses.get(entry.id) || [])) add(spouseId);
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

function parentChildMaps(knownIds, relationships = []) {
  const parents = new Map([...knownIds].map(id => [id, new Set()]));
  const children = new Map([...knownIds].map(id => [id, new Set()]));
  for (const link of relationships || []) {
    if (link.type !== 'parent' || !knownIds.has(link.from) || !knownIds.has(link.to) || link.from === link.to) continue;
    children.get(link.from).add(link.to);
    parents.get(link.to).add(link.from);
  }
  return { parents, children };
}

function generationDepths(startId, adjacency, maxDepth = Infinity) {
  const depths = new Map([[startId, 0]]);
  let frontier = [startId];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      const depth = depths.get(id) || 0;
      if (depth >= maxDepth) continue;
      for (const relativeId of adjacency.get(id) || []) {
        if (depths.has(relativeId)) continue;
        depths.set(relativeId, depth + 1);
        next.push(relativeId);
      }
    }
    frontier = next;
  }
  return depths;
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

function sortedIds(ids) {
  return [...ids].sort((a, b) => String(a).localeCompare(String(b)));
}

function addVisible(visible, id) {
  if (!id || visible.has(id)) return false;
  visible.add(id);
  return true;
}
