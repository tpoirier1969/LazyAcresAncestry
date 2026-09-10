import { SAMPLE_PORTRAITS } from './sample-portraits.js';

const FALLBACK_PATH = 'data/sample-family.json';

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
  const peopleUrl = `${config.supabaseUrl}/rest/v1/${prefix}people?select=gedcom_id,display_name,given_name,surname,sex,birth_date_text,birth_place,death_date_text,death_place,is_living,branch,sample_role,cluster_key,data_quality_note&sample_role=not.is.null`;
  const relUrl = `${config.supabaseUrl}/rest/v1/${prefix}relationships?select=relationship_type,from:${prefix}people!lazy_acres_ancestry_relationships_from_person_id_fkey(gedcom_id),to:${prefix}people!lazy_acres_ancestry_relationships_to_person_id_fkey(gedcom_id)`;
  const [peopleRes, relRes] = await Promise.all([fetch(peopleUrl, { headers }), fetch(relUrl, { headers })]);
  if (!peopleRes.ok || !relRes.ok) throw new Error('Supabase sample unavailable');
  const [peopleRows, relRows] = await Promise.all([peopleRes.json(), relRes.json()]);
  return {
    source: 'Supabase sample',
    people: peopleRows.map(row => ({
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
    })),
    relationships: relRows.map(row => ({ type: row.relationship_type, from: row.from?.gedcom_id, to: row.to?.gedcom_id })).filter(r => r.from && r.to),
  };
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
    })),
    relationships: data.relationships || [],
  };
}

function attachPortraits(family) {
  family.people.forEach(person => { person.photo = SAMPLE_PORTRAITS[person.id] || null; });
  return family;
}
