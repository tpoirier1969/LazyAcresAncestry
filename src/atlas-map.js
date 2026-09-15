// The low-resolution atlas is bundled with the application so the sphere can
// never degrade to a blank beige surface when a third-party image host is
// blocked or offline. Higher-resolution imagery remains progressive enhancement.
export const ATLAS_TEXTURE_URL = 'assets/atlas-base.svg';
export const ATLAS_TEXTURE_SOURCE_PAGE = '';
export const ATLAS_TEXTURE_CREDIT = 'Bundled Lazy Acres Ancestry schematic atlas; coastline reference derived from public-domain Natural Earth/Wikimedia material';
export const ATLAS_TEXTURE_SHA1 = 'bundled-local-atlas';

// The global relief layer is deliberately moderate resolution. Close views get
// their sharpness from geographically narrow regional requests, so giant
// whole-world textures do not monopolize GPU memory or compete with video decode.
export const ATLAS_RELIEF_TEXTURE_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg/2560px-Solarsystemscope_texture_8k_earth_daymap.jpg';
// If a device cannot support the relief texture size, fall back to the local
// atlas rather than another remote dependency.
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = ATLAS_TEXTURE_URL;
export const ATLAS_RELIEF_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_CREDIT = 'Solar System Scope, CC BY 4.0; based on NASA elevation and imagery data';

// Detail resolution rises as the geographic window narrows. The largest image
// is capped at 2048px because two regional textures coexist briefly during a
// cross-fade. That preserves sharp close views without a large GPU-memory spike.
export const ATLAS_DETAIL_LEVELS = Object.freeze([
  Object.freeze({ id: 'local', maxGap: 12, longitudeSpan: 30, latitudeSpan: 20, width: 2048 }),
  Object.freeze({ id: 'subregional', maxGap: 30, longitudeSpan: 48, latitudeSpan: 30, width: 1920 }),
  Object.freeze({ id: 'regional', maxGap: 70, longitudeSpan: 78, latitudeSpan: 46, width: 1792 }),
  Object.freeze({ id: 'continental', maxGap: 130, longitudeSpan: 120, latitudeSpan: 70, width: 1408 }),
]);
export const ATLAS_DETAIL_FADE_MS = 300;
export const ATLAS_DETAIL_SOURCE_PAGE = 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/';
export const ATLAS_DETAIL_CREDIT = 'NASA Earth Observatory Blue Marble: Next Generation, served by NASA GIBS';
const ATLAS_DETAIL_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export function atlasDetailLevel(cameraGap) {
  const gap = Number(cameraGap);
  if (!Number.isFinite(gap)) return null;
  return ATLAS_DETAIL_LEVELS.find(level => gap <= level.maxGap) || null;
}

export function atlasDetailStrength(cameraGap) {
  const gap = Number(cameraGap);
  if (!Number.isFinite(gap)) return 0;
  const fullDetailGap = ATLAS_DETAIL_LEVELS[ATLAS_DETAIL_LEVELS.length - 1].maxGap;
  const noDetailGap = fullDetailGap + 25;
  if (gap <= fullDetailGap) return 1;
  if (gap >= noDetailGap) return 0;
  const t = (gap - fullDetailGap) / (noDetailGap - fullDetailGap);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
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