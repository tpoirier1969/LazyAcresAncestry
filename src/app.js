import { APP_VERSION } from './version.js';
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

boot().catch(error => {
  console.error(error);
  source.textContent = 'Prototype failed to load';
});

async function boot() {
  family = await loadFamily(config);
  byId = new Map(family.people.map(person => [person.id, person]));
  scene.setFamily(family.people, family.relationships);
  source.textContent = `${family.source} · v${APP_VERSION}`;
  scaleReadout.textContent = `${scene.diameter.toFixed(0)} plaque-width sphere · 9,099-person capacity model`;
  homePerson = family.people.find(person => person.role === 'root') || family.people[0];
  wireSearch();
  wireNavigation();
  if (homePerson) selectPerson(homePerson.id, { resetZoom: true });
}

function wireSearch() {
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    const list = document.getElementById('searchResults');
    if (!query) { list.hidden = true; list.innerHTML = ''; return; }
    const matches = family.people.filter(person => person.name.toLowerCase().includes(query)).slice(0, 8);
    list.innerHTML = matches.map(person => `<button type="button" data-id="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.birth?.date || '')}</span></button>`).join('');
    list.hidden = !matches.length;
    list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      list.hidden = true;
      search.value = byId.get(button.dataset.id)?.name || '';
      selectPerson(button.dataset.id);
    }));
  });
}

function wireNavigation() {
  homePersonBtn.addEventListener('click', goHome);
  rail.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    rail.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    const action = button.dataset.action;
    if (action === 'home') return goHome();
    if (action === 'search') return search.focus();
    if (action === 'people') return showPeopleIndex();
    showSectionStatus(action);
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
  scene.focus(id, options);
  showPerson(person);
}

function showPerson(person) {
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close person details">×</button>
    <div class="panel-kicker">FOCUSED PERSON</div>
    <h2>${escapeHtml(person.name)}</h2>
    <dl>
      <div><dt>Born</dt><dd>${escapeHtml(person.birth?.date || 'Unknown')}<br>${escapeHtml(person.birth?.place || '')}</dd></div>
      <div><dt>Died</dt><dd>${person.death?.date ? `${escapeHtml(person.death.date)}<br>${escapeHtml(person.death?.place || '')}` : 'No death recorded'}</dd></div>
      <div><dt>GEDCOM</dt><dd>${escapeHtml(person.id)}</dd></div>
    </dl>
    ${person.note ? `<p class="data-note">${escapeHtml(person.note)}</p>` : ''}
    <p class="panel-note">Click another person to rotate that branch into the viewing apex. Use <strong>Return to Tod</strong> whenever you want the home position back.</p>`;
  openPanel();
}

function showPeopleIndex() {
  const visible = family.people.filter(person => ['root', 'spouse', 'sibling', 'parent', 'grandparent'].includes(person.role));
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close people list">×</button>
    <div class="panel-kicker">PEOPLE IN THIS PROTOTYPE</div>
    <h2>Family index</h2>
    <div class="people-index">${visible.map(person => `<button type="button" data-id="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.birth?.date || '')}</span></button>`).join('')}</div>`;
  openPanel();
  details.querySelectorAll('.people-index button').forEach(button => button.addEventListener('click', () => selectPerson(button.dataset.id)));
}

function showSectionStatus(section) {
  const labels = { places: 'Places', stories: 'Stories', media: 'Media' };
  details.innerHTML = `
    <button class="panel-close" id="personCloseInner" aria-label="Close panel">×</button>
    <div class="panel-kicker">${escapeHtml(labels[section] || section).toUpperCase()}</div>
    <h2>${escapeHtml(labels[section] || section)}</h2>
    <p class="panel-note">This section is wired into the navigation now, but its full view is intentionally deferred while we finish the globe interaction and family geometry.</p>`;
  openPanel();
}

function openPanel() {
  details.classList.add('open');
  document.getElementById('personCloseInner')?.addEventListener('click', () => details.classList.remove('open'));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
