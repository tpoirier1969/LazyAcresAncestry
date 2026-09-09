import { APP_VERSION } from './version.js';
import { loadFamily } from './data.js';
import { GlobeScene } from './scene.js';

const config = window.LAZY_ACRES_ANCESTRY_CONFIG || {};
const canvas = document.getElementById('globeCanvas');
const search = document.getElementById('searchInput');
const source = document.getElementById('sourcePill');
const details = document.getElementById('personPanel');
const scaleReadout = document.getElementById('scaleReadout');
const scene = new GlobeScene(canvas, selectPerson);
let family = { people: [], relationships: [] };
let byId = new Map();

boot().catch(error => {
  console.error(error);
  source.textContent = 'Prototype failed to load';
});

async function boot() {
  family = await loadFamily(config);
  byId = new Map(family.people.map(person => [person.id, person]));
  scene.setPeople(family.people);
  source.textContent = `${family.source} · v${APP_VERSION}`;
  scaleReadout.textContent = `${scene.diameter.toFixed(0)} plaque-width sphere · 9,099-person capacity model`;
  wireSearch();
  const focus = family.people.find(person => person.role === 'root') || family.people[0];
  if (focus) scene.focus(focus.id);
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

function selectPerson(id) {
  const person = byId.get(id);
  if (!person) return;
  scene.focus(id);
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
    <p class="panel-note">Clicking a person rotates that point of the family surface into the viewing apex. Full genealogy navigation will use the same behavior.</p>`;
  details.classList.add('open');
  document.getElementById('personCloseInner').addEventListener('click', () => details.classList.remove('open'));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
