// Canonical fictional antique atlas used by the genealogy globe. It is a large
// vector asset, so it can be rasterized sharply for larger future spheres
// without tying the family tree to recognizable modern geography.
export const ATLAS_TEXTURE_URL = 'assets/atlas-base.svg';
export const ATLAS_TEXTURE_SOURCE_PAGE = '';
export const ATLAS_TEXTURE_CREDIT = 'Bundled Lazy Acres Ancestry fictional antique atlas';
export const ATLAS_TEXTURE_SHA1 = 'bundled-fictional-atlas-v1';

// Keep the prior neutral parchment/graticule map in the repository as a manual
// fallback, but use the fictional atlas itself for the detail sampler so real
// Earth imagery cannot bleed through and make the invented geography look
// recognizable or soft-focus.
export const ATLAS_FALLBACK_TEXTURE_URL = 'assets/atlas-base-fallback.svg';
export const ATLAS_RELIEF_TEXTURE_URL = 'assets/atlas-base.svg';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'assets/atlas-base.svg';
export const ATLAS_RELIEF_SOURCE_PAGE = '';
export const ATLAS_RELIEF_CREDIT = 'Bundled fictional atlas detail layer';

// Rectangular regional WMS layers remain disabled. Their straight geographic
// bounds are inappropriate for a fictional atlas and read as artificial areas
// on the curved sphere.
export const ATLAS_DETAIL_LEVELS = Object.freeze([]);
export const ATLAS_DETAIL_FADE_MS = 300;
export const ATLAS_DETAIL_SOURCE_PAGE = '';
export const ATLAS_DETAIL_CREDIT = 'Regional real-world detail disabled for fictional atlas mode';
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

// This anchor is now only the default orientation of the fictional sphere; it
// no longer claims to place the home person over a real-world map location.
export const ATLAS_HOME_ANCHOR = Object.freeze({
  latitude: 12,
  longitude: -28,
  label: 'Fictional atlas home orientation',
});
