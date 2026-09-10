import { APP_VERSION } from './version.js';
import { startVersionChecker } from './version-checker.js';
import { loadFamily } from './data.js';
import { extractAlternateNames, extractSavedRecords } from './gedcom.js';
import { describeRelationship } from './relationships.js';
import { GlobeScene } from './scene.js';

const config = window.LAZY_ACRES_ANCESTRY_CONFIG || {};
const canvas = document.getElementById('globeCanvas');
const search = document.getElementById('searchInput');
const source = document.getElementById('sourcePill');
const details = document.getElementById('personPanel');
const scaleReadout = document.getElementById('scaleReadout');
const homePersonBtn = document.getElementById('homePersonBtn');
const appVersion = document.getElementById('appVersion');
const rail = document.querySelector('.rail');
const scene = new GlobeScene(canvas, selectPerson);
const NOTE_AUTHOR_KEY = 'lazy_acres_ancestry_note_author';

let family = { people: [], relationships: [] };
let byId = new Map();
let homePerson = null;
let selectedPerson = null;
let distances = new Map();

if (appVersion) appVersion.textContent = `v${APP_VERSION}`;

boot().catch(error => {
  console.error(error);
  source.textContent = 'Prototype failed to load';
});

async function boot() {
  family = await loadFamily(config);
  byId = new Map(family.people.map(person => [person.id, person]));
  homePerson = family.people.find(person => person.role === 'root') || family.people[0] || null;
  distances = computeDistances(homePerson?.id);
  scene.setFamily(family.people, family.relationships);
  source.textContent = family.source;
  scaleReadout.textContent = `${scene.diameter.toFixed(0)} plaque-width sphere · 9,099-person capacity model`;
  wireSearch();
  wireNavigation();
  startVersionChecker(APP_VERSION);
  if (homePerson) selectPerson(homePerson.id, { resetZoom: true });
}

function wireSearch() {
  search.addEventListener('input', () => renderSearchResults(search.value));
}

function renderSearchResults(value) {
  const query = value.trim().toLowerCase();
  const list = document.getElementById('searchResults');
  if (!query) { list.hidden = true; list.innerHTML = ''; return; }
  const matches = family.people.filter(person => person.name.toLowerCase().includes(query)).slice(0, 10);
  list.innerHTML = matches.map(person => `<button type="button" data-id="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(yearFrom(person.birth?.date) || '')}</span></button>`).join('');
  list.hidden = !matches.length;
  list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    list.hidden = true;
    search.value = byId.get(button.dataset.id)?.name || '';
    selectPerson(button.dataset.id);
  }));
}

function wireNavigation() {
  homePersonBtn.addEventListener('click', goHome);
  rail.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    rail.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    switch (button.dataset.action) {
      case 'home': goHome(); break;
      case 'search': search.focus(); search.select(); break;
      case 'people': showPeopleIndex(); break;
      case 'media': selectedPerson ? showGallery(selectedPerson) : showSectionStatus('media'); break;
      default: showSectionStatus(button.dataset.action);
    }
  });
}

function goHome() {
  if (!homePerson) return;
  search.value = '';
  document.getElementById('searchResults').hidden = true;
  selectPerson(homePerson.id, { resetZoom: true });
}

function selectPerson(id, options = {}) {
  const person = byId.get(id);
  if (!person) return;
  selectedPerson = person;
  scene.focus(id, options);
  showPerson(person);
}

function showPerson(person) {
  const photoCount = person.photo ? 1 : 0;
  const noteCount = readNotes(person.id).length;
  const relationship = describeRelationship(homePerson?.id, person.id, family.people, family.relationships);
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close person details">×</button>
    <div class="panel-kicker">FOCUSED PERSON</div>
    <div class="person-heading">
      ${renderProfileImage(person)}
      <div><h2>${escapeHtml(person.name)}</h2><div class="person-relationship">${escapeHtml(relationship)}</div></div>
    </div>
    <div class="panel-actions">
      <button type="button" id="galleryBtn">Photos${photoCount ? ` (${photoCount})` : ''}</button>
      <button type="button" id="notesBtn">Notes${noteCount ? ` (${noteCount})` : ''}</button>
    </div>
    <dl>
      <div><dt>Born</dt><dd>${escapeHtml(person.birth?.date || 'Unknown')}<br>${escapeHtml(person.birth?.place || '')}</dd></div>
      <div><dt>Died</dt><dd>${person.death?.date ? `${escapeHtml(person.death.date)}<br>${escapeHtml(person.death?.place || '')}` : 'No death recorded'}</dd></div>
      <div><dt>Relationship</dt><dd>${escapeHtml(relationship)}</dd></div>
      <div><dt>GEDCOM ID</dt><dd>${escapeHtml(person.id)}</dd></div>
    </dl>
    ${renderGedcomDetails(person)}
    ${person.note ? `<p class="data-note"><strong>Data-quality note:</strong> ${escapeHtml(person.note)}</p>` : ''}
    <p class="panel-note">Click another person to rotate that branch into the viewing apex. <strong>Return to ${escapeHtml(homePerson?.name || 'home')}</strong> restores the home view.</p>`;
  openPanel();
  document.getElementById('galleryBtn').addEventListener('click', () => showGallery(person));
  document.getElementById('notesBtn').addEventListener('click', () => showNotes(person));
  document.getElementById('profilePhotoBtn')?.addEventListener('click', () => showGallery(person));
}

function renderProfileImage(person) {
  if (person.photo) {
    return `<button class="person-profile person-profile-button" id="profilePhotoBtn" type="button" aria-label="Open ${escapeHtml(person.name)} photo gallery"><img src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name)}"></button>`;
  }
  const initial = (person.name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<div class="person-profile person-profile-placeholder" aria-hidden="true">${escapeHtml(initial)}</div>`;
}

function renderGedcomDetails(person) {
  const records = extractSavedRecords(person.rawGedcom);
  const alternateNames = extractAlternateNames(person.rawGedcom);
  const recordMarkup = records.length
    ? `<div class="saved-record-list">${records.map(record => `<article class="saved-record"><strong>${escapeHtml(record.title)}</strong>${record.detail ? `<span>${escapeHtml(record.detail)}</span>` : ''}${record.url ? `<a href="${escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer">Open record</a>` : ''}</article>`).join('')}</div>`
    : '<p class="record-empty">No saved source records were preserved in the current prototype import.</p>';
  const aliases = alternateNames.length
    ? `<div class="gedcom-aliases"><span>Also recorded as</span>${alternateNames.map(name => `<strong>${escapeHtml(name)}</strong>`).join('')}</div>`
    : '';
  return `<section class="gedcom-section" aria-label="GEDCOM saved records">
    <div class="section-heading"><h3>Saved records</h3><span>${records.length}</span></div>
    ${recordMarkup}
    ${aliases}
  </section>`;
}

function showGallery(person) {
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close photo gallery">×</button>
    <div class="panel-kicker">PHOTO GALLERY</div>
    <h2>${escapeHtml(person.name)}</h2>
    ${person.photo ? `<figure class="gallery-card"><img src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name)}"><figcaption>Current profile photograph</figcaption></figure>` : '<p class="empty-copy">No photographs are attached to this person yet.</p>'}
    <button class="text-action" type="button" id="backToPerson">← Back to person details</button>`;
  openPanel();
  document.getElementById('backToPerson').addEventListener('click', () => showPerson(person));
}

function showNotes(person) {
  const notes = readNotes(person.id).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const savedAuthor = localStorage.getItem(NOTE_AUTHOR_KEY) || '';
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close notes">×</button>
    <div class="panel-kicker">FAMILY NOTES</div>
    <h2>${escapeHtml(person.name)}</h2>
    <div class="note-history">
      ${notes.length ? notes.map(renderNoteCard).join('') : '<p class="empty-copy">No family notes have been saved for this person yet.</p>'}
    </div>
    <div class="note-entry">
      <div class="note-entry-title">Add a note</div>
      <label class="notes-author">Author<input id="noteAuthor" type="text" maxlength="80" autocomplete="name" placeholder="Your name" value="${escapeHtml(savedAuthor)}"></label>
      <label class="notes-field">Note<textarea id="personNotes" rows="6" placeholder="Add research notes, family stories, corrections, or questions…"></textarea></label>
      <div class="notes-actions"><button type="button" id="saveNotes">Save note</button><button class="text-action" type="button" id="backToPerson">Back</button></div>
      <p class="note-status" id="noteStatus" role="status" aria-live="polite"></p>
    </div>
    <p class="microcopy">Each note is saved as a separate dated entry in this browser. Cross-device note storage will move to the project-specific ancestry data store.</p>`;
  openPanel();
  document.getElementById('saveNotes').addEventListener('click', () => saveNote(person));
  document.getElementById('backToPerson').addEventListener('click', () => showPerson(person));
}

function saveNote(person) {
  const authorInput = document.getElementById('noteAuthor');
  const bodyInput = document.getElementById('personNotes');
  const status = document.getElementById('noteStatus');
  const author = authorInput.value.trim();
  const body = bodyInput.value.trim();

  if (!author) {
    status.textContent = 'Enter an author name before saving.';
    authorInput.focus();
    return;
  }
  if (!body) {
    status.textContent = 'Enter a note before saving.';
    bodyInput.focus();
    return;
  }

  const notes = readNotes(person.id);
  notes.push({
    id: typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author,
    body,
    createdAt: new Date().toISOString(),
  });
  writeNotes(person.id, notes);
  localStorage.setItem(NOTE_AUTHOR_KEY, author);
  showNotes(person);
}

function renderNoteCard(note) {
  const stamp = note.createdAt ? new Date(note.createdAt) : null;
  const validStamp = stamp && !Number.isNaN(stamp.valueOf());
  const date = validStamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(stamp) : 'Date unavailable';
  const time = validStamp ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(stamp) : 'Time unavailable';
  return `<article class="note-card">
    <div class="note-meta"><strong>${escapeHtml(note.author || 'Unknown author')}</strong><span>${escapeHtml(date)} · ${escapeHtml(time)}</span></div>
    <div class="note-body">${escapeHtml(note.body || '')}</div>
  </article>`;
}

function readNotes(personId) {
  const key = notesKey(personId);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.filter(note => note && typeof note === 'object');
    } catch {
      // If structured note data is damaged, preserve any legacy note below.
    }
  }

  const legacy = localStorage.getItem(legacyNoteKey(personId));
  if (!legacy) return [];
  const migrated = [{ id: `legacy-${personId}`, author: 'Previous browser note', body: legacy, createdAt: null }];
  writeNotes(personId, migrated);
  return migrated;
}

function writeNotes(personId, notes) {
  localStorage.setItem(notesKey(personId), JSON.stringify(notes));
}

function showPeopleIndex() {
  const centuries = [...new Set(family.people.map(person => centuryFrom(person.birth?.date)).filter(Boolean))].sort((a, b) => a - b);
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close people list">×</button>
    <div class="panel-kicker">PEOPLE</div>
    <h2>Family index</h2>
    <div class="people-filters">
      <label>Family side<select id="filterSide"><option value="all">All sides</option><option value="paternal">Paternal</option><option value="maternal">Maternal</option><option value="center">Immediate / spouse</option></select></label>
      <label>Century<select id="filterCentury"><option value="all">All centuries</option>${centuries.map(c => `<option value="${c}">${ordinal(c)} century</option>`).join('')}</select></label>
      <label>Relation distance<select id="filterDistance"><option value="all">Any distance</option><option value="0">Home person</option><option value="1">1 step</option><option value="2">2 steps</option><option value="3">3 steps</option><option value="4+">4+ steps</option></select></label>
      <label>Name<input id="filterName" type="search" placeholder="Filter names"></label>
    </div>
    <div class="people-count" id="peopleCount"></div>
    <div class="people-index" id="peopleIndex"></div>`;
  openPanel();
  ['filterSide', 'filterCentury', 'filterDistance', 'filterName'].forEach(id => document.getElementById(id).addEventListener('input', renderPeopleList));
  renderPeopleList();
}

function renderPeopleList() {
  const side = document.getElementById('filterSide').value;
  const century = document.getElementById('filterCentury').value;
  const distance = document.getElementById('filterDistance').value;
  const name = document.getElementById('filterName').value.trim().toLowerCase();
  const matches = family.people.filter(person => {
    if (side !== 'all' && (person.branch || 'center') !== side) return false;
    if (century !== 'all' && String(centuryFrom(person.birth?.date)) !== century) return false;
    const d = distances.get(person.id);
    if (distance !== 'all') {
      if (distance === '4+' && !(Number.isFinite(d) && d >= 4)) return false;
      if (distance !== '4+' && d !== Number(distance)) return false;
    }
    return !name || person.name.toLowerCase().includes(name);
  }).sort((a, b) => a.name.localeCompare(b.name));
  document.getElementById('peopleCount').textContent = `${matches.length} of ${family.people.length} people`;
  const list = document.getElementById('peopleIndex');
  list.innerHTML = matches.map(person => `<button type="button" data-id="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(yearFrom(person.birth?.date) || 'date unknown')} · ${escapeHtml(describeRelationship(homePerson?.id, person.id, family.people, family.relationships))}</span></button>`).join('') || '<p class="empty-copy">No people match these filters.</p>';
  list.querySelectorAll('button[data-id]').forEach(button => button.addEventListener('click', () => selectPerson(button.dataset.id)));
}

function showSectionStatus(section) {
  const labels = { places: 'Places', stories: 'Stories', media: 'Media' };
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close panel">×</button>
    <div class="panel-kicker">${escapeHtml(labels[section] || section).toUpperCase()}</div>
    <h2>${escapeHtml(labels[section] || section)}</h2>
    <p class="panel-note">The navigation is active. This section will populate from the full GEDCOM/media import after the globe and family navigation are stable.</p>`;
  openPanel();
}

function openPanel() {
  details.classList.add('open');
  document.getElementById('personCloseInner')?.addEventListener('click', () => details.classList.remove('open'));
}

function computeDistances(rootId) {
  const graph = new Map(family.people.map(person => [person.id, new Set()]));
  family.relationships.forEach(link => {
    if (!graph.has(link.from) || !graph.has(link.to)) return;
    graph.get(link.from).add(link.to);
    graph.get(link.to).add(link.from);
  });
  const result = new Map();
  if (!rootId) return result;
  const queue = [rootId];
  result.set(rootId, 0);
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    for (const next of graph.get(id) || []) {
      if (result.has(next)) continue;
      result.set(next, result.get(id) + 1);
      queue.push(next);
    }
  }
  return result;
}

function yearFrom(value = '') {
  const fourDigit = String(value).match(/(?:^|\D)(\d{4})(?:\D|$)/)?.[1];
  if (fourDigit) return fourDigit;
  const shortDate = String(value).match(/\b\d{1,2}[\/-]\d{1,2}[\/-](\d{2})\b/);
  if (!shortDate) return '';
  const year = Number(shortDate[1]);
  return String(year <= 30 ? 2000 + year : 1900 + year);
}
function centuryFrom(value = '') { const y = Number(yearFrom(value)); return y ? Math.floor((y - 1) / 100) + 1 : null; }
function ordinal(value) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
}
function notesKey(id) { return `lazy_acres_ancestry_notes_v2_${id}`; }
function legacyNoteKey(id) { return `lazy_acres_ancestry_note_${id}`; }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
