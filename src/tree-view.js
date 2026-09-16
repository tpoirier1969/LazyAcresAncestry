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

export function nextDescendantExpansionIds(rootId, visibleIds, people = [], relationships = []) {
  const knownIds = new Set(people.map(person => person.id));
  if (!knownIds.has(rootId)) return new Set();
  const visible = visibleIds instanceof Set ? visibleIds : new Set(visibleIds || []);
  const children = directedChildren(knownIds, relationships);
  const familyNeighbors = immediateFamilyNeighbors(knownIds, relationships);
  const traversed = new Set([rootId]);
  let frontier = [...(children.get(rootId) || [])];

  while (frontier.length) {
    const hiddenLayer = frontier.filter(id => !visible.has(id));
    if (hiddenLayer.length) {
      const expansion = new Set(hiddenLayer);
      for (const id of hiddenLayer) {
        for (const relativeId of familyNeighbors.get(id) || []) {
          if (!visible.has(relativeId)) expansion.add(relativeId);
        }
      }
      return expansion;
    }

    const next = new Set();
    for (const id of frontier) {
      if (traversed.has(id)) continue;
      traversed.add(id);
      for (const childId of children.get(id) || []) {
        if (!traversed.has(childId)) next.add(childId);
      }
    }
    frontier = [...next].sort();
  }

  return new Set();
}

export function hasHiddenDescendants(rootId, visibleIds, people = [], relationships = []) {
  return nextDescendantExpansionIds(rootId, visibleIds, people, relationships).size > 0;
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

function immediateFamilyNeighbors(knownIds, relationships) {
  const neighbors = new Map();
  const add = (a, b) => {
    if (!knownIds.has(a) || !knownIds.has(b) || a === b) return;
    if (!neighbors.has(a)) neighbors.set(a, new Set());
    neighbors.get(a).add(b);
  };
  for (const link of relationships || []) {
    if (link.type !== 'parent' && link.type !== 'spouse') continue;
    add(link.from, link.to);
    add(link.to, link.from);
  }
  return neighbors;
}

function personOrderKey(person) {
  if (!person) return '9|';
  const direct = Number.isFinite(person.directAncestorDepth) ? '0' : '1';
  const role = person.role === 'root' ? '0' : '1';
  return `${role}|${direct}|${String(person.id || '')}`;
}
