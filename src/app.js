import { APP_VERSION } from './version.js';
import { startVersionChecker } from './version-checker.js';
import { loadFamily } from './data.js';
import { GlobeScene } from './scene.js';

const config = window.LAZY_ACRES_ANCESTRY_CONFIG || {};
const canvas = document.getElementById('globeCanvas');
const search = document.getElementById('searchInput');
const source = document.getElementById('sourcePill');
const details = document.getElementById('personPanel');
const scaleReadout = document.getElementById('scaleReadout');
const homePersonBtn = document.getElementById('homePersonBtn');
const rail = document.querySelector('.rail');
const scene = new GlobeScene(canvas, selectPerson);

let family = { people: [], relationships: [] };
let byId = new Map();
let homePerson = null;
let selectedPerson = null;
let distances = new Map();

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
  source.textContent = `${family.source} · v${APP_VERSION}`;
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
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close person details">×</button>
    <div class="panel-kicker">FOCUSED PERSON</div>
    <h2>${escapeHtml(person.name)}</h2>
    <div class="panel-actions">
      <button type="button" id="galleryBtn">Photos${photoCount ? ` (${photoCount})` : ''}</button>
      <button type="button" id="notesBtn">Notes</button>
    </div>
    <dl>
      <div><dt>Born</dt><dd>${escapeHtml(person.birth?.date || 'Unknown')}<br>${escapeHtml(person.birth?.place || '')}</dd></div>
      <div><dt>Died</dt><dd>${person.death?.date ? `${escapeHtml(person.death.date)}<br>${escapeHtml(person.death?.place || '')}` : 'No death recorded'}</dd></div>
      <div><dt>Relationship distance</dt><dd>${formatDistance(distances.get(person.id))}</dd></div>
      <div><dt>GEDCOM</dt><dd>${escapeHtml(person.id)}</dd></div>
    </dl>
    ${person.note ? `<p class="data-note">${escapeHtml(person.note)}</p>` : ''}
    <p class="panel-note">Click another person to rotate that branch into the viewing apex. <strong>Return to Tod</strong> always restores the home view.</p>`;
  openPanel();
  document.getElementById('galleryBtn').addEventListener('click', () => showGallery(person));
  document.getElementById('notesBtn').addEventListener('click', () => showNotes(person));
}

function showGallery(person) {
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close photo gallery">×</button>
    <div class="panel-kicker">PHOTO GALLERY</div>
    <h2>${escapeHtml(person.name)}</h2>
    ${person.photo ? `<figure class="gallery-card"><img src="${person.photo}" alt="${escapeHtml(person.name)}"><figcaption>Current profile photograph</figcaption></figure>` : '<p class="empty-copy">No photographs are attached to this person yet.</p>'}
    <button class="text-action" type="button" id="backToPerson">← Back to person details</button>`;
  openPanel();
  document.getElementById('backToPerson').addEventListener('click', () => showPerson(person));
}

function showNotes(person) {
  const key = noteKey(person.id);
  const note = localStorage.getItem(key) || '';
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close notes">×</button>
    <div class="panel-kicker">FAMILY NOTES</div>
    <h2>${escapeHtml(person.name)}</h2>
    <label class="notes-field">Notes<textarea id="personNotes" rows="10" placeholder="Add research notes, family stories, corrections, or questions…">${escapeHtml(note)}</textarea></label>
    <div class="notes-actions"><button type="button" id="saveNotes">Save notes</button><button class="text-action" type="button" id="backToPerson">Back</button></div>
    <p class="microcopy">Prototype notes are saved in this browser only. The production version will use the project-specific Supabase ancestry tables.</p>`;
  openPanel();
  document.getElementById('saveNotes').addEventListener('click', () => {
    localStorage.setItem(key, document.getElementById('personNotes').value);
    document.getElementById('saveNotes').textContent = 'Saved';
  });
  document.getElementById('backToPerson').addEventListener('click', () => showPerson(person));
}

function showPeopleIndex() {
  const centuries = [...new Set(family.people.map(person => centuryFrom(person.birth?.date)).filter(Boolean))].sort((a, b) => a - b);
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close people list">×</button>
    <div class="panel-kicker">PEOPLE</div>
    <h2>Family index</h2>
    <div class="people-filters">
      <label>Family side<select id="filterSide"><option value="all">All sides</option><option value="paternal">Paternal</option><option value="maternal">Maternal</option><option value="center">Immediate / spouse</option></select></label>
      <label>Century<select id="filterCentury"><option value="all">All centuries</option>${centuries.map(c => `<option value="${c}">${c}th century</option>`).join('')}</select></label>
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
  list.innerHTML = matches.map(person => `<button type="button" data-id="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(yearFrom(person.birth?.date) || 'date unknown')} · ${formatDistance(distances.get(person.id), true)}</span></button>`).join('') || '<p class="empty-copy">No people match these filters.</p>';
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
    graph.get(link.from)?.add(link.to);
    graph.get(link.to)?.add(link.from);
  });
  const clusters = new Map();
  family.people.filter(p => p.cluster).forEach(person => {
    if (!clusters.has(person.cluster)) clusters.set(person.cluster, []);
    clusters.get(person.cluster).push(person.id);
  });
  clusters.forEach(ids => {
    const anchor = ids.find(id => byId.get(id)?.role === 'grandparent') || ids[0];
    ids.forEach(id => { if (id !== anchor) { graph.get(anchor)?.add(id); graph.get(id)?.add(anchor); } });
  });
  const result = new Map();
  if (!rootId) return result;
  const queue = [rootId]; result.set(rootId, 0);
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    for (const next of graph.get(id) || []) if (!result.has(next)) { result.set(next, result.get(id) + 1); queue.push(next); }
  }
  return result;
}

function yearFrom(value = '') { return value.match(/(?:^|\D)(\d{4})(?:\D|$)/)?.[1] || ''; }
function centuryFrom(value = '') { const y = Number(yearFrom(value)); return y ? Math.floor((y - 1) / 100) + 1 : null; }
function formatDistance(value, short = false) {
  if (!Number.isFinite(value)) return 'Not calculated';
  if (value === 0) return short ? 'home' : 'Home person';
  return `${value} ${value === 1 ? 'step' : 'steps'} from Tod`;
}
function noteKey(id) { return `lazy_acres_ancestry_note_${id}`; }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
