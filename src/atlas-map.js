// Canonical rendered antique atlas used by the genealogy globe. The current
// artwork is a deliberately low-contrast raster treatment wrapped in an
// 8192x4096 SVG canvas so the renderer keeps the same texture contract while we
// evaluate the art direction. The previously coded fictional map is preserved
// separately rather than being overwritten as a hidden repair layer.
export const ATLAS_TEXTURE_URL = 'assets/atlas-base.svg';
export const ATLAS_TEXTURE_SOURCE_PAGE = '';
export const ATLAS_TEXTURE_CREDIT = 'Bundled rendered antique atlas, screened as a low-contrast genealogy background';
export const ATLAS_TEXTURE_SHA1 = 'bundled-rendered-atlas-v1';

export const ATLAS_FALLBACK_TEXTURE_URL = 'assets/atlas-base-fallback.svg';
export const ATLAS_CODED_FALLBACK_TEXTURE_URL = 'assets/atlas-base-coded-fallback.svg';
// The illustrated atlas is already the complete visual treatment. Do not decode
// and upload the same 8192x4096 image a second time as a relief texture; a tiny
// neutral luminance texture keeps the shader contract without doubling atlas
// memory or startup work.
export const ATLAS_RELIEF_TEXTURE_URL = 'assets/atlas-relief-neutral.svg';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'assets/atlas-relief-neutral.svg';
export const ATLAS_RELIEF_SOURCE_PAGE = '';
export const ATLAS_RELIEF_CREDIT = 'Neutral relief texture; rendered atlas supplies all visible cartographic detail';

// Rectangular regional WMS layers remain disabled. The bundled artwork is the
// sole visual atlas layer, avoiding a sharp modern-photo patch over the faded
// historical treatment.
export const ATLAS_DETAIL_LEVELS = Object.freeze([]);
export const ATLAS_DETAIL_FADE_MS = 300;
export const ATLAS_DETAIL_SOURCE_PAGE = '';
export const ATLAS_DETAIL_CREDIT = 'Regional real-world detail disabled for bundled antique atlas mode';
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

// The temporary rendered atlas again resembles Earth. Use the central Upper
// Peninsula as the visual home orientation, while treating this artwork as
// decorative rather than geographically precise cartography.
export const ATLAS_HOME_ANCHOR = Object.freeze({
  latitude: 46.55,
  longitude: -87.45,
  label: 'Central Upper Peninsula home orientation',
});
