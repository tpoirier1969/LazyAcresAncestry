// Relationship navigation uses only the documented GEDCOM graph.
// Walking a parent-child edge reveals its full recorded co-parent unit,
// but never expands into the parents OF that unit unless the shortest
// connecting path itself needs that earlier generation.
export function findRelationshipPath(firstId, secondId, people = [], relationships = []) {
  const known = new Set(people.map(person => person.id));
  if (!known.has(firstId) || !known.has(secondId)) return null;

  const adjacency = new Map();
  const parentalLinks = new Map();
  const marriages = [];
  const addNeighbor = (graph, from, to) => {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from).add(to);
  };
  for (const link of relationships) {
    if (!known.has(link.from) || !known.has(link.to)) continue;
    if (link.type === 'parent') {
      addNeighbor(adjacency, link.from, link.to);
      addNeighbor(adjacency, link.to, link.from);
      if (!parentalLinks.has(link.to)) parentalLinks.set(link.to, []);
      parentalLinks.get(link.to).push(link);
    } else if (link.type === 'spouse') {
      marriages.push(link);
    }
  }

  const shortest = allowMarriage => {
    const neighbors = new Map([...adjacency].map(([id, values]) => [id, new Set(values)]));
    if (allowMarriage) for (const marriage of marriages) {
      addNeighbor(neighbors, marriage.from, marriage.to);
      addNeighbor(neighbors, marriage.to, marriage.from);
    }
    const from = new Map([[firstId, null]]);
    const queue = [firstId];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (id === secondId) break;
      for (const next of neighbors.get(id) || []) {
        if (from.has(next)) continue;
        from.set(next, id);
        queue.push(next);
      }
    }
    if (!from.has(secondId)) return null;
    const path = [];
    for (let id = secondId; id !== null; id = from.get(id)) path.push(id);
    return path.reverse();
  };

  const path = shortest(false) || shortest(true);
  if (!path) return null;

  const visibleIds = new Set(path);
  const links = [];
  const highlightedParentChild = new Set();
  const highlightedCouples = new Set();
  const segments = [{ kind: 'person', ids: [firstId] }];
  const coupleKey = (a, b) => [a, b].sort().join('|');
  const seen = new Set();
  const addLink = link => {
    const key = link.type === 'spouse'
      ? 'spouse:' + coupleKey(link.from, link.to)
      : 'parent:' + link.from + '>' + link.to;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(link);
  };
  const parentUnit = (childId, parentId) => {
    const parentLinks = parentalLinks.get(childId) || [];
    const chosen = parentLinks.find(link => link.from === parentId);
    if (!chosen) return null;
    // The family ID identifies the specific couple for a child. Do not
    // combine different marriages or adoptive families into one parent pair.
    const unitLinks = chosen.familyId
      ? parentLinks.filter(link => link.familyId === chosen.familyId)
      : parentLinks.filter(link => !link.familyId);
    return { parents: [...new Set(unitLinks.map(link => link.from))], links: unitLinks };
  };

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const childId = (parentalLinks.get(a) || []).some(link => link.from === b) ? a
      : (parentalLinks.get(b) || []).some(link => link.from === a) ? b : null;
    if (!childId) {
      const marriage = marriages.find(link => (link.from === a && link.to === b)
        || (link.from === b && link.to === a));
      addLink({ type: 'spouse', from: a, to: b, familyId: marriage?.familyId });
      highlightedCouples.add(coupleKey(a, b));
      segments.push({ kind: 'person', ids: [b] });
      continue;
    }
    const parentId = childId === a ? b : a;
    const unit = parentUnit(childId, parentId);
    if (!unit) continue;
    for (const id of unit.parents) visibleIds.add(id);
    for (const link of unit.links) {
      addLink(link);
      highlightedParentChild.add(link.from + '>' + link.to);
    }
    if (unit.parents.length > 1) {
      for (let p = 0; p < unit.parents.length; p++)
        for (let q = p + 1; q < unit.parents.length; q++)
          highlightedCouples.add(coupleKey(unit.parents[p], unit.parents[q]));
    }
    const parentSegment = { kind: 'parents', ids: [...unit.parents].sort() };
    if (childId === a) {
      const last = segments[segments.length - 1];
      if (last?.kind !== 'parents' || last.ids.join('|') !== parentSegment.ids.join('|')) {
        segments.push(parentSegment);
      }
    } else {
      // Replace a parent-only step with its complete parent unit, rather
      // than displaying the parent twice in the written relationship chain.
      const last = segments[segments.length - 1];
      if (last?.kind === 'person' && last.ids[0] === parentId) segments.pop();
      const prev = segments[segments.length - 1];
      if (prev?.kind !== 'parents' || prev.ids.join('|') !== parentSegment.ids.join('|')) {
        segments.push(parentSegment);
      }
      segments.push({ kind: 'person', ids: [childId] });
    }
  }
  return {
    path,
    visibleIds,
    links,
    firstId,
    secondId,
    segments,
    highlightedParentChild,
    highlightedCouples,
  };
}
