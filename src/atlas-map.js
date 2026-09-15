// The bundled atlas is a neutral parchment/graticule safety layer. It contains
// no simplified land or lake polygons, because those shapes become distracting
// area overlays when magnified on the genealogy sphere.
export const ATLAS_TEXTURE_URL = 'assets/atlas-base.svg';
export const ATLAS_TEXTURE_SOURCE_PAGE = '';
export const ATLAS_TEXTURE_CREDIT = 'Bundled Lazy Acres Ancestry parchment/graticule base';
export const ATLAS_TEXTURE_SHA1 = 'bundled-local-atlas';

// Keep one real geographic image active at every zoom level. Use Wikimedia's
// actual 2048px original rather than an invented thumbnail size so the relief
// layer cannot silently fail back to parchment.
export const ATLAS_RELIEF_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg/1280px-Solarsystemscope_texture_2k_earth_daymap.jpg';
export const ATLAS_RELIEF_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_2k_earth_daymap.jpg';
export const ATLAS_RELIEF_CREDIT = 'Solar System Scope, CC BY 4.0; based on NASA elevation and imagery data';

// Rectangular regional WMS layers are intentionally disabled. Their straight
// geographic bounds read as artificial area overlays on the curved sphere and
// could visibly change or disappear during zoom transitions. Regional detail
// can return later only with a sphere-aware feathered mask that has no visible
// rectangular footprint.
export const ATLAS_DETAIL_LEVELS = Object.freeze([]);
export const ATLAS_DETAIL_FADE_MS = 300;
export const ATLAS_DETAIL_SOURCE_PAGE = 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/';
export const ATLAS_DETAIL_CREDIT = 'NASA Earth Observatory Blue Marble: Next Generation, reserved for future sphere-masked regional detail';
const ATLAS_DETAIL_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export function atlasDetailLevel() {
  return null;
}

export function atlasDetailStrength() {
  return 0;
}

export function quantizeAtlasDetailCenter(center, level) {
  if (!center || !level) return null;
  const longitudeStep = Math.max(1, level.longitudeSpan * 0.22);
  const latitudeStep = Math.max(1, level.latitudeSpan * 0.22);
  return {
    longitude: normalizeLongitude(Math.round(center.longitude / longitudeStep) * longitudeStep),
    latitude: clamp(Math.round(center.latitude / latitudeStep) * latitudeStep, -78, 78),
  };
}

export function atlasDetailBounds(center, level) {
  if (!center || !level) return null;
  const quantized = quantizeAtlasDetailCenter(center, level);
  if (!quantized) return null;

  const latitudeSpan = level.latitudeSpan;
  const cosine = Math.max(0.62, Math.cos(quantized.latitude * Math.PI / 180));
  const longitudeSpan = Math.min(160, level.longitudeSpan / cosine);
  let south = quantized.latitude - latitudeSpan / 2;
  let north = quantized.latitude + latitudeSpan / 2;
  if (south < -85) {
    north += -85 - south;
    south = -85;
  }
  if (north > 85) {
    south -= north - 85;
    north = 85;
  }

  const west = quantized.longitude - longitudeSpan / 2;
  const east = quantized.longitude + longitudeSpan / 2;
  if (west < -180 || east > 180) return null;

  return {
    west,
    south,
    east,
    north,
    center: quantized,
    levelId: level.id,
  };
}

export function atlasDetailUrl(bounds, level) {
  if (!bounds || !level) return null;
  const longitudeSpan = bounds.east - bounds.west;
  const latitudeSpan = bounds.north - bounds.south;
  const width = clamp(Math.round(level.width), 1024, 2048);
  const height = clamp(Math.round(width * latitudeSpan / longitudeSpan), 768, 2048);
  const params = new URLSearchParams({
    version: '1.1.1',
    service: 'WMS',
    request: 'GetMap',
    format: 'image/jpeg',
    styles: '',
    srs: 'EPSG:4326',
    bbox: `${round(bounds.west)},${round(bounds.south)},${round(bounds.east)},${round(bounds.north)}`,
    height: String(height),
    width: String(width),
    layers: 'BlueMarble_NextGeneration',
  });
  return `${ATLAS_DETAIL_WMS}?${params.toString()}`;
}

export function atlasDetailKey(bounds, level) {
  if (!bounds || !level) return 'global';
  return [
    level.id,
    round(bounds.west),
    round(bounds.south),
    round(bounds.east),
    round(bounds.north),
  ].join(':');
}

function normalizeLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const ATLAS_HOME_ANCHOR = Object.freeze({
  latitude: 46.55,
  longitude: -87.45,
  label: 'Upper Peninsula, Michigan',
});