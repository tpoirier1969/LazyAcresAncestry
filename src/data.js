import { SAMPLE_PORTRAITS } from './sample-portraits.js';

const FALLBACK_PATH = 'data/sample-family.json';
const PAGE_SIZE = 1000;
const DEFAULT_ANCESTOR_DEPTH = 3;

export async function loadFamily(config) {
  const fromSupabase = await loadSupabase(config).catch(error => {
    console.warn('Using bundled sample:', error.message);
    return null;
  });
  return attachPortraits(fromSupabase || await loadFallback());
}

async function loadSupabase(config) {
  if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Supabase not configured');
  const headers = {
    apikey: config.supabasePublishableKey,
    Authorization: `Bearer ${config.supabasePublishableKey}`,
  };
  const prefix = config.tablePrefix || 'lazy_acres_ancestry_';
  const peopleUrl = `${config.supabaseUrl}/rest/v1/${prefix}people?select=gedcom_id,display_name,given_name,surname,sex,birth_date_text,birth_place,death_date_text,death_place,is_living,branch,sample_role,cluster_key,data_quality_note,raw_gedcom&sample_role=not.is.null&order=gedcom_id.asc`;
  const relUrl = `${config.supabaseUrl}/rest/v1/${prefix}relationships?select=id,relationship_type,from:${prefix}people!lazy_acres_ancestry_relationships_from_person_id_fkey(gedcom_id),to:${prefix}people!lazy_acres_ancestry_relationships_to_person_id_fkey(gedcom_id)&order=id.asc`;
  const [peopleRows, relRows] = await Promise.all([
    fetchAllRows(peopleUrl, headers),
    fetchAllRows(relUrl, headers),
  ]);

  const people = peopleRows.map(row => ({
    id: row.gedcom_id,
    name: row.display_name,
    given: row.given_name,
    surname: row.surname,
    sex: row.sex,
    birth: { date: row.birth_date_text, place: row.birth_place },
    death: { date: row.death_date_text, place: row.death_place },
    living: row.is_living,
    role: row.sample_role,
    branch: row.branch,
    cluster: row.cluster_key,
    note: row.data_quality_note,
    rawGedcom: row.raw_gedcom && typeof row.raw_gedcom === 'object' ? row.raw_gedcom : {},
  }));
  const knownIds = new Set(people.map(person => person.id));
  const relationships = relRows
    .map(row => ({ type: row.relationship_type, from: row.from?.gedcom_id, to: row.to?.gedcom_id }))
    .filter(link => knownIds.has(link.from) && knownIds.has(link.to));

  if (!people.length) throw new Error('Supabase GEDCOM graph is empty');
  if (!relationships.length) throw new Error('Supabase GEDCOM relationships are empty');

  const scoped = scopeFamilyGraph(people, relationships, DEFAULT_ANCESTOR_DEPTH);
  if (!scoped.people.length) throw new Error('Scoped GEDCOM family graph is empty');
  if (!scoped.relationships.length) throw new Error('Scoped GEDCOM relationships are empty');

  return {
    source: `GEDCOM family graph · ${scoped.people.length.toLocaleString()} people`,
    people: scoped.people,
    relationships: scoped.relationships,
  };
}

export function scopeFamilyGraph(people, relationships, ancestorDepth = DEFAULT_ANCESTOR_DEPTH) {
  if (!people.length) return { people: [], relationships: [] };
  const byId = new Map(people.map(person => [person.id, person]));
  const known = new Set(byId.keys());
  const parentLinks = relationships.filter(link => link.type === 'parent' && known.has(link.from) && known.has(link.to));
  const spouseLinks = relationships.filter(link => link.type === 'spouse' && known.has(link.from) && known.has(link.to));
  const parentsByChild = new Map();
  const childrenByParent = new Map();
  parentLinks.forEach(link => {
    if (!parentsByChild.has(link.to)) parentsByChild.set(link.to, new Set());
    if (!childrenByParent.has(link.from)) childrenByParent.set(link.from, new Set());
    parentsByChild.get(link.to).add(link.from);
    childrenByParent.get(link.from).add(link.to);
  });

  const root = people.find(person => person.role === 'root') || people[0];
  const directAncestors = new Map([[root.id, 0]]);
  const queue = [root.id];
  while (queue.length) {
    const child = queue.shift();
    const depth = directAncestors.get(child) || 0;
    if (depth >= ancestorDepth) continue;
    for (const parent of parentsByChild.get(child) || []) {
      if (directAncestors.has(parent) && directAncestors.get(parent) <= depth + 1) continue;
      directAncestors.set(parent, depth + 1);
      queue.push(parent);
    }
  }

  // Each branch starts at the oldest direct ancestor that is actually available
  // in the imported graph. Descending only through recorded parent-child links
  // includes the direct ancestor, their children/siblings on the home lineage,
  // and the descendants of those sibling branches without wandering up an
  // in-law spouse's unrelated ancestry.
  const frontier = new Set();
  for (const [id, depth] of directAncestors) {
    if (depth === 0) continue;
    const knownParents = [...(parentsByChild.get(id) || [])].filter(parent => known.has(parent));
    if (depth >= ancestorDepth || !knownParents.length) frontier.add(id);
  }
  if (!frontier.size) frontier.add(root.id);

  const blood = new Set(directAncestors.keys());
  const descendQueue = [...frontier];
  frontier.forEach(id => blood.add(id));
  while (descendQueue.length) {
    const parent = descendQueue.shift();
    for (const child of childrenByParent.get(parent) || []) {
      if (blood.has(child)) continue;
      blood.add(child);
      descendQueue.push(child);
    }
  }

  // Explicitly include any discoverable direct siblings of the selected
  // ancestor chain and their descendants. Most are already descendants of a
  // frontier ancestor; keeping this step explicit documents and protects the
  // intended product rule when a branch is only partially imported.
  const siblingSeeds = new Set();
  for (const ancestor of directAncestors.keys()) {
    for (const parent of parentsByChild.get(ancestor) || []) {
      for (const sibling of childrenByParent.get(parent) || []) {
        if (sibling !== ancestor) siblingSeeds.add(sibling);
      }
    }
  }
  const siblingQueue = [...siblingSeeds];
  siblingSeeds.forEach(id => blood.add(id));
  while (siblingQueue.length) {
    const parent = siblingQueue.shift();
    for (const child of childrenByParent.get(parent) || []) {
      if (blood.has(child)) continue;
      blood.add(child);
      siblingQueue.push(child);
    }
  }

  // A spouse/co-parent may be shown to make a family unit intelligible, but
  // inclusion stops there. Their parents, siblings and unrelated branches do
  // not hitchhike onto the displayed tree.
  const included = new Set(blood);
  spouseLinks.forEach(link => {
    if (blood.has(link.from)) included.add(link.to);
    if (blood.has(link.to)) included.add(link.from);
  });
  parentLinks.forEach(link => {
    if (!blood.has(link.to)) return;
    for (const parent of parentsByChild.get(link.to) || []) included.add(parent);
  });

  const scopedPeople = people
    .filter(person => included.has(person.id))
    .map(person => ({
      ...person,
      scopeKind: blood.has(person.id) ? 'blood' : 'family-partner',
      directAncestorDepth: directAncestors.has(person.id) ? directAncestors.get(person.id) : null,
    }));
  const scopedIds = new Set(scopedPeople.map(person => person.id));
  const scopedRelationships = relationships.filter(link => scopedIds.has(link.from) && scopedIds.has(link.to));

  return { people: scopedPeople, relationships: scopedRelationships };
}

async function fetchAllRows(baseUrl, headers) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Supabase graph request failed (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Supabase graph returned an invalid response');
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadFallback() {
  const response = await fetch(FALLBACK_PATH);
  if (!response.ok) throw new Error('Bundled family sample is missing.');
  const data = await response.json();
  const family = {
    source: 'Bundled sample',
    people: data.people.map(person => ({
      id: person.gedcom_id,
      name: person.name,
      given: person.given,
      surname: person.surname,
      sex: person.sex,
      birth: { date: person.birth?.date, place: person.birth?.plac },
      death: { date: person.death?.date, place: person.death?.plac },
      living: !person.death?.date,
      role: person.role,
      branch: person.branch,
      cluster: person.cluster,
      note: null,
      rawGedcom: {
        birth: person.birth || {},
        death: person.death || {},
        alternate_names: person.alternate_names || [],
        ...(person.raw_gedcom && typeof person.raw_gedcom === 'object' ? person.raw_gedcom : {}),
      },
    })),
    relationships: data.relationships || [],
  };
  const scoped = scopeFamilyGraph(family.people, family.relationships, DEFAULT_ANCESTOR_DEPTH);
  return {
    source: family.source,
    people: scoped.people,
    relationships: scoped.relationships,
  };
}

function attachPortraits(family) {
  family.people.forEach(person => { person.photo = SAMPLE_PORTRAITS[person.id] || null; });
  Object.defineProperty(family.people, 'relationships', {
    value: family.relationships,
    enumerable: false,
    configurable: true,
  });
  return family;
}
