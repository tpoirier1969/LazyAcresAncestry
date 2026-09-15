import { savedRecordsForIndividual } from './gedcom-family-parser.js';

export const PROOF_ROOT_ID = 'I40538616551';
export const PROOF_SPOUSE_ID = 'I352435523781';
export const PROOF_SIBLING_ID = 'I40538616398';
export const PROOF_SIBLING_CHILD_ID = 'I40538616392';
export const PROOF_BASE_EXPECTED_PEOPLE = 53;
export const PROOF_BREADTH_EXPECTED_PEOPLE = 139;
export const PROOF_EXPECTED_PEOPLE = 568;

const DISPLAY_NAME_OVERRIDES = Object.freeze({
  I40538615623: 'Mary Alene Hillman',
  I40538615169: 'Clara Ann Bucco',
  I40538615779: 'Alice (Elma-Aliisa) Kauppila',
  I40538616472: 'Joseph Didace Poirier I',
  I40538616347: 'Marie Perrault',
  I40538615166: 'Tony (Antonio) Matteo Bucco',
  I40538616824: 'Paulina (Paola) Stella',
  I40538615585: 'Zacharius "Simon" Hillman',
  I40538615582: 'Lena Kaisa Ohramaki I. Ahola',
  I40538616840: 'Francis Eli "Frank" TakaEilola',
  I40538615819: 'Maria-Liisa Johansdotter Kauppila',
});

export function buildProofFamily(parsed) {
  const { individuals, families, relationships, sources } = parsed;
  const root = requirePerson(individuals, PROOF_ROOT_ID);
  const originFamily = requireFamily(families, firstFamilyOfOrigin(root), 'home family');
  const fatherId = originFamily.husb;
  const motherId = originFamily.wife;
  const parents = [fatherId, motherId].filter(Boolean);

  const grandparentsByParent = new Map();
  for (const parentId of parents) {
    const parent = requirePerson(individuals, parentId);
    const family = requireFamily(families, firstFamilyOfOrigin(parent), `family of ${parentId}`);
    grandparentsByParent.set(parentId, [family.husb, family.wife].filter(Boolean));
  }
  const grandparents = [...grandparentsByParent.values()].flat();

  const greatGrandparentsByGrandparent = new Map();
  const siblingGroups = new Map();
  for (const grandparentId of grandparents) {
    const grandparent = requirePerson(individuals, grandparentId);
    const familyId = firstFamilyOfOrigin(grandparent);
    const family = requireFamily(families, familyId, `family of ${grandparentId}`);
    greatGrandparentsByGrandparent.set(grandparentId, [family.husb, family.wife].filter(Boolean));
    siblingGroups.set(grandparentId, [...family.children]);
  }
  const greatGrandparents = unique([...greatGrandparentsByGrandparent.values()].flat());

  const baseIncluded = new Set([
    PROOF_ROOT_ID,
    PROOF_SPOUSE_ID,
    PROOF_SIBLING_ID,
    PROOF_SIBLING_CHILD_ID,
    ...parents,
    ...grandparents,
    ...greatGrandparents,
  ]);
  for (const siblings of siblingGroups.values()) siblings.forEach(id => baseIncluded.add(id));

  if (baseIncluded.size !== PROOF_BASE_EXPECTED_PEOPLE) {
    throw new Error(`Proof-tree base expected ${PROOF_BASE_EXPECTED_PEOPLE} people but produced ${baseIncluded.size}`);
  }

  const paternal = new Set([fatherId, ...(grandparentsByParent.get(fatherId) || [])]);
  const maternal = new Set([motherId, ...(grandparentsByParent.get(motherId) || [])]);
  for (const grandparentId of grandparentsByParent.get(fatherId) || []) {
    (greatGrandparentsByGrandparent.get(grandparentId) || []).forEach(id => paternal.add(id));
    (siblingGroups.get(grandparentId) || []).forEach(id => paternal.add(id));
  }
  for (const grandparentId of grandparentsByParent.get(motherId) || []) {
    (greatGrandparentsByGrandparent.get(grandparentId) || []).forEach(id => maternal.add(id));
    (siblingGroups.get(grandparentId) || []).forEach(id => maternal.add(id));
  }

  const directDepth = new Map([[PROOF_ROOT_ID, 0]]);
  parents.forEach(id => directDepth.set(id, 1));
  grandparents.forEach(id => directDepth.set(id, 2));
  greatGrandparents.forEach(id => directDepth.set(id, 3));

  const baseBranch = new Map();
  const baseGeneration = new Map();
  for (const id of baseIncluded) {
    const role = roleForBase(id, parents, grandparents, greatGrandparents);
    baseBranch.set(id, branchForBase(id, paternal, maternal));
    baseGeneration.set(id, generationForRole(role));
  }

  const included = new Set(baseIncluded);
  const expansionKind = new Map();
  const inheritedBranch = new Map(baseBranch);
  const generationHint = new Map(baseGeneration);
  const expansionCluster = new Map();
  const spouseFamilyIndex = buildSpouseFamilyIndex(families);

  // First breadth step: siblings and spouses of the approved 53-person proof
  // tree. This is the v0.4.10 scope and remains a named checkpoint so each UI
  // revision can deliberately expand one family layer at a time.
  for (const seedId of baseIncluded) {
    const seed = requirePerson(individuals, seedId);
    const seedBranch = baseBranch.get(seedId) || 'center';
    const seedGeneration = baseGeneration.get(seedId) ?? 0;

    for (const famc of seed.famc || []) {
      const family = families.get(famc.familyId);
      if (!family) continue;
      for (const siblingId of family.children || []) {
        if (!individuals.has(siblingId) || baseIncluded.has(siblingId)) continue;
        included.add(siblingId);
        if (!expansionKind.has(siblingId)) expansionKind.set(siblingId, 'sibling');
        if (!inheritedBranch.has(siblingId)) inheritedBranch.set(siblingId, seedBranch);
        if (!generationHint.has(siblingId)) generationHint.set(siblingId, seedGeneration);
        if (!expansionCluster.has(siblingId)) expansionCluster.set(siblingId, family.id);
      }
    }

    for (const family of spouseFamilyIndex.get(seedId) || []) {
      const spouseId = spouseFromFamily(seedId, family);
      if (!spouseId || !individuals.has(spouseId) || baseIncluded.has(spouseId)) continue;
      included.add(spouseId);
      if (!expansionKind.has(spouseId)) expansionKind.set(spouseId, 'spouse');
      if (!inheritedBranch.has(spouseId)) inheritedBranch.set(spouseId, seedBranch);
      if (!generationHint.has(spouseId)) generationHint.set(spouseId, seedGeneration);
    }
  }

  if (included.size !== PROOF_BREADTH_EXPECTED_PEOPLE) {
    throw new Error(`Proof-tree breadth checkpoint expected ${PROOF_BREADTH_EXPECTED_PEOPLE} people but produced ${included.size}`);
  }

  // Next UI stress-test layer: for everybody who was visible in v0.4.10, add
  // every recorded spouse/co-parent and one generation of their children. Then
  // add spouses of those newly added children so the family unit is intelligible.
  // Do not recurse into grandchildren or into spouse-side ancestry.
  const currentLayer = new Set(included);
  const newChildren = new Set();

  for (const seedId of currentLayer) {
    const seedBranch = inheritedBranch.get(seedId) || 'center';
    const seedGeneration = generationHint.get(seedId) ?? 0;

    for (const family of spouseFamilyIndex.get(seedId) || []) {
      const spouseId = spouseFromFamily(seedId, family);
      if (spouseId && individuals.has(spouseId) && !included.has(spouseId)) {
        included.add(spouseId);
        expansionKind.set(spouseId, 'spouse');
        inheritedBranch.set(spouseId, seedBranch);
        generationHint.set(spouseId, seedGeneration);
      }

      for (const childId of family.children || []) {
        if (!individuals.has(childId) || included.has(childId)) continue;
        included.add(childId);
        newChildren.add(childId);
        expansionKind.set(childId, 'child');
        inheritedBranch.set(childId, seedBranch);
        generationHint.set(childId, seedGeneration - 1);
        expansionCluster.set(childId, family.id);
      }
    }
  }

  for (const childId of newChildren) {
    const childBranch = inheritedBranch.get(childId) || 'center';
    const childGeneration = generationHint.get(childId) ?? -1;
    for (const family of spouseFamilyIndex.get(childId) || []) {
      const spouseId = spouseFromFamily(childId, family);
      if (!spouseId || !individuals.has(spouseId) || included.has(spouseId)) continue;
      included.add(spouseId);
      expansionKind.set(spouseId, 'child-spouse');
      inheritedBranch.set(spouseId, childBranch);
      generationHint.set(spouseId, childGeneration);
    }
  }

  if (included.size !== PROOF_EXPECTED_PEOPLE) {
    throw new Error(`Expanded proof tree expected ${PROOF_EXPECTED_PEOPLE} people but produced ${included.size}`);
  }

  const people = [...included].map(id => {
    const individual = requirePerson(individuals, id);
    const isBase = baseIncluded.has(id);
    const kind = expansionKind.get(id) || null;
    const role = isBase
      ? roleForBase(id, parents, grandparents, greatGrandparents)
      : roleForExpansion(kind);
    const branch = inheritedBranch.get(id) || branchForBase(id, paternal, maternal);
    const familyOfOrigin = firstFamilyOfOrigin(individual);
    // A real GEDCOM family-of-origin is retained as a grouping key even when
    // that person's parents are outside the current display scope. The
    // renderer may draw a sibling rail from this FAM/CHIL evidence, but it may
    // never invent an unnamed parent relationship.
    const cluster = familyOfOrigin || expansionCluster.get(id) || null;
    return {
      id,
      name: DISPLAY_NAME_OVERRIDES[id] || individual.name || id,
      gedcomName: individual.name || id,
      sex: individual.sex || 'U',
      birth: { ...individual.birth },
      death: { ...individual.death },
      events: (individual.events || []).map(event => ({ ...event })),
      living: !individual.death?.date,
      role,
      branch,
      cluster,
      generationHint: generationHint.get(id) ?? 0,
      directAncestorDepth: directDepth.has(id) ? directDepth.get(id) : null,
      proofExpansionKind: kind,
      note: id === PROOF_SIBLING_CHILD_ID
        ? 'User-confirmed adopted child. The source GEDCOM family record does not include an adoption/pedigree tag.'
        : null,
      rawGedcom: {
        gedcom_name: individual.name || '',
        alternate_names: individual.alternateNames || [],
        saved_records: savedRecordsForIndividual(individual, sources),
      },
    };
  });

  const scopedRelationships = relationships
    .filter(link => included.has(link.from) && included.has(link.to))
    .map(link => ({ ...link }));

  for (const link of scopedRelationships) {
    if (
      link.type === 'parent'
      && link.familyId === 'F2583'
      && link.from === PROOF_SIBLING_ID
      && link.to === PROOF_SIBLING_CHILD_ID
    ) link.pedigree = 'adopted';
  }

  const usedFamilyIds = new Set(scopedRelationships.map(link => link.familyId).filter(Boolean));
  people.forEach(person => { if (person.cluster) usedFamilyIds.add(person.cluster); });
  const scopedFamilies = [...usedFamilyIds].map(id => {
    const family = requireFamily(families, id, id);
    return {
      id,
      husb: included.has(family.husb) ? family.husb : null,
      wife: included.has(family.wife) ? family.wife : null,
      children: family.children.filter(child => included.has(child)),
      marriage: { ...family.marriage },
      sourceChildCount: family.children.length,
    };
  });

  people.sort(proofPersonOrder);
  scopedFamilies.sort((a, b) => a.id.localeCompare(b.id));
  scopedRelationships.sort(relationshipOrder);

  return {
    source: `Original GEDCOM proof tree + siblings/spouses + one child generation · ${people.length} people`,
    people,
    families: scopedFamilies,
    relationships: scopedRelationships,
    metadata: {
      relationshipAuthority: 'GEDCOM FAM records only',
      expectedPeople: PROOF_EXPECTED_PEOPLE,
      basePeople: PROOF_BASE_EXPECTED_PEOPLE,
      previousUiPeople: PROOF_BREADTH_EXPECTED_PEOPLE,
      scope: 'approved 53-person proof tree, one sibling/spouse breadth step, then one generation of children plus the spouses/co-parents needed to show those family units',
    },
  };
}

function buildSpouseFamilyIndex(families) {
  const index = new Map();
  for (const family of families.values()) {
    for (const personId of [family.husb, family.wife].filter(Boolean)) {
      if (!index.has(personId)) index.set(personId, []);
      index.get(personId).push(family);
    }
  }
  return index;
}

function spouseFromFamily(personId, family) {
  if (family.husb === personId) return family.wife;
  if (family.wife === personId) return family.husb;
  return null;
}

function firstFamilyOfOrigin(individual) {
  return individual?.famc?.[0]?.familyId || null;
}

function requirePerson(individuals, id) {
  const person = individuals.get(id);
  if (!person) throw new Error(`Proof tree requires GEDCOM person ${id}`);
  return person;
}

function requireFamily(families, id, label) {
  if (!id) throw new Error(`Proof tree is missing ${label}`);
  const family = families.get(id);
  if (!family) throw new Error(`Proof tree requires GEDCOM family ${id}`);
  return family;
}

function roleForBase(id, parents, grandparents, greatGrandparents) {
  if (id === PROOF_ROOT_ID) return 'root';
  if (id === PROOF_SPOUSE_ID) return 'spouse';
  if (id === PROOF_SIBLING_ID) return 'sibling';
  if (id === PROOF_SIBLING_CHILD_ID) return 'sibling-descendant';
  if (parents.includes(id)) return 'parent';
  if (grandparents.includes(id)) return 'grandparent';
  if (greatGrandparents.includes(id)) return 'great-grandparent';
  return 'grandparent-sibling';
}

function roleForExpansion(kind) {
  if (kind === 'sibling') return 'one-step-sibling';
  if (kind === 'child') return 'one-generation-child';
  if (kind === 'child-spouse') return 'one-generation-child-spouse';
  return 'one-step-spouse';
}

function branchForBase(id, paternal, maternal) {
  if ([PROOF_ROOT_ID, PROOF_SPOUSE_ID, PROOF_SIBLING_ID, PROOF_SIBLING_CHILD_ID].includes(id)) return 'center';
  if (paternal.has(id)) return 'paternal';
  if (maternal.has(id)) return 'maternal';
  return 'center';
}

function generationForRole(role) {
  return ({
    'great-grandparent': 3,
    grandparent: 2,
    'grandparent-sibling': 2,
    parent: 1,
    root: 0,
    spouse: 0,
    sibling: 0,
    'sibling-descendant': -1,
  })[role] ?? 0;
}

function proofPersonOrder(a, b) {
  const level = (b.generationHint ?? 0) - (a.generationHint ?? 0);
  if (level) return level;
  const branchOrder = { paternal: 0, center: 1, maternal: 2 };
  const branch = (branchOrder[a.branch] ?? 3) - (branchOrder[b.branch] ?? 3);
  if (branch) return branch;
  const cluster = String(a.cluster || '').localeCompare(String(b.cluster || ''));
  if (cluster) return cluster;
  return String(a.birth?.date || '').localeCompare(String(b.birth?.date || '')) || a.name.localeCompare(b.name);
}

function relationshipOrder(a, b) {
  return String(a.familyId || '').localeCompare(String(b.familyId || ''))
    || a.type.localeCompare(b.type)
    || a.from.localeCompare(b.from)
    || a.to.localeCompare(b.to);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
