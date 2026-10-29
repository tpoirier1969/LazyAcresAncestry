// The authoritative genealogy stays in the imported GEDCOM. Coordinates
// are optional, explicitly attributed suggestions from the earlier map.
export function normalizePlace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function yearFromGenealogyDate(date) {
  const match = String(date || '').match(/(?:^|\D)(\d{3,4})(?=\D|$)/);
  return match ? Number(match[1]) : null;
}

export function buildPlaceIndex(people = [], families = [], geocodeEntries = []) {
  const coordinates = new Map();
  for (const entry of geocodeEntries) {
    if (!Array.isArray(entry) || entry.length < 5) continue;
    const [original, label, latitude, longitude, quality] = entry;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    coordinates.set(normalizePlace(original), {
      label: String(label || original),
      latitude, longitude,
      quality: quality === 'mapped' ? 'mapped' : 'approximate',
      provenance: 'Earlier Genealogy Map; geographic reference only',
    });
  }

  const byId = new Map(people.map(person => [person.id, person]));
  const locations = new Map();
  const add = (place, event) => {
    const key = normalizePlace(place);
    if (!key || /^unknown(?:\s+place)?$/.test(key)) return;
    let record = locations.get(key);
    if (!record) {
      record = {
        id: key,
        name: String(place).trim().replace(/\s+/g, ' '),
        coordinates: coordinates.get(key) || null,
        events: [],
        personIds: new Set(),
      };
      locations.set(key, record);
    }
    record.events.push(event);
    for (const id of event.personIds) if (byId.has(id)) record.personIds.add(id);
  };

  for (const person of people) {
    for (const [type, detail] of [['Birth', person.birth], ['Death', person.death]]) {
      if (!detail?.place) continue;
      add(detail.place, {
        id: type + ':' + person.id,
        type,
        date: detail.date || '',
        year: yearFromGenealogyDate(detail.date),
        personIds: [person.id],
        source: 'GEDCOM ' + type.toLowerCase() + ' place',
      });
    }
  }
  for (const family of families) {
    if (!family.marriage?.place) continue;
    const personIds = [family.husb, family.wife].filter(id => byId.has(id));
    if (!personIds.length) continue;
    add(family.marriage.place, {
      id: 'Marriage:' + family.id,
      type: 'Marriage',
      date: family.marriage.date || '',
      year: yearFromGenealogyDate(family.marriage.date),
      personIds,
      source: 'GEDCOM family marriage place',
    });
  }
  return [...locations.values()].sort((a, b) =>
    b.personIds.size - a.personIds.size || a.name.localeCompare(b.name));
}

export function filterPlaces(places, query = '', personId = null) {
  const key = normalizePlace(query);
  return places.filter(place =>
    (!personId || place.personIds.has(personId)) &&
    (!key || normalizePlace(place.name).includes(key)
      || normalizePlace(place.coordinates?.label).includes(key)));
}

export function placeStats(places) {
  return {
    places: places.length,
    mapped: places.filter(place => place.coordinates).length,
    people: new Set(places.flatMap(place => [...place.personIds])).size,
    events: places.reduce((sum, place) => sum + place.events.length, 0),
  };
}
