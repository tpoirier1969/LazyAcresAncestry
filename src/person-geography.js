import { isVisible, projectSpherePoint, rotatePoint, slerpUnit } from './geometry.js';
import { atlasPointToLocal } from './globe-webgl.js';

const CITY_RADIUS_DEGREES = 0.24;
const TRAVEL_COLOR = 'rgba(128,61,52,.30)';

// Deliberately conservative. A place that is not resolved with city-level
// confidence is omitted rather than painted as a broad state/country region.
const GAZETTEER = Object.freeze([
  ['ishpeming', 46.4885, -87.6676],
  ['gwinn', 46.2811, -87.4404],
  ['negaunee', 46.4991, -87.5963],
  ['marquette', 46.5436, -87.3954],
  ['palmer', 46.4422, -87.5932],
  ['republic', 46.4066, -87.9768],
  ['champion', 46.5100, -87.9635],
  ['michigamme', 46.5333, -88.1102],
  ['munising', 46.4111, -86.6479],
  ['manistique', 45.9578, -86.2463],
  ['escanaba', 45.7452, -87.0646],
  ['iron mountain', 45.8202, -88.0659],
  ['andreis', 46.2015, 12.6147],
  ['pordenone', 45.9564, 12.6615],
]);

export function resolveGenealogyPlace(place) {
  const normalized = normalizePlace(place);
  if (!normalized) return null;
  for (const [token, latitude, longitude] of GAZETTEER) {
    if (!containsPlaceToken(normalized, token)) continue;
    return { latitude, longitude, label: String(place || '').trim(), token };
  }
  return null;
}

export function personGeographyLocations(person) {
  if (!person) return [];
  const sequence = [];
  pushResolved(sequence, 'birth', person.birth?.place, person.birth?.date);
  for (const event of person.events || []) {
    if (!['RESI', 'CENS', 'IMMI', 'EMIG'].includes(String(event.type || '').toUpperCase())) continue;
    pushResolved(sequence, String(event.type || '').toLowerCase(), event.place, event.date);
  }
  pushResolved(sequence, 'death', person.death?.place, person.death?.date);

  // Consecutive records for the same city are one lived region. A later return
  // to that city is retained so the travel swatch can show the movement.
  return sequence.filter((location, index) => {
    if (!index) return true;
    const previous = sequence[index - 1];
    return location.token !== previous.token;
  });
}

export function drawPersonGeography(ctx, person, camera, yaw, pitch, radius) {
  const locations = personGeographyLocations(person);
  if (!ctx || !locations.length) return;

  for (let index = 1; index < locations.length; index += 1) {
    drawTravelSwatch(ctx, locations[index - 1], locations[index], camera, yaw, pitch, radius);
  }

  const unique = new Map();
  locations.forEach(location => unique.set(location.token, location));
  unique.forEach(location => drawCityRegion(ctx, location, camera, yaw, pitch, radius));
}

function pushResolved(sequence, kind, place, date) {
  const resolved = resolveGenealogyPlace(place);
  if (!resolved) return;
  sequence.push({ ...resolved, kind, date: date || '' });
}

function drawCityRegion(ctx, location, camera, yaw, pitch, radius) {
  const centerLocal = atlasPointToLocal(location.longitude, location.latitude);
  const centerUnit = rotatePoint(centerLocal, yaw, pitch);
  const center = projectSpherePoint(centerUnit, camera, radius + 0.045);
  if (!center || !isVisible(centerUnit, center)) return;

  const edgeLatitude = clamp(location.latitude + CITY_RADIUS_DEGREES, -89, 89);
  const edgeLocal = atlasPointToLocal(location.longitude, edgeLatitude);
  const edgeUnit = rotatePoint(edgeLocal, yaw, pitch);
  const edge = projectSpherePoint(edgeUnit, camera, radius + 0.045);
  const projectedRadius = edge ? Math.hypot(edge.x - center.x, edge.y - center.y) : 0;
  const swatchRadius = clamp(projectedRadius, 4.5, 34);

  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, swatchRadius);
  gradient.addColorStop(0, 'rgba(139,68,56,.28)');
  gradient.addColorStop(0.48, 'rgba(139,68,56,.15)');
  gradient.addColorStop(1, 'rgba(139,68,56,0)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center.x, center.y, swatchRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTravelSwatch(ctx, from, to, camera, yaw, pitch, radius) {
  if (from.token === to.token) return;
  const a = atlasPointToLocal(from.longitude, from.latitude);
  const b = atlasPointToLocal(to.longitude, to.latitude);
  const dot = clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
  const angle = Math.acos(dot);
  const steps = clamp(Math.ceil(angle * 44), 10, 40);

  ctx.save();
  ctx.strokeStyle = TRAVEL_COLOR;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let drawing = false;

  for (let index = 0; index <= steps; index += 1) {
    const local = slerpUnit(a, b, index / steps);
    const unit = rotatePoint(local, yaw, pitch);
    const projected = projectSpherePoint(unit, camera, radius + 0.038);
    if (!projected || !isVisible(unit, projected)) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      ctx.moveTo(projected.x, projected.y);
      drawing = true;
    } else {
      ctx.lineTo(projected.x, projected.y);
    }
  }

  ctx.stroke();
  ctx.restore();
}

function normalizePlace(place) {
  return String(place || '')
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPlaceToken(normalized, token) {
  return new RegExp(`(^|[,\\s])${escapeRegExp(token)}(?=,|\\s|$)`, 'i').test(normalized);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
