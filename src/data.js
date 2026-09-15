import { SAMPLE_PORTRAITS } from './sample-portraits.js';
import { parseGedcomFamilies, validateGedcomFamilyGraph } from './gedcom-family-parser.js';
import { buildProofFamily, PROOF_EXPECTED_PEOPLE } from './proof-family.js';

const GEDCOM_PATH = 'Poirier - Hillman - Kauppila - Eilola - Bucco - Sortonen - Perreault - Stella families..ged';

export async function loadFamily() {
  const response = await fetch(GEDCOM_PATH, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Source GEDCOM failed to load (${response.status})`);
  const text = await response.text();
  const parsed = parseGedcomFamilies(text);
  const graphErrors = validateGedcomFamilyGraph(parsed);
  if (graphErrors.length) throw new Error(`Source GEDCOM family graph has ${graphErrors.length} structural errors`);

  const family = buildProofFamily(parsed);
  if (family.people.length !== PROOF_EXPECTED_PEOPLE) {
    throw new Error(`Proof tree expected ${PROOF_EXPECTED_PEOPLE} people but produced ${family.people.length}`);
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
