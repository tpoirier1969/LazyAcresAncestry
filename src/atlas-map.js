export const ATLAS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_CREDIT = 'Gundan / mapswire.com, CC BY-SA 4.0';
export const ATLAS_TEXTURE_SHA1 = '2d069905a76447a5de0c11bb02628fb8d8323528';

// Prefer a 16K derivative of a 21,600 x 10,800 Plate Carree physical map on
// GPUs that can accept it. This materially improves Great Lakes and regional
// terrain detail at the close camera distances used by the genealogy atlas.
// If that derivative is unavailable or the GPU is smaller, the renderer falls
// back through the established 8K and 3840px sources.
export const ATLAS_RELIEF_TEXTURE_ULTRA_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Large_World_Map_unmodified.jpg/16384px-Large_World_Map_unmodified.jpg';
export const ATLAS_RELIEF_TEXTURE_ULTRA_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Large_World_Map_unmodified.jpg';
export const ATLAS_RELIEF_TEXTURE_ULTRA_CREDIT = 'MTBlack, CC BY-SA 4.0; NOAA bathymetry, NASA land data, Natural Earth III rivers/lakes';
export const ATLAS_RELIEF_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg/3840px-Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_CREDIT = 'Solar System Scope, CC BY 4.0; based on NASA elevation and imagery data';

// The home person is geographically anchored in the central Upper Peninsula.
// This is a visual home reference, not a claim that genealogy layout positions
// encode every person's birthplace or residence.
export const ATLAS_HOME_ANCHOR = Object.freeze({
  latitude: 46.55,
  longitude: -87.45,
  label: 'Upper Peninsula, Michigan',
});
