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

function emptyIndividual(id) {
  return {
    type: 'INDI',
    id,
    name: '',
    names: [],
    alternateNames: [],
    sex: 'U',
    fams: [],
    famc: [],
    birth: {},
    death: {},
    adoptions: [],
    citations: [],
    rawLines: [],
  };
}

function emptyFamily(id) {
  return {
    type: 'FAM',
    id,
    husb: null,
    wife: null,
    children: [],
    marriage: {},
    citations: [],
    rawLines: [],
  };
}

function emptySource(id) {
  return {
    type: 'SOUR',
    id,
    title: '',
    abbreviation: '',
    author: '',
    publisher: '',
    repositoryId: null,
    rawLines: [],
  };
}

export function parseGedcomFamilies(text) {
  const individuals = new Map();
  const families = new Map();
  const sources = new Map();
  const warnings = [];
  let record = null;
  let context = null;
  let currentFamc = null;
  let adoption = null;
  let citation = null;
  let citationLevel = null;

  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, index) => {
    if (!raw.trim()) return;
    const line = parseLine(raw, index + 1);
    if (line.invalid) {
      warnings.push({ type: 'invalid-line', line: line.lineNumber, raw });
      return;
    }

    if (citation && line.level <= citationLevel) {
      citation = null;
      citationLevel = null;
    }

    if (line.level === 0) {
      context = null;
      currentFamc = null;
      adoption = null;
      citation = null;
      citationLevel = null;
      if (line.tag === 'INDI' && line.xref) {
        record = emptyIndividual(line.xref);
        record.rawLines.push(raw);
        if (individuals.has(record.id)) warnings.push({ type: 'duplicate-individual', id: record.id, line: line.lineNumber });
        individuals.set(record.id, record);
      } else if (line.tag === 'FAM' && line.xref) {
        record = emptyFamily(line.xref);
        record.rawLines.push(raw);
        if (families.has(record.id)) warnings.push({ type: 'duplicate-family', id: record.id, line: line.lineNumber });
        families.set(record.id, record);
      } else if (line.tag === 'SOUR' && line.xref) {
        record = emptySource(line.xref);
        record.rawLines.push(raw);
        if (sources.has(record.id)) warnings.push({ type: 'duplicate-source', id: record.id, line: line.lineNumber });
        sources.set(record.id, record);
      } else {
        record = null;
      }
      return;
    }

    if (!record) return;
    record.rawLines.push(raw);

    if ((record.type === 'INDI' || record.type === 'FAM') && line.tag === 'SOUR') {
      const sourceId = cleanRef(line.value);
      if (sourceId) {
        citation = {
          sourceId,
          context: String(context || 'record').toLowerCase(),
          page: '',
          text: '',
          apids: [],
        };
        record.citations.push(citation);
        citationLevel = line.level;
      }
      return;
    }

    if (citation && line.level > citationLevel) {
      if (line.tag === 'PAGE') citation.page = line.value;
      else if (line.tag === 'TEXT') citation.text = line.value;
      else if (line.tag === '_APID') citation.apids.push(line.value);
    }

    if (record.type === 'INDI') {
      if (line.level === 1) {
        context = line.tag;
        currentFamc = null;
        adoption = null;
        if (line.tag === 'NAME') {
          const name = displayName(line.value);
          if (name) {
            record.names.push(name);
            if (!record.name) record.name = name;
            else if (!record.alternateNames.includes(name)) record.alternateNames.push(name);
          }
        } else if (line.tag === 'SEX') record.sex = line.value || 'U';
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
      return;
    }

    if (record.type === 'SOUR' && line.level === 1) {
      if (line.tag === 'TITL') record.title = line.value;
      else if (line.tag === 'ABBR') record.abbreviation = line.value;
      else if (line.tag === 'AUTH') record.author = line.value;
      else if (line.tag === 'PUBL') record.publisher = line.value;
      else if (line.tag === 'REPO') record.repositoryId = cleanRef(line.value);
    }
  });

  // FAMC may legitimately occur more than once for biological, adoptive,
  // foster, guardian, or other household relationships. Keep every source
  // link, but put the best-supported ancestry family first so legacy consumers
  // that expect one family of origin do not accidentally promote a collateral
  // household into the direct ancestry spine.
  for (const individual of individuals.values()) {
    individual.famc = orderedFamiliesOfOrigin(individual);
  }

  const relationships = buildRelationships(individuals, families, warnings);
  return { individuals, families, sources, relationships, warnings };
}

function pedigreeRank(value) {
  const pedigree = String(value || '').trim().toLowerCase();
  if (['birth', 'biological', 'natural'].includes(pedigree)) return 0;
  if (!pedigree) return 1;
  if (pedigree === 'adopted') return 2;
  if (pedigree === 'foster') return 3;
  if (pedigree === 'sealing') return 4;
  if (['guardian', 'step', 'other'].includes(pedigree)) return 5;
  return 4;
}

export function orderedFamiliesOfOrigin(individual) {
  return (individual?.famc || [])
    .map((entry, sourceOrder) => ({ ...entry, sourceOrder }))
    .sort((a, b) => pedigreeRank(a.pedigree) - pedigreeRank(b.pedigree) || a.sourceOrder - b.sourceOrder)
    .map(({ sourceOrder, ...entry }) => entry);
}

export function primaryFamilyOfOrigin(individual) {
  return orderedFamiliesOfOrigin(individual)[0]?.familyId || null;
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
      const primaryFamilyId = primaryFamilyOfOrigin(child);
      const relationshipType = !primaryFamilyId || primaryFamilyId === family.id
        ? 'parent'
        : 'alternate-parent';
      for (const parentId of parents) {
        relationships.push({ type: relationshipType, from: parentId, to: childId, familyId: family.id, pedigree });
      }
    }
  }
  return relationships;
}

export function ancestryRecordUrlFromApid(apid) {
  const match = String(apid || '').trim().match(/^(?:[^,]+,)?(\d+)::(\d+)$/);
  if (!match) return '';
  const [, databaseId, recordId] = match;
  return `https://www.ancestry.com/discoveryui-content/view/${encodeURIComponent(recordId)}:${encodeURIComponent(databaseId)}`;
}

export function savedRecordsForIndividual(individual, sources) {
  if (!individual) return [];
  const grouped = new Map();
  for (const citation of individual.citations || []) {
    const source = sources.get(citation.sourceId);
    const existing = grouped.get(citation.sourceId) || {
      title: source?.title || source?.abbreviation || citation.sourceId,
      kind: 'source',
      contexts: new Set(),
      pages: new Set(),
      apids: new Set(),
      author: source?.author || '',
      publisher: source?.publisher || '',
    };
    if (citation.context) existing.contexts.add(citation.context);
    if (citation.page) existing.pages.add(citation.page);
    for (const apid of citation.apids || []) if (apid) existing.apids.add(apid);
    grouped.set(citation.sourceId, existing);
  }

  return [...grouped.values()].map(record => {
    const details = [];
    if (record.contexts.size) details.push(`Contexts: ${[...record.contexts].join(', ')}`);
    if (record.pages.size) details.push(`Page: ${[...record.pages].slice(0, 3).join('; ')}${record.pages.size > 3 ? ' …' : ''}`);
    if (record.apids.size) details.push(`${record.apids.size} Ancestry record reference${record.apids.size === 1 ? '' : 's'}`);
    if (record.author) details.push(`Author: ${record.author}`);
    if (record.publisher) details.push(`Publisher: ${record.publisher}`);
    const url = [...record.apids]
      .map(ancestryRecordUrlFromApid)
      .find(Boolean) || '';
    return {
      title: record.title,
      kind: record.kind,
      detail: details.join(' · '),
      url,
    };
  });
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
