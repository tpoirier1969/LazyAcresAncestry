function cleanRef(value = '') {
  const match = String(value).trim().match(/^@([^@]+)@$/);
  return match ? match[1] : null;
}

function displayName(raw = '') {
  const text = String(raw).trim();
  if (!text) return '';
  return text.replace(/\s*\/([^/]*)\/\s*/, ' $1 ').replace(/\s+/g, ' ').trim();
}

function parseLine(raw, lineNumber) {
  const line = raw.replace(/^\uFEFF/, '');
  const match = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/);
  if (!match) return { invalid: true, raw, lineNumber };
  return {
    level: Number(match[1]),
    xref: cleanRef(match[2]),
    tag: match[3].toUpperCase(),
    value: (match[4] || '').trim(),
    raw,
    lineNumber,
  };
}

export function parseGedcomFamilies(text) {
  const individuals = new Map();
  const families = new Map();
  const warnings = [];
  let record = null;
  let context = null;
  let currentFamc = null;
  let adoption = null;

  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, index) => {
    if (!raw.trim()) return;
    const line = parseLine(raw, index + 1);
    if (line.invalid) {
      warnings.push({ type: 'invalid-line', line: line.lineNumber, raw });
      return;
    }

    if (line.level === 0) {
      context = null;
      currentFamc = null;
      adoption = null;
      if (line.tag === 'INDI' && line.xref) {
        record = {
          type: 'INDI', id: line.xref, name: '', sex: 'U', fams: [], famc: [],
          birth: {}, death: {}, adoptions: [], rawLines: [raw],
        };
        if (individuals.has(record.id)) warnings.push({ type: 'duplicate-individual', id: record.id, line: line.lineNumber });
        individuals.set(record.id, record);
      } else if (line.tag === 'FAM' && line.xref) {
        record = {
          type: 'FAM', id: line.xref, husb: null, wife: null, children: [], marriage: {}, rawLines: [raw],
        };
        if (families.has(record.id)) warnings.push({ type: 'duplicate-family', id: record.id, line: line.lineNumber });
        families.set(record.id, record);
      } else {
        record = null;
      }
      return;
    }

    if (!record) return;
    record.rawLines.push(raw);

    if (record.type === 'INDI') {
      if (line.level === 1) {
        context = line.tag;
        currentFamc = null;
        adoption = null;
        if (line.tag === 'NAME') record.name = displayName(line.value);
        else if (line.tag === 'SEX') record.sex = line.value || 'U';
        else if (line.tag === 'FAMS') {
          const id = cleanRef(line.value);
          if (id) record.fams.push(id);
        } else if (line.tag === 'FAMC') {
          const id = cleanRef(line.value);
          if (id) {
            currentFamc = { familyId: id, pedigree: null };
            record.famc.push(currentFamc);
          }
        } else if (line.tag === 'ADOP') {
          adoption = { familyId: null, by: null };
          record.adoptions.push(adoption);
        }
      } else if (line.level >= 2) {
        if (context === 'BIRT') {
          if (line.tag === 'DATE') record.birth.date = line.value;
          if (line.tag === 'PLAC') record.birth.place = line.value;
        } else if (context === 'DEAT') {
          if (line.tag === 'DATE') record.death.date = line.value;
          if (line.tag === 'PLAC') record.death.place = line.value;
        } else if (context === 'FAMC' && currentFamc && line.tag === 'PEDI') {
          currentFamc.pedigree = line.value.toLowerCase();
        } else if (context === 'ADOP' && adoption) {
          if (line.tag === 'FAMC') adoption.familyId = cleanRef(line.value);
          if (line.tag === 'ADOP') adoption.by = line.value.toLowerCase();
        }
      }
      return;
    }

    if (record.type === 'FAM') {
      if (line.level === 1) {
        context = line.tag;
        if (line.tag === 'HUSB') record.husb = cleanRef(line.value);
        else if (line.tag === 'WIFE') record.wife = cleanRef(line.value);
        else if (line.tag === 'CHIL') {
          const id = cleanRef(line.value);
          if (id) record.children.push(id);
        }
      } else if (line.level >= 2 && context === 'MARR') {
        if (line.tag === 'DATE') record.marriage.date = line.value;
        if (line.tag === 'PLAC') record.marriage.place = line.value;
      }
    }
  });

  const relationships = buildRelationships(individuals, families, warnings);
  return { individuals, families, relationships, warnings };
}

function childPedigree(individual, familyId) {
  const famc = individual?.famc?.find(entry => entry.familyId === familyId);
  if (famc?.pedigree) return famc.pedigree;
  if (individual?.adoptions?.some(entry => entry.familyId === familyId)) return 'adopted';
  return 'birth';
}

function buildRelationships(individuals, families, warnings) {
  const relationships = [];
  for (const family of families.values()) {
    const parents = [family.husb, family.wife].filter(Boolean);
    for (const id of parents) {
      if (!individuals.has(id)) warnings.push({ type: 'missing-person-reference', familyId: family.id, personId: id });
    }
    if (family.husb && family.wife) {
      relationships.push({ type: 'spouse', from: family.husb, to: family.wife, familyId: family.id });
    }
    for (const childId of family.children) {
      const child = individuals.get(childId);
      if (!child) {
        warnings.push({ type: 'missing-child-reference', familyId: family.id, personId: childId });
        continue;
      }
      const pedigree = childPedigree(child, family.id);
      for (const parentId of parents) {
        relationships.push({ type: 'parent', from: parentId, to: childId, familyId: family.id, pedigree });
      }
    }
  }
  return relationships;
}

export function validateGedcomFamilyGraph(parsed) {
  const errors = [];
  const { individuals, families, relationships } = parsed;
  for (const relation of relationships) {
    if (!individuals.has(relation.from) || !individuals.has(relation.to)) {
      errors.push({ type: 'orphan-relationship', relation });
    }
    if (!families.has(relation.familyId)) {
      errors.push({ type: 'relationship-without-family', relation });
    }
  }
  return errors;
}
