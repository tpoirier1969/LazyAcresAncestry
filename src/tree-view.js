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

export function visibleIdsForExpandedRoots(baseVisibleIds, expandedRoots, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  const visible = new Set([...baseVisibleIds].filter(id => knownIds.has(id)));
  const roots = expandedRoots instanceof Set ? expandedRoots : new Set(expandedRoots || []);
  const children = directedChildren(knownIds, relationships);
  const parents = parentsByChild(knownIds, relationships);
  const spouses = spouseNeighbors(knownIds, relationships);

  let changed = true;
  while (changed) {
    changed = false;
    for (const rootId of roots) {
      if (!visible.has(rootId)) continue;
      for (const childId of children.get(rootId) || []) {
        changed = addVisible(visible, childId) || changed;
        for (const parentId of parents.get(childId) || []) changed = addVisible(visible, parentId) || changed;
        for (const spouseId of spouses.get(childId) || []) changed = addVisible(visible, spouseId) || changed;
      }
    }
  }

  return visible;
}

export function hiddenImmediateDescendantRootIds(visibleIds, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  const visible = visibleIds instanceof Set ? visibleIds : new Set(visibleIds || []);
  const children = directedChildren(knownIds, relationships);
  const result = new Set();
  for (const id of visible) {
    if ([...(children.get(id) || [])].some(childId => !visible.has(childId))) result.add(id);
  }
  return result;
}

export function descendantIds(rootId, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  const children = directedChildren(knownIds, relationships);
  const descendants = new Set();
  const queue = [...(children.get(rootId) || [])];
  while (queue.length) {
    const id = queue.shift();
    if (descendants.has(id)) continue;
    descendants.add(id);
    for (const childId of children.get(id) || []) queue.push(childId);
  }
  return descendants;
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

function directedChildren(knownIds, relationships) {
  const children = new Map();
  for (const link of relationships || []) {
    if (link.type !== 'parent' || !knownIds.has(link.from) || !knownIds.has(link.to) || link.from === link.to) continue;
    if (!children.has(link.from)) children.set(link.from, new Set());
    children.get(link.from).add(link.to);
  }
  return children;
}

function parentsByChild(knownIds, relationships) {
  const parents = new Map();
  for (const link of relationships || []) {
    if (link.type !== 'parent' || !knownIds.has(link.from) || !knownIds.has(link.to) || link.from === link.to) continue;
    if (!parents.has(link.to)) parents.set(link.to, new Set());
    parents.get(link.to).add(link.from);
  }
  return parents;
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
