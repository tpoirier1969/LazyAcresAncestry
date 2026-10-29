// Find a shortest blood relationship first; use marriage links only if needed.
export function findRelationshipPath(firstId, secondId, people, relationships) {
  const known = new Set(people.map(p => p.id));
  if (!known.has(firstId) || !known.has(secondId)) return null;
  const parents = new Map(), neighbors = new Map();
  const add = (map, a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  for (const link of relationships) {
    if (!known.has(link.from) || !known.has(link.to)) continue;
    if (link.type === 'parent') {
      add(parents, link.to, link.from);
      add(neighbors, link.from, link.to);
      add(neighbors, link.to, link.from);
    }
  }
  function search(allowMarriage) {
    const graph = new Map([...neighbors].map(([id, set]) => [id, new Set(set)]));
    if (allowMarriage) for (const link of relationships) {
      if (link.type !== 'spouse' || !known.has(link.from) || !known.has(link.to)) continue;
      add(graph, link.from, link.to);
      add(graph, link.to, link.from);
    }
    const previous = new Map([[firstId, null]]);
    const queue = [firstId];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      if (id === secondId) break;
      for (const next of graph.get(id) || []) {
        if (previous.has(next)) continue;
        previous.set(next, id);
        queue.push(next);
      }
    }
    if (!previous.has(secondId)) return null;
    const path = [];
    for (let id = secondId; id !== null; id = previous.get(id)) path.push(id);
    return path.reverse();
  }
  const path = search(false) || search(true);
  if (!path) return null;
  const visibleIds = new Set(path);
  const links = [];
  const edges = new Set();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const parent = parents.get(a)?.has(b) ? a : parents.get(b)?.has(a) ? b : null;
    const child = parent === a ? b : parent === b ? a : null;
    if (child) {
      // A family connection always displays BOTH recorded parents.
      for (const p of parents.get(child) || []) {
        visibleIds.add(p);
        const key = [p, child].join('>');
        if (!edges.has(key)) { edges.add(key); links.push({ from: p, to: child, type: 'parent' }); }
      }
    } else {
      links.push({ from: a, to: b, type: 'spouse' });
    }
  }
  // Include the spouses of the parents to make parent couples legible.
  for (const link of relationships) {
    if (link.type === 'spouse' && visibleIds.has(link.from) && visibleIds.has(link.to)) {
      const key = [link.from, link.to].sort().join('|');
      if (!edges.has(key)) { edges.add(key); links.push(link); }
    }
  }
  return { path, visibleIds, links, firstId, secondId };
}
