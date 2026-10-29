import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const begin = app.indexOf('function renderPeopleList() {');
const end = app.indexOf('\nfunction showSectionStatus(', begin);
assert.ok(begin > 0 && end > begin, 'People index renderer exists');
const renderSource = app.slice(begin, end);

const people = Array.from({ length: 9099 }, (_, i) => ({
  id: 'person-' + String(i).padStart(5, '0'),
  name: 'Person ' + String(i).padStart(5, '0'),
  branch: 'center',
  birth: { date: '1900' },
}));
const nodes = new Map();
for (const id of [
  'filterSide', 'filterCentury', 'filterDistance', 'filterName',
  'peopleCount', 'peopleIndex', 'peopleIndexPage',
  'peopleIndexPrev', 'peopleIndexNext',
]) nodes.set(id, { value: '', innerHTML: '', textContent: '', disabled: false });
for (const id of ['filterSide','filterCentury','filterDistance']) nodes.get(id).value = 'all';
let computedLabels = 0;
const ctx = vm.createContext({
  alphabeticalPeople: people,
  family: { people },
  peopleIndexPage: 0,
  PEOPLE_INDEX_BATCH: 50,
  peopleIndexRelationshipCache: new Map(),
  distances: new Map(),
  homePerson: { id: people[0].id },
  document: { getElementById(id) { return nodes.get(id); } },
  describeRelationship() { computedLabels++; return 'Relative'; },
  yearFrom() { return '1900'; },
  centuryFrom() { return 19; },
  escapeHtml(s) { return String(s); },
});
vm.runInContext(renderSource, ctx);
const render = () => vm.runInContext('renderPeopleList()', ctx);
const renderedCount = () => (nodes.get('peopleIndex').innerHTML.match(/data-id=/g) || []).length;

render();
assert.equal(renderedCount(), 50, 'only one bounded page is created from 9,099 people');
assert.equal(computedLabels, 50, 'kinship is calculated only for the visible page');
assert.equal(nodes.get('peopleIndexPrev').disabled, true);
assert.equal(nodes.get('peopleIndexNext').disabled, false);
assert.match(nodes.get('peopleCount').textContent, /1–50 of 9099 matches/);

vm.runInContext('peopleIndexPage = 1', ctx);
render();
assert.equal(renderedCount(), 50, 'page navigation never accumulates thousands of nodes');
assert.equal(computedLabels, 100);
assert.match(nodes.get('peopleIndex').innerHTML, /person-00050/);
assert.doesNotMatch(nodes.get('peopleIndex').innerHTML, /person-00000/);

render();
assert.equal(computedLabels, 100, 're-rendering a visited page reuses cached kinship');

nodes.get('filterName').value = 'Person 090';
vm.runInContext('peopleIndexPage = 0', ctx);
render();
assert.equal(renderedCount(), 50);
assert.match(nodes.get('peopleCount').textContent, /of 99 matches/);
assert.equal(nodes.get('peopleIndexNext').disabled, false);

vm.runInContext('peopleIndexPage = 1', ctx);
render();
assert.equal(renderedCount(), 49);
assert.equal(nodes.get('peopleIndexNext').disabled, true);

console.log('People menu remains bounded and searchable across 9,099 records');
