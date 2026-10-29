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


/**
 * Describe the SECOND person's relationship to the FIRST, using the
 * complete GEDCOM graph rather than the subset currently visible.
 * Unproven links and ambiguous family-network paths get cautious labels.
 */
export function describePairRelationship(firstId, secondId, people = [], relationships = [], path = null) {
  if (!firstId || !secondId) return 'Relationship unavailable';
  if (firstId === secondId) return 'Same person';

  const peopleById = new Map(people.map(person => [person.id, person]));
  const sex = peopleById.get(secondId)?.sex;
  const parentLinks = new Map();
  const partners = new Map();
  const add = (map, a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  for (const link of relationships) {
    if (link.type === 'parent') {
      if (!parentLinks.has(link.to)) parentLinks.set(link.to, []);
      parentLinks.get(link.to).push(link);
    } else if (link.type === 'spouse') {
      add(partners, link.from, link.to);
      add(partners, link.to, link.from);
    }
  }
  const parents = id => new Set((parentLinks.get(id) || []).map(link => link.from));
  const sharesParent = (a, b) => [...parents(a)].some(p => parents(b).has(p));
  const isParent = (a, b) => parents(b).has(a);
  const isSpouse = (a, b) => partners.get(a)?.has(b) || false;
  const hasSpouseStep = path?.some((id, i) => i > 0 && isSpouse(path[i - 1], id));

  if (isSpouse(firstId, secondId)) return sexed(sex, 'Husband', 'Wife', 'Spouse');
  if (sharesParent(firstId, secondId)) {
    const firstParents = parents(firstId);
    const secondParents = parents(secondId);
    const shared = [...firstParents].filter(p => secondParents.has(p));
    const distinctParents = [...firstParents].some(p => !secondParents.has(p))
      && [...secondParents].some(p => !firstParents.has(p));
    const label = sexed(sex, 'Brother', 'Sister', 'Sibling');
    // One documented shared parent does not prove a half relationship
    // when the other parent is simply unknown in the source GEDCOM.
    return shared.length === 1 && distinctParents ? 'Half-' + label.toLowerCase() : label;
  }

  // Only call someone a step-relative when there is a documented marriage
  // linking the parent households. A co-parent or vague network connection
  // is insufficient evidence for that designation.
  if (!isParent(secondId, firstId) && [...parents(firstId)].some(p => isSpouse(p, secondId))) {
    return sexed(sex, 'Stepfather', 'Stepmother', 'Stepparent');
  }
  if (!isParent(firstId, secondId) && [...parents(secondId)].some(p => isSpouse(p, firstId))) {
    return sexed(sex, 'Stepson', 'Stepdaughter', 'Stepchild');
  }
  if ([...parents(firstId)].some(p => [...parents(secondId)].some(q => isSpouse(p, q)))) {
    return sexed(sex, 'Stepbrother', 'Stepsister', 'Stepsibling');
  }

  if (!hasSpouseStep) {
    const ancestors = id => {
      const depths = new Map([[id, 0]]);
      const queue = [id];
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        for (const parent of parents(current)) {
          if (depths.has(parent)) continue;
          depths.set(parent, depths.get(current) + 1);
          queue.push(parent);
        }
      }
      return depths;
    };
    const firstAncestors = ancestors(firstId);
    const secondAncestors = ancestors(secondId);
    let nearest = null;
    for (const [id, fromFirst] of firstAncestors) {
      const fromSecond = secondAncestors.get(id);
      if (fromSecond === undefined) continue;
      const distance = fromFirst + fromSecond;
      const maximum = Math.max(fromFirst, fromSecond);
      if (!nearest || distance < nearest.distance
        || (distance === nearest.distance && maximum < nearest.maximum)) {
        nearest = { fromFirst, fromSecond, distance, maximum };
      }
    }
    if (nearest) {
      const { fromFirst: a, fromSecond: b } = nearest;
      // The label names the SECOND person, from the FIRST person's perspective.
      if (b === 0) return generationalAncestor(a, sex);
      if (a === 0) return generationalDescendant(b, sex);
      if (a === 1 && b === 1) return sexed(sex, 'Brother', 'Sister', 'Sibling');
      if (b === 1) return collateralAncestor(a - 1, sex);
      if (a === 1) return collateralDescendant(b - 1, sex);
      const degree = Math.min(a, b) - 1;
      const removed = Math.abs(a - b);
      return wordOrdinal(degree) + ' cousin' + (removed ? ' ' + removedPhrase(removed) : '');
    }
  }

  // Relationships by marriage are classified only when graph evidence
  // establishes a recognizable immediate in-law relationship.
  if ([...partners.get(firstId) || []].some(p => isParent(secondId, p))) {
    return sexed(sex, 'Father-in-law', 'Mother-in-law', 'Parent-in-law');
  }
  if ([...partners.get(secondId) || []].some(p => isParent(firstId, p))) {
    return sexed(sex, 'Son-in-law', 'Daughter-in-law', 'Child-in-law');
  }
  if ([...partners.get(firstId) || []].some(p => sharesParent(p, secondId))
      || [...partners.get(secondId) || []].some(p => sharesParent(firstId, p))) {
    return sexed(sex, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law');
  }
  if (hasSpouseStep) return 'Connected through marriage (exact relationship not established)';
  return 'Family connection recorded (exact relationship not established)';
}

function generationalAncestor(depth, sex) {
  if (depth === 1) return sexed(sex, 'Father', 'Mother', 'Parent');
  const grand = sexed(sex, 'Grandfather', 'Grandmother', 'Grandparent');
  return depth === 2 ? grand : 'Great-'.repeat(depth - 2) + grand.toLowerCase();
}

function generationalDescendant(depth, sex) {
  if (depth === 1) return sexed(sex, 'Son', 'Daughter', 'Child');
  const grand = sexed(sex, 'Grandson', 'Granddaughter', 'Grandchild');
  return depth === 2 ? grand : 'Great-'.repeat(depth - 2) + grand;
}

function collateralAncestor(distance, sex) {
  const base = sexed(sex, 'Uncle', 'Aunt', 'Aunt/Uncle');
  if (distance === 1) return base;
  return (distance === 2 ? 'Grand-' : 'Great-'.repeat(distance - 2) + 'grand-') + base.toLowerCase();
}

function collateralDescendant(distance, sex) {
  const base = sexed(sex, 'Nephew', 'Niece', 'Niece/Nephew');
  if (distance === 1) return base;
  return (distance === 2 ? 'Grand-' : 'Great-'.repeat(distance - 2) + 'grand-') + base.toLowerCase();
}

function wordOrdinal(value) {
  const names = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
  return names[value] || ordinal(value);
}

function removedPhrase(value) {
  if (value === 1) return 'once removed';
  if (value === 2) return 'twice removed';
  return value + ' times removed';
}
