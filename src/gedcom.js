const RECORD_KEYS = ['saved_records', 'savedRecords', 'source_records', 'sourceRecords', 'records', 'sources', 'citations'];

export function extractSavedRecords(rawGedcom = {}) {
  if (!rawGedcom || typeof rawGedcom !== 'object' || Array.isArray(rawGedcom)) return [];
  const found = [];
  for (const key of RECORD_KEYS) collectRecords(rawGedcom[key], found, key);
  return dedupe(found.map((record, index) => normalizeRecord(record, index)).filter(Boolean));
}

export function extractAlternateNames(rawGedcom = {}) {
  const value = rawGedcom?.alternate_names ?? rawGedcom?.alternateNames ?? [];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
}

function collectRecords(value, out, sourceKey) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach(item => collectRecords(item, out, sourceKey));
    return;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) out.push({ title: trimmed, kind: sourceKey });
    return;
  }
  if (typeof value !== 'object') return;

  const looksLikeRecord = ['title', 'titl', 'name', 'page', 'text', 'data', 'url', 'href', 'source', 'repository', 'repo', 'date', 'type'].some(key => value[key] != null);
  if (looksLikeRecord) {
    out.push({ ...value, kind: value.kind || sourceKey });
    return;
  }

  Object.values(value).forEach(item => collectRecords(item, out, sourceKey));
}

function normalizeRecord(record, index) {
  if (!record || typeof record !== 'object') return null;
  const title = firstText(record.title, record.titl, record.name, record.source, record.page, record.type) || `Saved record ${index + 1}`;
  const detailParts = [];
  addDetail(detailParts, 'Page', record.page);
  addDetail(detailParts, 'Date', record.date);
  addDetail(detailParts, 'Repository', record.repository ?? record.repo);
  addDetail(detailParts, 'Text', record.text ?? record.data);
  const url = safeHttpUrl(record.url ?? record.href);
  return {
    title,
    kind: firstText(record.kind, record.type) || 'record',
    detail: detailParts.join(' · '),
    url,
  };
}

function addDetail(parts, label, value) {
  const text = scalarText(value);
  if (text) parts.push(`${label}: ${text}`);
}

function scalarText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (Array.isArray(value)) return value.map(scalarText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, item]) => item == null || ['string', 'number', 'boolean'].includes(typeof item))
      .map(([key, item]) => `${key}: ${String(item ?? '').trim()}`)
      .filter(item => !item.endsWith(': '))
      .join('; ');
  }
  return '';
}

function firstText(...values) {
  for (const value of values) {
    const text = scalarText(value);
    if (text) return text;
  }
  return '';
}

function safeHttpUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function dedupe(records) {
  const seen = new Set();
  return records.filter(record => {
    const key = `${record.title}|${record.detail}|${record.url}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
