import assert from 'node:assert/strict';
import { buildPlaceIndex, filterPlaces, normalizePlace, placeStats, yearFromGenealogyDate } from '../src/places.js';

const people = [
  { id: 'tod', name: 'Tod Poirier', birth: { date: '16 MAY 1969', place: 'Ishpeming, Marquette, Michigan, USA' }, death: {} },
  { id: 'roy', name: 'Roy Poirier', birth: { date: '1944', place: 'Ishpeming, Marquette, Michigan, USA' },
    death: { date: '2020', place: 'Marquette, Michigan, USA' } },
  { id: 'mary', name: 'Mary Hillman', birth: { place: 'Ishpeming, Marquette, Michigan, USA' }, death: {} },
  { id: 'henrik', name: 'Henrik TakaEilola', birth: { date: 'ABT 1790', place: 'Karstula, Finland' }, death: {} },
  { id: 'other', name: 'Other', birth: { place: 'Unknown' }, death: { place: '' } },
];
const families = [
  { id: 'F1', husb: 'roy', wife: 'mary', marriage: { place: 'Ishpeming, Marquette, Michigan, USA', date: '12 JUN 1966' } },
  { id: 'F2', husb: 'roy', wife: null, marriage: { place: 'Marquette, Michigan, USA', date: '' } },
];
const geocodes = [
  ['ishpeming, marquette, michigan, usa', 'Ishpeming, Michigan, USA', 46.48855, -87.66764, 'mapped'],
  ['karstula, finland', 'Karstula, Finland', 62.87, 24.80, 'approximate'],
  ['unknown other', 'Unknown', 'not a latitude', 0, 'mapped'],
];
const places = buildPlaceIndex(people, families, geocodes);
assert.equal(places.length, 3, 'unknown and blank locations must not create places');
assert.equal(places[0].name, 'Ishpeming, Marquette, Michigan, USA');
assert.equal(places[0].events.length, 4, 'three births and one marriage use same place');
assert.equal(places[0].personIds.size, 3, 'spouses deduped across their recorded events');
assert.equal(places[0].coordinates?.quality, 'mapped');
assert.equal(places[0].coordinates?.longitude, -87.66764);
assert.equal(places.find(p => p.name === 'Karstula, Finland')?.coordinates.quality, 'approximate');
assert.equal(places.find(p => p.name === 'Marquette, Michigan, USA')?.coordinates, null);
assert.equal(filterPlaces(places, ' ISHPEming ').length, 1);
assert.equal(filterPlaces(places, 'Ishpeming, Michigan').length, 1, 'standardized reference may also be searched');
assert.deepEqual(filterPlaces(places, '', 'henrik').map(p => p.name), ['Karstula, Finland']);
assert.equal(filterPlaces(places, '', 'unknown').length, 0);
const stats = placeStats(places);
assert.equal(stats.events, 7);
assert.equal(stats.places, 3);
assert.equal(stats.mapped, 2);
assert.equal(stats.people, 4);
assert.equal(normalizePlace('  Negaunee,   Michigan  '), 'negaunee, michigan');
assert.equal(yearFromGenealogyDate('ABT 1790'), 1790);
assert.equal(yearFromGenealogyDate('before 900'), 900);
assert.equal(yearFromGenealogyDate(''), null);
assert.equal(places.find(p => p.name === 'Ishpeming, Marquette, Michigan, USA').events.find(e => e.type === 'Marriage').id, 'Marriage:F1');

// A full-size family catalogue should be indexed once without generating
// one DOM row or geography marker for each person.
const largePeople = Array.from({ length: 9099 }, (_, index) => ({
  id: String(index), name: String(index), birth: { place: 'Ishpeming, Marquette, Michigan, USA' },
}));
const large = buildPlaceIndex(largePeople);
assert.equal(large.length, 1);
assert.equal(large[0].personIds.size, 9099);
assert.equal(large[0].events.length, 9099);

const { PlacesView } = await import('../src/places-view.js');
const ishpeming = places.find(p => p.name.startsWith('Ishpeming'));
const personScope = { personId: 'roy' };
assert.equal(PlacesView.prototype.eventsFor.call(personScope, ishpeming).length, 2,
  'person-specific place view must exclude other family members events');
assert.equal(PlacesView.prototype.peopleCountFor.call(personScope, ishpeming), 1);
assert.equal(PlacesView.prototype.eventsFor.call({ personId: null }, ishpeming).length, 4,
  'general Places retains the complete GEDCOM record');
assert.equal(PlacesView.prototype.peopleCountFor.call({ personId: null }, ishpeming), 3);

// The explicit Reset button must restore the original all-family map extent,
// including when a single person's events or a single place was selected.
const calls = [];
const resetHarness = {
  active: true,
  personId: 'roy',
  query: 'Ishpeming',
  selected: ishpeming,
  resultsLimit: 105,
  eventLimit: 70,
  map: { stop() { calls.push('stop'); } },
  showList() { calls.push('show-all-places'); },
  updateMarkers(fit) { calls.push(['fit-all-markers', fit]); },
};
PlacesView.prototype.reset.call(resetHarness);
assert.equal(resetHarness.personId, null);
assert.equal(resetHarness.query, '');
assert.equal(resetHarness.selected, null);
assert.equal(resetHarness.resultsLimit, 35);
assert.equal(resetHarness.eventLimit, 35);
assert.deepEqual(calls, ['stop', 'show-all-places', ['fit-all-markers', true]]);

console.log('Places index, original world-map reset, and full-size population checks passed');
