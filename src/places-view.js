import { buildPlaceIndex, filterPlaces, placeStats } from './places.js';

const MAX_LIST = 35;
const MAX_MAP_LOCATIONS = 160;
const LEAFLET_VERSION = '1.9.4';
let leafletPromise;

function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/' + LEAFLET_VERSION + '/leaflet.css';
    document.head.append(css);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/' + LEAFLET_VERSION + '/leaflet.js';
    script.async = true;
    script.onload = () => window.L?.map ? resolve(window.L) : reject(new Error('Map library unavailable'));
    script.onerror = () => reject(new Error('Map library did not load'));
    document.head.append(script);
  }).catch(error => { leafletPromise = null; throw error; });
  return leafletPromise;
}

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function mapLink(coordinates) {
  const lat = coordinates.latitude;
  const lon = coordinates.longitude;
  return 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(lat)
    + '&mlon=' + encodeURIComponent(lon)
    + '#map=8/' + encodeURIComponent(lat) + '/' + encodeURIComponent(lon);
}

function displayEvent(event, peopleById) {
  const people = event.personIds.map(id => peopleById.get(id)).filter(Boolean);
  return '<div class="places-event">' +
    '<div class="places-event-meta"><strong>' + escape(event.type) + '</strong>' +
      (event.date ? '<span>' + escape(event.date) + '</span>' : '') + '</div>' +
    '<div class="places-event-people">' + people.map(person =>
      '<button type="button" data-person-id="' + escape(person.id) + '">' +
        escape(person.name) + '</button>').join(' &amp; ') + '</div>' +
  '</div>';
}

export class PlacesView {
  constructor({ workspace, details, family, peopleById, selectPerson, onClose }) {
    this.workspace = workspace;
    this.details = details;
    this.family = family;
    this.peopleById = peopleById;
    this.selectPerson = selectPerson;
    this.onClose = onClose;
    this.places = null;
    this.map = null;
    this.markerLayer = null;
    this.active = false;
    this.personId = null;
    this.selected = null;
    this.query = '';
    this.resultsLimit = MAX_LIST;
    this.eventLimit = 35;
    this.openToken = 0;
    // One delegated listener survives panel redraws without accumulating handlers.
    this.details.addEventListener('click', event => {
      if (!this.active) return;
      const button = event.target.closest('button[data-person-id]');
      if (button && this.details.contains(button)) this.selectPerson(button.dataset.personId);
    });
  }

  async open({ personId = null } = {}) {
    this.active = true;
    const token = ++this.openToken;
    this.personId = personId;
    this.selected = null;
    this.query = '';
    this.resultsLimit = MAX_LIST;
    this.workspace.hidden = false;
    document.body.classList.add('places-mode');
    this.details.classList.add('open');
    this.details.classList.add('places-panel');
    this.details.innerHTML = '<div class="panel-kicker">FAMILY GEOGRAPHY</div><h2>Places</h2>' +
      '<p role="status">Preparing locations from the GEDCOM…</p>';
    if (!this.places) {
      let geocodes = [];
      try {
        const response = await fetch(new URL('data/place-geocodes.json', document.baseURI), { cache: 'no-cache' });
        if (response.ok) geocodes = (await response.json()).entries || [];
      } catch (error) {
        console.warn('Historical geocode reference unavailable', error);
      }
      this.places = buildPlaceIndex(this.family.people, this.family.families || [], geocodes);
    }
    if (!this.active || token !== this.openToken) return;
    this.showList();
    try {
      await this.ensureMap();
      if (this.active && token === this.openToken) {
        this.updateMarkers(true);
      }
    } catch (error) {
      if (this.active && token === this.openToken) {
        this.workspace.querySelector('.places-map-status').textContent =
          'Map tiles or map controls are unavailable. The searchable place records remain accessible.';
      }
      console.warn('Places map unavailable', error);
    }
  }

  hide() {
    this.active = false;
    this.openToken++;
    this.workspace.hidden = true;
    document.body.classList.remove('places-mode');
    this.details.classList.remove('places-panel');
  }

  close() {
    this.hide();
    this.onClose?.();
  }

  personName(id) {
    return this.peopleById.get(id)?.name || id;
  }

  renderFrame(contents) {
    this.details.innerHTML = '<button type="button" class="panel-close" id="personCloseInner" aria-label="Close places">×</button>' +
      '<div class="panel-kicker">FAMILY GEOGRAPHY</div>' + contents;
    this.details.classList.add('open');
    document.getElementById('personCloseInner')?.addEventListener('click', () => this.close());
  }


  filtered() {
    return filterPlaces(this.places || [], this.query, this.personId);
  }

  eventsFor(place) {
    return this.personId
      ? place.events.filter(event => event.personIds.includes(this.personId))
      : place.events;
  }

  peopleCountFor(place) {
    return this.personId ? Number(place.personIds.has(this.personId)) : place.personIds.size;
  }

  showList() {
    if (!this.active) return;
    this.selected = null;
    const matches = this.filtered();
    const base = this.personId ? filterPlaces(this.places, '', this.personId) : this.places;
    const stats = this.personId
      ? {
          places: base.length,
          events: base.reduce((sum, place) => sum + this.eventsFor(place).length, 0),
          mapped: base.filter(place => place.coordinates).length,
        }
      : placeStats(base);
    const name = this.personId ? this.personName(this.personId) : '';
    const shown = matches.slice(0, this.resultsLimit);
    this.renderFrame(
      '<h2>' + (this.personId ? 'Places: ' + escape(name) : 'Places') + '</h2>' +
      '<p class="places-summary">' + stats.places.toLocaleString() + ' recorded places · ' +
        stats.events.toLocaleString() + ' events · ' + stats.mapped.toLocaleString() + ' with map references</p>' +
      '<label class="places-search-label" for="placesSearch">Search locations' +
        '<input id="placesSearch" type="search" placeholder="City, region, country…" value="' + escape(this.query) + '"></label>' +
      (this.personId ? '<button class="places-small-action" id="placesAll">Show all family places</button>' : '') +
      '<div class="places-count" role="status">' + matches.length + ' matching locations</div>' +
      '<div class="places-results">' +
      (shown.length ? shown.map(place =>
        '<button type="button" class="places-place-button" data-place-key="' + escape(place.id) + '">' +
        '<strong>' + escape(place.name) + '</strong><span>' + this.peopleCountFor(place) +
        ' people · ' + this.eventsFor(place).length + ' events' +
        (place.coordinates ? ' · ' + (place.coordinates.quality === 'mapped' ? 'Mapped' : 'Approximate map') : ' · Unmapped') +
        '</span></button>').join('') : '<p class="empty-copy">No matching recorded places.</p>') +
      '</div>' +
      (shown.length < matches.length ? '<button type="button" class="places-small-action" id="placesMore">Show 35 more</button>' : '') +
      '<p class="places-provenance">Place names and family events come from the current GEDCOM. Coordinates are references from the earlier Genealogy Map, and may be approximate or inferred.</p>',
    );
    document.getElementById('placesSearch').addEventListener('input', event => {
      this.query = event.target.value;
      this.resultsLimit = MAX_LIST;
      this.showList();
      document.getElementById('placesSearch')?.focus();
      document.getElementById('placesSearch')?.setSelectionRange(this.query.length, this.query.length);
      this.updateMarkers(false);
    });
    this.details.querySelectorAll('button[data-place-key]').forEach(button =>
      button.addEventListener('click', () => this.showPlace(button.dataset.placeKey)));
    document.getElementById('placesMore')?.addEventListener('click', () => {
      this.resultsLimit += MAX_LIST;
      this.showList();
    });
    document.getElementById('placesAll')?.addEventListener('click', () => {
      this.personId = null;
      this.showList();
      this.updateMarkers(true);
    });
  }

  showPlace(key) {
    if (!this.active) return;
    const place = this.places.find(item => item.id === key);
    if (!place) return;
    this.selected = place;
    this.eventLimit = 35;
    this.renderSelectedPlace();
    this.updateMarkers(false);
    if (place.coordinates && this.map) {
      const { latitude, longitude, quality } = place.coordinates;
      this.map.flyTo([latitude, longitude], quality === 'mapped' ? 8 : 6, {
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        duration: .75,
      });
    }
  }

  renderSelectedPlace() {
    const place = this.selected;
    if (!place) return;
    const geocode = place.coordinates;
    const events = [...this.eventsFor(place)].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    const shown = events.slice(0, this.eventLimit);
    this.renderFrame(
      '<button type="button" class="places-small-action" id="placesBack">← All matching places</button>' +
      '<h2>' + escape(place.name) + '</h2>' +
      '<p class="places-summary">' + this.peopleCountFor(place) + ' people · ' + events.length + ' recorded events</p>' +
      (geocode ? '<div class="places-geo-quality"><strong>' +
        (geocode.quality === 'mapped' ? 'Mapped reference' : 'Approximate geographic reference') +
        '</strong><span>' + escape(geocode.label) + '</span>' +
        '<a href="' + escape(mapLink(geocode)) + '" rel="noopener noreferrer" target="_blank">Open in OpenStreetMap</a></div>' :
        '<p class="places-unmapped">No reliable map coordinates are linked to this spelling of the place. The family records are still shown below.</p>') +
      '<h3 class="places-events-heading">Recorded family events</h3>' +
      '<div class="places-events-list">' + shown.map(event => displayEvent(event, this.peopleById)).join('') + '</div>' +
      (shown.length < events.length ? '<button type="button" class="places-small-action" id="placesMoreEvents">Show more events</button>' : '') +
      '<p class="places-provenance">Birth, death and marriage details are taken from the current GEDCOM, not inferred from the map position.</p>',
    );
    document.getElementById('placesBack').addEventListener('click', () => {
      this.showList();
      this.updateMarkers(false);
    });
    document.getElementById('placesMoreEvents')?.addEventListener('click', () => {
      this.eventLimit += 35;
      this.renderSelectedPlace();
    });
  }

  async ensureMap() {
    if (this.map) {
      requestAnimationFrame(() => this.map.invalidateSize());
      return;
    }
    const L = await loadLeaflet();
    if (!this.active) return;
    this.map = L.map('placesMap', {
      zoomControl: true,
      minZoom: 2,
      maxZoom: 14,
      worldCopyJump: true,
      preferCanvas: true,
    }).setView([44, -36], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    requestAnimationFrame(() => this.map.invalidateSize());
  }

  updateMarkers(fit = false) {
    if (!this.map || !this.markerLayer || !this.active) return;
    const L = window.L;
    this.markerLayer.clearLayers();
    const locations = this.selected ? [this.selected] : this.filtered();
    const groups = new Map();
    for (const place of locations) {
      const coordinates = place.coordinates;
      if (!coordinates) continue;
      const key = coordinates.latitude.toFixed(4) + ',' + coordinates.longitude.toFixed(4);
      if (!groups.has(key)) groups.set(key, { coords: coordinates, places: [], people: 0 });
      const group = groups.get(key);
      group.places.push(place);
      group.people += this.peopleCountFor(place);
    }
    const markers = [...groups.values()].sort((a, b) => b.people - a.people).slice(0, MAX_MAP_LOCATIONS);
    const positions = [];
    for (const group of markers) {
      const { latitude, longitude } = group.coords;
      const selected = this.selected && group.places.includes(this.selected);
      const marker = L.circleMarker([latitude, longitude], {
        radius: selected ? 11 : Math.min(10, 4 + Math.log2(1 + group.people) * .75),
        color: selected ? '#fff1ad' : '#7b3e31',
        weight: selected ? 4 : 2,
        fillColor: selected ? '#d5a026' : '#a97735',
        fillOpacity: selected ? .95 : .72,
      });
      marker.bindTooltip(
        escape(group.places[0].name) +
        (group.places.length > 1 ? ' and ' + (group.places.length - 1) + ' related place entries' : '') +
        (group.coords.quality === 'approximate' ? ' (approximate)' : ''),
      );
      marker.on('click', () => this.showPlace(group.places[0].id));
      this.markerLayer.addLayer(marker);
      positions.push([latitude, longitude]);
    }
    const status = this.workspace.querySelector('.places-map-status');
    if (status) status.textContent = 'Showing ' + markers.length +
      ' mapped location groups. Search to narrow; select a location for its people.';
    if (fit && positions.length) {
      if (positions.length === 1) this.map.setView(positions[0], this.personId ? 8 : 6);
      else this.map.fitBounds(L.latLngBounds(positions).pad(.20), { maxZoom: 8 });
    }
  }
}
