import { savedRecordsForIndividual } from './gedcom-family-parser.js';

export const PROOF_ROOT_ID = 'I40538616551';
export const PROOF_SPOUSE_ID = 'I352435523781';
export const PROOF_SIBLING_ID = 'I40538616398';
export const PROOF_SIBLING_CHILD_ID = 'I40538616392';
export const PROOF_EXPECTED_PEOPLE = 53;

// These are display labels already used by the prototype. They do not alter
// the source GEDCOM. The later data-cleanup phase will decide which labels
// should become corrections in the working genealogy.
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

  const included = new Set([
    PROOF_ROOT_ID,
    PROOF_SPOUSE_ID,
    PROOF_SIBLING_ID,
    PROOF_SIBLING_CHILD_ID,
    ...parents,
    ...grandparents,
    ...greatGrandparents,
  ]);
  for (const siblings of siblingGroups.values()) siblings.forEach(id => included.add(id));

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

  const people = [...included].map(id => {
    const individual = requirePerson(individuals, id);
    const role = roleFor(id, parents, grandparents, greatGrandparents);
    const branch = id === PROOF_ROOT_ID || id === PROOF_SPOUSE_ID || id === PROOF_SIBLING_ID || id === PROOF_SIBLING_CHILD_ID
      ? 'center'
      : paternal.has(id) ? 'paternal' : maternal.has(id) ? 'maternal' : 'center';
    const familyOfOrigin = firstFamilyOfOrigin(individual);
    return {
      id,
      name: DISPLAY_NAME_OVERRIDES[id] || individual.name || id,
      gedcomName: individual.name || id,
      sex: individual.sex || 'U',
      birth: { ...individual.birth },
      death: { ...individual.death },
      living: !individual.death?.date,
      role,
      branch,
      cluster: ['grandparent', 'grandparent-sibling'].includes(role) ? familyOfOrigin : null,
      directAncestorDepth: directDepth.has(id) ? directDepth.get(id) : null,
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

  // The original Ancestry GEDCOM links Amy and Maikel in F2583 but does not
  // preserve the adoption pedigree. Keep the source file untouched and apply
  // this user-confirmed fact only to the proof-tree working layer.
  for (const link of scopedRelationships) {
    if (
      link.type === 'parent'
      && link.familyId === 'F2583'
      && link.from === PROOF_SIBLING_ID
      && link.to === PROOF_SIBLING_CHILD_ID
    ) link.pedigree = 'adopted';
  }

  const usedFamilyIds = new Set(scopedRelationships.map(link => link.familyId).filter(Boolean));
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
    source: `Original GEDCOM proof tree · ${people.length} people`,
    people,
    families: scopedFamilies,
    relationships: scopedRelationships,
    metadata: {
      relationshipAuthority: 'GEDCOM FAM records only',
      expectedPeople: PROOF_EXPECTED_PEOPLE,
      scope: 'home person, spouse, sibling and her child, parents, grandparents, great-grandparents, and the four grandparent sibling groups',
    },
  };
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

function roleFor(id, parents, grandparents, greatGrandparents) {
  if (id === PROOF_ROOT_ID) return 'root';
  if (id === PROOF_SPOUSE_ID) return 'spouse';
  if (id === PROOF_SIBLING_ID) return 'sibling';
  if (id === PROOF_SIBLING_CHILD_ID) return 'sibling-descendant';
  if (parents.includes(id)) return 'parent';
  if (grandparents.includes(id)) return 'grandparent';
  if (greatGrandparents.includes(id)) return 'great-grandparent';
  return 'grandparent-sibling';
}

function proofPersonOrder(a, b) {
  const level = roleLevel(b.role) - roleLevel(a.role);
  if (level) return level;
  const branchOrder = { paternal: 0, center: 1, maternal: 2 };
  const branch = (branchOrder[a.branch] ?? 3) - (branchOrder[b.branch] ?? 3);
  if (branch) return branch;
  return String(a.birth?.date || '').localeCompare(String(b.birth?.date || '')) || a.name.localeCompare(b.name);
}

function roleLevel(role) {
  return ({ 'great-grandparent': 3, grandparent: 2, 'grandparent-sibling': 2, parent: 1, root: 0, spouse: 0, sibling: 0, 'sibling-descendant': -1 })[role] ?? 0;
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
