import { SAMPLE_PORTRAITS } from './sample-portraits.js';
import { parseGedcomFamilies, validateGedcomFamilyGraph } from './gedcom-family-parser.js';
import { buildProofFamily } from './proof-family.js';

const GEDCOM_PATH = 'Poirier - Hillman - Kauppila - Eilola - Bucco - Sortonen - Perreault - Stella families..ged';

export async function loadFamily() {
  const response = await fetch(GEDCOM_PATH, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Source GEDCOM failed to load (${response.status})`);
  const text = await response.text();
  const parsed = parseGedcomFamilies(text);
  const graphErrors = validateGedcomFamilyGraph(parsed);
  if (graphErrors.length) throw new Error(`Source GEDCOM family graph has ${graphErrors.length} structural errors`);

  const family = includeCompleteGedcom(buildProofFamily(parsed), parsed);
  if (!family.people.length || family.metadata?.expectedPeople !== family.people.length) {
    throw new Error(`GEDCOM produced an invalid population (${family.people.length} people)`);
  }
  attachPortraits(family);
  return family;
}

function attachPortraits(family) {
  family.people.forEach(person => {
    person.photo = SAMPLE_PORTRAITS[person.id] || null;
  });
  return family;
}

function includeCompleteGedcom(proof, parsed) {
  const existing = new Set(proof.people.map(person => person.id));
  for (const [id, individual] of parsed.individuals) {
    if (existing.has(id)) continue;
    proof.people.push({
      id,
      name: individual.name || id,
      gedcomName: individual.name || id,
      sex: individual.sex || 'U',
      birth: { ...individual.birth },
      death: { ...individual.death },
      living: !individual.death?.date,
      role: 'relative',
      branch: 'center',
      cluster: individual.famc?.[0]?.familyId || null,
      generationHint: 0,
      directAncestorDepth: null,
      proofExpansionKind: null,
      note: null,
      rawGedcom: {
        gedcom_name: individual.name || '',
        alternate_names: individual.alternateNames || [],
        saved_records: [],
      },
    });
  }
  // Preserve every original GEDCOM relationship and marriage family.
  proof.relationships = parsed.relationships.map(link => ({ ...link }));
  proof.families = [...parsed.families.values()].map(family => ({
    id: family.id,
    husb: family.husb || null,
    wife: family.wife || null,
    children: [...family.children],
    marriage: { ...family.marriage },
    sourceChildCount: family.children.length,
  }));
  proof.metadata = {
    ...proof.metadata,
    expectedPeople: proof.people.length,
    fullGedcomPeople: parsed.individuals.size,
    scope: 'Complete GEDCOM population; the original proof population remains annotated.',
  };
  proof.source = `Complete GEDCOM · ${proof.people.length} people`;
  return proof;
}
