import { SAMPLE_PORTRAITS } from './sample-portraits.js';

const FALLBACK_PATH = 'data/sample-family.json';
const PAGE_SIZE = 1000;

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

  return {
    source: `GEDCOM family graph · ${people.length.toLocaleString()} people`,
    people,
    relationships,
  };
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
  return {
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
