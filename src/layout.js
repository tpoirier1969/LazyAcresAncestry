import { tangentPoint } from './geometry.js';

export const LAYOUT_GAPS = Object.freeze({
  COUPLE_GAP: 1.25,
  SIBLING_GAP: 1.55,
  MIN_PERSON_CLEARANCE: 1.08,
  BETWEEN_FAMILY_GAP: 2.05,
  GENERATION_GAP: 2.48,
});

export function layoutSample(people, radius) {
  const positions = new Map();
  const byRole = role => people.filter(person => person.role === role);

  const place = (person, x, y) => {
    if (!person) return;
    positions.set(person.id, tangentPoint(x, y, radius));
  };

  const root = byRole('root')[0];
  const spouse = byRole('spouse')[0];
  const sibling = byRole('sibling')[0];

  const rootRow = [];
  if (sibling) rootRow.push({ person: sibling, gapBefore: 0 });
  if (root) rootRow.push({ person: root, gapBefore: sibling ? LAYOUT_GAPS.SIBLING_GAP : 0 });
  if (spouse) rootRow.push({ person: spouse, gapBefore: root ? LAYOUT_GAPS.COUPLE_GAP : LAYOUT_GAPS.SIBLING_GAP });
  placeSequence(rootRow, 0, place);

  const parents = byRole('parent');
  const paternalParent = parents.find(person => person.branch === 'paternal');
  const maternalParent = parents.find(person => person.branch === 'maternal');
  const parentRow = [];
  if (paternalParent) parentRow.push({ person: paternalParent, gapBefore: 0 });
  if (maternalParent) parentRow.push({ person: maternalParent, gapBefore: paternalParent ? LAYOUT_GAPS.COUPLE_GAP : 0 });
  placeSequence(parentRow, LAYOUT_GAPS.GENERATION_GAP, place);

  const grandparentRow = buildGrandparentRow(people);
  placeSequence(grandparentRow, LAYOUT_GAPS.GENERATION_GAP * 2, place);

  return positions;
}

function buildGrandparentRow(people) {
  const grandparents = people.filter(person => person.role === 'grandparent');
  const siblings = people.filter(person => person.role === 'grandparent-sibling');
  const branches = ['paternal', 'maternal'];
  const row = [];

  branches.forEach((branch, branchIndex) => {
    const anchors = grandparents.filter(person => person.branch === branch);
    if (!anchors.length) return;

    if (branchIndex > 0 && row.length) {
      row.push({ divider: true, gapBefore: LAYOUT_GAPS.BETWEEN_FAMILY_GAP });
    }

    anchors.forEach((anchor, anchorIndex) => {
      const familySiblings = siblings.filter(person => person.cluster === anchor.cluster);
      const familyEntries = anchorIndex === 0
        ? [...familySiblings.map(person => ({ person, gapBefore: LAYOUT_GAPS.SIBLING_GAP })), { person: anchor, gapBefore: LAYOUT_GAPS.SIBLING_GAP }]
        : [{ person: anchor, gapBefore: LAYOUT_GAPS.COUPLE_GAP }, ...familySiblings.map(person => ({ person, gapBefore: LAYOUT_GAPS.SIBLING_GAP }))];

      if (anchorIndex === 0 && !row.length) familyEntries[0].gapBefore = 0;
      if (anchorIndex === 0 && row.length && row[row.length - 1]?.divider) familyEntries[0].gapBefore = row[row.length - 1].gapBefore;
      row.push(...familyEntries);
    });
  });

  return row.filter(entry => !entry.divider);
}

function placeSequence(entries, y, place) {
  if (!entries.length) return;
  const gaps = entries.map((entry, index) => {
    if (index === 0) return 0;
    return Math.max(entry.gapBefore || LAYOUT_GAPS.MIN_PERSON_CLEARANCE, LAYOUT_GAPS.MIN_PERSON_CLEARANCE);
  });
  const width = gaps.reduce((sum, gap) => sum + gap, 0);
  let x = -width / 2;

  entries.forEach((entry, index) => {
    if (index > 0) x += gaps[index];
    place(entry.person, x, y);
  });
}
